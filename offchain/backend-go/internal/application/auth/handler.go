// Package auth — HTTP handlers for core authentication endpoints.
//
// File layout:
//
//	handler.go         — Handler struct, RegisterRoutes, login flow (challenge → login → 2fa complete → refresh → logout)
//	handler_session.go — Session listing and revocation
//	handler_2fa.go     — TOTP setup, enable, and disable
package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	_ "github.com/vndc/backend/internal/models" // swagger model registration
	apperr "github.com/vndc/backend/pkg/errors"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	httpreq "github.com/vndc/backend/pkg/http/request"
	"github.com/vndc/backend/pkg/logger"
)

// Handler exposes authentication HTTP endpoints spanning SIWE login, token rotation, logout, session control, and 2FA lifecycle.
// It forms the transport boundary of the auth module by binding requests, reading identity from middleware, and shaping responses.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the auth HTTP handler with a logger scoped to authentication transport events.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("auth_handler")}
}

// RegisterRoutes mounts public auth endpoints, rate-limits sensitive unauthenticated flows, and protects session-bound actions.
// Grouping is used to make access policy visible at the route-registration layer instead of scattering it per handler.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker) {
	auth := r.Group("/auth")
	{
		// Strict rate limiting on sensitive unauthenticated endpoints (5 req/min per IP).
		auth.GET("/challenge", middleware.StrictRateLimit(), h.GetChallenge)
		auth.POST("/login", middleware.StrictRateLimit(), h.Login)
		auth.POST("/2fa/complete", middleware.StrictRateLimit(), h.Complete2FA)
		auth.POST("/refresh", h.Refresh)

		protected := auth.Group("")
		protected.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
		{
			protected.POST("/logout", h.Logout)
			protected.POST("/logout-all", h.LogoutAll)
			protected.GET("/sessions", h.ListSessions)
			protected.DELETE("/sessions/:id", h.RevokeSession)
			protected.POST("/2fa/setup", h.Setup2FA)
			protected.POST("/2fa/enable", h.Enable2FA)
			protected.POST("/2fa/disable", h.Disable2FA)
		}
	}
}

// GetChallenge handles issuance of the SIWE challenge that starts the wallet-authentication flow.
// The handler performs the minimal required query validation before delegating nonce generation to the service.
// GetChallenge godoc
//
//	@Summary      Request a SIWE sign-in challenge
//	@Description  Generates a random nonce and returns a pre-formatted EIP-191 message
//	@Description  the wallet must sign. The nonce expires in 5 minutes.
//	@Description  **Step 1** of the login flow — call before POST /auth/login.
//	@Tags         Auth
//	@Produce      json
//	@Param        wallet  query     string  true  "Checksummed Ethereum wallet address"  example(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045)
//	@Success      200     {object}  models.ChallengeResponse
//	@Failure      400     {object}  models.ErrorResponse  "wallet query param is missing"
//	@Failure      500     {object}  models.ErrorResponse  "Internal server error"
//	@Router       /auth/challenge [get]
func (h *Handler) GetChallenge(c *gin.Context) {
	wallet := c.Query("wallet")
	if wallet == "" {
		h.log.Warn("challenge_missing_wallet", zap.String("msg", "wallet query param missing"))
		apihttp.Fail(c, apperr.New(apperr.ErrCodeBadRequest, "wallet query param required"))
		return
	}
	h.log.Debug("challenge_requested", zap.String("wallet", wallet))

	resp, err := h.svc.GetChallenge(c.Request.Context(), wallet)
	if err != nil {
		h.log.Error("challenge_error", zap.String("wallet", wallet), zap.Error(err))
		apihttp.Fail(c, err)
		return
	}
	h.log.Debug("challenge_issued", zap.String("wallet", wallet), zap.String("nonce", resp.Nonce))
	apihttp.OK(c, resp)
}

// Login handles signature-based wallet authentication and the first step of the 2FA-aware login flow.
// Depending on the service result, it either returns final tokens immediately or a temporary token for 2FA completion.
// Login godoc
//
//	@Summary      Sign in with Ethereum wallet (SIWE)
//	@Description  Verifies the EIP-191 personal_sign signature against the challenge nonce.
//	@Description  Returns a full JWT pair **or** a temp_token when 2FA is enabled.
//	@Description
//	@Description  | Case | Response |
//	@Description  |------|----------|
//	@Description  | 2FA disabled | `LoginResponse` with `access_token` + `refresh_token` |
//	@Description  | 2FA enabled  | `Login2FAResponse` with `requires_2fa: true` + `temp_token` → call `/auth/2fa/complete` |
//	@Tags         Auth
//	@Accept       json
//	@Produce      json
//	@Param        body  body      models.LoginRequest   true  "Wallet address + EIP-191 signature"
//	@Success      200   {object}  models.LoginResponse        "JWT pair (2FA not required)"
//	@Success      200   {object}  models.Login2FAResponse     "2FA required — use temp_token"
//	@Failure      400   {object}  models.ErrorResponse        "Missing or invalid fields"
//	@Failure      401   {object}  models.ErrorResponse        "Signature mismatch / expired nonce / locked account"
//	@Failure      500   {object}  models.ErrorResponse        "Internal server error"
//	@Router       /auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	req, ok := apihttp.Bind[LoginRequest](c)
	if !ok {
		h.log.Warn("login_invalid_request", zap.String("msg", "Invalid login request body"))
		return
	}
	httpreq.Inject(c, &req.Meta)

	h.log.Debug("login_attempt", zap.String("wallet", req.Wallet), zap.Int("sig_len", len(req.Signature)), zap.Int("msg_len", len(req.Message)))

	result, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		h.log.Warn("login_failed", zap.String("wallet", req.Wallet), zap.Error(err))
		apihttp.Fail(c, err)
		return
	}

	if result.Requires2FA {
		h.log.Info("login_2fa_required", zap.String("wallet", req.Wallet))
		apihttp.OK(c, &gin.H{
			"requires_2fa": true,
			"temp_token":   result.TempToken,
			"message":      "TOTP code required — call /auth/2fa/complete",
		})
		return
	}
	h.log.Info("login_success", zap.String("wallet", req.Wallet))
	apihttp.OK(c, result.TokenPair)
}

// Complete2FA handles the second step of the login flow when the account requires TOTP or backup-code confirmation.
// Transport metadata is injected so the resulting session and audit events carry client context.
// Complete2FA godoc
//
//	@Summary      Complete two-factor authentication
//	@Description  Verifies the TOTP code (6 digits) or a backup code (8 chars) and issues the full JWT pair.
//	@Description  Requires the `temp_token` returned by POST /auth/login when `requires_2fa` is true.
//	@Tags         Auth
//	@Accept       json
//	@Produce      json
//	@Param        body  body      models.Complete2FARequest  true  "Temp token + TOTP or backup code"
//	@Success      200   {object}  models.LoginResponse             "Full JWT pair issued"
//	@Failure      400   {object}  models.ErrorResponse             "Missing fields"
//	@Failure      401   {object}  models.ErrorResponse             "Expired session or wrong code"
//	@Failure      500   {object}  models.ErrorResponse             "Internal server error"
//	@Router       /auth/2fa/complete [post]
func (h *Handler) Complete2FA(c *gin.Context) {
	req, ok := apihttp.Bind[Complete2FARequest](c)
	if !ok {
		return
	}
	httpreq.Inject(c, &req.Meta)

	pair, err := h.svc.Complete2FA(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, pair)
}

// Refresh handles refresh-token rotation and returns a newly minted token pair.
// The request body contains the opaque refresh token while client metadata is injected from the HTTP request.
// Refresh godoc
//
//	@Summary      Rotate the JWT token pair
//	@Description  Exchanges a valid refresh token for a new access + refresh token pair.
//	@Description  The old refresh token is **immediately invalidated** (rotation). Refresh tokens are valid for 7 days.
//	@Tags         Auth
//	@Accept       json
//	@Produce      json
//	@Param        body  body      models.RefreshRequest  true  "Opaque refresh token"
//	@Success      200   {object}  models.LoginResponse        "New JWT pair"
//	@Failure      400   {object}  models.ErrorResponse        "Missing body"
//	@Failure      401   {object}  models.ErrorResponse        "Invalid / expired / already-rotated refresh token"
//	@Failure      500   {object}  models.ErrorResponse        "Internal server error"
//	@Router       /auth/refresh [post]
func (h *Handler) Refresh(c *gin.Context) {
	req, ok := apihttp.Bind[RefreshRequest](c)
	if !ok {
		return
	}
	httpreq.Inject(c, &req.Meta)

	pair, err := h.svc.Refresh(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, pair)
}

// Logout handles revocation of only the current authenticated session.
// It delegates to the shared logout helper so single-session and all-session revocation stay behaviorally aligned.
// Logout godoc
//
//	@Summary      Log out current session
//	@Description  Blacklists the current access token in Redis and revokes the active session.
//	@Description  The token is rejected on subsequent requests even before its natural expiry.
//	@Tags         Auth
//	@Produce      json
//	@Security     BearerAuth
//	@Success      204  "Session revoked — no content"
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /auth/logout [post]
func (h *Handler) Logout(c *gin.Context) {
	h.doLogout(c, false)
}

// LogoutAll handles revocation of all active sessions belonging to the authenticated user.
// It reuses the same helper path as Logout but sets the all-sessions intent flag.
// LogoutAll godoc
//
//	@Summary      Log out all sessions
//	@Description  Blacklists the current access token and revokes **all** active sessions for this user.
//	@Description  Use this when a device is lost or a security breach is suspected.
//	@Tags         Auth
//	@Produce      json
//	@Security     BearerAuth
//	@Success      204  "All sessions revoked — no content"
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /auth/logout-all [post]
func (h *Handler) LogoutAll(c *gin.Context) {
	h.doLogout(c, true)
}

// doLogout is the shared helper behind current-session and all-session logout endpoints.
// It assembles logout context from middleware claims and applies a fixed blacklist TTL for the current access token.
func (h *Handler) doLogout(c *gin.Context, all bool) {
	req := &LogoutRequest{
		JWTID:     middleware.JWTID(c),
		SessionID: middleware.SessionID(c),
		UserID:    middleware.UserID(c),
		Wallet:    middleware.WalletAddress(c),
		LogoutAll: all,
	}
	httpreq.Inject(c, &req.Meta)

	const remainingTTL = 20 * time.Minute
	if err := h.svc.Logout(c.Request.Context(), req, remainingTTL); err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

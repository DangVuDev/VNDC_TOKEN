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

	_ "github.com/vndc/backend/internal/models" // swagger model registration
	apperr "github.com/vndc/backend/pkg/errors"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	httpreq "github.com/vndc/backend/pkg/http/request"
	"github.com/vndc/backend/pkg/logger"
)

// Handler exposes all authentication HTTP endpoints.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs an auth Handler.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("auth_handler")}
}

// RegisterRoutes mounts all auth routes on the given router group.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker) {
	auth := r.Group("/auth")
	{
		auth.GET("/challenge", h.GetChallenge)
		auth.POST("/login", h.Login)
		auth.POST("/2fa/complete", h.Complete2FA)
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
		apihttp.Fail(c, apperr.New(apperr.ErrCodeBadRequest, "wallet query param required"))
		return
	}
	resp, err := h.svc.GetChallenge(c.Request.Context(), wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

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
		return
	}
	httpreq.Inject(c, &req.Meta)

	result, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	if result.Requires2FA {
		apihttp.OK(c, &gin.H{
			"requires_2fa": true,
			"temp_token":   result.TempToken,
			"message":      "TOTP code required — call /auth/2fa/complete",
		})
		return
	}
	apihttp.OK(c, result.TokenPair)
}

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

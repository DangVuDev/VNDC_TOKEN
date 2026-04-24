// Package auth — TOTP 2FA setup, enable, and disable handlers.
package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"

	_ "github.com/vndc/backend/internal/models" // swagger model registration
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	httpreq "github.com/vndc/backend/pkg/http/request"
)

// Setup2FA godoc
//
//	@Summary      Generate a new TOTP secret
//	@Description  Creates a TOTP secret and 8 one-time backup codes for the authenticated user.
//	@Description  **2FA is NOT active until the user calls POST /auth/2fa/enable** with a valid code.
//	@Description
//	@Description  The `otp_auth_uri` field should be encoded as a QR code for the user to scan
//	@Description  with an authenticator app (Google Authenticator, Authy, etc.).
//	@Description
//	@Description  ⚠️ Backup codes are shown **once** — the user must store them securely.
//	@Tags         Auth
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.Setup2FAResponse
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      409  {object}  models.ErrorResponse  "2FA is already enabled"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /auth/2fa/setup [post]
func (h *Handler) Setup2FA(c *gin.Context) {
	userID := middleware.UserID(c)
	resp, err := h.svc.Setup2FA(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// Enable2FA godoc
//
//	@Summary      Activate two-factor authentication
//	@Description  Confirms the TOTP secret by verifying a live authenticator code, then enables 2FA on the account.
//	@Description  Must be called after POST /auth/2fa/setup.
//	@Tags         Auth
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.Enable2FARequest  true  "Current 6-digit TOTP code"
//	@Success      200   {object}  models.MessageResponse        "2FA enabled successfully"
//	@Failure      400   {object}  models.ErrorResponse          "setup not called / missing code"
//	@Failure      401   {object}  models.ErrorResponse          "Invalid TOTP code"
//	@Failure      500   {object}  models.ErrorResponse          "Internal server error"
//	@Router       /auth/2fa/enable [post]
func (h *Handler) Enable2FA(c *gin.Context) {
	req, ok := apihttp.Bind[Enable2FARequest](c)
	if !ok {
		return
	}
	req.UserID = middleware.UserID(c)
	httpreq.Inject(c, &req.Meta)

	if err := h.svc.Enable2FA(c.Request.Context(), req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "2FA enabled successfully"})
}

// Disable2FA godoc
//
//	@Summary      Deactivate two-factor authentication
//	@Description  Disables TOTP on the account after verifying the current code or a backup code.
//	@Description  This also clears the TOTP secret and all remaining backup codes.
//	@Tags         Auth
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.Disable2FARequest  true  "6-digit TOTP code or 8-char backup code"
//	@Success      200   {object}  models.MessageResponse         "2FA disabled successfully"
//	@Failure      400   {object}  models.ErrorResponse           "2FA is not enabled"
//	@Failure      401   {object}  models.ErrorResponse           "Invalid code"
//	@Failure      500   {object}  models.ErrorResponse           "Internal server error"
//	@Router       /auth/2fa/disable [post]
func (h *Handler) Disable2FA(c *gin.Context) {
	req, ok := apihttp.Bind[Disable2FARequest](c)
	if !ok {
		return
	}
	req.UserID = middleware.UserID(c)
	httpreq.Inject(c, &req.Meta)

	if err := h.svc.Disable2FA(c.Request.Context(), req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "2FA disabled successfully"})
}

// Package user — HTTP handlers for self-service profile endpoints.
//
// File layout:
//
//	handler.go       — Handler struct, RegisterRoutes, self-service handlers
//	handler_admin.go — Admin-only user management handlers
package user

import (
	"github.com/gin-gonic/gin"

	_ "github.com/vndc/backend/internal/models" // swagger model registration
	apperr "github.com/vndc/backend/pkg/errors"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler exposes all user-management HTTP endpoints.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs a user Handler.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("user_handler")}
}

// RegisterRoutes mounts all user routes.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker) {
	users := r.Group("/users")
	users.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
	{
		me := users.Group("/me")
		{
			me.GET("", h.GetMe)
			me.PATCH("", h.UpdateProfile)
			me.PUT("/email", h.RequestEmailChange)
			me.POST("/email/verify", h.VerifyEmail)
			me.POST("/phone/request", h.RequestPhoneVerification)
			me.POST("/phone/verify", h.VerifyPhone)
			me.GET("/preferences", h.GetPreferences)
			me.PUT("/preferences", h.UpdatePreferences)
			me.GET("/referral", h.GetReferralInfo)
			me.GET("/referral/list", h.ListReferrals)
			me.POST("/2fa/backup-codes", h.GenerateBackupCodes)
			me.POST("/deactivate", h.DeactivateAccount)
			me.GET("/audit-logs", h.GetAuditLogs)
			me.POST("/kyc", h.SubmitKYC)
		}

		admin := users.Group("")
		admin.Use(middleware.RequireRole("ADMIN"))
		{
			admin.GET("", h.ListUsers)
			admin.GET("/:id", h.GetUser)
			admin.POST("/:id/suspend", h.SuspendUser)
			admin.POST("/:id/unsuspend", h.UnsuspendUser)
			admin.POST("/:id/roles", h.AssignRole)
			admin.DELETE("/:id/roles/:role", h.RemoveRole)
			admin.POST("/:id/kyc/approve", h.ApproveKYC)
		}
	}
}

// GetMe godoc
//
//	@Summary      Get my profile
//	@Description  Returns the full profile of the authenticated user, including KYC status,
//	@Description  roles, login statistics, and custom metadata.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.UserResponse
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      404  {object}  models.ErrorResponse  "User not found (should not happen in practice)"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /users/me [get]
func (h *Handler) GetMe(c *gin.Context) {
	userID := middleware.UserID(c)
	user, err := h.svc.GetMe(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, user)
}

// UpdateProfile godoc
//
//	@Summary      Update my profile
//	@Description  Partially updates the authenticated user's profile. All fields are optional —
//	@Description  only provided (non-null) fields are applied. Metadata is **deep-merged** (not replaced).
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.UpdateProfileRequest  true  "Fields to update (all optional)"
//	@Success      200   {object}  models.UserResponse               "Updated profile"
//	@Failure      400   {object}  models.ErrorResponse              "Validation error"
//	@Failure      401   {object}  models.ErrorResponse              "Missing or invalid Bearer token"
//	@Failure      409   {object}  models.ErrorResponse              "Username already taken"
//	@Failure      500   {object}  models.ErrorResponse              "Internal server error"
//	@Router       /users/me [patch]
func (h *Handler) UpdateProfile(c *gin.Context) {
	req, ok := apihttp.Bind[UpdateProfileRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	user, err := h.svc.UpdateProfile(c.Request.Context(), userID, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, user)
}

// RequestEmailChange godoc
//
//	@Summary      Request an email address change
//	@Description  Updates the account's email address and marks it **unverified** until the link is clicked.
//	@Description  A verification email is dispatched to the new address (not yet implemented in this release).
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.RequestEmailChangeRequest  true  "New email address"
//	@Success      200   {object}  models.MessageResponse                 "Request accepted"
//	@Failure      400   {object}  models.ErrorResponse                   "Invalid email format"
//	@Failure      401   {object}  models.ErrorResponse                   "Missing or invalid Bearer token"
//	@Failure      409   {object}  models.ErrorResponse                   "Email already registered"
//	@Failure      500   {object}  models.ErrorResponse                   "Internal server error"
//	@Router       /users/me/email [put]
func (h *Handler) RequestEmailChange(c *gin.Context) {
	req, ok := apihttp.Bind[EmailChangeRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.RequestEmailChange(c.Request.Context(), userID, req.Email, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Email update requested; verification required"})
}

// GetAuditLogs godoc
//
//	@Summary      Get my security audit trail
//	@Description  Returns a paginated list of security events for the authenticated user:
//	@Description  logins, logouts, token refreshes, 2FA changes, profile updates, and KYC submissions.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        page       query     int  false  "Page number (default: 1)"           example(1)
//	@Param        page_size  query     int  false  "Items per page (default: 20, max: 100)"  example(20)
//	@Success      200        {object}  models.AuditLogListResponse
//	@Failure      401        {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      500        {object}  models.ErrorResponse  "Internal server error"
//	@Router       /users/me/audit-logs [get]
func (h *Handler) GetAuditLogs(c *gin.Context) {
	req, ok := apihttp.Bind[pagination.Request](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	logs, total, err := h.svc.GetAuditLogs(c.Request.Context(), userID, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, logs, total, req.Page, req.PageSize)
}

// SubmitKYC godoc
//
//	@Summary      Submit a KYC document
//	@Description  Submits a KYC document for identity verification. The `document_ref` is an encrypted
//	@Description  storage reference returned by the secure upload endpoint (not in this release).
//	@Description  After submission, `kyc_status` changes to `PENDING` and an admin will review it.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.SubmitKYCRequest  true  "Document type + encrypted storage ref"
//	@Success      200   {object}  models.MessageResponse        "Document submitted for review"
//	@Failure      400   {object}  models.ErrorResponse          "Invalid document type"
//	@Failure      401   {object}  models.ErrorResponse          "Missing or invalid Bearer token"
//	@Failure      404   {object}  models.ErrorResponse          "User not found"
//	@Failure      500   {object}  models.ErrorResponse          "Internal server error"
//	@Router       /users/me/kyc [post]
func (h *Handler) SubmitKYC(c *gin.Context) {
	req, ok := apihttp.Bind[SubmitKYCRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.SubmitKYCDocument(c.Request.Context(), userID, req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "KYC document submitted; awaiting review"})
}

// ─── EMAIL & PHONE VERIFICATION ─────────────────────────────────────────

// VerifyEmail godoc
//
//	@Summary      Verify email address
//	@Description  Verifies email ownership using a token sent to the email address.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.VerifyEmailRequest  true  "Verification token"
//	@Success      200   {object}  models.MessageResponse          "Email verified successfully"
//	@Failure      400   {object}  models.ErrorResponse           "Invalid or expired token"
//	@Failure      401   {object}  models.ErrorResponse           "Missing or invalid Bearer token"
//	@Failure      404   {object}  models.ErrorResponse           "User not found"
//	@Router       /users/me/email/verify [post]
func (h *Handler) VerifyEmail(c *gin.Context) {
	req, ok := apihttp.Bind[VerifyEmailRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.VerifyEmail(c.Request.Context(), userID, req.Token); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Email verified successfully"})
}

// RequestPhoneVerification godoc
//
//	@Summary      Request phone verification OTP
//	@Description  Sends an OTP code to the specified phone number for verification.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.RequestPhoneVerificationRequest  true  "Phone number in E.164 format"
//	@Success      200   {object}  models.MessageResponse                        "OTP sent to phone"
//	@Failure      400   {object}  models.ErrorResponse                         "Invalid phone format"
//	@Failure      401   {object}  models.ErrorResponse                         "Missing or invalid Bearer token"
//	@Router       /users/me/phone/request [post]
func (h *Handler) RequestPhoneVerification(c *gin.Context) {
	req, ok := apihttp.Bind[RequestPhoneVerificationRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.RequestPhoneVerification(c.Request.Context(), userID, req.Phone); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "OTP sent to phone number"})
}

// VerifyPhone godoc
//
//	@Summary      Verify phone number
//	@Description  Verifies phone ownership using the 6-digit OTP code sent to the phone.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.VerifyPhoneRequest  true  "6-digit OTP code"
//	@Success      200   {object}  models.MessageResponse          "Phone verified successfully"
//	@Failure      400   {object}  models.ErrorResponse           "Invalid or expired OTP"
//	@Failure      401   {object}  models.ErrorResponse           "Missing or invalid Bearer token"
//	@Router       /users/me/phone/verify [post]
func (h *Handler) VerifyPhone(c *gin.Context) {
	req, ok := apihttp.Bind[VerifyPhoneRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.VerifyPhone(c.Request.Context(), userID, req.Code); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Phone verified successfully"})
}

// ─── USER PREFERENCES ───────────────────────────────────────────────────

// GetPreferences godoc
//
//	@Summary      Get user preferences
//	@Description  Returns the user's notification and privacy preferences.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.UserPreferencesResponse
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      404  {object}  models.ErrorResponse  "User not found"
//	@Router       /users/me/preferences [get]
func (h *Handler) GetPreferences(c *gin.Context) {
	userID := middleware.UserID(c)
	prefs, err := h.svc.GetPreferences(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, prefs)
}

// UpdatePreferences godoc
//
//	@Summary      Update user preferences
//	@Description  Updates notification and privacy preferences. Only provided fields are updated.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.UserPreferencesRequest  true  "Preferences to update"
//	@Success      200   {object}  models.UserPreferencesResponse
//	@Failure      400   {object}  models.ErrorResponse           "Invalid preferences"
//	@Failure      401   {object}  models.ErrorResponse           "Missing or invalid Bearer token"
//	@Router       /users/me/preferences [put]
func (h *Handler) UpdatePreferences(c *gin.Context) {
	req, ok := apihttp.Bind[UserPreferencesRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	prefs, err := h.svc.UpdatePreferences(c.Request.Context(), userID, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, prefs)
}

// ─── REFERRAL SYSTEM ────────────────────────────────────────────────────

// GetReferralInfo godoc
//
//	@Summary      Get referral information
//	@Description  Returns the user's referral code, count, and accumulated rewards.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.ReferralInfoResponse
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      404  {object}  models.ErrorResponse  "User not found"
//	@Router       /users/me/referral [get]
func (h *Handler) GetReferralInfo(c *gin.Context) {
	userID := middleware.UserID(c)
	info, err := h.svc.GetReferralInfo(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, info)
}

// ListReferrals godoc
//
//	@Summary      List referred users
//	@Description  Returns a paginated list of users referred by the authenticated user.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        page      query     int  false  "Page number"     example(1)
//	@Param        page_size query     int  false  "Items per page"  example(20)
//	@Success      200       {object}  models.ReferralListResponse
//	@Failure      401       {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Router       /users/me/referral/list [get]
func (h *Handler) ListReferrals(c *gin.Context) {
	req, ok := apihttp.Bind[pagination.Request](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	referrals, total, err := h.svc.ListReferrals(c.Request.Context(), userID, req.Page, req.PageSize)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, referrals, total, req.Page, req.PageSize)
}

// ─── 2FA BACKUP CODES ───────────────────────────────────────────────────

// GenerateBackupCodes godoc
//
//	@Summary      Generate new 2FA backup codes
//	@Description  Generates a new set of 10 backup codes for 2FA recovery.
//	@Description  User must save these securely; they cannot be retrieved again.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.BackupCodesResponse
//	@Failure      400  {object}  models.ErrorResponse  "2FA not enabled"
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /users/me/2fa/backup-codes [post]
func (h *Handler) GenerateBackupCodes(c *gin.Context) {
	userID := middleware.UserID(c)
	codes, err := h.svc.GenerateBackupCodes(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, codes)
}

// ─── ACCOUNT DEACTIVATION ───────────────────────────────────────────────

// DeactivateAccount godoc
//
//	@Summary      Deactivate account
//	@Description  Soft-deletes the account. All data is retained but the account is marked as deactivated.
//	@Description  User can request reactivation by signing in with their wallet again.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.DeactivateAccountRequest  false  "Optional deactivation reason"
//	@Success      200   {object}  models.MessageResponse                  "Account deactivated"
//	@Failure      401   {object}  models.ErrorResponse                    "Missing or invalid Bearer token"
//	@Failure      500   {object}  models.ErrorResponse                    "Internal server error"
//	@Router       /users/me/deactivate [post]
func (h *Handler) DeactivateAccount(c *gin.Context) {
	req, ok := apihttp.Bind[DeactivateAccountRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.DeactivateAccount(c.Request.Context(), userID, req.Reason, c.ClientIP()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Account deactivated successfully"})
}

// requireID extracts a required path parameter or returns an error response.
func requireID(c *gin.Context, param string) (string, bool) {
	id, ok := apihttp.PathParam(c, param)
	if !ok {
		apihttp.Fail(c, apperr.New(apperr.ErrCodeBadRequest, param+" path parameter is required"))
		return "", false
	}
	return id, true
}

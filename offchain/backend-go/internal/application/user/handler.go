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
	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler exposes HTTP endpoints for self-service account management and selected admin-facing user workflows.
// It is responsible for request binding, identity extraction from middleware, and shaping service results into HTTP responses.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the user HTTP handler with a module-scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("user_handler")}
}

// RegisterRoutes wires all authenticated user routes and nested admin moderation routes for the user module.
// The route layout separates self-service endpoints under /me from privileged operations guarded by admin-role middleware.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	users := r.Group("/users")
	users.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
	{
		// Public lookup (still requires auth to prevent wallet enumeration)
		users.GET("/lookup", h.LookupUser)

		me := users.Group("/me")
		{
			me.GET("", h.GetMe)
			me.PUT("", h.UpdateProfile)
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

			// KYC endpoints
			me.GET("/kyc/status", h.GetKYCLevel1Status)
			me.POST("/kyc/level1", h.SubmitKYCLevel1)
			me.POST("/kyc/level2", middleware.RequireKYCLevel(1, userRepo), h.SubmitKYCLevel2)
			me.POST("/kyc/upload", h.UploadKYCDocument)
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
			// Level 2 KYC submission review
			admin.GET("/kyc/submissions", h.ListKYCSubmissions)
			admin.POST("/kyc/submissions/:submissionId/review", h.ReviewKYCSubmission)
		}
	}
}

// GetMe handles retrieval of the authenticated user's full profile.
// User identity is taken exclusively from middleware context rather than any client-supplied parameter.
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

// LookupUser handles authenticated public-profile lookup by username or wallet address.
// Requiring prior authentication reduces anonymous enumeration risk while still supporting social lookup scenarios.
// LookupUser returns minimal public info for a user identified by username or wallet address.
//
//	@Summary      Lookup user by username or wallet
//	@Description  Returns public-safe user info (wallet, username, full_name, kyc_level).
//	@Description  Requires auth to prevent enumeration attacks.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        username  query  string  false  "Username (student ID) to look up"
//	@Param        wallet    query  string  false  "Wallet address to look up"
//	@Success      200  {object}  models.PublicUserInfo
//	@Failure      400  {object}  models.ErrorResponse  "Missing query param"
//	@Failure      404  {object}  models.ErrorResponse  "User not found"
//	@Router       /users/lookup [get]
func (h *Handler) LookupUser(c *gin.Context) {
	username := c.Query("username")
	wallet := c.Query("wallet")
	info, err := h.svc.LookupPublicUser(c.Request.Context(), username, wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, info)
}

// UpdateProfile handles partial updates to the authenticated user's profile data.
// It binds only the provided fields and forwards transport metadata such as IP and user agent for auditing.
// @Summary      Update my profile
// @Description  Partially updates the authenticated user's profile. All fields are optional —
// @Description  only provided (non-null) fields are applied. Metadata is **deep-merged** (not replaced).
// @Tags         Users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      models.UpdateProfileRequest  true  "Fields to update (all optional)"
// @Success      200   {object}  models.UserResponse               "Updated profile"
// @Failure      400   {object}  models.ErrorResponse              "Validation error"
// @Failure      401   {object}  models.ErrorResponse              "Missing or invalid Bearer token"
// @Failure      409   {object}  models.ErrorResponse              "Username already taken"
// @Failure      500   {object}  models.ErrorResponse              "Internal server error"
// @Router       /users/me [put]
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

// RequestEmailChange handles the authenticated user's request to change their account email.
// The handler captures request metadata so the underlying service can write a security-relevant audit entry.
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

// GetAuditLogs handles retrieval of the caller's own audit history.
// Pagination parameters are bound at the transport layer before delegating the lookup to the service.
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
	req, ok := apihttp.BindQuery[pagination.Request](c)
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

// GetKYCLevel1Status handles the guided-check endpoint that reports whether Level 1 KYC prerequisites are satisfied.
// This gives the frontend a compact readiness object without exposing broader user internals.
// GetKYCLevel1Status returns the KYC Level 1 requirements status for the authenticated user.
//
//	@Summary      Get KYC Level 1 status
//	@Description  Returns which requirements (username, email, phone) are met for KYC Level 1.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.KYCLevel1StatusResponse
//	@Failure      401  {object}  models.ErrorResponse
//	@Router       /users/me/kyc/status [get]
func (h *Handler) GetKYCLevel1Status(c *gin.Context) {
	userID := middleware.UserID(c)
	status, err := h.svc.CheckKYCLevel1Status(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, status)
}

// SubmitKYCLevel1 handles the self-service request to finalize automatic KYC Level 1 approval.
// The service enforces readiness checks; the handler simply supplies identity and audit context.
// SubmitKYCLevel1 triggers auto-approval of KYC Level 1.
//
//	@Summary      Submit KYC Level 1 (auto-approve)
//	@Description  Automatically grants KYC Level 1 when username, verified email, and verified phone are all set.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.MessageResponse  "KYC Level 1 granted"
//	@Failure      400  {object}  models.ErrorResponse    "Requirements not met"
//	@Failure      409  {object}  models.ErrorResponse    "Already at Level 1 or higher"
//	@Router       /users/me/kyc/level1 [post]
func (h *Handler) SubmitKYCLevel1(c *gin.Context) {
	userID := middleware.UserID(c)
	if err := h.svc.SubmitKYCLevel1(c.Request.Context(), userID, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "KYC Level 1 đã được xác nhận thành công!"})
}

// SubmitKYCLevel2 handles creation of a manual-review KYC Level 2 submission.
// The route is already guarded by middleware requiring at least Level 1, so the request reaches the service from a valid baseline.
// SubmitKYCLevel2 submits a Level 2 KYC request for admin review.
//
//	@Summary      Submit KYC Level 2
//	@Description  Submits student card and selfie URLs for admin-reviewed Level 2 KYC. Requires KYC Level 1 first.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.SubmitKYCLevel2Request  true  "Document URLs"
//	@Success      200   {object}  models.MessageResponse
//	@Failure      400   {object}  models.ErrorResponse
//	@Failure      409   {object}  models.ErrorResponse  "Already at Level 2"
//	@Router       /users/me/kyc/level2 [post]
func (h *Handler) SubmitKYCLevel2(c *gin.Context) {
	req, ok := apihttp.Bind[SubmitKYCLevel2Request](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.SubmitKYCLevel2(c.Request.Context(), userID, req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Hồ sơ KYC Level 2 đã được gửi. Vui lòng chờ admin xét duyệt."})
}

// UploadKYCDocument handles the temporary demo upload endpoint used to simulate KYC document storage.
// It returns a generated URL rather than persisting binary content in this development-stage implementation.
// UploadKYCDocument simulates a document upload and returns a demo URL.
//
//	@Summary      Upload KYC document (demo)
//	@Description  Demo endpoint that returns a URL for the uploaded document. In production this stores to S3/IPFS.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.KYCUploadDemoRequest  true  "File name"
//	@Success      200   {object}  models.KYCUploadResponse
//	@Router       /users/me/kyc/upload [post]
func (h *Handler) UploadKYCDocument(c *gin.Context) {
	req, ok := apihttp.Bind[KYCUploadDemoRequest](c)
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	url, err := h.svc.DemoUploadKYCDocument(c.Request.Context(), userID, req.FileName)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "url": url, "message": "Demo URL generated"})
}

// ListKYCSubmissions handles the admin review queue for Level 2 KYC submissions.
// The handler applies default pagination when query binding is absent so the moderation view remains resilient.
// ListKYCSubmissions lists pending Level 2 KYC submissions (admin only).
//
//	@Summary      List KYC Level 2 submissions (admin)
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        status     query  string  false  "PENDING|APPROVED|REJECTED (default: PENDING)"
//	@Param        page       query  int     false  "Page"
//	@Param        page_size  query  int     false  "Page size"
//	@Success      200  {object}  models.KYCSubmissionListResponse
//	@Router       /users/kyc/submissions [get]
func (h *Handler) ListKYCSubmissions(c *gin.Context) {
	statusFilter := c.DefaultQuery("status", "PENDING")
	req, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		r := pagination.DefaultRequest()
		req = &r
	}
	req.Normalize()
	submissions, total, err := h.svc.ListKYCSubmissions(c.Request.Context(), statusFilter, req.Page, req.PageSize)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, submissions, total, req.Page, req.PageSize)
}

// ReviewKYCSubmission handles the admin decision endpoint for approving or rejecting one KYC submission.
// It binds the moderation payload and derives the acting administrator identity from middleware context.
// ReviewKYCSubmission approves or rejects a Level 2 KYC submission (admin only).
//
//	@Summary      Review KYC Level 2 submission (admin)
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        submissionId  path   string                       true  "Submission ID"
//	@Param        body          body   models.ReviewKYCSubmissionRequest  true  "Approve or reject"
//	@Success      200  {object}  models.MessageResponse
//	@Router       /users/kyc/submissions/{submissionId}/review [post]
func (h *Handler) ReviewKYCSubmission(c *gin.Context) {
	submissionID, ok := apihttp.PathParam(c, "submissionId")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[ReviewKYCSubmissionRequest](c)
	if !ok {
		return
	}
	adminID := middleware.UserID(c)
	adminWallet := middleware.WalletAddress(c)
	if err := h.svc.ReviewKYCSubmission(c.Request.Context(), adminID, adminWallet, submissionID, req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	action := "từ chối"
	if req.Approve {
		action = "duyệt"
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Đã " + action + " hồ sơ KYC Level 2"})
}

// VerifyEmail handles confirmation of the email-verification token for the authenticated user.
// The user identity comes from the current session, while the token is provided in the request body.
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

// RequestPhoneVerification handles the start of the phone-verification flow.
// It binds the target phone number and leaves OTP dispatch semantics to the service or infrastructure layer.
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

// VerifyPhone handles submission of the OTP code used to confirm phone ownership.
// Successful verification can indirectly trigger KYC auto-upgrade logic in the service layer.
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

// GetPreferences handles retrieval of the authenticated user's notification and privacy preferences.
// The service resolves defaults and metadata merging details before the response is returned.
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

// UpdatePreferences handles partial updates to preference-related metadata for the authenticated user.
// It returns the normalized post-update preference snapshot rather than only an acknowledgment message.
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

// GetReferralInfo handles retrieval of the caller's referral code and summary metrics.
// This endpoint may lazily cause referral-code generation through the underlying service.
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

// ListReferrals handles paginated retrieval of the users referred by the current account.
// Request paging is bound from the query string and the target user remains the authenticated caller.
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
	req, ok := apihttp.BindQuery[pagination.Request](c)
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

// GenerateBackupCodes handles regeneration of 2FA recovery codes for the authenticated user.
// The service decides whether 2FA is enabled and whether regeneration is currently allowed.
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

// DeactivateAccount handles soft deactivation of the caller's own account.
// The optional reason is forwarded for auditability and support-side follow-up.
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

// requireID extracts a required path parameter and emits a standardized bad-request response when absent.
// This helper prevents repeated path-parameter validation boilerplate across admin endpoints.
// requireID extracts a required path parameter or returns an error response.
func requireID(c *gin.Context, param string) (string, bool) {
	id, ok := apihttp.PathParam(c, param)
	if !ok {
		apihttp.Fail(c, apperr.New(apperr.ErrCodeBadRequest, param+" path parameter is required"))
		return "", false
	}
	return id, true
}

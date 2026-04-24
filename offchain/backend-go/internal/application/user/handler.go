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

// requireID extracts a required path parameter or returns an error response.
func requireID(c *gin.Context, param string) (string, bool) {
	id, ok := apihttp.PathParam(c, param)
	if !ok {
		apihttp.Fail(c, apperr.New(apperr.ErrCodeBadRequest, param+" path parameter is required"))
		return "", false
	}
	return id, true
}

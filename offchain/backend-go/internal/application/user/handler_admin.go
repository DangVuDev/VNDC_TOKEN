// Package user — HTTP handlers for admin user management endpoints.
package user

import (
	"github.com/gin-gonic/gin"

	"github.com/vndc/backend/internal/domain"
	_ "github.com/vndc/backend/internal/models" // swagger model registration
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
)

// ListUsers handles the admin endpoint for browsing platform users.
// It binds list filters and forwards them unchanged to the user service for policy-consistent lookup behavior.
// ListUsers godoc
//
//	@Summary      List users (admin)
//	@Description  Returns a paginated, searchable list of all users on the platform.
//	@Description  Filter by `status`, `kyc_status`, or `role`. Search by wallet, email, or username.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        status      query     string  false  "Filter by account status"     Enums(ACTIVE,SUSPENDED,BANNED,PENDING_VERIFICATION)
//	@Param        kyc_status  query     string  false  "Filter by KYC status"         Enums(NONE,PENDING,VERIFIED,REJECTED)
//	@Param        role        query     string  false  "Filter by role"               Enums(USER,MODERATOR,ADMIN)
//	@Param        search      query     string  false  "Full-text search (wallet / email / username)"
//	@Param        page        query     int     false  "Page number (default: 1)"     example(1)
//	@Param        page_size   query     int     false  "Items per page (max: 100)"    example(20)
//	@Success      200         {object}  models.UserListResponse
//	@Failure      401         {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      403         {object}  models.ErrorResponse  "Requires ADMIN role"
//	@Failure      500         {object}  models.ErrorResponse  "Internal server error"
//	@Router       /users [get]
func (h *Handler) ListUsers(c *gin.Context) {
	req, ok := apihttp.BindQuery[ListUsersRequest](c)
	if !ok {
		return
	}
	users, total, err := h.svc.ListUsers(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, users, total, req.Page, req.PageSize)
}

// GetUser handles the admin detail endpoint for one specific user account.
// The handler only validates the required path parameter before delegating to the service.
// GetUser godoc
//
//	@Summary      Get user by ID (admin)
//	@Description  Returns the full profile for any user on the platform, including sensitive fields
//	@Description  such as KYC documents, suspension reason, and login statistics.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string  true  "MongoDB ObjectID or UUID"  example(65f1a2b3c4d5e6f7a8b9c0d1)
//	@Success      200  {object}  models.UserResponse
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      403  {object}  models.ErrorResponse  "Requires ADMIN role"
//	@Failure      404  {object}  models.ErrorResponse  "User not found"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /users/{id} [get]
func (h *Handler) GetUser(c *gin.Context) {
	id, ok := requireID(c, "id")
	if !ok {
		return
	}
	user, err := h.svc.GetUser(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, user)
}

// SuspendUser handles the admin moderation action that suspends a target account.
// It forwards acting-admin metadata so the suspension is attributable in audit trails.
// SuspendUser godoc
//
//	@Summary      Suspend a user account (admin)
//	@Description  Sets account status to `SUSPENDED` and immediately revokes all active sessions.
//	@Description  The user will be unable to log in until the account is unsuspended.
//	@Description  Cannot suspend your own account.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path      string                    true  "Target user ID"
//	@Param        body  body      models.SuspendUserRequest true  "Mandatory suspension reason (10–500 chars)"
//	@Success      200   {object}  models.MessageResponse         "Account suspended"
//	@Failure      400   {object}  models.ErrorResponse           "Cannot suspend own account / invalid reason"
//	@Failure      401   {object}  models.ErrorResponse           "Missing or invalid Bearer token"
//	@Failure      403   {object}  models.ErrorResponse           "Requires ADMIN role"
//	@Failure      404   {object}  models.ErrorResponse           "User not found"
//	@Failure      500   {object}  models.ErrorResponse           "Internal server error"
//	@Router       /users/{id}/suspend [post]
func (h *Handler) SuspendUser(c *gin.Context) {
	id, ok := requireID(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[SuspendUserRequest](c)
	if !ok {
		return
	}
	adminID := middleware.UserID(c)
	adminWallet := middleware.WalletAddress(c)
	if err := h.svc.SuspendUser(c.Request.Context(), adminID, adminWallet, id, req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "User suspended"})
}

// UnsuspendUser handles the admin moderation action that restores a suspended account.
// Identity for the acting administrator is taken from auth middleware rather than the request body.
// UnsuspendUser godoc
//
//	@Summary      Unsuspend a user account (admin)
//	@Description  Restores account status to `ACTIVE`. The user can log in again immediately.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string  true  "Target user ID"
//	@Success      200  {object}  models.MessageResponse  "Account unsuspended"
//	@Failure      401  {object}  models.ErrorResponse    "Missing or invalid Bearer token"
//	@Failure      403  {object}  models.ErrorResponse    "Requires ADMIN role"
//	@Failure      404  {object}  models.ErrorResponse    "User not found"
//	@Failure      500  {object}  models.ErrorResponse    "Internal server error"
//	@Router       /users/{id}/unsuspend [post]
func (h *Handler) UnsuspendUser(c *gin.Context) {
	id, ok := requireID(c, "id")
	if !ok {
		return
	}
	adminID := middleware.UserID(c)
	adminWallet := middleware.WalletAddress(c)
	if err := h.svc.UnsuspendUser(c.Request.Context(), adminID, adminWallet, id, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "User unsuspended"})
}

// AssignRole handles administrative RBAC role assignment for a target user.
// The handler binds the requested role and leaves normalization plus duplication checks to the service layer.
// AssignRole godoc
//
//	@Summary      Assign a role to a user (admin)
//	@Description  Adds the specified RBAC role to the target user's role list.
//	@Description  Has no effect if the user already holds that role.
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path      string                   true  "Target user ID"
//	@Param        body  body      models.AssignRoleRequest true  "Role to assign: USER | MODERATOR | ADMIN"
//	@Success      200   {object}  models.MessageResponse        "Role assigned"
//	@Failure      400   {object}  models.ErrorResponse          "Invalid role value"
//	@Failure      401   {object}  models.ErrorResponse          "Missing or invalid Bearer token"
//	@Failure      403   {object}  models.ErrorResponse          "Requires ADMIN role"
//	@Failure      404   {object}  models.ErrorResponse          "User not found"
//	@Failure      409   {object}  models.ErrorResponse          "User already has this role"
//	@Failure      500   {object}  models.ErrorResponse          "Internal server error"
//	@Router       /users/{id}/roles [post]
func (h *Handler) AssignRole(c *gin.Context) {
	id, ok := requireID(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[AssignRoleRequest](c)
	if !ok {
		return
	}
	adminID := middleware.UserID(c)
	adminWallet := middleware.WalletAddress(c)
	if err := h.svc.AssignRole(c.Request.Context(), adminID, adminWallet, id, req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Role assigned"})
}

// RemoveRole handles administrative removal of one RBAC role from a target account.
// Path parameters are used for both user ID and role name to keep the action URL explicit.
// RemoveRole godoc
//
//	@Summary      Remove a role from a user (admin)
//	@Description  Removes the specified RBAC role from the target user. The base `USER` role cannot be removed.
//	@Tags         Users
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path      string  true  "Target user ID"
//	@Param        role  path      string  true  "Role to remove"  Enums(MODERATOR,ADMIN)
//	@Success      200   {object}  models.MessageResponse  "Role removed"
//	@Failure      400   {object}  models.ErrorResponse    "Cannot remove base USER role"
//	@Failure      401   {object}  models.ErrorResponse    "Missing or invalid Bearer token"
//	@Failure      403   {object}  models.ErrorResponse    "Requires ADMIN role"
//	@Failure      404   {object}  models.ErrorResponse    "User not found or does not have this role"
//	@Failure      500   {object}  models.ErrorResponse    "Internal server error"
//	@Router       /users/{id}/roles/{role} [delete]
func (h *Handler) RemoveRole(c *gin.Context) {
	id, ok := requireID(c, "id")
	if !ok {
		return
	}
	role, ok := apihttp.PathParam(c, "role")
	if !ok {
		return
	}
	adminID := middleware.UserID(c)
	adminWallet := middleware.WalletAddress(c)
	if err := h.svc.RemoveRole(c.Request.Context(), adminID, adminWallet, id, role, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "Role removed"})
}

// ApproveKYC handles the admin shortcut endpoint that directly grants a KYC level to a user.
// It is separate from submission review so operators can resolve exceptional moderation cases explicitly.
// ApproveKYC godoc
//
//	@Summary      Approve KYC verification (admin)
//	@Description  Marks the target user's KYC as `VERIFIED` at the specified level (1–3).
//	@Description  | Level | Description |
//	@Description  |-------|-------------|
//	@Description  | 1     | Basic — email + phone confirmed |
//	@Description  | 2     | Standard — government-issued ID |
//	@Description  | 3     | Advanced — face-match + liveness check |
//	@Tags         Users
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id    path      string                    true  "Target user ID"
//	@Param        body  body      models.ApproveKYCRequest  true  "KYC level to grant (1–3)"
//	@Success      200   {object}  models.MessageResponse         "KYC approved"
//	@Failure      400   {object}  models.ErrorResponse           "Invalid level"
//	@Failure      401   {object}  models.ErrorResponse           "Missing or invalid Bearer token"
//	@Failure      403   {object}  models.ErrorResponse           "Requires ADMIN role"
//	@Failure      404   {object}  models.ErrorResponse           "User not found"
//	@Failure      500   {object}  models.ErrorResponse           "Internal server error"
//	@Router       /users/{id}/kyc/approve [post]
func (h *Handler) ApproveKYC(c *gin.Context) {
	id, ok := requireID(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[ApproveKYCRequest](c)
	if !ok {
		return
	}
	adminID := middleware.UserID(c)
	adminWallet := middleware.WalletAddress(c)
	if err := h.svc.ApproveKYC(c.Request.Context(), adminID, adminWallet, id, domain.KYCLevel(req.Level), c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"success": true, "message": "KYC approved"})
}

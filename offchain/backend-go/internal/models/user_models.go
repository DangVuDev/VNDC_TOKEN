// Package models — swagger model definitions for the user module.
package models

import "time"

// ─────────────────────────────────────────────
//  /users/me  — GET
// ─────────────────────────────────────────────

// UserResponse is the envelope for a single user profile.
type UserResponse struct {
	Success bool         `json:"success" example:"true"`
	Data    UserInfo     `json:"data"`
	Meta    ResponseMeta `json:"meta"`
}

// ─────────────────────────────────────────────
//  /users/me  — PATCH
// ─────────────────────────────────────────────

// UpdateProfileRequest is the body for PATCH /users/me.
// All fields are optional — only provided fields are applied.
type UpdateProfileRequest struct {
	Username    *string        `json:"username,omitempty"     example:"alice_dev"`
	FullName    *string        `json:"full_name,omitempty"    example:"Alice Nguyen"`
	Bio         *string        `json:"bio,omitempty"          example:"Blockchain developer"`
	AvatarURI   *string        `json:"avatar_uri,omitempty"   example:"https://cdn.example.com/alice.png"`
	Country     *string        `json:"country,omitempty"      example:"VN"`
	Language    *string        `json:"language,omitempty"     example:"vi"`
	Timezone    *string        `json:"timezone,omitempty"     example:"Asia/Ho_Chi_Minh"`
	DateOfBirth *time.Time     `json:"date_of_birth,omitempty" example:"1995-06-15T00:00:00Z"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}

// ─────────────────────────────────────────────
//  /users/me/email  — PUT
// ─────────────────────────────────────────────

// RequestEmailChangeRequest is the body for PUT /users/me/email.
type RequestEmailChangeRequest struct {
	// Email is the new email address. A verification link will be sent to it.
	Email string `json:"email" example:"alice_new@example.com"`
}

// ─────────────────────────────────────────────
//  /users/me/audit-logs  — GET
// ─────────────────────────────────────────────

// AuditLogListResponse is the paginated envelope for audit log entries.
type AuditLogListResponse struct {
	Success    bool            `json:"success"    example:"true"`
	Data       []AuditLogEntry `json:"data"`
	Pagination PaginationMeta  `json:"pagination"`
	Meta       ResponseMeta    `json:"meta"`
}

// ─────────────────────────────────────────────
//  /users/me/kyc  — POST
// ─────────────────────────────────────────────

// SubmitKYCRequest is the body for POST /users/me/kyc.
type SubmitKYCRequest struct {
	// DocumentType must be one of: PASSPORT, NATIONAL_ID, DRIVER_LICENSE.
	DocumentType string `json:"document_type" example:"PASSPORT"`
	// DocumentRef is the encrypted storage reference returned by the upload endpoint.
	DocumentRef string `json:"document_ref" example:"enc:s3::bucket/usr123/passport.enc"`
}

// ─────────────────────────────────────────────
//  /users  — GET (admin)
// ─────────────────────────────────────────────

// UserListResponse is the paginated envelope for admin user listings.
type UserListResponse struct {
	Success    bool           `json:"success"    example:"true"`
	Data       []UserInfo     `json:"data"`
	Pagination PaginationMeta `json:"pagination"`
	Meta       ResponseMeta   `json:"meta"`
}

// ─────────────────────────────────────────────
//  Admin action request bodies
// ─────────────────────────────────────────────

// SuspendUserRequest is the body for POST /users/:id/suspend.
type SuspendUserRequest struct {
	// Reason must describe why the account is being suspended (10–500 characters).
	Reason string `json:"reason" example:"Multiple violations of community guidelines detected"`
}

// AssignRoleRequest is the body for POST /users/:id/roles.
type AssignRoleRequest struct {
	// Role must be one of: USER, MODERATOR, ADMIN.
	Role string `json:"role" example:"MODERATOR"`
}

// ApproveKYCRequest is the body for POST /users/:id/kyc/approve.
type ApproveKYCRequest struct {
	// Level is 1 (basic), 2 (standard), or 3 (advanced).
	Level int `json:"level" example:"2"`
}

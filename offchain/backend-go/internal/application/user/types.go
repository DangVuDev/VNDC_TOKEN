// Package user — request/response DTO types for the user module.
package user

import "time"

// ─────────────────────────────────────────────
//  Self-service request types
// ─────────────────────────────────────────────

// UpdateProfileRequest carries validated profile update fields.
// All fields are optional (pointer or omitempty) — only provided values are applied.
type UpdateProfileRequest struct {
	Username    *string    `json:"username,omitempty"     validate:"omitempty,min=3,max=32,alphanum"`
	FullName    *string    `json:"full_name,omitempty"    validate:"omitempty,min=1,max=128"`
	Bio         *string    `json:"bio,omitempty"          validate:"omitempty,max=500"`
	AvatarURI   *string    `json:"avatar_uri,omitempty"   validate:"omitempty,url"`
	Country     *string    `json:"country,omitempty"      validate:"omitempty,iso3166_1_alpha2"`
	Language    *string    `json:"language,omitempty"     validate:"omitempty,bcp47_language_tag"`
	Timezone    *string    `json:"timezone,omitempty"     validate:"omitempty,timezone"`
	DateOfBirth *time.Time `json:"date_of_birth,omitempty"`
	// Metadata is a free-form key-value store for client-specific extensions.
	// Values are merged (not replaced) into the existing metadata map.
	Metadata map[string]any `json:"metadata,omitempty"`
}

// EmailChangeRequest carries the new email for a change request.
type EmailChangeRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// SubmitKYCRequest carries a KYC document submission.
type SubmitKYCRequest struct {
	DocumentType string `json:"document_type" validate:"required,oneof=PASSPORT NATIONAL_ID DRIVER_LICENSE"`
	DocumentRef  string `json:"document_ref"  validate:"required"` // encrypted storage reference
}

// ─────────────────────────────────────────────
//  Admin request types
// ─────────────────────────────────────────────

// ListUsersRequest carries search and pagination filters for the admin user list.
type ListUsersRequest struct {
	Status    string `form:"status"`
	KYCStatus string `form:"kyc_status"`
	Role      string `form:"role"`
	Search    string `form:"search"` // matches wallet, email, or username
	Page      int64  `form:"page"      validate:"omitempty,min=1"`
	PageSize  int64  `form:"page_size" validate:"omitempty,min=1,max=100"`
}

// SuspendUserRequest carries the mandatory suspension reason.
type SuspendUserRequest struct {
	Reason string `json:"reason" validate:"required,min=10,max=500"`
}

// AssignRoleRequest carries the role to add to a user.
type AssignRoleRequest struct {
	Role string `json:"role" validate:"required,oneof=USER MODERATOR ADMIN"`
}

// ApproveKYCRequest carries the verified KYC level to assign.
type ApproveKYCRequest struct {
	Level int `json:"level" validate:"required,min=1,max=3"`
}

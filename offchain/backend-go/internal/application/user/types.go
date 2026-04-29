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

// ─────────────────────────────────────────────
//  Email & Phone Verification
// ─────────────────────────────────────────────

// VerifyEmailRequest carries the verification token/code.
type VerifyEmailRequest struct {
	Token string `json:"token" validate:"required,min=6,max=128"`
}

// VerifyPhoneRequest carries the OTP code.
type VerifyPhoneRequest struct {
	Code string `json:"code" validate:"required,len=6,numeric"`
}

// RequestPhoneVerificationRequest carries the phone number to verify.
type RequestPhoneVerificationRequest struct {
	Phone string `json:"phone" validate:"required,e164"`
}

// ─────────────────────────────────────────────
//  User Preferences & Settings
// ─────────────────────────────────────────────

// UserPreferencesRequest carries notification and privacy settings.
type UserPreferencesRequest struct {
	// Notification preferences
	NotifyLogin     *bool `json:"notify_login,omitempty"`     // alert on new login
	NotifyKYC       *bool `json:"notify_kyc,omitempty"`       // alert on KYC status change
	NotifyTransfer  *bool `json:"notify_transfer,omitempty"`  // alert on token transfer
	NotifyReward    *bool `json:"notify_reward,omitempty"`    // alert on rewards
	NotifyMarketing *bool `json:"notify_marketing,omitempty"` // marketing emails
	// Privacy settings
	ProfilePublic  *bool `json:"profile_public,omitempty"`   // allow others to see profile
	ShowLoginStats *bool `json:"show_login_stats,omitempty"` // show last login info
}

// UserPreferencesResponse carries the user's preference settings.
type UserPreferencesResponse struct {
	NotifyLogin     bool      `json:"notify_login"`
	NotifyKYC       bool      `json:"notify_kyc"`
	NotifyTransfer  bool      `json:"notify_transfer"`
	NotifyReward    bool      `json:"notify_reward"`
	NotifyMarketing bool      `json:"notify_marketing"`
	ProfilePublic   bool      `json:"profile_public"`
	ShowLoginStats  bool      `json:"show_login_stats"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ─────────────────────────────────────────────
//  Referral System
// ─────────────────────────────────────────────

// ReferralInfoResponse carries referral code and stats.
type ReferralInfoResponse struct {
	ReferralCode   string    `json:"referral_code"`
	ReferredCount  int64     `json:"referred_count"`
	ReferredBy     string    `json:"referred_by,omitempty"`
	ReferralReward float64   `json:"referral_reward"`
	CreatedAt      time.Time `json:"created_at"`
}

// ReferralListResponse carries paginated list of referrals.
type ReferralListResponse struct {
	Referrals []ReferralRecord `json:"referrals"`
	Total     int64            `json:"total"`
}

// ReferralRecord represents a single referral entry.
type ReferralRecord struct {
	WalletAddress string    `json:"wallet_address"`
	JoinedAt      time.Time `json:"joined_at"`
	Status        string    `json:"status"` // ACTIVE, INACTIVE
}

// ─────────────────────────────────────────────
//  Account Management
// ─────────────────────────────────────────────

// DeactivateAccountRequest carries optional reason for deactivation.
type DeactivateAccountRequest struct {
	Reason string `json:"reason,omitempty" validate:"omitempty,max=500"`
}

// GenerateBackupCodesRequest is empty (no params needed).
type GenerateBackupCodesRequest struct{}

// BackupCodesResponse carries new backup codes.
type BackupCodesResponse struct {
	BackupCodes []string  `json:"backup_codes"` // 10 codes, user must save them
	GeneratedAt time.Time `json:"generated_at"`
	Message     string    `json:"message"` // "Save these codes securely"
}

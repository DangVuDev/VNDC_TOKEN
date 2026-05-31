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
	// Class identifies the student group / cohort (e.g. "CNTT-K2024").
	// Used for per-class activity visibility filtering.
	Class *string `json:"class,omitempty" validate:"omitempty,max=64"`
	// Metadata is a free-form key-value store for client-specific extensions.
	// Values are merged (not replaced) into the existing metadata map.
	Metadata map[string]any `json:"metadata,omitempty"`
}

// EmailChangeRequest carries the new email for a change request.
type EmailChangeRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// SubmitKYCLevel1Request triggers auto-approval of KYC Level 1.
// The user must already have a unique username set, a verified email,
// and a verified phone number. No admin approval is required.
// This request body is intentionally empty — all data is taken from the user record.
type SubmitKYCLevel1Request struct{}

// SubmitKYCLevel2Request carries document URLs for admin-reviewed Level 2 KYC.
// Images are first uploaded via POST /users/me/kyc/upload (which returns demo URLs).
type SubmitKYCLevel2Request struct {
	StudentCardURL string `json:"student_card_url" validate:"required,url"`
	SelfieURL      string `json:"selfie_url"       validate:"required,url"`
}

// KYCUploadDemoRequest carries a filename to simulate an image upload.
type KYCUploadDemoRequest struct {
	FileName string `json:"file_name" validate:"required,min=1,max=255"`
}

// KYCLevel1StatusResponse describes why Level 1 requirements are or are not met.
type KYCLevel1StatusResponse struct {
	Ready           bool   `json:"ready"`
	HasUsername     bool   `json:"has_username"`
	EmailVerified   bool   `json:"email_verified"`
	PhoneVerified   bool   `json:"phone_verified"`
	CurrentKYCLevel int    `json:"current_kyc_level"`
	Message         string `json:"message,omitempty"`
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

// ApproveKYCRequest carries the verified KYC level to assign (for direct admin approval).
type ApproveKYCRequest struct {
	Level int `json:"level" validate:"required,min=1,max=3"`
}

// ReviewKYCSubmissionRequest carries the review outcome for a Level 2 KYC submission.
type ReviewKYCSubmissionRequest struct {
	Approve bool   `json:"approve" validate:"required"`
	Note    string `json:"note"    validate:"omitempty,max=500"`
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

// ─────────────────────────────────────────────
//  Public Lookup
// ─────────────────────────────────────────────

// PublicUserInfo is the minimal public profile returned by the lookup endpoint.
// It exposes only non-sensitive information safe to share between authenticated users.
type PublicUserInfo struct {
	WalletAddress string `json:"wallet_address"`
	Username      string `json:"username,omitempty"`
	FullName      string `json:"full_name,omitempty"`
	AvatarURI     string `json:"avatar_uri,omitempty"`
	KYCLevel      int    `json:"kyc_level"`
	KYCVerified   bool   `json:"kyc_verified"`
}

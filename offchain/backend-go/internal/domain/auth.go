// Package domain — auth-specific domain entities.
// Session, LoginAttempt, and AuditLog support the SIWE + JWT auth system.
package domain

import "time"

// ─────────────────────────────────────────────
//  Session — authenticated user session
// ─────────────────────────────────────────────

// Session represents a long-lived authenticated session tied to a refresh token.
// Each login creates one session. A user may hold multiple concurrent sessions
// (different devices). Sessions are stored in MongoDB so they survive restarts.
type Session struct {
	BaseEntity `bson:",inline"`

	UserID        string `bson:"user_id"        json:"user_id"`
	WalletAddress string `bson:"wallet_address" json:"wallet_address"`

	// RefreshToken stores the SHA-256 hash of the opaque refresh token.
	// The raw token is returned to the client once and never stored.
	RefreshTokenHash string `bson:"refresh_token_hash" json:"-"`

	// Device fingerprint — helps users identify and revoke foreign sessions.
	DeviceID   string `bson:"device_id,omitempty"   json:"device_id,omitempty"`
	DeviceName string `bson:"device_name,omitempty" json:"device_name,omitempty"`
	DeviceOS   string `bson:"device_os,omitempty"   json:"device_os,omitempty"`
	UserAgent  string `bson:"user_agent,omitempty"  json:"user_agent,omitempty"`
	IPAddress  string `bson:"ip_address,omitempty"  json:"ip_address,omitempty"`
	GeoCountry string `bson:"geo_country,omitempty" json:"geo_country,omitempty"`

	// Lifecycle timestamps.
	IssuedAt     time.Time  `bson:"issued_at"             json:"issued_at"`
	ExpiresAt    time.Time  `bson:"expires_at"            json:"expires_at"`
	LastUsedAt   *time.Time `bson:"last_used_at,omitempty" json:"last_used_at,omitempty"`
	RevokedAt    *time.Time `bson:"revoked_at,omitempty"  json:"revoked_at,omitempty"`
	RevokeReason string     `bson:"revoke_reason,omitempty" json:"revoke_reason,omitempty"`

	// Roles snapshot captured at session creation (avoids extra DB lookup per request).
	Roles []string `bson:"roles" json:"roles"`
}

// IsActive reports whether the session is still valid (not revoked, not expired).
func (s *Session) IsActive() bool {
	return s.RevokedAt == nil && s.ExpiresAt.After(time.Now())
}

// ─────────────────────────────────────────────
//  LoginAttempt — brute-force audit trail
// ─────────────────────────────────────────────

// LoginAttempt records every authentication attempt for security monitoring.
// Failed attempts trigger the account lockout policy.
type LoginAttempt struct {
	BaseEntity `bson:",inline"`

	WalletAddress string    `bson:"wallet_address"        json:"wallet_address"`
	IPAddress     string    `bson:"ip_address"            json:"ip_address"`
	UserAgent     string    `bson:"user_agent,omitempty"  json:"user_agent,omitempty"`
	Success       bool      `bson:"success"               json:"success"`
	FailReason    string    `bson:"fail_reason,omitempty" json:"fail_reason,omitempty"`
	AttemptedAt   time.Time `bson:"attempted_at"          json:"attempted_at"`
}

// ─────────────────────────────────────────────
//  AuditLog — compliance & security event log
// ─────────────────────────────────────────────

// AuditEventType categorises security-relevant events.
type AuditEventType string

const (
	AuditLogin                      AuditEventType = "AUTH_LOGIN"
	AuditLogout                     AuditEventType = "AUTH_LOGOUT"
	AuditTokenRefresh               AuditEventType = "AUTH_TOKEN_REFRESH"
	AuditSessionRevoked             AuditEventType = "AUTH_SESSION_REVOKED"
	AuditTwoFAEnabled               AuditEventType = "TWO_FA_ENABLED"
	AuditTwoFADisabled              AuditEventType = "TWO_FA_DISABLED"
	AuditTwoFAVerified              AuditEventType = "TWO_FA_VERIFIED"
	AuditTwoFAFailed                AuditEventType = "TWO_FA_FAILED"
	AuditProfileUpdated             AuditEventType = "PROFILE_UPDATED"
	AuditEmailChanged               AuditEventType = "EMAIL_CHANGED"
	AuditEmailVerified              AuditEventType = "EMAIL_VERIFIED"
	AuditPhoneVerificationRequested AuditEventType = "PHONE_VERIFICATION_REQUESTED"
	AuditPhoneVerified              AuditEventType = "PHONE_VERIFIED"
	AuditRoleAssigned               AuditEventType = "ROLE_ASSIGNED"
	AuditRoleRemoved                AuditEventType = "ROLE_REMOVED"
	AuditUserSuspended              AuditEventType = "USER_SUSPENDED"
	AuditUserUnsuspended            AuditEventType = "USER_UNSUSPENDED"
	AuditKYCLevel1Completed         AuditEventType = "KYC_LEVEL1_COMPLETED"
	AuditKYCSubmitted               AuditEventType = "KYC_SUBMITTED"
	AuditKYCApproved                AuditEventType = "KYC_APPROVED"
	AuditKYCRejected                AuditEventType = "KYC_REJECTED"
	AuditPreferencesUpdated         AuditEventType = "PREFERENCES_UPDATED"
	AuditBackupCodesGenerated       AuditEventType = "BACKUP_CODES_GENERATED"
	AuditAccountDeactivated         AuditEventType = "ACCOUNT_DEACTIVATED"
)

// AuditLog is an immutable, append-only record of security-relevant system events.
// These records support compliance requirements and incident investigation.
type AuditLog struct {
	BaseEntity `bson:",inline"`

	EventType   AuditEventType `bson:"event_type"           json:"event_type"`
	ActorID     string         `bson:"actor_id"             json:"actor_id"` // userID who performed the action
	ActorWallet string         `bson:"actor_wallet"         json:"actor_wallet"`
	TargetID    string         `bson:"target_id,omitempty"  json:"target_id,omitempty"` // affected user (for admin actions)

	// Request context captured at the time of the event.
	IPAddress string `bson:"ip_address,omitempty" json:"ip_address,omitempty"`
	UserAgent string `bson:"user_agent,omitempty" json:"user_agent,omitempty"`
	SessionID string `bson:"session_id,omitempty" json:"session_id,omitempty"`

	// Structured payload — event-specific details for forensic analysis.
	Details    map[string]any `bson:"details,omitempty" json:"details,omitempty"`
	OccurredAt time.Time      `bson:"occurred_at"       json:"occurred_at"`
}

// ─────────────────────────────────────────────
//  KYCSubmission — Level 2 identity verification request
// ─────────────────────────────────────────────

// KYCSubmissionStatus represents the review lifecycle of a Level 2 KYC submission.
type KYCSubmissionStatus string

const (
	KYCSubmissionPending  KYCSubmissionStatus = "PENDING"
	KYCSubmissionApproved KYCSubmissionStatus = "APPROVED"
	KYCSubmissionRejected KYCSubmissionStatus = "REJECTED"
)

// KYCSubmission represents a user's Level 2 KYC document upload awaiting admin review.
// Student card image and selfie are referenced by URL (stored externally / demo).
type KYCSubmission struct {
	BaseEntity `bson:",inline"`

	UserID        string `bson:"user_id"         json:"user_id"`
	WalletAddress string `bson:"wallet_address"  json:"wallet_address"`
	Level         int    `bson:"level"           json:"level"` // always 2 for now

	// Document references (URLs returned by the upload demo endpoint).
	StudentCardURL string `bson:"student_card_url" json:"student_card_url"`
	SelfieURL      string `bson:"selfie_url"       json:"selfie_url"`

	// Review outcome.
	Status     KYCSubmissionStatus `bson:"status"                json:"status"`
	ReviewedBy string              `bson:"reviewed_by,omitempty" json:"reviewed_by,omitempty"` // admin userID
	ReviewNote string              `bson:"review_note,omitempty" json:"review_note,omitempty"`
	ReviewedAt *time.Time          `bson:"reviewed_at,omitempty" json:"reviewed_at,omitempty"`
}

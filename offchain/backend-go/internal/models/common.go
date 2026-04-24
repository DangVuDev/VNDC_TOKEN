// Package models defines concrete response and request types used ONLY
// for Swagger/OpenAPI documentation generation (swaggo/swag).
//
// These structs mirror what the API actually returns through the generic
// apihttp.Response[T] / apihttp.PagedResponse[T] envelopes but are expressed
// as plain, non-generic structs so that swag can parse them.
//
// Production code does NOT import this package; it is referenced only
// from // @Success / @Failure handler annotations.
package models

import "time"

// ─────────────────────────────────────────────
//  Common envelope types (mirrors pkg/http)
// ─────────────────────────────────────────────

// ResponseMeta holds per-response metadata injected by the server.
type ResponseMeta struct {
	RequestID string `json:"request_id,omitempty" example:"01HWXYZ1234567890ABCDEF"`
	Timestamp string `json:"timestamp"            example:"2026-04-24T07:00:00Z"`
}

// PaginationMeta describes offset-based paging returned by list endpoints.
type PaginationMeta struct {
	Total    int64 `json:"total"     example:"100"`
	Page     int64 `json:"page"      example:"1"`
	PageSize int64 `json:"page_size" example:"20"`
	Pages    int64 `json:"pages"     example:"5"`
	HasNext  bool  `json:"has_next"  example:"true"`
	HasPrev  bool  `json:"has_prev"  example:"false"`
}

// ErrorBody is the structured error payload inside a failure response.
type ErrorBody struct {
	Code    string      `json:"code"              example:"VALIDATION_ERROR"`
	Message string      `json:"message"           example:"wallet query param required"`
	Details interface{} `json:"details,omitempty"`
}

// ErrorResponse is the standard API error envelope.
//
//	{
//	  "success": false,
//	  "error":   { "code": "...", "message": "..." },
//	  "meta":    { "timestamp": "..." }
//	}
type ErrorResponse struct {
	Success bool         `json:"success" example:"false"`
	Error   *ErrorBody   `json:"error"`
	Meta    ResponseMeta `json:"meta"`
}

// ─────────────────────────────────────────────
//  Shared sub-types
// ─────────────────────────────────────────────

// KYCDocumentInfo is the swagger representation of a submitted KYC document.
type KYCDocumentInfo struct {
	Type        string     `json:"type"                    example:"PASSPORT"`
	DocumentRef string     `json:"document_ref"            example:"enc:s3::bucket/usr123/passport.enc"`
	SubmittedAt time.Time  `json:"submitted_at"            example:"2026-04-24T07:00:00Z"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	ReviewNote  string     `json:"review_note,omitempty"   example:"Document blurry — please resubmit"`
}

// UserInfo is the full user profile returned by the API.
type UserInfo struct {
	ID               string            `json:"id"                        example:"65f1a2b3c4d5e6f7a8b9c0d1"`
	CreatedAt        time.Time         `json:"created_at"                example:"2026-01-01T00:00:00Z"`
	UpdatedAt        time.Time         `json:"updated_at"                example:"2026-04-24T07:00:00Z"`
	WalletAddress    string            `json:"wallet_address"            example:"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`
	Username         string            `json:"username,omitempty"        example:"alice"`
	Email            string            `json:"email,omitempty"           example:"alice@example.com"`
	FullName         string            `json:"full_name,omitempty"       example:"Alice Nguyen"`
	Bio              string            `json:"bio,omitempty"             example:"Blockchain enthusiast"`
	AvatarURI        string            `json:"avatar_uri,omitempty"      example:"https://cdn.example.com/avatars/alice.png"`
	Country          string            `json:"country,omitempty"         example:"VN"`
	Language         string            `json:"language,omitempty"        example:"vi"`
	Timezone         string            `json:"timezone,omitempty"        example:"Asia/Ho_Chi_Minh"`
	Status           string            `json:"status"                    example:"ACTIVE"`
	EmailVerified    bool              `json:"email_verified"            example:"true"`
	TwoFactorEnabled bool              `json:"two_factor_enabled"        example:"false"`
	KYCStatus        string            `json:"kyc_status"                example:"VERIFIED"`
	KYCLevel         int               `json:"kyc_level"                 example:"2"`
	KYCDocuments     []KYCDocumentInfo `json:"kyc_documents,omitempty"`
	Roles            []string          `json:"roles"                     example:"[\"USER\"]"`
	LoginCount       int64             `json:"login_count"               example:"42"`
	LastLoginAt      *time.Time        `json:"last_login_at,omitempty"`
	ReferralCode     string            `json:"referral_code,omitempty"   example:"ALICE2026"`
	Metadata         map[string]any    `json:"metadata,omitempty"`
}

// SessionInfo describes a single authenticated device session.
type SessionInfo struct {
	ID            string     `json:"id"                      example:"9f8e7d6c-5b4a-3210-fedc-ba9876543210"`
	CreatedAt     time.Time  `json:"created_at"              example:"2026-04-24T07:00:00Z"`
	UserID        string     `json:"user_id"                 example:"65f1a2b3c4d5e6f7a8b9c0d1"`
	WalletAddress string     `json:"wallet_address"          example:"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`
	DeviceName    string     `json:"device_name,omitempty"   example:"iPhone 15 Pro"`
	DeviceOS      string     `json:"device_os,omitempty"     example:"iOS 17"`
	UserAgent     string     `json:"user_agent,omitempty"    example:"Mozilla/5.0 ..."`
	IPAddress     string     `json:"ip_address,omitempty"    example:"203.0.113.42"`
	GeoCountry    string     `json:"geo_country,omitempty"   example:"VN"`
	IssuedAt      time.Time  `json:"issued_at"               example:"2026-04-24T07:00:00Z"`
	ExpiresAt     time.Time  `json:"expires_at"              example:"2026-05-01T07:00:00Z"`
	LastUsedAt    *time.Time `json:"last_used_at,omitempty"`
	Roles         []string   `json:"roles"                   example:"[\"USER\"]"`
}

// AuditLogEntry is a single security audit trail record.
type AuditLogEntry struct {
	ID          string         `json:"id"                   example:"65f1a2b3c4d5e6f7a8b9c0d1"`
	CreatedAt   time.Time      `json:"created_at"           example:"2026-04-24T07:00:00Z"`
	EventType   string         `json:"event_type"           example:"AUTH_LOGIN"`
	ActorID     string         `json:"actor_id"             example:"65f1a2b3c4d5e6f7a8b9c0d1"`
	ActorWallet string         `json:"actor_wallet"         example:"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`
	TargetID    string         `json:"target_id,omitempty"  example:""`
	IPAddress   string         `json:"ip_address"           example:"203.0.113.42"`
	UserAgent   string         `json:"user_agent,omitempty" example:"Mozilla/5.0 ..."`
	Details     map[string]any `json:"details,omitempty"`
	OccurredAt  time.Time      `json:"occurred_at"          example:"2026-04-24T07:00:00Z"`
}

// TransactionInfo is the swagger model for a single off-chain transaction.
type TransactionInfo struct {
	ID          string     `json:"id"                      example:"f47ac10b-58cc-4372-a567-0e02b2c3d479"`
	CreatedAt   time.Time  `json:"created_at"              example:"2026-04-24T07:00:00Z"`
	UpdatedAt   time.Time  `json:"updated_at"              example:"2026-04-24T07:05:00Z"`
	Type        string     `json:"type"                    example:"TOKEN_TRANSFER"`
	Status      string     `json:"status"                  example:"PENDING"`
	FromWallet  string     `json:"from_wallet"             example:"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`
	ToWallet    string     `json:"to_wallet"               example:"0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"`
	Amount      string     `json:"amount"                  example:"1000000000000000000"`
	Nonce       string     `json:"nonce"                   example:"42"`
	Deadline    int64      `json:"deadline"                example:"1745481600"`
	Signature   string     `json:"signature"               example:"0xabc123..."`
	BatchID     string     `json:"batch_id,omitempty"      example:"batch-001"`
	TxHash      string     `json:"tx_hash,omitempty"       example:"0xdeadbeef..."`
	BlockNumber uint64     `json:"block_number,omitempty"  example:"19500000"`
	RetryCount  int        `json:"retry_count"             example:"0"`
	SettledAt   *time.Time `json:"settled_at,omitempty"`
}

// MessageResponse is a simple success/message reply.
type MessageResponse struct {
	Success bool   `json:"success" example:"true"`
	Message string `json:"message" example:"Operation completed successfully"`
}

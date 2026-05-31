// Package domain contains all domain entities and business rules.
// These are plain Go structs with no external dependencies — pure business logic.
package domain

import (
	"time"
)

// ─────────────────────────────────────────────
//  Base Entity
// ─────────────────────────────────────────────

// BaseEntity is embedded in all domain entities.
// It satisfies the database.Identifiable interface.
type BaseEntity struct {
	ID        string     `bson:"_id,omitempty" json:"id"`
	CreatedAt time.Time  `bson:"created_at"    json:"created_at"`
	UpdatedAt time.Time  `bson:"updated_at"    json:"updated_at"`
	DeletedAt *time.Time `bson:"deleted_at"    json:"deleted_at,omitempty"`
}

// GetID returns the entity ID.
func (e BaseEntity) GetID() string { return e.ID }

// SetID sets the entity ID.
func (e *BaseEntity) SetID(id string) { e.ID = id }

// SetCreatedAt sets the created_at timestamp.
func (e *BaseEntity) SetCreatedAt(t time.Time) { e.CreatedAt = t }

// SetUpdatedAt sets the updated_at timestamp.
func (e *BaseEntity) SetUpdatedAt(t time.Time) { e.UpdatedAt = t }

// IsDeleted reports whether the entity is soft-deleted.
func (e BaseEntity) IsDeleted() bool { return e.DeletedAt != nil }

// ─────────────────────────────────────────────
//  Transaction — off-chain meta-transaction record
// ─────────────────────────────────────────────

// TransactionStatus represents the lifecycle state of a transaction.
type TransactionStatus string

const (
	TxStatusPending    TransactionStatus = "PENDING"
	TxStatusQueued     TransactionStatus = "QUEUED"
	TxStatusProcessing TransactionStatus = "PROCESSING"
	TxStatusSuccess    TransactionStatus = "SUCCESS"
	TxStatusFailed     TransactionStatus = "FAILED"
	TxStatusRolledBack TransactionStatus = "ROLLED_BACK"
)

// TransactionType distinguishes token transfers from NFT operations.
type TransactionType string

const (
	TxTypeTokenTransfer    TransactionType = "TOKEN_TRANSFER"
	TxTypeNFTMint          TransactionType = "NFT_MINT"
	TxTypeNFTTransfer      TransactionType = "NFT_TRANSFER"
	TxTypeTaskClaim        TransactionType = "TASK_CLAIM"
	TxTypeFundContribution TransactionType = "FUND_CONTRIBUTION"
	TxTypeMarketplaceBuy   TransactionType = "MARKETPLACE_BUY"
	TxTypeServiceTicketBuy TransactionType = "SERVICE_TICKET_BUY"
)

// Transaction represents an off-chain queued meta-transaction.
// Records are created immediately when users submit signed requests.
// They are settled on-chain in batches by the relayer worker.
type Transaction struct {
	BaseEntity `bson:",inline"`

	// Intent
	Type   TransactionType   `bson:"type"   json:"type"`
	Status TransactionStatus `bson:"status" json:"status"`

	// EIP-712 signed payload
	FromWallet string `bson:"from_wallet" json:"from_wallet"` // checksummed address
	ToWallet   string `bson:"to_wallet"   json:"to_wallet"`
	Amount     string `bson:"amount"      json:"amount"` // wei as string (no float!)
	Nonce      string `bson:"nonce"       json:"nonce"`
	Deadline   int64  `bson:"deadline"    json:"deadline"`  // Unix timestamp
	Signature  string `bson:"signature"   json:"signature"` // hex-encoded 65 bytes

	// Optional context for cross-module processing (e.g. funding contribution)
	ContextType string `bson:"context_type,omitempty" json:"context_type,omitempty"`
	ContextID   string `bson:"context_id,omitempty"   json:"context_id,omitempty"`
	ContextRef  string `bson:"context_ref,omitempty"  json:"context_ref,omitempty"`

	// NFT-specific
	TokenID      string `bson:"token_id,omitempty"      json:"token_id,omitempty"`
	NFTAmount    string `bson:"nft_amount,omitempty"    json:"nft_amount,omitempty"`
	MetadataHash string `bson:"metadata_hash,omitempty" json:"metadata_hash,omitempty"`
	MetadataURI  string `bson:"metadata_uri,omitempty"  json:"metadata_uri,omitempty"`

	// On-chain settlement
	BatchID     string     `bson:"batch_id,omitempty"     json:"batch_id,omitempty"`
	TxHash      string     `bson:"tx_hash,omitempty"      json:"tx_hash,omitempty"`
	BlockNumber uint64     `bson:"block_number,omitempty" json:"block_number,omitempty"`
	GasUsed     uint64     `bson:"gas_used,omitempty"     json:"gas_used,omitempty"`
	SettledAt   *time.Time `bson:"settled_at,omitempty"   json:"settled_at,omitempty"`

	// Error handling
	RetryCount int    `bson:"retry_count" json:"retry_count"`
	LastError  string `bson:"last_error,omitempty" json:"last_error,omitempty"`
}

// IsPending returns true if the transaction is awaiting processing.
func (t *Transaction) IsPending() bool {
	return t.Status == TxStatusPending || t.Status == TxStatusQueued
}

// IsTerminal returns true if the transaction has reached a final state.
func (t *Transaction) IsTerminal() bool {
	return t.Status == TxStatusSuccess || t.Status == TxStatusFailed || t.Status == TxStatusRolledBack
}

// ─────────────────────────────────────────────
//  Batch — a group of transactions settled in one on-chain tx
// ─────────────────────────────────────────────

// BatchStatus represents the lifecycle of a settlement batch.
type BatchStatus string

const (
	BatchStatusPending   BatchStatus = "PENDING"
	BatchStatusSubmitted BatchStatus = "SUBMITTED"
	BatchStatusConfirmed BatchStatus = "CONFIRMED"
	BatchStatusFailed    BatchStatus = "FAILED"
)

// Batch represents a group of meta-transactions settled in a single on-chain call.
type Batch struct {
	BaseEntity `bson:",inline"`

	Status         BatchStatus `bson:"status"           json:"status"`
	TransactionIDs []string    `bson:"transaction_ids"  json:"transaction_ids"`
	TxHash         string      `bson:"tx_hash,omitempty" json:"tx_hash,omitempty"`
	BlockNumber    uint64      `bson:"block_number,omitempty" json:"block_number,omitempty"`
	GasUsed        uint64      `bson:"gas_used,omitempty" json:"gas_used,omitempty"`
	GasPrice       string      `bson:"gas_price,omitempty" json:"gas_price,omitempty"`
	TotalAmount    string      `bson:"total_amount"     json:"total_amount"` // wei sum
	SubmittedAt    *time.Time  `bson:"submitted_at,omitempty" json:"submitted_at,omitempty"`
	ConfirmedAt    *time.Time  `bson:"confirmed_at,omitempty" json:"confirmed_at,omitempty"`
	RetryCount     int         `bson:"retry_count"      json:"retry_count"`
	LastError      string      `bson:"last_error,omitempty" json:"last_error,omitempty"`
}

// ─────────────────────────────────────────────
//  User — off-chain user record (comprehensive)
// ─────────────────────────────────────────────

// UserStatus represents the full account lifecycle.
type UserStatus string

const (
	UserStatusPendingVerification UserStatus = "PENDING_VERIFICATION"
	UserStatusActive              UserStatus = "ACTIVE"
	UserStatusSuspended           UserStatus = "SUSPENDED"
	UserStatusBanned              UserStatus = "BANNED"
	UserStatusDeactivated         UserStatus = "DEACTIVATED"
)

// UserRole defines RBAC roles used across the platform.
type UserRole string

const (
	RoleUser       UserRole = "USER"
	RoleModerator  UserRole = "MODERATOR"
	RoleAdmin      UserRole = "ADMIN"
	RoleSuperAdmin UserRole = "SUPER_ADMIN"
)

// KYCStatus represents know-your-customer verification state.
type KYCStatus string

const (
	KYCStatusNone     KYCStatus = "NONE"
	KYCStatusPending  KYCStatus = "PENDING"
	KYCStatusVerified KYCStatus = "VERIFIED"
	KYCStatusRejected KYCStatus = "REJECTED"
)

// KYCLevel defines depth of identity verification.
type KYCLevel int

const (
	KYCLevelNone     KYCLevel = 0 // no verification
	KYCLevelBasic    KYCLevel = 1 // email + phone confirmed
	KYCLevelStandard KYCLevel = 2 // government-issued ID
	KYCLevelAdvanced KYCLevel = 3 // face-match + liveness check
)

// KYCDocument holds a submitted KYC document reference (encrypted pointer to storage).
type KYCDocument struct {
	Type        string     `bson:"type"                    json:"type"`         // PASSPORT | NATIONAL_ID | DRIVER_LICENSE
	DocumentRef string     `bson:"document_ref"            json:"document_ref"` // encrypted storage key
	SubmittedAt time.Time  `bson:"submitted_at"            json:"submitted_at"`
	ReviewedAt  *time.Time `bson:"reviewed_at,omitempty"   json:"reviewed_at,omitempty"`
	ReviewNote  string     `bson:"review_note,omitempty"   json:"review_note,omitempty"`
}

// TwoFactorMethod is the type of 2FA configured for the account.
type TwoFactorMethod string

const (
	TwoFactorTOTP TwoFactorMethod = "TOTP"
)

// User is the comprehensive off-chain user entity.
// Authentication is wallet-based (SIWE / EIP-712) — no password stored.
type User struct {
	BaseEntity `bson:",inline"`

	// ── Identity ──────────────────────────────────────────────────────────
	WalletAddress string `bson:"wallet_address"         json:"wallet_address"` // checksummed EIP-55
	Username      string `bson:"username,omitempty"     json:"username,omitempty"`
	Email         string `bson:"email,omitempty"        json:"email,omitempty"`
	Phone         string `bson:"phone,omitempty"        json:"phone,omitempty"`

	// ── Profile ───────────────────────────────────────────────────────────
	FullName    string     `bson:"full_name,omitempty"    json:"full_name,omitempty"`
	AvatarURI   string     `bson:"avatar_uri,omitempty"   json:"avatar_uri,omitempty"`
	ProfileURI  string     `bson:"profile_uri,omitempty"  json:"profile_uri,omitempty"` // legacy alias
	Bio         string     `bson:"bio,omitempty"          json:"bio,omitempty"`
	DateOfBirth *time.Time `bson:"date_of_birth,omitempty" json:"date_of_birth,omitempty"`
	Country     string     `bson:"country,omitempty"      json:"country,omitempty"`  // ISO 3166-1 alpha-2
	Language    string     `bson:"language,omitempty"     json:"language,omitempty"` // BCP-47 (e.g. "en", "vi")
	Timezone    string     `bson:"timezone,omitempty"     json:"timezone,omitempty"` // IANA tz (e.g. "Asia/Ho_Chi_Minh")

	// ── Auth state ────────────────────────────────────────────────────────
	Nonce         string     `bson:"nonce"                   json:"-"` // SIWE challenge nonce (never expose)
	Status        UserStatus `bson:"status"                  json:"status"`
	EmailVerified bool       `bson:"email_verified"          json:"email_verified"`
	PhoneVerified bool       `bson:"phone_verified"          json:"phone_verified"`
	LastLoginAt   *time.Time `bson:"last_login_at,omitempty" json:"last_login_at,omitempty"`
	LastLoginIP   string     `bson:"last_login_ip,omitempty" json:"last_login_ip,omitempty"`
	LoginCount    int64      `bson:"login_count"             json:"login_count"`

	// ── Two-Factor Authentication ──────────────────────────────────────────
	TwoFactorEnabled bool            `bson:"two_factor_enabled"          json:"two_factor_enabled"`
	TwoFactorMethod  TwoFactorMethod `bson:"two_factor_method,omitempty" json:"two_factor_method,omitempty"`
	TOTPSecret       string          `bson:"totp_secret,omitempty"       json:"-"` // encrypted, never exposed via API
	TOTPBackupCodes  []string        `bson:"totp_backup_codes,omitempty" json:"-"` // SHA-256 hashed

	// ── KYC ───────────────────────────────────────────────────────────────
	KYCStatus     KYCStatus     `bson:"kyc_status"               json:"kyc_status"`
	KYCLevel      KYCLevel      `bson:"kyc_level"                json:"kyc_level"`
	KYCDocuments  []KYCDocument `bson:"kyc_documents,omitempty"  json:"kyc_documents,omitempty"`
	KYCVerifiedAt *time.Time    `bson:"kyc_verified_at,omitempty" json:"kyc_verified_at,omitempty"`

	// ── RBAC ──────────────────────────────────────────────────────────────
	Roles       []UserRole `bson:"roles"                  json:"roles"`
	Permissions []string   `bson:"permissions,omitempty"  json:"permissions,omitempty"` // extra granular grants

	// ── Security tracking ─────────────────────────────────────────────────
	FailedLoginAttempts int        `bson:"failed_login_attempts"    json:"-"`
	LockedUntil         *time.Time `bson:"locked_until,omitempty"   json:"-"`
	SuspendedAt         *time.Time `bson:"suspended_at,omitempty"   json:"suspended_at,omitempty"`
	SuspendReason       string     `bson:"suspend_reason,omitempty" json:"suspend_reason,omitempty"`

	// ── Extensibility ─────────────────────────────────────────────────────
	ReferralCode   string         `bson:"referral_code,omitempty" json:"referral_code,omitempty"`
	ReferredBy     string         `bson:"referred_by,omitempty"   json:"referred_by,omitempty"` // wallet address
	ActivityPoints int64          `bson:"activity_points"         json:"activity_points"`
	Class          string         `bson:"class,omitempty"         json:"class,omitempty"` // student class / group (e.g. "CNTT-K2024")
	Tags           []string       `bson:"tags,omitempty"          json:"tags,omitempty"`
	Metadata       map[string]any `bson:"metadata,omitempty"      json:"metadata,omitempty"` // open key-value store
}

// IsActive reports whether the account can perform operations.
func (u *User) IsActive() bool { return u.Status == UserStatusActive }

// IsLocked reports whether the account is temporarily locked due to brute-force.
func (u *User) IsLocked() bool {
	return u.LockedUntil != nil && u.LockedUntil.After(time.Now())
}

// HasRole reports whether the user holds a specific RBAC role.
func (u *User) HasRole(role UserRole) bool {
	for _, r := range u.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// IsAdmin reports whether the user has admin privileges.
func (u *User) IsAdmin() bool {
	return u.HasRole(RoleAdmin) || u.HasRole(RoleSuperAdmin)
}

// HasPermission reports whether the user has a specific permission (admins pass all).
func (u *User) HasPermission(perm string) bool {
	if u.IsAdmin() {
		return true
	}
	for _, p := range u.Permissions {
		if p == perm {
			return true
		}
	}
	return false
}

// IsKYCVerified reports whether the user has completed identity verification.
func (u *User) IsKYCVerified() bool { return u.KYCStatus == KYCStatusVerified }

// RoleStrings returns roles as string slice (for JWT claims).
func (u *User) RoleStrings() []string {
	s := make([]string, len(u.Roles))
	for i, r := range u.Roles {
		s[i] = string(r)
	}
	return s
}

// ─────────────────────────────────────────────
//  NFT Metadata — off-chain NFT record
// ─────────────────────────────────────────────

// NFTType classifies the NFT purpose.
type NFTType string

const (
	NFTTypeCertificate NFTType = "CERTIFICATE"
	NFTTypeBadge       NFTType = "BADGE"
	NFTTypeAchievement NFTType = "ACHIEVEMENT"
)

// NFTTier represents the rarity/reward tier of a badge NFT.
// Used in DAO vote-power calculation (Bronze→50%, Silver→100%, Gold→200% boost).
type NFTTier string

const (
	NFTTierNone   NFTTier = ""
	NFTTierBronze NFTTier = "BRONZE"
	NFTTierSilver NFTTier = "SILVER"
	NFTTierGold   NFTTier = "GOLD"
)

// VotePowerBoostBps returns the additional basis-points multiplier for the tier.
// vote_power = token_balance × (1 + boost_bps/10000)
func (t NFTTier) VotePowerBoostBps() int64 {
	switch t {
	case NFTTierBronze:
		return 5000 // 50 %
	case NFTTierSilver:
		return 10000 // 100 %
	case NFTTierGold:
		return 20000 // 200 %
	default:
		return 0
	}
}

// NFT represents an off-chain NFT record mirroring on-chain ERC1155 data.
type NFT struct {
	BaseEntity `bson:",inline"`

	TokenID     string         `bson:"token_id"    json:"token_id"` // uint256 as string
	Type        NFTType        `bson:"type"        json:"type"`
	Tier        NFTTier        `bson:"tier,omitempty" json:"tier,omitempty"` // BRONZE/SILVER/GOLD for badge NFTs
	Owner       string         `bson:"owner"       json:"owner"`             // checksummed address
	Creator     string         `bson:"creator"     json:"creator"`           // checksummed address
	Name        string         `bson:"name"        json:"name"`
	Description string         `bson:"description" json:"description"`
	ImageURI    string         `bson:"image_uri"   json:"image_uri"`
	MetadataURI string         `bson:"metadata_uri" json:"metadata_uri"`
	Supply      string         `bson:"supply"      json:"supply"` // uint256 as string
	TxHash      string         `bson:"tx_hash"     json:"tx_hash"`
	BlockNumber uint64         `bson:"block_number" json:"block_number"`
	Attributes  []NFTAttribute `bson:"attributes,omitempty" json:"attributes,omitempty"`
}

// NFTAttribute is an OpenSea-compatible trait.
type NFTAttribute struct {
	TraitType string      `bson:"trait_type" json:"trait_type"`
	Value     interface{} `bson:"value"      json:"value"`
}

// Package auth — configuration and request/response DTO types.
package auth

import (
	"time"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/http/request"
)

// ─────────────────────────────────────────────
//  Service configuration
// ─────────────────────────────────────────────

// Config holds tuneable parameters for the auth service.
type Config struct {
	JWTSecret     string
	JWTIssuer     string
	AccessTTL     time.Duration // recommended: 15 min
	RefreshTTL    time.Duration // recommended: 7 days
	ChallengeTTL  time.Duration // recommended: 5 min
	Pending2FATTL time.Duration // recommended: 5 min
	SIWEDomain    string        // e.g. "vndc.io"

	// Brute-force protection.
	MaxFailedAttempts int           // default: 5
	LockDuration      time.Duration // default: 30 min
}

func (c *Config) setDefaults() {
	if c.AccessTTL == 0 {
		c.AccessTTL = 15 * time.Minute
	}
	if c.RefreshTTL == 0 {
		c.RefreshTTL = 7 * 24 * time.Hour
	}
	if c.ChallengeTTL == 0 {
		c.ChallengeTTL = 5 * time.Minute
	}
	if c.Pending2FATTL == 0 {
		c.Pending2FATTL = 5 * time.Minute
	}
	if c.MaxFailedAttempts == 0 {
		c.MaxFailedAttempts = 5
	}
	if c.LockDuration == 0 {
		c.LockDuration = 30 * time.Minute
	}
}

// ─────────────────────────────────────────────
//  Challenge
// ─────────────────────────────────────────────

// ChallengeResponse is returned by GetChallenge for the client to sign.
type ChallengeResponse struct {
	Message   string    `json:"message"`
	Nonce     string    `json:"nonce"`
	ExpiresAt time.Time `json:"expires_at"`
}

// ─────────────────────────────────────────────
//  Login
// ─────────────────────────────────────────────

// LoginRequest carries the SIWE signature and optional device metadata.
// IP address and User-Agent are server-injected via request.Meta.
type LoginRequest struct {
	Wallet       string `json:"wallet"     validate:"required,eth_addr"`
	Signature    string `json:"signature"  validate:"required"` // 0x-prefixed hex
	Message      string `json:"message"    validate:"required"` // The SIWE message that was signed
	DeviceName   string `json:"device_name,omitempty"`
	DeviceOS     string `json:"device_os,omitempty"`
	request.Meta        // IPAddress + UserAgent — populated by handler, never from JSON
}

// TokenPair is returned on successful authentication (or after 2FA completion).
type TokenPair struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	ExpiresAt    time.Time    `json:"expires_at"` // access token expiry
	TokenType    string       `json:"token_type"` // "Bearer"
	User         *domain.User `json:"user"`
}

// LoginResult is the union type returned by Login.
// Exactly one of TokenPair or TempToken will be non-zero.
type LoginResult struct {
	TokenPair *TokenPair
	// Requires2FA is true when the user has TOTP enabled.
	// In that case TempToken holds the short-lived opaque session for /auth/2fa/complete.
	Requires2FA bool
	TempToken   string
}

// ─────────────────────────────────────────────
//  2FA completion
// ─────────────────────────────────────────────

// Complete2FARequest carries the pending temp token and the TOTP (or backup) code.
type Complete2FARequest struct {
	TempToken    string `json:"temp_token"  validate:"required"`
	Code         string `json:"code"        validate:"required"`
	DeviceName   string `json:"device_name,omitempty"`
	DeviceOS     string `json:"device_os,omitempty"`
	request.Meta        // IPAddress + UserAgent — server-injected
}

// ─────────────────────────────────────────────
//  Token refresh
// ─────────────────────────────────────────────

// RefreshRequest carries the opaque refresh token from the client.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
	request.Meta        // IPAddress + UserAgent — server-injected
}

// ─────────────────────────────────────────────
//  Logout
// ─────────────────────────────────────────────

// LogoutRequest carries all context needed to revoke a session.
// All fields are injected by the handler from JWT claims and context — never from JSON body.
type LogoutRequest struct {
	JWTID        string // jti claim from access token
	SessionID    string // session_id claim from access token
	UserID       string // sub claim from access token
	Wallet       string // wallet_address claim from access token
	LogoutAll    bool   `json:"logout_all"` // true → revoke all sessions
	request.Meta        // IPAddress + UserAgent — server-injected
}

// ─────────────────────────────────────────────
//  2FA management
// ─────────────────────────────────────────────

// Setup2FAResponse holds the TOTP provisioning data for the client.
// Displayed only once — the user must store the backup codes securely.
type Setup2FAResponse struct {
	Secret      string   `json:"secret"`       // base32 — for manual authenticator entry
	OTPAuthURI  string   `json:"otp_auth_uri"` // otpauth:// URI for QR code generation
	BackupCodes []string `json:"backup_codes"` // 8 one-time recovery codes
}

// Enable2FARequest confirms TOTP setup by validating a live code from the authenticator app.
type Enable2FARequest struct {
	Code         string `json:"code" validate:"required,len=6"`
	UserID       string `json:"-"` // injected from JWT sub claim
	request.Meta        // IPAddress + UserAgent — server-injected
}

// Disable2FARequest deactivates TOTP after re-verifying identity with the current code.
type Disable2FARequest struct {
	Code         string `json:"code" validate:"required"`
	UserID       string `json:"-"` // injected from JWT sub claim
	request.Meta        // IPAddress + UserAgent — server-injected
}

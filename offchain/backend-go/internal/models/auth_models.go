// Package models — swagger model definitions for the auth module.
package models

import "time"

// ─────────────────────────────────────────────
//  /auth/challenge
// ─────────────────────────────────────────────

// ChallengeData is the payload inside a successful challenge response.
type ChallengeData struct {
	// Message is the full EIP-191 formatted message the wallet must sign.
	Message string `json:"message" example:"vndc.io wants you to sign in with your Ethereum account:\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\n\nSign in to VNDC Platform\n\nNonce: a1b2c3d4e5f6..."`
	// Nonce is the single-use random string embedded in the message.
	Nonce     string    `json:"nonce"      example:"a1b2c3d4e5f6a7b8c9d0e1f2"`
	ExpiresAt time.Time `json:"expires_at" example:"2026-04-24T07:05:00Z"`
}

// ChallengeResponse is the envelope wrapping a ChallengeData payload.
type ChallengeResponse struct {
	Success bool          `json:"success" example:"true"`
	Data    ChallengeData `json:"data"`
	Meta    ResponseMeta  `json:"meta"`
}

// ─────────────────────────────────────────────
//  /auth/login
// ─────────────────────────────────────────────

// LoginRequest is the body for POST /auth/login.
type LoginRequest struct {
	// Wallet is the checksummed Ethereum wallet address.
	Wallet string `json:"wallet"              example:"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`
	// Signature is the 0x-prefixed EIP-191 personal_sign output.
	Signature  string `json:"signature"           example:"0x4a5b6c...130hexchars...ab"`
	DeviceName string `json:"device_name,omitempty" example:"iPhone 15 Pro"`
	DeviceOS   string `json:"device_os,omitempty"   example:"iOS 17"`
}

// TokenPairData holds the issued JWT pair and associated metadata.
type TokenPairData struct {
	// AccessToken is a short-lived JWT (15 min). Send in Authorization: Bearer <token>.
	AccessToken string `json:"access_token"  example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
	// RefreshToken is an opaque token used to obtain a new access token. Treat as secret.
	RefreshToken string    `json:"refresh_token" example:"b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8..."`
	ExpiresAt    time.Time `json:"expires_at"    example:"2026-04-24T07:15:00Z"`
	TokenType    string    `json:"token_type"    example:"Bearer"`
	User         UserInfo  `json:"user"`
}

// LoginResponse is the envelope for a full login success (no 2FA).
type LoginResponse struct {
	Success bool          `json:"success" example:"true"`
	Data    TokenPairData `json:"data"`
	Meta    ResponseMeta  `json:"meta"`
}

// Login2FAResponse is returned when the account has 2FA enabled.
// The client must call POST /auth/2fa/complete with the temp_token.
type Login2FAResponse struct {
	Success bool         `json:"success" example:"true"`
	Data    Login2FAData `json:"data"`
	Meta    ResponseMeta `json:"meta"`
}

// Login2FAData is the payload inside a 2FA-pending login response.
type Login2FAData struct {
	Requires2FA bool `json:"requires_2fa" example:"true"`
	// TempToken is a short-lived (5 min) opaque token passed to /auth/2fa/complete.
	TempToken string `json:"temp_token" example:"9f8e7d6c5b4a3210fedcba9876543210"`
	Message   string `json:"message"    example:"TOTP code required — call /auth/2fa/complete"`
}

// ─────────────────────────────────────────────
//  /auth/2fa/complete
// ─────────────────────────────────────────────

// Complete2FARequest is the body for POST /auth/2fa/complete.
type Complete2FARequest struct {
	// TempToken is the value returned by POST /auth/login when requires_2fa is true.
	TempToken string `json:"temp_token"          example:"9f8e7d6c5b4a3210fedcba9876543210"`
	// Code is a 6-digit TOTP code or an 8-character backup code.
	Code       string `json:"code"                example:"123456"`
	DeviceName string `json:"device_name,omitempty" example:"iPhone 15 Pro"`
	DeviceOS   string `json:"device_os,omitempty"   example:"iOS 17"`
}

// ─────────────────────────────────────────────
//  /auth/refresh
// ─────────────────────────────────────────────

// RefreshRequest is the body for POST /auth/refresh.
type RefreshRequest struct {
	// RefreshToken is the opaque token issued at login.
	RefreshToken string `json:"refresh_token" example:"b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8..."`
}

// ─────────────────────────────────────────────
//  /auth/sessions
// ─────────────────────────────────────────────

// SessionListResponse is the envelope for listing active sessions.
type SessionListResponse struct {
	Success bool          `json:"success" example:"true"`
	Data    []SessionInfo `json:"data"`
	Meta    ResponseMeta  `json:"meta"`
}

// ─────────────────────────────────────────────
//  /auth/2fa/setup
// ─────────────────────────────────────────────

// Setup2FAData is returned by POST /auth/2fa/setup.
type Setup2FAData struct {
	// Secret is the base-32 encoded TOTP secret to enter in an authenticator app.
	Secret string `json:"secret"       example:"JBSWY3DPEHPK3PXP"`
	// OTPAuthURI is the otpauth:// URI to encode as a QR code.
	OTPAuthURI string `json:"otp_auth_uri" example:"otpauth://totp/vndc.io:0xd8dA...?secret=JBSWY3DP&issuer=vndc.io"`
	// BackupCodes are one-time plaintext codes — shown ONCE. Store securely.
	BackupCodes []string `json:"backup_codes" example:"[\"ABCD1234\",\"EFGH5678\"]"`
}

// Setup2FAResponse is the envelope for POST /auth/2fa/setup.
type Setup2FAResponse struct {
	Success bool         `json:"success" example:"true"`
	Data    Setup2FAData `json:"data"`
	Meta    ResponseMeta `json:"meta"`
}

// ─────────────────────────────────────────────
//  /auth/2fa/enable  &  /auth/2fa/disable
// ─────────────────────────────────────────────

// Enable2FARequest is the body for POST /auth/2fa/enable.
type Enable2FARequest struct {
	// Code is the current 6-digit TOTP code to confirm the secret is correctly configured.
	Code string `json:"code" example:"123456"`
}

// Disable2FARequest is the body for POST /auth/2fa/disable.
type Disable2FARequest struct {
	// Code is a 6-digit TOTP code or an 8-character backup code.
	Code string `json:"code" example:"123456"`
}

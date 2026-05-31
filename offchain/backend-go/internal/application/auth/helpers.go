// Package auth — cryptographic and address utility helpers.
// All functions here are package-private (unexported).
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"strings"

	"github.com/vndc/backend/pkg/totp"
)

// generateNonce returns 16 cryptographically random bytes encoded as lowercase hex.
// The auth module reuses this helper for short-lived SIWE nonces and temporary 2FA continuation tokens.
func generateNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// generateRefreshToken returns a longer opaque token suitable for refresh-token issuance.
// The raw token is delivered to the client, while persistence layers store only its hashed representation.
func generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashToken computes the deterministic digest used when storing refresh or backup-like tokens safely.
// Hashing keeps secret bearer material out of persistent storage while still supporting equality checks.
func hashToken(raw string) string {
	return totp.HashBackupCode(raw)
}

// normalizeAddress trims, lowercases, and lightly validates an Ethereum address for auth-flow comparisons.
// Returning an empty string on malformed input gives callers a simple invalid-address sentinel.
func normalizeAddress(addr string) string {
	addr = strings.ToLower(strings.TrimSpace(addr))
	if len(addr) != 42 || !strings.HasPrefix(addr, "0x") {
		return ""
	}
	return addr
}

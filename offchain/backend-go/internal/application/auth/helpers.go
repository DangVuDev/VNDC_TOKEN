// Package auth — cryptographic and address utility helpers.
// All functions here are package-private (unexported).
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/vndc/backend/pkg/totp"
)

// generateNonce returns 16 cryptographically random bytes as a lowercase hex string.
// Used for SIWE challenge nonces and pending-2FA tokens.
func generateNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// generateRefreshToken returns 32 cryptographically random bytes as hex.
// This is the raw opaque refresh token sent to the client; it is never stored plaintext.
func generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashToken computes a stable SHA-256 hex digest for safe token storage.
// Reuses pkg/totp's SHA-256 helper — no additional dependency.
func hashToken(raw string) string {
	return totp.HashBackupCode(raw)
}

// hexToBytes decodes a 0x-prefixed or plain hex string into bytes.
func hexToBytes(s string) ([]byte, error) {
	s = strings.TrimPrefix(s, "0x")
	b, err := hex.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("hex decode: %w", err)
	}
	return b, nil
}

// normalizeAddress lowercases and validates an Ethereum address.
// Returns "" if the address is malformed (wrong length or missing 0x prefix).
func normalizeAddress(addr string) string {
	addr = strings.ToLower(strings.TrimSpace(addr))
	if len(addr) != 42 || !strings.HasPrefix(addr, "0x") {
		return ""
	}
	return addr
}

// Package totp implements Time-Based One-Time Passwords per RFC 6238.
// Uses only Go standard library — no external dependencies.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math"
	"strings"
	"time"
)

const (
	// SecretBytes is the length of the raw random secret (160-bit).
	SecretBytes = 20
	// Digits is the number of OTP digits produced.
	Digits = 6
	// Period is the TOTP time step in seconds (RFC 6238 default).
	Period = 30
	// Window is how many steps ±current we accept (clock skew tolerance).
	Window = 1
	// BackupCodeCount is the number of backup codes generated per account.
	BackupCodeCount = 8
)

// ─────────────────────────────────────────────
//  Secret management
// ─────────────────────────────────────────────

// GenerateSecret creates a cryptographically random base32-encoded TOTP secret.
func GenerateSecret() (string, error) {
	key := make([]byte, SecretBytes)
	if _, err := rand.Read(key); err != nil {
		return "", fmt.Errorf("totp: generate secret: %w", err)
	}
	return base32.StdEncoding.EncodeToString(key), nil
}

// ─────────────────────────────────────────────
//  Code generation & verification
// ─────────────────────────────────────────────

// Generate produces the TOTP code for the given secret at time t.
func Generate(secret string, t time.Time) (string, error) {
	key, err := decodeSecret(secret)
	if err != nil {
		return "", err
	}
	counter := uint64(math.Floor(float64(t.Unix()) / Period))
	return hotp(key, counter), nil
}

// Verify checks whether code is valid for secret within the clock-skew Window.
// Uses constant-time comparison to prevent timing attacks.
func Verify(secret, code string) (bool, error) {
	key, err := decodeSecret(secret)
	if err != nil {
		return false, err
	}
	now := time.Now().Unix()
	for delta := -Window; delta <= Window; delta++ {
		counter := uint64(math.Floor(float64(now+int64(delta)*Period) / Period))
		expected := hotp(key, counter)
		if subtle.ConstantTimeCompare([]byte(expected), []byte(code)) == 1 {
			return true, nil
		}
	}
	return false, nil
}

// OTPAuthURI builds the otpauth:// URI for QR-code rendering on the client.
func OTPAuthURI(issuer, accountName, secret string) string {
	return fmt.Sprintf(
		"otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d",
		issuer, accountName, secret, issuer, Digits, Period,
	)
}

// ─────────────────────────────────────────────
//  Backup codes
// ─────────────────────────────────────────────

// GenerateBackupCodes produces BackupCodeCount one-time recovery codes.
// Format: "XXXX-XXXX" (8 uppercase alphanumeric chars, hyphen separator).
func GenerateBackupCodes() (plain []string, hashed []string, err error) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	plain = make([]string, BackupCodeCount)
	hashed = make([]string, BackupCodeCount)
	for i := range plain {
		b := make([]byte, 8)
		if _, err = rand.Read(b); err != nil {
			return nil, nil, fmt.Errorf("totp: backup code: %w", err)
		}
		code := make([]byte, 8)
		for j, v := range b {
			code[j] = chars[int(v)%len(chars)]
		}
		plain[i] = string(code[:4]) + "-" + string(code[4:])
		hashed[i] = HashBackupCode(plain[i])
	}
	return plain, hashed, nil
}

// HashBackupCode returns the SHA-256 hex digest of a backup code.
// Backup codes are high-entropy random strings, so SHA-256 is sufficient
// (no bcrypt needed — the entropy is in the code itself, not a weak password).
func HashBackupCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// ConsumeBackupCode checks whether code matches any stored hash, removes the
// matched hash from the slice, and returns the updated slice.
// Returns (updatedHashes, true) on match, (original, false) on miss.
func ConsumeBackupCode(code string, hashes []string) ([]string, bool) {
	target := HashBackupCode(code)
	for i, h := range hashes {
		if subtle.ConstantTimeCompare([]byte(h), []byte(target)) == 1 {
			// Remove matched code — one-time use.
			updated := make([]string, 0, len(hashes)-1)
			updated = append(updated, hashes[:i]...)
			updated = append(updated, hashes[i+1:]...)
			return updated, true
		}
	}
	return hashes, false
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

// decodeSecret base32-decodes the secret (case-insensitive, no padding required).
func decodeSecret(secret string) ([]byte, error) {
	s := strings.ToUpper(strings.TrimRight(secret, "="))
	// Pad to multiple of 8 chars.
	if pad := len(s) % 8; pad != 0 {
		s += strings.Repeat("=", 8-pad)
	}
	key, err := base32.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("totp: invalid secret: %w", err)
	}
	return key, nil
}

// hotp computes HMAC-SHA1 based OTP (RFC 4226) for a counter value.
func hotp(key []byte, counter uint64) string {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, counter)

	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	sum := mac.Sum(nil)

	// Dynamic truncation (RFC 4226 §5.4).
	offset := sum[len(sum)-1] & 0x0F
	code := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7FFFFFFF
	code %= uint32(math.Pow10(Digits))
	return fmt.Sprintf("%0*d", Digits, code)
}

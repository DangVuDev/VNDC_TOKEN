// Package token — address utilities and balance snapshot conversion.
package token

import (
	"strings"
	"time"

	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
)

// normalizeAddress lowercases and validates an Ethereum address.
// Returns an empty string if addr is not a valid 0x-prefixed 42-character hex address.
func normalizeAddress(addr string) string {
	lower := strings.ToLower(strings.TrimSpace(addr))
	if !strings.HasPrefix(lower, "0x") || len(lower) != 42 {
		return ""
	}
	return lower
}

// hexToBytes decodes a 0x-prefixed hex string into a byte slice using manual
// byte-level decoding (no encoding/hex dependency — avoids additional import).
func hexToBytes(s string) ([]byte, error) {
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		s = s[2:]
	}
	if len(s)%2 != 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "odd-length hex string")
	}
	b := make([]byte, len(s)/2)
	for i := range b {
		hi := hexVal(s[i*2])
		lo := hexVal(s[i*2+1])
		if hi > 15 || lo > 15 {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid hex character")
		}
		b[i] = hi<<4 | lo
	}
	return b, nil
}

// hexVal maps a single ASCII hex character to its nibble value (0–15).
// Returns 255 for invalid characters (caller checks > 15).
func hexVal(c byte) byte {
	switch {
	case c >= '0' && c <= '9':
		return c - '0'
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10
	default:
		return 255
	}
}

// snapshotToBalance converts a ports.BalanceSnapshot into the HTTP response type.
// BalanceSnapshot fields (OnChain, Pending, Available) are decimal-string amounts.
func snapshotToBalance(wallet string, snap *ports.BalanceSnapshot) *BalanceResponse {
	return &BalanceResponse{
		Wallet:    wallet,
		OnChain:   snap.OnChain,
		Pending:   snap.Pending,
		Available: snap.Available,
		SyncedAt:  snap.SyncedAt.UTC().Format(time.RFC3339),
	}
}

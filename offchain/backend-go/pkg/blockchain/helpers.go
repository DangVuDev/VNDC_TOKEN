// Package blockchain — Ethereum utilities
package blockchain

import (
	"strings"

	apperr "github.com/vndc/backend/pkg/errors"
)

// HexToBytes decodes a 0x-prefixed or plain hex string into a byte slice.
// Performs manual byte-level decoding without external dependencies.
func HexToBytes(s string) ([]byte, error) {
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		s = s[2:]
	}
	if len(s)%2 != 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "odd-length hex string")
	}
	b := make([]byte, len(s)/2)
	for i := range b {
		hi := hexNibble(s[i*2])
		lo := hexNibble(s[i*2+1])
		if hi > 15 || lo > 15 {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid hex character")
		}
		b[i] = hi<<4 | lo
	}
	return b, nil
}

// hexNibble maps a single ASCII hex character to its nibble value (0–15).
// Returns 255 for invalid characters (caller checks > 15).
func hexNibble(c byte) byte {
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

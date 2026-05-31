// Package token — address utilities and balance snapshot conversion.
package token

import (
	"strings"

	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/timeutil"
)

// normalizeAddress trims and canonicalizes wallet addresses before cache, repository, or contract lookups.
// It intentionally performs lightweight validation only, returning an empty string when the format is obviously invalid.
func normalizeAddress(addr string) string {
	lower := strings.ToLower(strings.TrimSpace(addr))
	if !strings.HasPrefix(lower, "0x") || len(lower) != 42 {
		return ""
	}
	return lower
}

// snapshotToBalance converts an internal balance snapshot into the token module's public response shape.
// Timestamp formatting is handled here so service methods can stay focused on balance calculation rather than presentation.
func snapshotToBalance(wallet string, snap *ports.BalanceSnapshot) *BalanceResponse {
	return &BalanceResponse{
		Wallet:    wallet,
		OnChain:   snap.OnChain,
		Pending:   snap.Pending,
		Available: snap.Available,
		SyncedAt:  timeutil.FormatRFC3339UTC7(snap.SyncedAt),
	}
}

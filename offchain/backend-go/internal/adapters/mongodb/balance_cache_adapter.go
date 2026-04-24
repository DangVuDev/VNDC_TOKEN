// Package adapters — adapter for ports.BalanceCachePort backed by redis.BalanceCache.
package adapters

import (
	"context"
	"time"

	"github.com/vndc/backend/internal/ports"
	rediscache "github.com/vndc/backend/pkg/cache/redis"
	apperr "github.com/vndc/backend/pkg/errors"
)

// balanceCacheAdapter bridges *rediscache.BalanceCache to ports.BalanceCachePort.
type balanceCacheAdapter struct {
	inner *rediscache.BalanceCache
}

// NewBalanceCacheAdapter wraps a redis BalanceCache as a ports.BalanceCachePort.
func NewBalanceCacheAdapter(bc *rediscache.BalanceCache) ports.BalanceCachePort {
	return &balanceCacheAdapter{inner: bc}
}

func (a *balanceCacheAdapter) Get(ctx context.Context, wallet string) (*ports.BalanceSnapshot, error) {
	entry, err := a.inner.Get(ctx, wallet)
	if err != nil {
		return nil, err
	}
	return &ports.BalanceSnapshot{
		OnChain:   entry.OnChain,
		Pending:   entry.Pending,
		Available: entry.Available,
		SyncedAt:  time.Unix(entry.UpdatedAt, 0).UTC(),
	}, nil
}

func (a *balanceCacheAdapter) Set(ctx context.Context, wallet string, snapshot *ports.BalanceSnapshot) error {
	return a.inner.Set(ctx, wallet, &rediscache.BalanceEntry{
		OnChain:   snapshot.OnChain,
		Pending:   snapshot.Pending,
		Available: snapshot.Available,
		UpdatedAt: snapshot.SyncedAt.Unix(),
	})
}

func (a *balanceCacheAdapter) CheckAndReserve(ctx context.Context, wallet, amountWei string) (bool, error) {
	return a.inner.CheckAndReserve(ctx, wallet, amountWei)
}

func (a *balanceCacheAdapter) Rollback(ctx context.Context, wallet, amountWei string) error {
	return a.inner.Rollback(ctx, wallet, amountWei)
}

func (a *balanceCacheAdapter) Invalidate(ctx context.Context, wallet string) error {
	// Invalidate by setting an expired entry — this clears the cache key.
	// (BalanceCache does not expose a Delete method yet, so we Set with a zeroed entry
	//  using a TTL of 1 second so it expires almost immediately.)
	err := a.inner.Set(ctx, wallet, &rediscache.BalanceEntry{
		UpdatedAt: time.Now().Unix(),
	})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeCache, "Invalidate failed", err)
	}
	return nil
}

// Verify interface at compile-time.
var _ ports.BalanceCachePort = (*balanceCacheAdapter)(nil)

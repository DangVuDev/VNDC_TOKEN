// Package adapters contains infrastructure adapters that translate domain ports to concrete persistence or cache implementations.
// This file provides the Redis-backed implementation for the balance cache port used by transaction and balance services.
package adapters

import (
	"context"
	"time"

	"github.com/vndc/backend/internal/ports"
	rediscache "github.com/vndc/backend/pkg/cache/redis"
)

// balanceCacheAdapter bridges the Redis cache helper to the BalanceCachePort expected by the application layer.
// It keeps Redis-specific data shapes and cache semantics out of higher-level services.
type balanceCacheAdapter struct {
	inner *rediscache.BalanceCache
}

// NewBalanceCacheAdapter exposes the Redis balance cache through the BalanceCachePort interface.
// This keeps callers dependent on the port contract instead of the concrete Redis helper type or storage layout.
func NewBalanceCacheAdapter(bc *rediscache.BalanceCache) ports.BalanceCachePort {
	return &balanceCacheAdapter{inner: bc}
}

// Get reads a cached balance entry and converts it into the port-level snapshot used by services.
// The timestamp translation keeps cache metadata consistent with the UTC time representation expected by the application layer.
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

// Set writes a port-level balance snapshot back into Redis using the cache helper's entry format.
// The adapter performs the shape conversion so service code never needs to know the Redis schema or timestamp encoding.
func (a *balanceCacheAdapter) Set(ctx context.Context, wallet string, snapshot *ports.BalanceSnapshot) error {
	return a.inner.Set(ctx, wallet, &rediscache.BalanceEntry{
		OnChain:   snapshot.OnChain,
		Pending:   snapshot.Pending,
		Available: snapshot.Available,
		UpdatedAt: snapshot.SyncedAt.Unix(),
	})
}

// CheckAndReserve asks the cache to atomically verify available balance and reserve an amount if possible.
// Keeping the signature aligned with the port allows transaction orchestration code to remain completely storage-agnostic.
func (a *balanceCacheAdapter) CheckAndReserve(ctx context.Context, wallet, amountWei string) (bool, error) {
	return a.inner.CheckAndReserve(ctx, wallet, amountWei)
}

// Rollback releases a previously reserved balance amount through the underlying cache implementation.
// This is used when a transaction attempt fails, is cancelled, or is rolled back after optimistic reservation.
func (a *balanceCacheAdapter) Rollback(ctx context.Context, wallet, amountWei string) error {
	return a.inner.Rollback(ctx, wallet, amountWei)
}

// Invalidate removes the cached balance entry so the next lookup is forced to refresh from a source of truth.
// This is important after writes or reconciliations that may leave the cache stale relative to on-chain balance state.
func (a *balanceCacheAdapter) Invalidate(ctx context.Context, wallet string) error {
	// Properly delete the key so the next Get returns a cache miss,
	// which triggers a fresh blockchain balance fetch.
	return a.inner.Delete(ctx, wallet)
}

// Verify interface at compile-time.
var _ ports.BalanceCachePort = (*balanceCacheAdapter)(nil)

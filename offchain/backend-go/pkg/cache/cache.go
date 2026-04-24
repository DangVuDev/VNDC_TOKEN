// Package cache defines the generic Cache interface used across the application.
// Implementations are in sub-packages (redis, memcached, etc.).
package cache

import (
	"context"
	"time"
)

// Cache[T] is a generic key-value cache interface.
// T must be JSON-serializable.
type Cache[T any] interface {
	// Get retrieves a value. Returns ErrCacheMiss if not found.
	Get(ctx context.Context, key string) (*T, error)

	// Set stores a value with TTL. 0 TTL means no expiry.
	Set(ctx context.Context, key string, value *T, ttl time.Duration) error

	// Delete removes a key.
	Delete(ctx context.Context, key string) error

	// Exists checks if a key exists without fetching value.
	Exists(ctx context.Context, key string) (bool, error)

	// GetOrSet atomically fetches a value, calling fn on cache miss.
	GetOrSet(ctx context.Context, key string, ttl time.Duration, fn func(ctx context.Context) (*T, error)) (*T, error)

	// SetMany stores multiple key-value pairs atomically.
	SetMany(ctx context.Context, items map[string]*T, ttl time.Duration) error

	// DeleteMany removes multiple keys.
	DeleteMany(ctx context.Context, keys ...string) error

	// InvalidateByPrefix deletes all keys matching the prefix.
	InvalidateByPrefix(ctx context.Context, prefix string) error
}

// RawCache provides access to raw Redis commands for advanced usage.
// Use only when Cache[T] is insufficient.
type RawCache interface {
	// Increment atomically increments a counter.
	Increment(ctx context.Context, key string, delta int64) (int64, error)

	// IncrementBy atomically increments with TTL (for nonce, rate limit).
	IncrementWithTTL(ctx context.Context, key string, delta int64, ttl time.Duration) (int64, error)

	// SetNX sets a key only if it does not exist (distributed lock primitive).
	SetNX(ctx context.Context, key string, value interface{}, ttl time.Duration) (bool, error)

	// Eval executes a Lua script atomically.
	Eval(ctx context.Context, script string, keys []string, args ...interface{}) (interface{}, error)

	// Expire refreshes the TTL of an existing key.
	Expire(ctx context.Context, key string, ttl time.Duration) error

	// TTL returns remaining TTL of a key. -1 if no expiry, -2 if not found.
	TTL(ctx context.Context, key string) (time.Duration, error)
}

// ErrCacheMiss is returned when a key is not found in the cache.
var ErrCacheMiss = &cacheMissError{}

type cacheMissError struct{}

func (e *cacheMissError) Error() string     { return "cache: key not found" }
func (e *cacheMissError) IsCacheMiss() bool { return true }

// IsCacheMiss returns true if the error is a cache miss.
func IsCacheMiss(err error) bool {
	type hasCacheMiss interface{ IsCacheMiss() bool }
	cm, ok := err.(hasCacheMiss)
	return ok && cm.IsCacheMiss()
}

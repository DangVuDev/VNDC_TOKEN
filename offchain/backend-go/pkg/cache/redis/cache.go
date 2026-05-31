// Package redis provides a generic Cache[T] implementation backed by Redis.
// Uses JSON serialization and supports all Cache operations including
// Lua scripts for atomic operations (rate limiting, nonce, balance).
package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/vndc/backend/pkg/cache"
	apperr "github.com/vndc/backend/pkg/errors"
)

// ─────────────────────────────────────────────
//  Client
// ─────────────────────────────────────────────

// ClientConfig holds Redis connection settings.
type ClientConfig struct {
	Addr         string
	Password     string
	DB           int
	PoolSize     int
	MinIdleConns int
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	MaxRetries   int
	KeyPrefix    string
}

// Client wraps *goredis.Client with health and raw operations.
type Client struct {
	rdb       *goredis.Client
	keyPrefix string
}

// NewClient creates and validates a Redis connection.
func NewClient(ctx context.Context, cfg ClientConfig) (*Client, error) {
	rdb := goredis.NewClient(&goredis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
		DialTimeout:  cfg.DialTimeout,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		MaxRetries:   cfg.MaxRetries,
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis: ping: %w", err)
	}

	return &Client{rdb: rdb, keyPrefix: cfg.KeyPrefix}, nil
}

// Health checks Redis connectivity.
func (c *Client) Health(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// Close closes the Redis connection pool.
func (c *Client) Close() error { return c.rdb.Close() }

// Raw returns the underlying *goredis.Client for advanced operations.
func (c *Client) Raw() *goredis.Client { return c.rdb }

func (c *Client) prefixKey(key string) string {
	if c.keyPrefix == "" {
		return key
	}
	return c.keyPrefix + key
}

// ── RawCache ──────────────────────────────────

func (c *Client) Increment(ctx context.Context, key string, delta int64) (int64, error) {
	return c.rdb.IncrBy(ctx, c.prefixKey(key), delta).Result()
}

func (c *Client) IncrementWithTTL(ctx context.Context, key string, delta int64, ttl time.Duration) (int64, error) {
	// Lua script: atomic increment + set TTL only on first call
	script := goredis.NewScript(`
		local current = redis.call('INCRBY', KEYS[1], ARGV[1])
		if current == tonumber(ARGV[1]) then
			redis.call('EXPIRE', KEYS[1], ARGV[2])
		end
		return current
	`)
	res, err := script.Run(ctx, c.rdb, []string{c.prefixKey(key)}, delta, int(ttl.Seconds())).Int64()
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeCache, "IncrementWithTTL failed", err)
	}
	return res, nil
}

func (c *Client) SetNX(ctx context.Context, key string, value interface{}, ttl time.Duration) (bool, error) {
	return c.rdb.SetNX(ctx, c.prefixKey(key), value, ttl).Result()
}

func (c *Client) Eval(ctx context.Context, script string, keys []string, args ...interface{}) (interface{}, error) {
	prefixedKeys := make([]string, len(keys))
	for i, k := range keys {
		prefixedKeys[i] = c.prefixKey(k)
	}
	return c.rdb.Eval(ctx, script, prefixedKeys, args...).Result()
}

func (c *Client) Expire(ctx context.Context, key string, ttl time.Duration) error {
	return c.rdb.Expire(ctx, c.prefixKey(key), ttl).Err()
}

func (c *Client) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.rdb.TTL(ctx, c.prefixKey(key)).Result()
}

// ─────────────────────────────────────────────
//  TypedCache[T] — generic implementation
// ─────────────────────────────────────────────

// TypedCache[T] is a generic Cache[T] backed by Redis.
// All values are JSON-serialized.
type TypedCache[T any] struct {
	client     *Client
	defaultTTL time.Duration
	namespace  string // e.g. "balance", "nonce"
}

// NewTypedCache constructs a Cache[T] with an optional namespace.
func NewTypedCache[T any](client *Client, namespace string, defaultTTL time.Duration) *TypedCache[T] {
	return &TypedCache[T]{
		client:     client,
		defaultTTL: defaultTTL,
		namespace:  namespace,
	}
}

func (c *TypedCache[T]) ns(key string) string {
	if c.namespace == "" {
		return key
	}
	return c.namespace + ":" + key
}

func (c *TypedCache[T]) Get(ctx context.Context, key string) (*T, error) {
	data, err := c.client.rdb.Get(ctx, c.client.prefixKey(c.ns(key))).Bytes()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return nil, cache.ErrCacheMiss
		}
		return nil, apperr.Wrap(apperr.ErrCodeCache, "Cache.Get failed", err)
	}

	var val T
	if err := json.Unmarshal(data, &val); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeCache, "Cache.Get unmarshal failed", err)
	}
	return &val, nil
}

func (c *TypedCache[T]) Set(ctx context.Context, key string, value *T, ttl time.Duration) error {
	if ttl == 0 {
		ttl = c.defaultTTL
	}
	data, err := json.Marshal(value)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeCache, "Cache.Set marshal failed", err)
	}
	if err := c.client.rdb.Set(ctx, c.client.prefixKey(c.ns(key)), data, ttl).Err(); err != nil {
		return apperr.Wrap(apperr.ErrCodeCache, "Cache.Set failed", err)
	}
	return nil
}

func (c *TypedCache[T]) Delete(ctx context.Context, key string) error {
	return c.client.rdb.Del(ctx, c.client.prefixKey(c.ns(key))).Err()
}

func (c *TypedCache[T]) Exists(ctx context.Context, key string) (bool, error) {
	n, err := c.client.rdb.Exists(ctx, c.client.prefixKey(c.ns(key))).Result()
	return n > 0, err
}

func (c *TypedCache[T]) GetOrSet(ctx context.Context, key string, ttl time.Duration, fn func(ctx context.Context) (*T, error)) (*T, error) {
	if val, err := c.Get(ctx, key); err == nil {
		return val, nil
	} else if !cache.IsCacheMiss(err) {
		return nil, err
	}

	// Cache miss — load from source
	val, err := fn(ctx)
	if err != nil {
		return nil, err
	}

	// Best-effort set (don't fail caller if cache write fails)
	_ = c.Set(ctx, key, val, ttl)
	return val, nil
}

func (c *TypedCache[T]) SetMany(ctx context.Context, items map[string]*T, ttl time.Duration) error {
	if ttl == 0 {
		ttl = c.defaultTTL
	}
	pipe := c.client.rdb.Pipeline()
	for key, val := range items {
		data, err := json.Marshal(val)
		if err != nil {
			return apperr.Wrap(apperr.ErrCodeCache, "SetMany marshal failed", err)
		}
		pipe.Set(ctx, c.client.prefixKey(c.ns(key)), data, ttl)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return apperr.Wrap(apperr.ErrCodeCache, "SetMany pipeline failed", err)
	}
	return nil
}

func (c *TypedCache[T]) DeleteMany(ctx context.Context, keys ...string) error {
	full := make([]string, len(keys))
	for i, k := range keys {
		full[i] = c.client.prefixKey(c.ns(k))
	}
	return c.client.rdb.Del(ctx, full...).Err()
}

func (c *TypedCache[T]) InvalidateByPrefix(ctx context.Context, prefix string) error {
	fullPrefix := c.client.prefixKey(c.ns(prefix)) + "*"
	var cursor uint64
	for {
		keys, newCursor, err := c.client.rdb.Scan(ctx, cursor, fullPrefix, 100).Result()
		if err != nil {
			return apperr.Wrap(apperr.ErrCodeCache, "InvalidateByPrefix scan failed", err)
		}
		if len(keys) > 0 {
			if err := c.client.rdb.Del(ctx, keys...).Err(); err != nil {
				return err
			}
		}
		cursor = newCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

// ─────────────────────────────────────────────
//  Balance Cache — domain-specific Lua scripts
// ─────────────────────────────────────────────

// BalanceEntry represents the dual-layer balance stored in Redis.
type BalanceEntry struct {
	OnChain   string `json:"on_chain"`   // BigInt as string (wei)
	Pending   string `json:"pending"`    // BigInt as string (wei)
	Available string `json:"available"`  // BigInt as string (wei)
	UpdatedAt int64  `json:"updated_at"` // Unix timestamp
}

// BalanceCache provides domain-specific balance operations with Lua atomicity.
type BalanceCache struct {
	client *Client
	ttl    time.Duration
}

// NewBalanceCache creates a domain-specific cache for VNDC balances.
// If client is nil, returns a no-op cache for testing.
func NewBalanceCache(client *Client, ttl time.Duration) *BalanceCache {
	return &BalanceCache{client: client, ttl: ttl}
}

func (b *BalanceCache) key(wallet string) string {
	if b.client == nil {
		return "balance:" + strings.ToLower(wallet)
	}
	return b.client.prefixKey("balance:" + strings.ToLower(wallet))
}

// Get fetches the balance entry for a wallet.
func (b *BalanceCache) Get(ctx context.Context, wallet string) (*BalanceEntry, error) {
	if b.client == nil || b.client.rdb == nil {
		return nil, cache.ErrCacheMiss // No cache available for testing
	}
	data, err := b.client.rdb.Get(ctx, b.key(wallet)).Bytes()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return nil, cache.ErrCacheMiss
		}
		return nil, apperr.Wrap(apperr.ErrCodeCache, "BalanceCache.Get", err)
	}
	var entry BalanceEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeCache, "BalanceCache.Get unmarshal", err)
	}
	return &entry, nil
}

// Set updates the balance entry.
func (b *BalanceCache) Set(ctx context.Context, wallet string, entry *BalanceEntry) error {
	if b.client == nil || b.client.rdb == nil {
		return nil // No-op for testing
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeCache, "BalanceCache.Set marshal", err)
	}
	return b.client.rdb.Set(ctx, b.key(wallet), data, b.ttl).Err()
}

// CheckAndReserveLua atomically checks available balance and reserves amount.
// Returns (true, nil) if reservation succeeded; (false, nil) if insufficient balance.
// This is the primary defense against double-spending race conditions.
var checkAndReserveScript = goredis.NewScript(`
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local raw = redis.call('GET', key)
if not raw then
	return redis.error_reply('CACHE_MISS')
end

local entry = cjson.decode(raw)
local available = tonumber(entry.available)
local pending = tonumber(entry.pending)

if available < amount then
	return 0
end

entry.pending = tostring(pending + amount)
entry.available = tostring(available - amount)
entry.updated_at = now

redis.call('SET', key, cjson.encode(entry), 'EX', ttl)
return 1
`)

// CheckAndReserve atomically reserves 'amountWei' from available balance.
// Returns true if reserved, false if insufficient.
// For testing without Redis, always returns false (insufficient balance).
func (b *BalanceCache) CheckAndReserve(ctx context.Context, wallet, amountWei string) (bool, error) {
	if b.client == nil || b.client.rdb == nil {
		return false, cache.ErrCacheMiss // Simulate no balance available for testing
	}
	result, err := checkAndReserveScript.Run(
		ctx, b.client.rdb,
		[]string{b.key(wallet)},
		amountWei,
		time.Now().Unix(),
		int(b.ttl.Seconds()),
	).Int()
	if err != nil {
		if strings.Contains(err.Error(), "CACHE_MISS") {
			return false, cache.ErrCacheMiss
		}
		return false, apperr.Wrap(apperr.ErrCodeCache, "CheckAndReserve failed", err)
	}
	return result == 1, nil
}

// RollbackLua atomically releases a reserved amount back to available.
var rollbackScript = goredis.NewScript(`
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local raw = redis.call('GET', key)
if not raw then return 0 end

local entry = cjson.decode(raw)
local pending = tonumber(entry.pending)
local available = tonumber(entry.available)

if pending < amount then amount = pending end

entry.pending = tostring(pending - amount)
entry.available = tostring(available + amount)
entry.updated_at = now

redis.call('SET', key, cjson.encode(entry), 'EX', ttl)
return 1
`)

// Rollback reverses a previously reserved amount (e.g., on batch failure).
// For testing without Redis, this is a no-op.
func (b *BalanceCache) Rollback(ctx context.Context, wallet, amountWei string) error {
	if b.client == nil || b.client.rdb == nil {
		return nil // No-op for testing
	}
	_, err := rollbackScript.Run(
		ctx, b.client.rdb,
		[]string{b.key(wallet)},
		amountWei,
		time.Now().Unix(),
		int(b.ttl.Seconds()),
	).Int()
	return err
}

// Delete removes the balance cache key entirely, forcing a fresh blockchain fetch on the next Get.
func (b *BalanceCache) Delete(ctx context.Context, wallet string) error {
	if b.client == nil || b.client.rdb == nil {
		return nil
	}
	return b.client.rdb.Del(ctx, b.key(wallet)).Err()
}

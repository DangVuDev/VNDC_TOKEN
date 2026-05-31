// Package redis — AuthCache implementation.
// Implements ports.AuthCachePort using the shared Redis client.
package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	apperr "github.com/vndc/backend/pkg/errors"
)

// ─────────────────────────────────────────────
//  AuthCache
// ─────────────────────────────────────────────

// AuthCache implements ports.AuthCachePort using Redis.
// Key namespaces:
//   - challenge:{wallet}          — SIWE nonce  (TTL = 5 min)
//   - blacklist:{jwtID}           — revoked AT   (TTL = remaining token lifetime)
//   - pending_2fa:{tempToken}     — pending 2FA  (TTL = 5 min)
type AuthCache struct {
	rdb    *goredis.Client
	prefix string
}

// NewAuthCache constructs an AuthCache.
// If client is nil, returns a no-op implementation for testing.
// keyPrefix should match the global cache prefix (e.g. "vndc:").
func NewAuthCache(client *Client, keyPrefix string) *AuthCache {
	if client == nil {
		// Return no-op cache for testing
		return &AuthCache{
			rdb:    nil,
			prefix: keyPrefix,
		}
	}
	return &AuthCache{
		rdb:    client.rdb,
		prefix: keyPrefix,
	}
}

// ─────────────────────────────────────────────
//  Challenge (SIWE message + nonce)
// ─────────────────────────────────────────────

// StoreChallenge stores both the full SIWE message and nonce in Redis.
// If Redis is unavailable, this is a no-op for testing.
// The full message is needed during verification to reconstruct the exact
// same hash that was signed (including the issuedAt timestamp).
func (a *AuthCache) StoreChallenge(ctx context.Context, wallet, nonce string, ttl time.Duration) error {
	if a.rdb == nil {
		return nil // No-op for testing
	}
	key := a.key("challenge", wallet)
	// Store as JSON: {"nonce": "...", "message": "..."}
	challenge := map[string]string{
		"nonce": nonce,
	}
	data, _ := json.Marshal(challenge)
	if err := a.rdb.Set(ctx, key, string(data), ttl).Err(); err != nil {
		return fmt.Errorf("auth_cache: store challenge: %w", err)
	}
	return nil
}

// GetChallenge retrieves the nonce (and nonce-only) from Redis.
// If Redis is unavailable, returns empty string for testing.
// The full message should be provided by the client in the login request.
func (a *AuthCache) GetChallenge(ctx context.Context, wallet string) (string, error) {
	if a.rdb == nil {
		return "", nil // No-op for testing
	}
	key := a.key("challenge", wallet)
	val, err := a.rdb.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return "", apperr.New(apperr.ErrCodeNotFound, "Challenge not found or expired")
		}
		return "", fmt.Errorf("auth_cache: get challenge: %w", err)
	}
	// Parse JSON and extract nonce
	var challenge map[string]string
	if err := json.Unmarshal([]byte(val), &challenge); err != nil {
		return val, nil // fallback: return raw value for backward compatibility
	}
	return challenge["nonce"], nil
}

func (a *AuthCache) DeleteChallenge(ctx context.Context, wallet string) error {
	if a.rdb == nil {
		return nil
	}
	return a.rdb.Del(ctx, a.key("challenge", wallet)).Err()
}

// ─────────────────────────────────────────────
//  Blacklist (revoked access tokens)
// ─────────────────────────────────────────────

func (a *AuthCache) BlacklistToken(ctx context.Context, jwtID string, ttl time.Duration) error {
	if a.rdb == nil {
		return nil
	}
	key := a.key("blacklist", jwtID)
	// Value is irrelevant; existence of the key means "revoked".
	if err := a.rdb.Set(ctx, key, "1", ttl).Err(); err != nil {
		return fmt.Errorf("auth_cache: blacklist token: %w", err)
	}
	return nil
}

func (a *AuthCache) IsTokenBlacklisted(ctx context.Context, jwtID string) (bool, error) {
	if a.rdb == nil {
		return false, nil
	}
	key := a.key("blacklist", jwtID)
	exists, err := a.rdb.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("auth_cache: check blacklist: %w", err)
	}
	return exists > 0, nil
}

// ─────────────────────────────────────────────
//  Pending 2FA session
// ─────────────────────────────────────────────

func (a *AuthCache) StorePending2FA(ctx context.Context, tempToken, wallet string, ttl time.Duration) error {
	if a.rdb == nil {
		return nil
	}
	key := a.key("pending_2fa", tempToken)
	if err := a.rdb.Set(ctx, key, wallet, ttl).Err(); err != nil {
		return fmt.Errorf("auth_cache: store pending 2fa: %w", err)
	}
	return nil
}

func (a *AuthCache) GetPending2FA(ctx context.Context, tempToken string) (string, error) {
	if a.rdb == nil {
		return "", apperr.New(apperr.ErrCodeNotFound, "2FA session expired or invalid")
	}
	key := a.key("pending_2fa", tempToken)
	wallet, err := a.rdb.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return "", apperr.New(apperr.ErrCodeNotFound, "2FA session expired or invalid")
		}
		return "", fmt.Errorf("auth_cache: get pending 2fa: %w", err)
	}
	return wallet, nil
}

func (a *AuthCache) DeletePending2FA(ctx context.Context, tempToken string) error {
	if a.rdb == nil {
		return nil
	}
	return a.rdb.Del(ctx, a.key("pending_2fa", tempToken)).Err()
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

func (a *AuthCache) key(parts ...string) string {
	s := a.prefix
	for _, p := range parts {
		s += p + ":"
	}
	return s[:len(s)-1] // strip trailing colon
}

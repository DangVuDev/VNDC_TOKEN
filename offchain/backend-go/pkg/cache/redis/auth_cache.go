// Package redis — AuthCache implementation.
// Implements ports.AuthCachePort using the shared Redis client.
package redis

import (
	"context"
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
// keyPrefix should match the global cache prefix (e.g. "vndc:").
func NewAuthCache(client *Client, keyPrefix string) *AuthCache {
	return &AuthCache{
		rdb:    client.rdb,
		prefix: keyPrefix,
	}
}

// ─────────────────────────────────────────────
//  Challenge (SIWE nonce)
// ─────────────────────────────────────────────

func (a *AuthCache) StoreChallenge(ctx context.Context, wallet, nonce string, ttl time.Duration) error {
	key := a.key("challenge", wallet)
	if err := a.rdb.Set(ctx, key, nonce, ttl).Err(); err != nil {
		return fmt.Errorf("auth_cache: store challenge: %w", err)
	}
	return nil
}

func (a *AuthCache) GetChallenge(ctx context.Context, wallet string) (string, error) {
	key := a.key("challenge", wallet)
	val, err := a.rdb.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return "", apperr.New(apperr.ErrCodeNotFound, "Challenge not found or expired")
		}
		return "", fmt.Errorf("auth_cache: get challenge: %w", err)
	}
	return val, nil
}

func (a *AuthCache) DeleteChallenge(ctx context.Context, wallet string) error {
	return a.rdb.Del(ctx, a.key("challenge", wallet)).Err()
}

// ─────────────────────────────────────────────
//  Blacklist (revoked access tokens)
// ─────────────────────────────────────────────

func (a *AuthCache) BlacklistToken(ctx context.Context, jwtID string, ttl time.Duration) error {
	key := a.key("blacklist", jwtID)
	// Value is irrelevant; existence of the key means "revoked".
	if err := a.rdb.Set(ctx, key, "1", ttl).Err(); err != nil {
		return fmt.Errorf("auth_cache: blacklist token: %w", err)
	}
	return nil
}

func (a *AuthCache) IsTokenBlacklisted(ctx context.Context, jwtID string) (bool, error) {
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
	key := a.key("pending_2fa", tempToken)
	if err := a.rdb.Set(ctx, key, wallet, ttl).Err(); err != nil {
		return fmt.Errorf("auth_cache: store pending 2fa: %w", err)
	}
	return nil
}

func (a *AuthCache) GetPending2FA(ctx context.Context, tempToken string) (string, error) {
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

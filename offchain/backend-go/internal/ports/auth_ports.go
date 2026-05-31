// Package ports — additional ports for the auth, session, and audit subsystems.
package ports

import (
	"context"
	"time"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

// ─────────────────────────────────────────────
//  Repository ports — auth entities
// ─────────────────────────────────────────────

// SessionRepository manages authenticated user sessions.
type SessionRepository interface {
	database.Repository[domain.Session]

	// FindByRefreshTokenHash retrieves the session matching a hashed refresh token.
	FindByRefreshTokenHash(ctx context.Context, hash string) (*domain.Session, error)

	// FindActiveByUserID returns all non-revoked, non-expired sessions for a user.
	FindActiveByUserID(ctx context.Context, userID string) ([]*domain.Session, error)

	// RevokeByID marks a single session as revoked.
	RevokeByID(ctx context.Context, sessionID, reason string) error

	// RevokeAllByUserID revokes every active session for a user (logout all devices).
	RevokeAllByUserID(ctx context.Context, userID, reason string) error

	// TouchLastUsed updates the last-used timestamp without a full entity update.
	TouchLastUsed(ctx context.Context, sessionID string) error
}

// LoginAttemptRepository records and queries brute-force attempt history.
type LoginAttemptRepository interface {
	database.Repository[domain.LoginAttempt]

	// CountRecentFailed returns the number of failed attempts for a wallet in the last window.
	CountRecentFailed(ctx context.Context, wallet string, window time.Duration) (int64, error)

	// CountRecentFailedByIP returns the number of failed attempts from an IP in the last window.
	CountRecentFailedByIP(ctx context.Context, ip string, window time.Duration) (int64, error)
}

// AuditLogRepository is append-only — no updates or deletes.
type AuditLogRepository interface {
	database.Repository[domain.AuditLog]

	// FindByActor returns audit events performed by a specific user.
	FindByActor(ctx context.Context, actorID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error)

	// FindByTarget returns audit events targeting a specific user (admin actions).
	FindByTarget(ctx context.Context, targetID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error)
}

// KYCSubmissionRepository manages Level 2 KYC submissions awaiting admin review.
type KYCSubmissionRepository interface {
	database.Repository[domain.KYCSubmission]

	// FindByUserID returns all submissions for a specific user.
	FindByUserID(ctx context.Context, userID string) ([]*domain.KYCSubmission, error)

	// FindByStatus returns all submissions in a given status (e.g. PENDING).
	FindByStatus(ctx context.Context, status domain.KYCSubmissionStatus, opts ...database.QueryOption) ([]*domain.KYCSubmission, int64, error)
}

// ─────────────────────────────────────────────
//  Cache ports — auth subsystem
// ─────────────────────────────────────────────

// AuthCachePort handles all Redis operations needed by the auth service.
// Responsibilities:
//   - SIWE challenge nonce storage (short TTL)
//   - JWT access-token blacklist (per-token TTL = remaining lifetime)
//   - Pending 2FA session (maps temp token → wallet, short TTL)
type AuthCachePort interface {
	// Challenge — SIWE nonce lifecycle.
	StoreChallenge(ctx context.Context, wallet, nonce string, ttl time.Duration) error
	GetChallenge(ctx context.Context, wallet string) (string, error)
	DeleteChallenge(ctx context.Context, wallet string) error

	// Blacklist — revoked access tokens (prevents use after logout).
	BlacklistToken(ctx context.Context, jwtID string, ttl time.Duration) error
	IsTokenBlacklisted(ctx context.Context, jwtID string) (bool, error)

	// Pending 2FA — temp token issued before TOTP verification.
	StorePending2FA(ctx context.Context, tempToken, wallet string, ttl time.Duration) error
	GetPending2FA(ctx context.Context, tempToken string) (wallet string, err error)
	DeletePending2FA(ctx context.Context, tempToken string) error
}

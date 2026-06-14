package adapters

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
	apperr "github.com/vndc/backend/pkg/errors"
)


// ─────────────────────────────────────────────
//  auditLogRepository — implements ports.AuditLogRepository
// ─────────────────────────────────────────────

type auditLogRepository struct {
	*pkgmongodb.Repository[domain.AuditLog]
	col *mongo.Collection
}

// NewAuditLogRepository wires the audit-log repository to the dedicated MongoDB collection.
// Audit storage stays isolated so security history remains easy to index, query, and retain independently.
func NewAuditLogRepository(client *pkgmongodb.Client) ports.AuditLogRepository {
	return &auditLogRepository{
		Repository: pkgmongodb.NewRepository[domain.AuditLog](client, "audit_logs"),
		col:        client.Collection("audit_logs"),
	}
}

// FindByActor returns audit entries created by a specific actor, preserving caller-supplied filters.
// This is the main read path for user-scoped audit histories and operator activity review.
func (r *auditLogRepository) FindByActor(ctx context.Context, actorID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error) {
	opts = append(opts, database.WithEq("actor_id", actorID))
	return r.Find(ctx, opts...)
}

// FindByTarget returns audit entries that reference a specific target entity.
// It is used when tracing all security or administrative events affecting one resource.
func (r *auditLogRepository) FindByTarget(ctx context.Context, targetID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error) {
	opts = append(opts, database.WithEq("target_id", targetID))
	return r.Find(ctx, opts...)
}

// loginAttemptRepository — implements ports.LoginAttemptRepository

type loginAttemptRepository struct {
	*pkgmongodb.Repository[domain.LoginAttempt]
	col *mongo.Collection
}

// NewLoginAttemptRepository wires the login-attempt repository to the login_attempts collection.
// The repository underpins lockout, rate limiting, and brute-force detection logic.
func NewLoginAttemptRepository(client *pkgmongodb.Client) ports.LoginAttemptRepository {
	return &loginAttemptRepository{
		Repository: pkgmongodb.NewRepository[domain.LoginAttempt](client, "login_attempts"),
		col:        client.Collection("login_attempts"),
	}
}

// CountRecentFailed counts failed login attempts for a wallet within a sliding time window.
// Higher layers use the result to decide whether the account should be rate-limited, challenged, or locked.
func (r *loginAttemptRepository) CountRecentFailed(ctx context.Context, wallet string, window time.Duration) (int64, error) {
	since := time.Now().Add(-window)
	filter := bson.M{
		"wallet_address": wallet,
		"success":        false,
		"attempted_at":   bson.M{"$gte": since},
	}
	n, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeDatabase, "CountRecentFailed failed", err)
	}
	return n, nil
}

// CountRecentFailedByIP counts failed attempts for a source IP within a sliding window.
// This complements wallet-based throttling with network-level abuse detection and bot mitigation.
func (r *loginAttemptRepository) CountRecentFailedByIP(ctx context.Context, ip string, window time.Duration) (int64, error) {
	since := time.Now().Add(-window)
	filter := bson.M{
		"ip_address":   ip,
		"success":      false,
		"attempted_at": bson.M{"$gte": since},
	}
	n, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeDatabase, "CountRecentFailedByIP failed", err)
	}
	return n, nil
}

var _ ports.LoginAttemptRepository = (*loginAttemptRepository)(nil)
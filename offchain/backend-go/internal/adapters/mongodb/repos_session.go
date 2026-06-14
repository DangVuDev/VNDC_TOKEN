package adapters

import (
	"context"
	"fmt"
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
//  sessionRepository — implements ports.SessionRepository
// ─────────────────────────────────────────────

type sessionRepository struct {
	*pkgmongodb.Repository[domain.Session]
	col *mongo.Collection
}

// NewSessionRepository wires the session repository to the MongoDB sessions collection.
// Session persistence stays isolated from token minting, validation, and transport-specific authentication logic.
func NewSessionRepository(client *pkgmongodb.Client) ports.SessionRepository {
	return &sessionRepository{
		Repository: pkgmongodb.NewRepository[domain.Session](client, "sessions"),
		col:        client.Collection("sessions"),
	}
}

// FindByRefreshTokenHash resolves a session by the stored refresh-token hash.
// It is the primary lookup used during refresh-token validation and token rotation.
func (r *sessionRepository) FindByRefreshTokenHash(ctx context.Context, hash string) (*domain.Session, error) {
	return r.FindOne(ctx, database.WithEq("refresh_token_hash", hash))
}

// FindActiveByUserID returns only non-revoked, non-expired sessions for a user.
// The query is intentionally strict so logout operations, token rotation, and security reviews stay predictable.
func (r *sessionRepository) FindActiveByUserID(ctx context.Context, userID string) ([]*domain.Session, error) {
	now := time.Now().UTC()
	filter := bson.M{
		"user_id":    userID,
		"revoked_at": bson.M{"$exists": false},
		"expires_at": bson.M{"$gt": now},
		"deleted_at": bson.M{"$exists": false},
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindActiveByUserID failed", err)
	}
	defer cursor.Close(ctx)
	var sessions []*domain.Session
	if err := cursor.All(ctx, &sessions); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode sessions failed", err)
	}
	return sessions, nil
}

// RevokeByID marks a single session as revoked and records the operator-supplied reason.
// A missing session is treated as a not-found condition rather than a silent success so callers can surface inconsistencies.
func (r *sessionRepository) RevokeByID(ctx context.Context, sessionID, reason string) error {
	now := time.Now().UTC()
	filter := bson.M{"_id": sessionID}
	update := bson.M{"$set": bson.M{
		"revoked_at":    now,
		"revoke_reason": reason,
		"updated_at":    now,
	}}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "RevokeByID failed", err)
	}
	if res.MatchedCount == 0 {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	return nil
}

// RevokeAllByUserID revokes every currently active session for a user in one batch write.
// This is used for global logout, password reset fallout, and security incident response.
func (r *sessionRepository) RevokeAllByUserID(ctx context.Context, userID, reason string) error {
	now := time.Now().UTC()
	filter := bson.M{
		"user_id":    userID,
		"revoked_at": bson.M{"$exists": false},
	}
	update := bson.M{"$set": bson.M{
		"revoked_at":    now,
		"revoke_reason": reason,
		"updated_at":    now,
	}}
	_, err := r.col.UpdateMany(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "RevokeAllByUserID failed", err)
	}
	return nil
}

// TouchLastUsed refreshes the last-used timestamp without changing any other session fields.
// The method is intentionally lightweight so request-path activity tracking does not need a full session rewrite.
func (r *sessionRepository) TouchLastUsed(ctx context.Context, sessionID string) error {
	now := time.Now().UTC()
	filter := bson.M{"_id": sessionID}
	update := bson.M{"$set": bson.M{"last_used_at": now}}
	_, err := r.col.UpdateOne(ctx, filter, update)
	return err
}

var _ ports.SessionRepository = (*sessionRepository)(nil)

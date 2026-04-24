// Package adapters — concrete MongoDB adapters implementing domain repository ports.
// Each adapter embeds the generic Repository[T] for standard CRUD and adds
// domain-specific query methods on top of the raw mongo.Collection.
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
//  userRepository — implements ports.UserRepository
// ─────────────────────────────────────────────

type userRepository struct {
	*pkgmongodb.Repository[domain.User]
	col *mongo.Collection
}

// NewUserRepository constructs a UserRepository backed by MongoDB.
func NewUserRepository(client *pkgmongodb.Client) ports.UserRepository {
	return &userRepository{
		Repository: pkgmongodb.NewRepository[domain.User](client, "users"),
		col:        client.Collection("users"),
	}
}

func (r *userRepository) FindByWallet(ctx context.Context, wallet string) (*domain.User, error) {
	return r.FindOne(ctx, database.WithEq("wallet_address", wallet))
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	return r.FindOne(ctx, database.WithEq("email", email))
}

func (r *userRepository) UpdateNonce(ctx context.Context, wallet, newNonce string) error {
	filter := bson.M{"wallet_address": wallet}
	update := bson.M{"$set": bson.M{
		"nonce":      newNonce,
		"updated_at": time.Now().UTC(),
	}}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "UpdateNonce failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

func (r *userRepository) UpdateLoginInfo(ctx context.Context, wallet, ip string, loginAt time.Time) error {
	filter := bson.M{"wallet_address": wallet}
	update := bson.M{"$set": bson.M{
		"last_login_at": loginAt,
		"last_login_ip": ip,
		"updated_at":    time.Now().UTC(),
	}, "$inc": bson.M{"login_count": 1}}
	_, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "UpdateLoginInfo failed", err)
	}
	return nil
}

func (r *userRepository) IncrementFailedAttempts(ctx context.Context, wallet string) (int, error) {
	filter := bson.M{"wallet_address": wallet}
	update := bson.M{
		"$inc": bson.M{"failed_login_attempts": 1},
		"$set": bson.M{"updated_at": time.Now().UTC()},
	}
	res := r.col.FindOneAndUpdate(ctx, filter, update)
	if res.Err() != nil {
		return 0, apperr.Wrap(apperr.ErrCodeDatabase, "IncrementFailedAttempts failed", res.Err())
	}
	var user domain.User
	if err := res.Decode(&user); err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeDatabase, "decode failed", err)
	}
	return user.FailedLoginAttempts + 1, nil
}

func (r *userRepository) ResetFailedAttempts(ctx context.Context, wallet string) error {
	filter := bson.M{"wallet_address": wallet}
	update := bson.M{"$set": bson.M{
		"failed_login_attempts": 0,
		"locked_until":          nil,
		"updated_at":            time.Now().UTC(),
	}}
	_, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "ResetFailedAttempts failed", err)
	}
	return nil
}

func (r *userRepository) LockAccount(ctx context.Context, wallet string, until time.Time) error {
	filter := bson.M{"wallet_address": wallet}
	update := bson.M{"$set": bson.M{
		"locked_until": until,
		"updated_at":   time.Now().UTC(),
	}}
	_, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "LockAccount failed", err)
	}
	return nil
}

func (r *userRepository) UnlockAccount(ctx context.Context, wallet string) error {
	filter := bson.M{"wallet_address": wallet}
	update := bson.M{
		"$unset": bson.M{"locked_until": ""},
		"$set": bson.M{
			"failed_login_attempts": 0,
			"updated_at":            time.Now().UTC(),
		},
	}
	_, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "UnlockAccount failed", err)
	}
	return nil
}

// Ensure interface is fully satisfied at compile-time.
var _ ports.UserRepository = (*userRepository)(nil)

// ─────────────────────────────────────────────
//  sessionRepository — implements ports.SessionRepository
// ─────────────────────────────────────────────

type sessionRepository struct {
	*pkgmongodb.Repository[domain.Session]
	col *mongo.Collection
}

// NewSessionRepository constructs a SessionRepository backed by MongoDB.
func NewSessionRepository(client *pkgmongodb.Client) ports.SessionRepository {
	return &sessionRepository{
		Repository: pkgmongodb.NewRepository[domain.Session](client, "sessions"),
		col:        client.Collection("sessions"),
	}
}

func (r *sessionRepository) FindByRefreshTokenHash(ctx context.Context, hash string) (*domain.Session, error) {
	return r.FindOne(ctx, database.WithEq("refresh_token_hash", hash))
}

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

func (r *sessionRepository) TouchLastUsed(ctx context.Context, sessionID string) error {
	now := time.Now().UTC()
	filter := bson.M{"_id": sessionID}
	update := bson.M{"$set": bson.M{"last_used_at": now}}
	_, err := r.col.UpdateOne(ctx, filter, update)
	return err
}

var _ ports.SessionRepository = (*sessionRepository)(nil)

// ─────────────────────────────────────────────
//  auditLogRepository — implements ports.AuditLogRepository
// ─────────────────────────────────────────────

type auditLogRepository struct {
	*pkgmongodb.Repository[domain.AuditLog]
	col *mongo.Collection
}

// NewAuditLogRepository constructs an AuditLogRepository backed by MongoDB.
func NewAuditLogRepository(client *pkgmongodb.Client) ports.AuditLogRepository {
	return &auditLogRepository{
		Repository: pkgmongodb.NewRepository[domain.AuditLog](client, "audit_logs"),
		col:        client.Collection("audit_logs"),
	}
}

func (r *auditLogRepository) FindByActor(ctx context.Context, actorID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error) {
	opts = append(opts, database.WithEq("actor_id", actorID))
	return r.Find(ctx, opts...)
}

func (r *auditLogRepository) FindByTarget(ctx context.Context, targetID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error) {
	opts = append(opts, database.WithEq("target_id", targetID))
	return r.Find(ctx, opts...)
}

// loginAttemptRepository — implements ports.LoginAttemptRepository

type loginAttemptRepository struct {
	*pkgmongodb.Repository[domain.LoginAttempt]
	col *mongo.Collection
}

// NewLoginAttemptRepository constructs a LoginAttemptRepository.
func NewLoginAttemptRepository(client *pkgmongodb.Client) ports.LoginAttemptRepository {
	return &loginAttemptRepository{
		Repository: pkgmongodb.NewRepository[domain.LoginAttempt](client, "login_attempts"),
		col:        client.Collection("login_attempts"),
	}
}

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

// ─────────────────────────────────────────────
//  transactionRepository — implements ports.TransactionRepository
// ─────────────────────────────────────────────

type transactionRepository struct {
	*pkgmongodb.Repository[domain.Transaction]
	col *mongo.Collection
}

// NewTransactionRepository constructs a TransactionRepository backed by MongoDB.
func NewTransactionRepository(client *pkgmongodb.Client) ports.TransactionRepository {
	return &transactionRepository{
		Repository: pkgmongodb.NewRepository[domain.Transaction](client, "transactions"),
		col:        client.Collection("transactions"),
	}
}

func (r *transactionRepository) FindByStatus(ctx context.Context, status domain.TransactionStatus, limit int64) ([]*domain.Transaction, error) {
	txs, _, err := r.Find(ctx, database.WithEq("status", string(status)), database.WithLimit(limit))
	return txs, err
}

func (r *transactionRepository) FindByWallet(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.Transaction, int64, error) {
	combined := append([]database.QueryOption{
		database.WithEq("from_wallet", wallet), // TODO: use OR filter when supported
	}, opts...)
	return r.Find(ctx, combined...)
}

func (r *transactionRepository) FindPendingOlderThan(ctx context.Context, threshold time.Duration) ([]*domain.Transaction, error) {
	since := time.Now().Add(-threshold)
	filter := bson.M{
		"status":     "pending",
		"created_at": bson.M{"$lt": since},
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindPendingOlderThan failed", err)
	}
	defer cursor.Close(ctx)
	var txs []*domain.Transaction
	if err := cursor.All(ctx, &txs); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode failed", err)
	}
	return txs, nil
}

func (r *transactionRepository) CountByStatus(ctx context.Context, status domain.TransactionStatus) (int64, error) {
	return r.Count(ctx, database.WithEq("status", string(status)))
}

func (r *transactionRepository) AssignBatch(ctx context.Context, txIDs []string, batchID string) error {
	filter := bson.M{"_id": bson.M{"$in": txIDs}}
	update := bson.M{"$set": bson.M{
		"batch_id":   batchID,
		"status":     "batched",
		"updated_at": time.Now().UTC(),
	}}
	_, err := r.col.UpdateMany(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "AssignBatch failed", err)
	}
	return nil
}

var _ ports.TransactionRepository = (*transactionRepository)(nil)

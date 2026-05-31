// Package adapters — concrete MongoDB adapters implementing domain repository ports.
// Each adapter embeds the generic Repository[T] for standard CRUD and adds
// domain-specific query methods on top of the raw mongo.Collection.
package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	mongooptions "go.mongodb.org/mongo-driver/mongo/options"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  userRepository — implements ports.UserRepository
// ─────────────────────────────────────────────

type userRepository struct {
	*pkgmongodb.Repository[domain.User]
	col *mongo.Collection
}

// NewUserRepository wires the user repository to the MongoDB-backed users collection.
// Centralizing this binding keeps service code dependent on the port contract instead of concrete storage details.
func NewUserRepository(client *pkgmongodb.Client) ports.UserRepository {
	return &userRepository{
		Repository: pkgmongodb.NewRepository[domain.User](client, "users"),
		col:        client.Collection("users"),
	}
}

// FindByWallet resolves a user by wallet address, which is the canonical identity key in this app.
// It is the main lookup used by wallet-based authentication and profile hydration flows.
func (r *userRepository) FindByWallet(ctx context.Context, wallet string) (*domain.User, error) {
	return r.FindOne(ctx, database.WithEq("wallet_address", wallet))
}

// FindByEmail resolves a user by email for login and account recovery flows.
// This path supports hybrid account scenarios where email remains a secondary identifier.
func (r *userRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	return r.FindOne(ctx, database.WithEq("email", email))
}

// FindByUsername resolves a user by username for profile and admin lookup use cases.
// It is intentionally separate from wallet lookup because usernames are user-facing but not canonical IDs.
func (r *userRepository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	return r.FindOne(ctx, database.WithEq("username", username))
}

// UpdateNonce stores the latest nonce and updates the audit timestamp in one atomic write.
// Keeping both changes together ensures login challenge rotation and replay protection stay synchronized.
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

// UpdateLoginInfo records the latest login metadata and increments the login counter atomically.
// It is invoked immediately after successful authentication so security and engagement fields remain consistent.
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

// IncrementFailedAttempts atomically bumps the failed-login counter and returns the new total.
// Returning the updated count lets the authentication layer decide whether lockout thresholds have been crossed.
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

// ResetFailedAttempts clears lock-related state after a successful authentication or admin reset.
// This prevents stale lock metadata from surviving after the account has been intentionally recovered.
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

// LockAccount stores a lock-until timestamp so the account remains blocked until the deadline.
// The repository does not decide the duration; it only persists the security policy chosen upstream.
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

// UnlockAccount clears the lock state and resets the failed-attempt counter.
// This is used after successful recovery, administrative intervention, or automated lock expiration handling.
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

// IncrementActivityPoints atomically adds delta to the user's activity score.
// Using $inc prevents lost updates when multiple reward or participation events are processed concurrently.
func (r *userRepository) IncrementActivityPoints(ctx context.Context, wallet string, delta int64) error {
	filter := bson.M{"wallet_address": wallet}
	update := bson.M{
		"$inc": bson.M{"activity_points": delta},
		"$set": bson.M{"updated_at": time.Now().UTC()},
	}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "IncrementActivityPoints failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// FindRanked returns users sorted by activity points in descending order with pagination.
// Soft-deleted users are excluded so leaderboard-style views only show active accounts.
func (r *userRepository) FindRanked(ctx context.Context, page, limit int64) ([]*domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	skip := (page - 1) * limit

	filter := bson.M{
		"$or": bson.A{
			bson.M{"deleted_at": bson.M{"$exists": false}},
			bson.M{"deleted_at": nil},
		},
	}
	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "FindRanked count failed", err)
	}

	opts := mongooptions.Find().
		SetSort(bson.D{{Key: "activity_points", Value: -1}}).
		SetSkip(skip).
		SetLimit(limit)

	cursor, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "FindRanked failed", err)
	}
	defer cursor.Close(ctx)

	var users []*domain.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "FindRanked decode failed", err)
	}
	return users, total, nil
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

// ─────────────────────────────────────────────
//  transactionRepository — implements ports.TransactionRepository
// ─────────────────────────────────────────────

type transactionRepository struct {
	*pkgmongodb.Repository[domain.Transaction]
	col *mongo.Collection
}

// NewTransactionRepository wires the transaction repository to the MongoDB transactions collection.
// Keeping transaction-specific reads here avoids leaking query mechanics into workers, APIs, and reconciliation services.
func NewTransactionRepository(client *pkgmongodb.Client) ports.TransactionRepository {
	return &transactionRepository{
		Repository: pkgmongodb.NewRepository[domain.Transaction](client, "transactions"),
		col:        client.Collection("transactions"),
	}
}

// FindByStatus returns recent transactions with a given status and optional limit.
// It is primarily used by admin dashboards, monitoring panels, and operational work queues.
func (r *transactionRepository) FindByStatus(ctx context.Context, status domain.TransactionStatus, limit int64) ([]*domain.Transaction, error) {
	txs, _, err := r.Find(ctx, database.WithEq("status", string(status)), database.WithLimit(limit))
	return txs, err
}

// FindByWallet returns transactions where the wallet appears on either side of the transfer.
// The method also emits detailed debug traces because wallet normalization issues can be difficult to diagnose in production data.
func (r *transactionRepository) FindByWallet(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.Transaction, int64, error) {
	// Build base query options for pagination/sort from caller
	q := database.NewQuery(opts...)
	filter, findOpts := buildTxWalletFilter(wallet, q)

	// Debug logging
	filterJSON, _ := json.Marshal(filter)
	log := logger.FromContext(ctx)
	log.Debug("FindByWallet query",
		logger.String("wallet_input", wallet),
		logger.String("filter", string(filterJSON)),
		logger.Int64("skip", q.Skip),
		logger.Int64("limit", q.Limit),
	)

	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "FindByWallet count failed", err)
	}

	log.Debug("FindByWallet count result",
		logger.Int64("total_matched", total),
	)

	// If no results, also log total transactions in collection for debugging
	if total == 0 {
		totalInCollection, _ := r.col.EstimatedDocumentCount(ctx)
		log.Debug("FindByWallet no matches - checking total collection",
			logger.Int64("total_in_collection", totalInCollection),
		)

		// Sample a transaction to see what wallet addresses look like
		opts := mongooptions.FindOne().SetSort(bson.M{"created_at": -1})
		var sample bson.M
		if err := r.col.FindOne(ctx, bson.M{}, opts).Decode(&sample); err == nil {
			sampleJSON, _ := json.Marshal(sample)
			log.Debug("Sample transaction from collection", logger.String("sample", string(sampleJSON)))

			// Check from_wallet field specifically
			if fromWallet, ok := sample["from_wallet"]; ok {
				fromWalletStr := fmt.Sprintf("%v", fromWallet)
				log.Debug("Sample from_wallet field",
					logger.String("value", fromWalletStr),
					logger.String("type", fmt.Sprintf("%T", fromWallet)),
					logger.Int("length", len(fromWalletStr)),
					logger.String("query_wallet", wallet),
					logger.Int("query_wallet_len", len(wallet)),
					logger.Bool("equal", fromWalletStr == wallet),
				)

				// Character-by-character comparison if not equal
				if fromWalletStr != wallet {
					minLen := len(fromWalletStr)
					if len(wallet) < minLen {
						minLen = len(wallet)
					}
					for i := 0; i < minLen; i++ {
						if fromWalletStr[i] != wallet[i] {
							log.Debug("Character mismatch at position",
								logger.Int("position", i),
								logger.String("sample_char", string(fromWalletStr[i])),
								logger.String("query_char", string(wallet[i])),
								logger.Int("sample_code", int(fromWalletStr[i])),
								logger.Int("query_code", int(wallet[i])),
							)
							break
						}
					}
				}
			}
			if toWallet, ok := sample["to_wallet"]; ok {
				log.Debug("Sample to_wallet field",
					logger.String("value", fmt.Sprintf("%v", toWallet)),
					logger.String("type", fmt.Sprintf("%T", toWallet)),
				)
			}

			// Try a direct from_wallet match
			directFilter := bson.M{"from_wallet": wallet}
			directCount, _ := r.col.CountDocuments(ctx, directFilter)
			log.Debug("Direct from_wallet match test",
				logger.String("wallet", wallet),
				logger.Int64("matched_count", directCount),
			)

			// Try a direct to_wallet match
			directFilterTo := bson.M{"to_wallet": wallet}
			directCountTo, _ := r.col.CountDocuments(ctx, directFilterTo)
			log.Debug("Direct to_wallet match test",
				logger.String("wallet", wallet),
				logger.Int64("matched_count", directCountTo),
			)
		}
	}

	cursor, err := r.col.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "FindByWallet find failed", err)
	}
	defer cursor.Close(ctx)
	var txs []*domain.Transaction
	if err := cursor.All(ctx, &txs); err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "FindByWallet decode failed", err)
	}

	log.Debug("FindByWallet results",
		logger.Int("returned_count", len(txs)),
	)

	return txs, total, nil
}

// buildTxWalletFilter builds the case-insensitive wallet filter and matching pagination options for transaction lookups.
// Keeping this logic in one helper prevents subtle divergence between query code paths that should interpret wallet matching identically.
func buildTxWalletFilter(wallet string, q *database.Query) (bson.M, *mongooptions.FindOptions) {
	normalised := strings.ToLower(wallet)
	walletEqCI := bson.M{"$regex": "^" + regexp.QuoteMeta(normalised) + "$", "$options": "i"}
	filter := bson.M{
		"$or": bson.A{
			bson.M{"from_wallet": walletEqCI},
			bson.M{"to_wallet": walletEqCI},
		},
		// Match transactions that are NOT deleted.
		// Handles both: field doesn't exist, or field is null (for nil pointers)
		"$and": bson.A{
			bson.M{
				"deleted_at": bson.M{
					"$in": bson.A{nil}, // null values
				},
			},
		},
	}

	findOpts := mongooptions.Find().
		SetSort(bson.M{"created_at": -1}).
		SetSkip(q.Skip).
		SetLimit(q.Limit)
	return filter, findOpts
}

// FindPendingOlderThan returns pending transactions older than a given threshold.
// This is used by background sweepers that detect stuck, delayed, or abandoned transactions.
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

// CountByStatus returns how many transactions currently share a given status.
// The method provides a lightweight aggregate for dashboards and batch-orchestration heuristics.
func (r *transactionRepository) CountByStatus(ctx context.Context, status domain.TransactionStatus) (int64, error) {
	return r.Count(ctx, database.WithEq("status", string(status)))
}

// HasActiveNonce checks whether a nonce is still active for a wallet outside final states.
// This protects against duplicate submission, replay, or accidental worker reprocessing during the transaction lifecycle.
func (r *transactionRepository) HasActiveNonce(ctx context.Context, wallet, nonce string) (bool, error) {
	filter := bson.M{
		"from_wallet": wallet,
		"nonce":       nonce,
		"status": bson.M{"$nin": []string{
			string(domain.TxStatusSuccess),
			string(domain.TxStatusFailed),
			string(domain.TxStatusRolledBack),
		}},
		"deleted_at": nil,
	}
	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return false, apperr.Wrap(apperr.ErrCodeDatabase, "HasActiveNonce count failed", err)
	}
	return count > 0, nil
}

// AssignBatch attaches a batch identifier to many transactions and marks them as batched.
// Doing the write in bulk keeps settlement and reconciliation workers efficient when large batches are assembled.
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

// ─────────────────────────────────────────────
//  batchRepository — implements ports.BatchRepository
// ─────────────────────────────────────────────

type batchRepository struct {
	*pkgmongodb.Repository[domain.Batch]
	col *mongo.Collection
}

// NewBatchRepository wires the batch repository to the MongoDB batches collection.
// Batch retrieval and persistence stay encapsulated so orchestration code can remain storage-agnostic.
func NewBatchRepository(client *pkgmongodb.Client) ports.BatchRepository {
	return &batchRepository{
		Repository: pkgmongodb.NewRepository[domain.Batch](client, "batches"),
		col:        client.Collection("batches"),
	}
}

// FindByStatus returns batches filtered by status using the shared repository helper.
// This supports worker coordination screens and internal batch-processing loops.
func (r *batchRepository) FindByStatus(ctx context.Context, status domain.BatchStatus) ([]*domain.Batch, error) {
	batches, _, err := r.Find(ctx, database.WithEq("status", string(status)))
	return batches, err
}

// FindByTxHash resolves the batch that owns a specific transaction hash.
// The lookup is used during settlement tracing, reconciliation, and failure investigation.
func (r *batchRepository) FindByTxHash(ctx context.Context, txHash string) (*domain.Batch, error) {
	return r.FindOne(ctx, database.WithEq("tx_hash", txHash))
}

var _ ports.BatchRepository = (*batchRepository)(nil)

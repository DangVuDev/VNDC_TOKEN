package adapters


import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	mongooptions "go.mongodb.org/mongo-driver/mongo/options"

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
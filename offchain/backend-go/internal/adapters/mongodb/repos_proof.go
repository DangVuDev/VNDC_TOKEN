// Package adapters contains MongoDB-backed implementations of repository ports and persistence helpers.
// This file focuses on proof-code issuance and user-progress tracking used by learning and validation workflows.
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
//  proofCodeRepository
// ─────────────────────────────────────────────

type proofCodeRepository struct {
	*pkgmongodb.Repository[domain.ProofCode]
	col *mongo.Collection
}

// NewProofCodeRepository wires proof-code persistence to the MongoDB proof_codes collection.
// This keeps proof issuance and validation data separate from the service logic that consumes those codes.
func NewProofCodeRepository(client *pkgmongodb.Client) ports.ProofCodeRepository {
	return &proofCodeRepository{
		Repository: pkgmongodb.NewRepository[domain.ProofCode](client, "proof_codes"),
		col:        client.Collection("proof_codes"),
	}
}

// BulkCreate inserts multiple proof codes in one operation to support batch issuance.
// Returning early on empty input keeps caller code simple during automated generation flows.
func (r *proofCodeRepository) BulkCreate(ctx context.Context, codes []*domain.ProofCode) error {
	if len(codes) == 0 {
		return nil
	}
	docs := make([]interface{}, len(codes))
	for i, c := range codes {
		docs[i] = c
	}
	_, err := r.col.InsertMany(ctx, docs)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "bulk insert proof codes failed", err)
	}
	return nil
}

// FindByCode resolves a proof code by its unique code string.
// Scanner or claim flows use this lookup when the code value is the only identifier available.
func (r *proofCodeRepository) FindByCode(ctx context.Context, code string) (*domain.ProofCode, error) {
	return r.FindOne(ctx, database.WithEq("code", code))
}

// FindByTaskID returns all proof codes attached to a task while preserving pagination and filters.
// This supports task-level issuance review, moderation, and export workflows.
func (r *proofCodeRepository) FindByTaskID(ctx context.Context, taskID string, opts ...database.QueryOption) ([]*domain.ProofCode, int64, error) {
	opts = append(opts, database.WithEq("task_id", taskID))
	return r.Find(ctx, opts...)
}

// MarkUsed atomically marks a proof code as consumed and records the recipient wallet.
// The conditional update prevents double-spend and guarantees one successful consumer for each code.
func (r *proofCodeRepository) MarkUsed(ctx context.Context, id, wallet string) error {
	now := time.Now().UTC()
	filter := bson.M{"_id": id, "is_used": false} // atomic check-and-set
	update := bson.M{"$set": bson.M{
		"is_used":     true,
		"assigned_to": wallet,
		"used_at":     now,
		"updated_at":  now,
	}}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "mark proof code used failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.New(apperr.ErrCodeConflict, "proof code already used or not found")
	}
	return nil
}

var _ ports.ProofCodeRepository = (*proofCodeRepository)(nil)

// ─────────────────────────────────────────────
//  userProgressRepository
// ─────────────────────────────────────────────

type userProgressRepository struct {
	*pkgmongodb.Repository[domain.UserProgress]
	col *mongo.Collection
}

// NewUserProgressRepository wires user-progress persistence to the MongoDB user_progress collection.
// This repository stores off-chain progress state while learning rules remain in higher layers.
func NewUserProgressRepository(client *pkgmongodb.Client) ports.UserProgressRepository {
	return &userProgressRepository{
		Repository: pkgmongodb.NewRepository[domain.UserProgress](client, "user_progress"),
		col:        client.Collection("user_progress"),
	}
}

// FindByTaskAndUser resolves a single progress document for a task and user pair.
// The lookup is used to prevent duplicate progress records and to resume an in-flight learning session.
func (r *userProgressRepository) FindByTaskAndUser(ctx context.Context, taskID, wallet string) (*domain.UserProgress, error) {
	return r.FindOne(ctx,
		database.WithEq("task_id", taskID),
		database.WithEq("user_wallet", wallet),
	)
}

// FindByStatus returns progress records matching a given state with any caller-supplied filters.
// This supports scanner queues, reviewer dashboards, and operational batch jobs.
func (r *userProgressRepository) FindByStatus(ctx context.Context, status domain.ProgressStatus, opts ...database.QueryOption) ([]*domain.UserProgress, int64, error) {
	opts = append(opts, database.WithEq("status", string(status)))
	return r.Find(ctx, opts...)
}

// Update persists the full progress document and refreshes its UpdatedAt timestamp.
// Centralizing this write keeps state transitions auditable and prevents callers from forgetting timestamp maintenance.
func (r *userProgressRepository) Update(ctx context.Context, progress *domain.UserProgress) error {
	progress.UpdatedAt = time.Now().UTC()
	filter := bson.M{"_id": progress.ID}
	update := bson.M{"$set": progress}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update user progress failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// EnsureIndexes creates the indexes required by proof, progress, and claim lookups.
// The function makes hot query paths predictable and documents the intended access patterns for these collections.
func EnsureTaskIndexes(ctx context.Context, client *pkgmongodb.Client) error {
	proofCol := client.Collection("proof_codes")
	progressCol := client.Collection("user_progress")
	claimCol := client.Collection("student_claims")

	// proof_codes: unique code, compound (task_id + is_used)
	_, err := proofCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "code", Value: 1}},
			Options: mongooptions.Index().SetUnique(true),
		},
		{Keys: bson.D{{Key: "task_id", Value: 1}, {Key: "is_used", Value: 1}}},
	})
	if err != nil {
		return err
	}

	// user_progress: compound (task_id + user_wallet) unique, status for scanner
	_, err = progressCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "task_id", Value: 1}, {Key: "user_wallet", Value: 1}},
			Options: mongooptions.Index().SetUnique(true),
		},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updated_at", Value: 1}}},
	})
	if err != nil {
		return err
	}

	// student_claims: status for claim worker
	_, err = claimCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "created_at", Value: 1}}},
		{Keys: bson.D{{Key: "task_id", Value: 1}, {Key: "student_wallet", Value: 1}}},
	})
	return err
}

var _ ports.UserProgressRepository = (*userProgressRepository)(nil)

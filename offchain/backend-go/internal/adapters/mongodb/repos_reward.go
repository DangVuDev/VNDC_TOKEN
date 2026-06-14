// Package adapters contains MongoDB-backed implementations of repository ports and persistence helpers.
// This file focuses on reward queues and processed reward history used by async reward settlement flows.
package adapters

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/vndc/backend/internal/domain"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ─────────────────────────────────────────────
//  RewardPendingRepository
// ─────────────────────────────────────────────

// RewardPendingRepository persists rewards that are still waiting to be processed.
// It acts as the durable queue for reward issuance, retries, and operator review flows.
type RewardPendingRepository struct {
	col *mongo.Collection
}

// NewRewardPendingRepository wires pending-reward persistence to the reward_pending collection.
// Queue-management, retry policy, and settlement orchestration remain in higher layers while this repository handles durable storage.
func NewRewardPendingRepository(client *pkgmongodb.Client) *RewardPendingRepository {
	return &RewardPendingRepository{
		col: client.Collection("reward_pending"),
	}
}

// Create inserts a new pending reward document, assigning identifiers and timestamps when needed.
// This keeps enqueue operations consistent even when callers omit persistence metadata during worker-driven or service-driven reward creation.
func (r *RewardPendingRepository) Create(ctx context.Context, reward *domain.RewardPending) error {
	if reward.ID == "" {
		reward.ID = uuid.New().String()
	}
	reward.CreatedAt = time.Now().UTC()
	reward.UpdatedAt = time.Now().UTC()
	_, err := r.col.InsertOne(ctx, reward)
	return err
}

// FindByID resolves a pending reward by its document ID.
// It returns nil when the record does not exist so callers can treat missing work items explicitly.
func (r *RewardPendingRepository) FindByID(ctx context.Context, id string) (*domain.RewardPending, error) {
	var reward domain.RewardPending
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&reward)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &reward, nil
}

// FindByStudentWallet returns all pending rewards associated with a student wallet.
// Sorting newest-first makes the result usable for wallet history views, support investigations, and dispute analysis.
func (r *RewardPendingRepository) FindByStudentWallet(ctx context.Context, wallet string) ([]*domain.RewardPending, int64, error) {
	filter := bson.M{"student_wallet": wallet}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter, options.Find().SetSort(bson.M{"created_at": -1}))
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var rewards []*domain.RewardPending
	if err = cursor.All(ctx, &rewards); err != nil {
		return nil, 0, err
	}

	if rewards == nil {
		rewards = make([]*domain.RewardPending, 0)
	}

	return rewards, count, nil
}

// FindPending returns rewards that are currently eligible for worker pickup.
// It includes both pending and queued states and orders them oldest-first so worker processing remains stable and fair.
func (r *RewardPendingRepository) FindPending(ctx context.Context, limit int64) ([]*domain.RewardPending, error) {
	filter := bson.M{
		"status": bson.M{
			"$in": []domain.RewardStatus{domain.RewardStatusPending, domain.RewardStatusQueued},
		},
	}

	opts := options.Find().
		SetSort(bson.M{"created_at": 1}).
		SetLimit(limit)

	cursor, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var rewards []*domain.RewardPending
	if err = cursor.All(ctx, &rewards); err != nil {
		return nil, err
	}

	if rewards == nil {
		rewards = make([]*domain.RewardPending, 0)
	}

	return rewards, nil
}

// FindByStatus returns pending rewards filtered by one workflow status.
// Returning the count alongside the row set makes this query suitable for dashboards, review queues, and paginated admin lists.
func (r *RewardPendingRepository) FindByStatus(ctx context.Context, status domain.RewardStatus) ([]*domain.RewardPending, int64, error) {
	filter := bson.M{"status": status}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter, options.Find().SetSort(bson.M{"created_at": -1}))
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var rewards []*domain.RewardPending
	if err = cursor.All(ctx, &rewards); err != nil {
		return nil, 0, err
	}

	if rewards == nil {
		rewards = make([]*domain.RewardPending, 0)
	}

	return rewards, count, nil
}

// FindReadyForRetry returns failed rewards whose retry window has opened and that have not exceeded the retry cap.
// This is the primary query used by retry workers that safely requeue previously failed reward settlements.
func (r *RewardPendingRepository) FindReadyForRetry(ctx context.Context) ([]*domain.RewardPending, error) {
	now := time.Now().UTC()
	filter := bson.M{
		"status": domain.RewardStatusFailed,
		"$or": []bson.M{
			{"next_retry_at": bson.M{"$lte": now}},
			{"next_retry_at": bson.M{"$exists": false}},
		},
		"retry_count": bson.M{"$lt": 5}, // Max 5 retries
	}

	cursor, err := r.col.Find(ctx, filter, options.Find().SetSort(bson.M{"created_at": 1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var rewards []*domain.RewardPending
	if err = cursor.All(ctx, &rewards); err != nil {
		return nil, err
	}

	if rewards == nil {
		rewards = make([]*domain.RewardPending, 0)
	}

	return rewards, nil
}

// Update applies partial field updates to a pending reward and refreshes the UpdatedAt timestamp.
// This method is used for status transitions, retry bookkeeping, and worker-side metadata updates without rewriting the full document.
func (r *RewardPendingRepository) Update(ctx context.Context, id string, updates map[string]any) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

// BulkUpdateStatus changes the status of multiple pending rewards in one write operation.
// Batch updates keep worker reconciliation efficient when many rewards transition together after one operational step.
func (r *RewardPendingRepository) BulkUpdateStatus(ctx context.Context, ids []string, newStatus domain.RewardStatus) error {
	if len(ids) == 0 {
		return nil
	}

	filter := bson.M{"_id": bson.M{"$in": ids}}
	updates := bson.M{
		"$set": bson.M{
			"status":     newStatus,
			"updated_at": time.Now().UTC(),
		},
	}

	_, err := r.col.UpdateMany(ctx, filter, updates)
	return err
}

// Delete permanently removes a pending reward document by ID.
// This should generally be reserved for exceptional cleanup because pending rewards form part of the settlement audit trail.
func (r *RewardPendingRepository) Delete(ctx context.Context, id string) error {
	_, err := r.col.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// ─────────────────────────────────────────────
//  RewardProcessedRepository
// ─────────────────────────────────────────────

// RewardProcessedRepository persists the immutable history of rewards that already finished processing.
// It supports reconciliation, audit review, and user-facing payout history queries.
type RewardProcessedRepository struct {
	col *mongo.Collection
}

// NewRewardProcessedRepository wires processed-reward persistence to the reward_processed collection.
// It stores the finalized outcome of reward settlement separately from the pending queue.
func NewRewardProcessedRepository(client *pkgmongodb.Client) *RewardProcessedRepository {
	return &RewardProcessedRepository{
		col: client.Collection("reward_processed"),
	}
}

// Create inserts a processed reward record, assigning identifiers and timestamps when needed.
// The method is typically called once a pending reward has been finalized and moved into immutable history.
func (r *RewardProcessedRepository) Create(ctx context.Context, reward *domain.RewardProcessed) error {
	if reward.ID == "" {
		reward.ID = uuid.New().String()
	}
	reward.CreatedAt = time.Now().UTC()
	reward.UpdatedAt = time.Now().UTC()
	_, err := r.col.InsertOne(ctx, reward)
	return err
}

// FindByID resolves a processed reward by its document ID.
// Missing records return nil so reconciliation code can distinguish absence from failure.
func (r *RewardProcessedRepository) FindByID(ctx context.Context, id string) (*domain.RewardProcessed, error) {
	var reward domain.RewardProcessed
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&reward)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &reward, nil
}

// FindByStudentWallet returns processed rewards for a student wallet ordered by most recent processing time.
// This query powers payout history pages, support investigations, and student-facing settlement timelines.
func (r *RewardProcessedRepository) FindByStudentWallet(ctx context.Context, wallet string) ([]*domain.RewardProcessed, int64, error) {
	filter := bson.M{"student_wallet": wallet}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter, options.Find().SetSort(bson.M{"processed_at": -1}))
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var rewards []*domain.RewardProcessed
	if err = cursor.All(ctx, &rewards); err != nil {
		return nil, 0, err
	}

	if rewards == nil {
		rewards = make([]*domain.RewardProcessed, 0)
	}

	return rewards, count, nil
}

// FindByOriginalRewardID resolves the processed record created from a pending reward.
// It is useful when tracing one reward across the transition from queue state into finalized settlement history.
func (r *RewardProcessedRepository) FindByOriginalRewardID(ctx context.Context, rewardID string) (*domain.RewardProcessed, error) {
	var reward domain.RewardProcessed
	err := r.col.FindOne(ctx, bson.M{"original_reward_id": rewardID}).Decode(&reward)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &reward, nil
}

// FindByTransactionID returns processed rewards associated with one blockchain transaction.
// The result is sorted newest-first to support reconciliation, explorer cross-checking, and post-settlement inspection.
func (r *RewardProcessedRepository) FindByTransactionID(ctx context.Context, txID string) ([]*domain.RewardProcessed, error) {
	filter := bson.M{"transaction_id": txID}

	cursor, err := r.col.Find(ctx, filter, options.Find().SetSort(bson.M{"processed_at": -1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var rewards []*domain.RewardProcessed
	if err = cursor.All(ctx, &rewards); err != nil {
		return nil, err
	}

	if rewards == nil {
		rewards = make([]*domain.RewardProcessed, 0)
	}

	return rewards, nil
}

// FindByStatus returns processed rewards filtered by settlement outcome.
// The accompanying count supports admin reporting, success-rate tracking, and operational summaries.
func (r *RewardProcessedRepository) FindByStatus(ctx context.Context, isSuccessful bool) ([]*domain.RewardProcessed, int64, error) {
	filter := bson.M{"is_successful": isSuccessful}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter, options.Find().SetSort(bson.M{"processed_at": -1}))
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var rewards []*domain.RewardProcessed
	if err = cursor.All(ctx, &rewards); err != nil {
		return nil, 0, err
	}

	if rewards == nil {
		rewards = make([]*domain.RewardProcessed, 0)
	}

	return rewards, count, nil
}

// Update applies partial field updates to a processed reward and refreshes the UpdatedAt timestamp.
// This is reserved for post-processing annotations, reconciliation metadata changes, or audit corrections.
func (r *RewardProcessedRepository) Update(ctx context.Context, id string, updates map[string]any) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

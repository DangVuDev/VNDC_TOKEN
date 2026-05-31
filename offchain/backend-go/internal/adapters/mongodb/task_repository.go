// Package adapters contains MongoDB-backed implementations of repository ports and persistence helpers.
// This file focuses on task definitions and student claim records used by task-completion workflows.
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
//  taskRepository — implements ports.TaskRepository
// ─────────────────────────────────────────────

type taskRepository struct {
	*pkgmongodb.Repository[domain.Task]
	col *mongo.Collection
}

// NewTaskRepository wires task persistence to the MongoDB tasks collection.
// Task eligibility, completion rules, and reward policies remain outside the repository boundary.
func NewTaskRepository(client *pkgmongodb.Client) ports.TaskRepository {
	return &taskRepository{
		Repository: pkgmongodb.NewRepository[domain.Task](client, "tasks"),
		col:        client.Collection("tasks"),
	}
}

// FindAll returns tasks using the shared repository query pipeline.
// It lets callers apply pagination, filtering, and sorting uniformly across admin and student-facing task views.
func (r *taskRepository) FindAll(ctx context.Context, opts ...database.QueryOption) ([]*domain.Task, int64, error) {
	return r.Find(ctx, opts...)
}

// FindByStatus returns tasks filtered by workflow status while preserving query options.
// The count is included so dashboards and moderation screens can render pagination metadata without extra queries.
func (r *taskRepository) FindByStatus(ctx context.Context, status domain.TaskStatus, opts ...database.QueryOption) ([]*domain.Task, int64, error) {
	opts = append(opts, database.WithEq("status", string(status)))
	return r.Find(ctx, opts...)
}

// Update persists the full task document and refreshes the UpdatedAt timestamp.
// Services call this after edits to task metadata, lifecycle state, eligibility rules, or reward configuration.
func (r *taskRepository) Update(ctx context.Context, task *domain.Task) error {
	task.UpdatedAt = time.Now().UTC()
	filter := bson.M{"_id": task.ID}
	update := bson.M{"$set": task}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update task failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// Delete soft-deletes a task through the shared repository helper.
// Cleanup of dependent claims or progress data must be handled explicitly outside this repository.
func (r *taskRepository) Delete(ctx context.Context, id string) error {
	return r.Repository.Delete(ctx, id)
}

var _ ports.TaskRepository = (*taskRepository)(nil)

// ─────────────────────────────────────────────
//  studentClaimRepository — implements ports.StudentClaimRepository
// ─────────────────────────────────────────────

type studentClaimRepository struct {
	*pkgmongodb.Repository[domain.StudentClaim]
	col *mongo.Collection
}

// NewStudentClaimRepository wires student claim persistence to the MongoDB student_claims collection.
// Claim validation and reward settlement remain outside the storage layer.
func NewStudentClaimRepository(client *pkgmongodb.Client) ports.StudentClaimRepository {
	return &studentClaimRepository{
		Repository: pkgmongodb.NewRepository[domain.StudentClaim](client, "student_claims"),
		col:        client.Collection("student_claims"),
	}
}

// FindByTaskAndStudent resolves the unique claim document for a task and student pair.
// This lookup is used to prevent duplicate claim creation and to resume a claim review flow.
func (r *studentClaimRepository) FindByTaskAndStudent(ctx context.Context, taskID, wallet string) (*domain.StudentClaim, error) {
	return r.FindOne(ctx,
		database.WithEq("task_id", taskID),
		database.WithEq("student_wallet", wallet),
	)
}

// FindByStudent returns all claims for a student while preserving pagination and filters.
// It powers personal claim history views and support-side troubleshooting screens.
func (r *studentClaimRepository) FindByStudent(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.StudentClaim, int64, error) {
	opts = append(opts, database.WithEq("student_wallet", wallet))
	return r.Find(ctx, opts...)
}

// FindByStatus returns claims matching a state and any caller-supplied query options.
// This supports review queues, payout preparation, and administrative monitoring.
func (r *studentClaimRepository) FindByStatus(ctx context.Context, status string, opts ...database.QueryOption) ([]*domain.StudentClaim, int64, error) {
	opts = append(opts, database.WithEq("status", status))
	return r.Find(ctx, opts...)
}

// Update persists the full claim document and refreshes UpdatedAt.
// It is used when claim state, reviewer metadata, or settlement references change.
func (r *studentClaimRepository) Update(ctx context.Context, claim *domain.StudentClaim) error {
	claim.UpdatedAt = time.Now().UTC()
	filter := bson.M{"_id": claim.ID}
	update := bson.M{"$set": claim}
	res, err := r.col.UpdateOne(ctx, filter, update)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update claim failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.StudentClaimRepository = (*studentClaimRepository)(nil)

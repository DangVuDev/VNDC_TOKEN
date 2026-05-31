package ports

import (
	"context"

	"github.com/vndc/backend/internal/domain"
)

// ActivityRepository manages activities (definitions)
type ActivityRepository interface {
	Create(ctx context.Context, activity *domain.Activity) error
	FindByID(ctx context.Context, id string) (*domain.Activity, error)
	FindAll(ctx context.Context) ([]*domain.Activity, int64, error)
	FindByCreator(ctx context.Context, createdBy string) ([]*domain.Activity, int64, error)
	Update(ctx context.Context, id string, updates map[string]any) error
	Delete(ctx context.Context, id string) error
	// FindByIDs returns activities matching the given IDs (used for title lookup).
	FindByIDs(ctx context.Context, ids []string) ([]*domain.Activity, error)
}

// ActivityRecordRepository manages activity records (student participation)
type ActivityRecordRepository interface {
	Create(ctx context.Context, record *domain.ActivityRecord) error
	FindByID(ctx context.Context, id string) (*domain.ActivityRecord, error)

	// Find records for a specific activity
	FindByActivityID(ctx context.Context, activityID string) ([]*domain.ActivityRecord, int64, error)

	// Find records for a specific student
	FindByStudentAddress(ctx context.Context, address string) ([]*domain.ActivityRecord, int64, error)

	// Find a specific record (must be unique per activity+student)
	FindByActivityAndStudent(ctx context.Context, activityID, studentAddress string) (*domain.ActivityRecord, error)

	// Find records by status (PENDING, CONFIRMED, LOCKED)
	FindByStatus(ctx context.Context, status domain.ActivityRecordStatus) ([]*domain.ActivityRecord, int64, error)

	// Find records that need auto-locking (status=PENDING, editDeadline <= now)
	FindExpiredRecords(ctx context.Context) ([]*domain.ActivityRecord, error)

	// Update a record
	Update(ctx context.Context, id string, updates map[string]any) error

	// Bulk update for auto-lock operations
	BulkUpdateStatus(ctx context.Context, ids []string, newStatus domain.ActivityRecordStatus) error

	Delete(ctx context.Context, id string) error
}

// ActivityClaimRepository manages claim records
type ActivityClaimRepository interface {
	Create(ctx context.Context, claim *domain.ActivityClaim) error
	FindByID(ctx context.Context, id string) (*domain.ActivityClaim, error)
	FindByStudentAddress(ctx context.Context, address string) ([]*domain.ActivityClaim, int64, error)
	Update(ctx context.Context, id string, updates map[string]any) error
}

// ActivityEnrollmentRepository manages student enrollments for ACTIVITY cluster events
type ActivityEnrollmentRepository interface {
	Create(ctx context.Context, e *domain.ActivityEnrollment) error
	FindByID(ctx context.Context, id string) (*domain.ActivityEnrollment, error)
	FindByActivityID(ctx context.Context, activityID string) ([]*domain.ActivityEnrollment, int64, error)
	FindByStudentAddress(ctx context.Context, address string) ([]*domain.ActivityEnrollment, int64, error)
	FindByActivityAndStudent(ctx context.Context, activityID, studentAddress string) (*domain.ActivityEnrollment, error)
	CountByActivityID(ctx context.Context, activityID string) (int64, error)
	Update(ctx context.Context, id string, updates map[string]any) error
}

// LearningSubmissionRepository manages LEARNING cluster auto-completions
type LearningSubmissionRepository interface {
	Create(ctx context.Context, s *domain.LearningSubmission) error
	FindByActivityAndStudent(ctx context.Context, activityID, studentAddress string) (*domain.LearningSubmission, error)
	FindByStudentAddress(ctx context.Context, address string) ([]*domain.LearningSubmission, int64, error)
}

// ─────────────────────────────────────────────
//  RewardRepository — Pending rewards
// ─────────────────────────────────────────────

// RewardRepository manages pending rewards awaiting transfer
type RewardRepository interface {
	// CRUD operations
	Create(ctx context.Context, reward *domain.RewardPending) error
	FindByID(ctx context.Context, id string) (*domain.RewardPending, error)
	FindByStudentWallet(ctx context.Context, wallet string) ([]*domain.RewardPending, int64, error)

	// Query pending rewards for processing
	FindPending(ctx context.Context, limit int64) ([]*domain.RewardPending, error)
	FindByStatus(ctx context.Context, status domain.RewardStatus) ([]*domain.RewardPending, int64, error)

	// Find rewards ready for retry
	FindReadyForRetry(ctx context.Context) ([]*domain.RewardPending, error)

	// Update a single reward
	Update(ctx context.Context, id string, updates map[string]any) error

	// Bulk update rewards
	BulkUpdateStatus(ctx context.Context, ids []string, newStatus domain.RewardStatus) error

	Delete(ctx context.Context, id string) error
}

// ─────────────────────────────────────────────
//  RewardProcessedRepository — Audit/history
// ─────────────────────────────────────────────

// RewardProcessedRepository manages processed reward history for audit
type RewardProcessedRepository interface {
	// Record a processed reward
	Create(ctx context.Context, reward *domain.RewardProcessed) error
	FindByID(ctx context.Context, id string) (*domain.RewardProcessed, error)

	// Query by student/timeline
	FindByStudentWallet(ctx context.Context, wallet string) ([]*domain.RewardProcessed, int64, error)
	FindByOriginalRewardID(ctx context.Context, rewardID string) (*domain.RewardProcessed, error)
	FindByTransactionID(ctx context.Context, txID string) ([]*domain.RewardProcessed, error)

	// Find successful/failed rewards
	FindByStatus(ctx context.Context, isSuccessful bool) ([]*domain.RewardProcessed, int64, error)

	Update(ctx context.Context, id string, updates map[string]any) error
}

package ports

import (
	"context"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

type TaskRepository interface {
	Create(ctx context.Context, task *domain.Task) error
	FindByID(ctx context.Context, id string) (*domain.Task, error)
	FindAll(ctx context.Context, opts ...database.QueryOption) ([]*domain.Task, int64, error)
	FindByStatus(ctx context.Context, status domain.TaskStatus, opts ...database.QueryOption) ([]*domain.Task, int64, error)
	Update(ctx context.Context, task *domain.Task) error
	Delete(ctx context.Context, id string) error
}

type StudentClaimRepository interface {
	Create(ctx context.Context, claim *domain.StudentClaim) error
	FindByID(ctx context.Context, id string) (*domain.StudentClaim, error)
	FindByTaskAndStudent(ctx context.Context, taskID, wallet string) (*domain.StudentClaim, error)
	FindByStudent(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.StudentClaim, int64, error)
	FindByStatus(ctx context.Context, status string, opts ...database.QueryOption) ([]*domain.StudentClaim, int64, error)
	Update(ctx context.Context, claim *domain.StudentClaim) error
}

// ProofCodeRepository manages Cluster 2 physical proof codes.
type ProofCodeRepository interface {
	Create(ctx context.Context, code *domain.ProofCode) error
	BulkCreate(ctx context.Context, codes []*domain.ProofCode) error
	FindByCode(ctx context.Context, code string) (*domain.ProofCode, error)
	FindByTaskID(ctx context.Context, taskID string, opts ...database.QueryOption) ([]*domain.ProofCode, int64, error)
	MarkUsed(ctx context.Context, id, wallet string) error
}

// UserProgressRepository tracks Cluster 1 learning sessions.
type UserProgressRepository interface {
	Create(ctx context.Context, progress *domain.UserProgress) error
	FindByID(ctx context.Context, id string) (*domain.UserProgress, error)
	FindByTaskAndUser(ctx context.Context, taskID, wallet string) (*domain.UserProgress, error)
	FindByStatus(ctx context.Context, status domain.ProgressStatus, opts ...database.QueryOption) ([]*domain.UserProgress, int64, error)
	Update(ctx context.Context, progress *domain.UserProgress) error
}

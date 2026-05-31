package ports

import (
	"context"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

// FundActivityRepository manages fundraising activities.
type FundActivityRepository interface {
	Create(ctx context.Context, activity *domain.FundActivity) error
	FindByID(ctx context.Context, id string) (*domain.FundActivity, error)
	Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.FundActivity, int64, error)
	FindByMember(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.FundActivity, int64, error)
	Update(ctx context.Context, activity *domain.FundActivity) error
	Delete(ctx context.Context, id string) error
	WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

// FundLedgerRepository stores the immutable fund ledger.
type FundLedgerRepository interface {
	Create(ctx context.Context, entry *domain.FundLedgerEntry) error
	FindByID(ctx context.Context, id string) (*domain.FundLedgerEntry, error)
	FindByActivity(ctx context.Context, activityID string, opts ...database.QueryOption) ([]*domain.FundLedgerEntry, int64, error)
	FindPendingContributionByReference(ctx context.Context, activityID, txReference string) (*domain.FundLedgerEntry, error)
	CountByActivityAndType(ctx context.Context, activityID string, entryType domain.FundLedgerEntryType) (int64, error)
	Update(ctx context.Context, entry *domain.FundLedgerEntry) error
	WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

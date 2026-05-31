package ports

import (
	"context"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

type DAOOrganizationRepository interface {
	Create(ctx context.Context, dao *domain.DAOOrganization) error
	FindByID(ctx context.Context, id string) (*domain.DAOOrganization, error)
	Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.DAOOrganization, int64, error)
	Update(ctx context.Context, dao *domain.DAOOrganization) error
	Delete(ctx context.Context, id string) error
}

type DAOProposalRepository interface {
	Create(ctx context.Context, proposal *domain.DAOProposal) error
	FindByID(ctx context.Context, id string) (*domain.DAOProposal, error)
	FindByDAO(ctx context.Context, daoID string, opts ...database.QueryOption) ([]*domain.DAOProposal, int64, error)
	Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.DAOProposal, int64, error)
	// FindExpiredActive returns proposals in ACTIVE/PENDING state whose end_time has passed.
	FindExpiredActive(ctx context.Context) ([]*domain.DAOProposal, error)
	Update(ctx context.Context, proposal *domain.DAOProposal) error
}

type DAOVoteRepository interface {
	Create(ctx context.Context, vote *domain.DAOVote) error
	FindByID(ctx context.Context, id string) (*domain.DAOVote, error)
	FindByProposal(ctx context.Context, proposalID string, opts ...database.QueryOption) ([]*domain.DAOVote, int64, error)
	FindByProposalAndVoter(ctx context.Context, proposalID, wallet string) (*domain.DAOVote, error)
}

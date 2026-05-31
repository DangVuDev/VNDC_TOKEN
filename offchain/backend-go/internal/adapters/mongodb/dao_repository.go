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

type daoOrganizationRepository struct {
	*pkgmongodb.Repository[domain.DAOOrganization]
	col *mongo.Collection
}

// NewDAOOrganizationRepository wires DAO organization persistence to the MongoDB dao_organizations collection.
// The constructor keeps storage binding localized so higher layers only depend on the repository port.
func NewDAOOrganizationRepository(client *pkgmongodb.Client) ports.DAOOrganizationRepository {
	return &daoOrganizationRepository{
		Repository: pkgmongodb.NewRepository[domain.DAOOrganization](client, "dao_organizations"),
		col:        client.Collection("dao_organizations"),
	}
}

// Update persists the full DAO organization document and refreshes its UpdatedAt timestamp.
// It is used after changes to DAO metadata, governance parameters, treasury settings, or membership configuration.
func (r *daoOrganizationRepository) Update(ctx context.Context, dao *domain.DAOOrganization) error {
	dao.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": dao.ID}, bson.M{"$set": dao})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update dao organization failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// Delete removes a DAO organization by ID through the shared repository helper.
// The repository intentionally limits itself to document removal and leaves any cascading cleanup to services.
func (r *daoOrganizationRepository) Delete(ctx context.Context, id string) error {
	return r.Repository.Delete(ctx, id)
}

var _ ports.DAOOrganizationRepository = (*daoOrganizationRepository)(nil)

type daoProposalRepository struct {
	*pkgmongodb.Repository[domain.DAOProposal]
	col *mongo.Collection
}

// NewDAOProposalRepository wires DAO proposal persistence to the MongoDB dao_proposals collection.
// Proposal validation, vote thresholds, and execution rules remain outside the repository boundary.
func NewDAOProposalRepository(client *pkgmongodb.Client) ports.DAOProposalRepository {
	return &daoProposalRepository{
		Repository: pkgmongodb.NewRepository[domain.DAOProposal](client, "dao_proposals"),
		col:        client.Collection("dao_proposals"),
	}
}

// FindByDAO returns proposals that belong to one DAO while preserving caller-supplied filters, sorting, and pagination.
// This is the main read path for DAO governance dashboards and proposal history views.
func (r *daoProposalRepository) FindByDAO(ctx context.Context, daoID string, opts ...database.QueryOption) ([]*domain.DAOProposal, int64, error) {
	opts = append(opts, database.WithEq("dao_id", daoID))
	return r.Find(ctx, opts...)
}

// FindExpiredActive finds proposals that are still marked active or pending even though their end time has elapsed.
// The result is used by scheduled governance maintenance that closes, tallies, or escalates overdue proposals.
func (r *daoProposalRepository) FindExpiredActive(ctx context.Context) ([]*domain.DAOProposal, error) {
	filter := bson.M{
		"status":   bson.M{"$in": bson.A{string(domain.DAOProposalActive), string(domain.DAOProposalPending)}},
		"end_time": bson.M{"$lt": time.Now().UTC()},
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "find expired proposals failed", err)
	}
	defer cursor.Close(ctx)
	var results []*domain.DAOProposal
	if err := cursor.All(ctx, &results); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode expired proposals failed", err)
	}
	return results, nil
}

// Update persists the full DAO proposal document and refreshes its UpdatedAt timestamp.
// Services call this after vote tallies, status changes, execution metadata updates, or content edits.
func (r *daoProposalRepository) Update(ctx context.Context, proposal *domain.DAOProposal) error {
	proposal.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": proposal.ID}, bson.M{"$set": proposal})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update dao proposal failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.DAOProposalRepository = (*daoProposalRepository)(nil)

type daoVoteRepository struct {
	*pkgmongodb.Repository[domain.DAOVote]
	col *mongo.Collection
}

// NewDAOVoteRepository wires DAO vote persistence to the MongoDB dao_votes collection.
// This keeps vote storage concerns isolated from vote-weight calculation and proposal resolution logic.
func NewDAOVoteRepository(client *pkgmongodb.Client) ports.DAOVoteRepository {
	return &daoVoteRepository{
		Repository: pkgmongodb.NewRepository[domain.DAOVote](client, "dao_votes"),
		col:        client.Collection("dao_votes"),
	}
}

// FindByProposal returns all votes for a proposal while preserving caller-provided filters, ordering, and pagination.
// It is the primary read path for vote tallying, audit review, and voter history views.
func (r *daoVoteRepository) FindByProposal(ctx context.Context, proposalID string, opts ...database.QueryOption) ([]*domain.DAOVote, int64, error) {
	opts = append(opts, database.WithEq("proposal_id", proposalID))
	return r.Find(ctx, opts...)
}

// FindByProposalAndVoter resolves the unique vote cast by one wallet on one proposal.
// Callers use this lookup to prevent duplicate votes and to display a voter's existing choice.
func (r *daoVoteRepository) FindByProposalAndVoter(ctx context.Context, proposalID, wallet string) (*domain.DAOVote, error) {
	return r.FindOne(ctx,
		database.WithEq("proposal_id", proposalID),
		database.WithEq("voter_wallet", wallet),
	)
}

var _ ports.DAOVoteRepository = (*daoVoteRepository)(nil)

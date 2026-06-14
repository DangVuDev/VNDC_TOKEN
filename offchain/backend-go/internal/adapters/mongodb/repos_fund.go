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

type fundActivityRepository struct {
	*pkgmongodb.Repository[domain.FundActivity]
	col *mongo.Collection
}

// NewFundActivityRepository wires fund-activity persistence to the MongoDB fund_activities collection.
// The repository keeps member-scoped fundraising activity access behind a single port abstraction.
func NewFundActivityRepository(client *pkgmongodb.Client) ports.FundActivityRepository {
	return &fundActivityRepository{
		Repository: pkgmongodb.NewRepository[domain.FundActivity](client, "fund_activities"),
		col:        client.Collection("fund_activities"),
	}
}

// FindByMember returns fund activities where the wallet is either an owner or deputy.
// It preserves the caller's filters, pagination, and sort order so member-facing dashboards can stay flexible.
func (r *fundActivityRepository) FindByMember(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.FundActivity, int64, error) {
	q := database.NewQuery(opts...)
	filter, findOpts := buildFundFindOptions(q)
	filter = append(filter, bson.E{Key: "$or", Value: bson.A{
		bson.M{"owner_wallet": wallet},
		bson.M{"deputy_wallets": wallet},
	}})

	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "count fund activities by member failed", err)
	}

	cursor, err := r.col.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "find fund activities by member failed", err)
	}
	defer cursor.Close(ctx)

	var items []*domain.FundActivity
	if err := cursor.All(ctx, &items); err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "decode fund activities by member failed", err)
	}
	return items, total, nil
}

// Update persists the full fund activity document and refreshes its UpdatedAt timestamp.
// Services call it when governance roles, balances, deadlines, or activity metadata change.
func (r *fundActivityRepository) Update(ctx context.Context, activity *domain.FundActivity) error {
	activity.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": activity.ID}, bson.M{"$set": activity})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update fund activity failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// Delete soft-deletes a fund activity through the shared repository helper.
// Any dependent financial cleanup must already have been handled by higher layers before deletion.
func (r *fundActivityRepository) Delete(ctx context.Context, id string) error {
	return r.Repository.Delete(ctx, id)
}

var _ ports.FundActivityRepository = (*fundActivityRepository)(nil)

type fundLedgerRepository struct {
	*pkgmongodb.Repository[domain.FundLedgerEntry]
	col *mongo.Collection
}

// NewFundLedgerRepository wires fund-ledger persistence to the MongoDB fund_ledger_entries collection.
// It centralizes contribution and accounting-entry lookups so financial flows stay consistent.
func NewFundLedgerRepository(client *pkgmongodb.Client) ports.FundLedgerRepository {
	return &fundLedgerRepository{
		Repository: pkgmongodb.NewRepository[domain.FundLedgerEntry](client, "fund_ledger_entries"),
		col:        client.Collection("fund_ledger_entries"),
	}
}

// FindByActivity returns ledger entries linked to a fundraising activity.
// This is the core query for activity ledgers, finance review screens, and reconciliation reports.
func (r *fundLedgerRepository) FindByActivity(ctx context.Context, activityID string, opts ...database.QueryOption) ([]*domain.FundLedgerEntry, int64, error) {
	opts = append(opts, database.WithEq("activity_id", activityID))
	return r.Find(ctx, opts...)
}

// CountByActivityAndType counts ledger entries for one activity and entry type.
// The aggregate is useful for quick workflow checks without loading the full ledger row set.
func (r *fundLedgerRepository) CountByActivityAndType(ctx context.Context, activityID string, entryType domain.FundLedgerEntryType) (int64, error) {
	return r.Count(ctx,
		database.WithEq("activity_id", activityID),
		database.WithEq("entry_type", string(entryType)),
	)
}

// FindByID resolves a ledger entry by its document ID.
// This is primarily used by finance workflows that need to inspect or amend one known record.
func (r *fundLedgerRepository) FindByID(ctx context.Context, id string) (*domain.FundLedgerEntry, error) {
	return r.Repository.FindByID(ctx, id)
}

// FindPendingContributionByReference resolves the pending contribution tied to a transaction reference.
// This allows payment-confirmation code to map an inbound transaction reference back to the correct ledger row.
func (r *fundLedgerRepository) FindPendingContributionByReference(ctx context.Context, activityID, txReference string) (*domain.FundLedgerEntry, error) {
	return r.Repository.FindOne(
		ctx,
		database.WithEq("activity_id", activityID),
		database.WithEq("entry_type", string(domain.FundLedgerContribution)),
		database.WithEq("status", string(domain.FundLedgerPending)),
		database.WithEq("reference", txReference),
	)
}

// Update persists the full ledger entry document and refreshes its UpdatedAt timestamp.
// It is used for settlement changes, reconciliation annotations, and accounting corrections.
func (r *fundLedgerRepository) Update(ctx context.Context, entry *domain.FundLedgerEntry) error {
	entry.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": entry.ID}, bson.M{"$set": entry})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update fund ledger entry failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.FundLedgerRepository = (*fundLedgerRepository)(nil)

// buildFundFindOptions translates shared query options into MongoDB filters and find options.
// Keeping this translation in one helper prevents inconsistent handling of filters, soft-delete state, and sort order.
func buildFundFindOptions(q *database.Query) (bson.D, *mongooptions.FindOptions) {
	filter := bson.D{}
	for _, f := range q.Filters {
		switch f.Operator {
		case database.OpEq:
			filter = append(filter, bson.E{Key: f.Field, Value: f.Value})
		case database.OpLike:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$regex": f.Value, "$options": "i"}})
		}
	}
	filter = append(filter, bson.E{Key: "deleted_at", Value: nil})

	findOpts := mongooptions.Find()
	if q.Limit > 0 {
		findOpts.SetLimit(q.Limit)
	}
	if q.Skip > 0 {
		findOpts.SetSkip(q.Skip)
	}
	if len(q.Sorts) > 0 {
		sortDoc := bson.D{}
		for _, s := range q.Sorts {
			order := int32(-1)
			if s.Order == database.SortAsc {
				order = 1
			}
			sortDoc = append(sortDoc, bson.E{Key: s.Field, Value: order})
		}
		findOpts.SetSort(sortDoc)
	}
	return filter, findOpts
}

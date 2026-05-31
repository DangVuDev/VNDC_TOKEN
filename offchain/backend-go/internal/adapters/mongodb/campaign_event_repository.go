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
//  FundraisingCampaign Repository
// ─────────────────────────────────────────────

type fundraisingCampaignRepository struct {
	*pkgmongodb.Repository[domain.FundraisingCampaign]
	col *mongo.Collection
}

// NewFundraisingCampaignRepository wires fundraising campaign persistence to the MongoDB fundraising_campaigns collection.
// Campaign business rules such as funding thresholds and lifecycle transitions remain in service code.
func NewFundraisingCampaignRepository(client *pkgmongodb.Client) ports.FundraisingCampaignRepository {
	return &fundraisingCampaignRepository{
		Repository: pkgmongodb.NewRepository[domain.FundraisingCampaign](client, "fundraising_campaigns"),
		col:        client.Collection("fundraising_campaigns"),
	}
}

// Find returns fundraising campaigns using the shared repository query pipeline.
// It allows higher layers to compose pagination, filtering, and sort options without duplicating query code.
func (r *fundraisingCampaignRepository) Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.FundraisingCampaign, int64, error) {
	return r.Repository.Find(ctx, opts...)
}

// Update persists the full fundraising campaign document and refreshes UpdatedAt.
// This is used for campaign status changes, progress updates, deadline edits, and administrative corrections.
func (r *fundraisingCampaignRepository) Update(ctx context.Context, campaign *domain.FundraisingCampaign) error {
	campaign.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": campaign.ID}, bson.M{"$set": campaign})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update fundraising campaign failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// FindExpiredActive returns active campaigns whose deadline has already passed.
// Background jobs can use this result to settle campaigns that were never explicitly closed.
func (r *fundraisingCampaignRepository) FindExpiredActive(ctx context.Context) ([]*domain.FundraisingCampaign, error) {
	filter := bson.M{
		"status":   string(domain.CampaignStatusActive),
		"deadline": bson.M{"$lt": time.Now().UTC()},
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "find expired campaigns failed", err)
	}
	defer cursor.Close(ctx)
	var items []*domain.FundraisingCampaign
	if err := cursor.All(ctx, &items); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode expired campaigns failed", err)
	}
	return items, nil
}

var _ ports.FundraisingCampaignRepository = (*fundraisingCampaignRepository)(nil)

// ─────────────────────────────────────────────
//  FundraisingContribution Repository
// ─────────────────────────────────────────────

type fundraisingContributionRepository struct {
	*pkgmongodb.Repository[domain.FundraisingContribution]
	col *mongo.Collection
}

// NewFundraisingContributionRepository wires fundraising contribution persistence to the MongoDB fundraising_contributions collection.
// It isolates contribution storage from payment verification and campaign accounting logic.
func NewFundraisingContributionRepository(client *pkgmongodb.Client) ports.FundraisingContributionRepository {
	return &fundraisingContributionRepository{
		Repository: pkgmongodb.NewRepository[domain.FundraisingContribution](client, "fundraising_contributions"),
		col:        client.Collection("fundraising_contributions"),
	}
}

// FindByCampaign returns all contributions attached to a campaign.
// This query supports campaign detail pages, treasury summaries, and contribution reconciliation jobs.
func (r *fundraisingContributionRepository) FindByCampaign(ctx context.Context, campaignID string) ([]*domain.FundraisingContribution, error) {
	cursor, err := r.col.Find(ctx, bson.M{"campaign_id": campaignID})
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "find contributions by campaign failed", err)
	}
	defer cursor.Close(ctx)
	var items []*domain.FundraisingContribution
	if err := cursor.All(ctx, &items); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode contributions failed", err)
	}
	return items, nil
}

// FindPendingByCampaign returns contributions that are still pending for a campaign.
// The result is typically consumed by background processors waiting for payment finalization.
func (r *fundraisingContributionRepository) FindPendingByCampaign(ctx context.Context, campaignID string) ([]*domain.FundraisingContribution, error) {
	filter := bson.M{
		"campaign_id": campaignID,
		"status":      string(domain.ContributionStatusPending),
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "find pending contributions failed", err)
	}
	defer cursor.Close(ctx)
	var items []*domain.FundraisingContribution
	if err := cursor.All(ctx, &items); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode pending contributions failed", err)
	}
	return items, nil
}

// UpdateStatus changes a contribution's state and refreshes its updated timestamp.
// This repository method is intentionally narrow so workers can acknowledge settlement progress without rewriting the full document.
func (r *fundraisingContributionRepository) UpdateStatus(ctx context.Context, id string, status domain.ContributionStatus) error {
	res, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"status": string(status), "updated_at": time.Now().UTC()}},
	)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update contribution status failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.FundraisingContributionRepository = (*fundraisingContributionRepository)(nil)

// ─────────────────────────────────────────────
//  Event Repository
// ─────────────────────────────────────────────

type eventRepository struct {
	*pkgmongodb.Repository[domain.Event]
	col *mongo.Collection
}

// NewEventRepository wires event persistence to the MongoDB events collection.
// Domain rules such as ticket issuance, publication, and attendance validation stay outside this layer.
func NewEventRepository(client *pkgmongodb.Client) ports.EventRepository {
	return &eventRepository{
		Repository: pkgmongodb.NewRepository[domain.Event](client, "events"),
		col:        client.Collection("events"),
	}
}

// Find returns events using the shared repository query pipeline.
// It is the common read path for public listings, admin panels, and organizer dashboards.
func (r *eventRepository) Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.Event, int64, error) {
	return r.Repository.Find(ctx, opts...)
}

// Update persists the full event document and refreshes UpdatedAt.
// Services call it when schedule data, capacity, publication state, or organizer-owned metadata changes.
func (r *eventRepository) Update(ctx context.Context, event *domain.Event) error {
	event.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": event.ID}, bson.M{"$set": event})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update event failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.EventRepository = (*eventRepository)(nil)

// ─────────────────────────────────────────────
//  EventTicket Repository
// ─────────────────────────────────────────────

type eventTicketRepository struct {
	*pkgmongodb.Repository[domain.EventTicket]
	col *mongo.Collection
}

// NewEventTicketRepository wires event ticket persistence to the MongoDB event_tickets collection.
// Ticket allocation and ownership transitions remain governed by higher-level workflows.
func NewEventTicketRepository(client *pkgmongodb.Client) ports.EventTicketRepository {
	return &eventTicketRepository{
		Repository: pkgmongodb.NewRepository[domain.EventTicket](client, "event_tickets"),
		col:        client.Collection("event_tickets"),
	}
}

// BulkCreate inserts many tickets at once for efficiency and reduced round-trips.
// It is used during ticket generation so large batches do not require one write per ticket.
func (r *eventTicketRepository) BulkCreate(ctx context.Context, tickets []*domain.EventTicket) error {
	if len(tickets) == 0 {
		return nil
	}
	docs := make([]interface{}, len(tickets))
	for i, t := range tickets {
		docs[i] = t
	}
	_, err := r.col.InsertMany(ctx, docs)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "bulk insert event tickets failed", err)
	}
	return nil
}

// FindAvailable returns one available ticket for an event, which is used when matching a purchase.
// The oldest available ticket is selected first to keep issuance order deterministic.
func (r *eventTicketRepository) FindAvailable(ctx context.Context, eventID string) (*domain.EventTicket, error) {
	filter := bson.M{"event_id": eventID, "status": string(domain.TicketStatusAvailable)}
	opts := mongooptions.FindOne().SetSort(bson.M{"created_at": 1})
	var ticket domain.EventTicket
	if err := r.col.FindOne(ctx, filter, opts).Decode(&ticket); err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, apperr.New(apperr.ErrCodeNotFound, "no available tickets")
		}
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "find available ticket failed", err)
	}
	return &ticket, nil
}

// FindByOwner returns tickets owned by a wallet while preserving query options.
// This powers personal ticket views, organizer support tools, and ownership audits.
func (r *eventTicketRepository) FindByOwner(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.EventTicket, int64, error) {
	return r.Repository.Find(ctx, append(opts, database.WithEq("owner_wallet", wallet))...)
}

// Update persists the full event ticket document and refreshes UpdatedAt.
// It is typically used after ownership transfer, scan state changes, or ticket lifecycle updates.
func (r *eventTicketRepository) Update(ctx context.Context, ticket *domain.EventTicket) error {
	ticket.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": ticket.ID}, bson.M{"$set": ticket})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update event ticket failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.EventTicketRepository = (*eventTicketRepository)(nil)

// ─────────────────────────────────────────────
//  NFT Repository
// ─────────────────────────────────────────────

type nftRepository struct {
	*pkgmongodb.Repository[domain.NFT]
	col *mongo.Collection
}

// NewNFTRepository wires NFT persistence to the MongoDB nfts collection.
// On-chain minting and metadata derivation rules remain outside the repository layer.
func NewNFTRepository(client *pkgmongodb.Client) ports.NFTRepository {
	return &nftRepository{
		Repository: pkgmongodb.NewRepository[domain.NFT](client, "nfts"),
		col:        client.Collection("nfts"),
	}
}

// FindByOwner returns NFTs owned by a wallet while preserving the caller's filters.
// This is used by profile inventories, marketplace preparation flows, and ownership audits.
func (r *nftRepository) FindByOwner(ctx context.Context, owner string, opts ...database.QueryOption) ([]*domain.NFT, int64, error) {
	return r.Repository.Find(ctx, append(opts, database.WithEq("owner", owner))...)
}

// FindByTokenID resolves an NFT by its token identifier.
// The lookup is useful when reconciling on-chain token events with off-chain metadata records.
func (r *nftRepository) FindByTokenID(ctx context.Context, tokenID string) (*domain.NFT, error) {
	return r.Repository.FindOne(ctx, database.WithEq("token_id", tokenID))
}

var _ ports.NFTRepository = (*nftRepository)(nil)

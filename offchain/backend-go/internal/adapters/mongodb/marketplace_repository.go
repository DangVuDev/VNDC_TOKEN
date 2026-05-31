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

type marketplaceListingRepository struct {
	*pkgmongodb.Repository[domain.MarketplaceListing]
	col *mongo.Collection
}

// NewMarketplaceListingRepository wires marketplace listing persistence to the MongoDB marketplace_listings collection.
// It isolates on-chain listing metadata storage from service-level pricing, settlement, and validation logic.
func NewMarketplaceListingRepository(client *pkgmongodb.Client) ports.MarketplaceListingRepository {
	return &marketplaceListingRepository{
		Repository: pkgmongodb.NewRepository[domain.MarketplaceListing](client, "marketplace_listings"),
		col:        client.Collection("marketplace_listings"),
	}
}

// FindByOnchainListingID resolves a listing by its on-chain listing identifier.
// This lookup is used when syncing contract events back into the off-chain marketplace state.
func (r *marketplaceListingRepository) FindByOnchainListingID(ctx context.Context, onchainListingID string) (*domain.MarketplaceListing, error) {
	return r.FindOne(ctx, database.WithEq("onchain_listing_id", onchainListingID))
}

// FindBySeller returns listings created by a seller while preserving caller-supplied filters.
// It is the main read path for seller dashboards and listing-management screens.
func (r *marketplaceListingRepository) FindBySeller(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.MarketplaceListing, int64, error) {
	opts = append(opts, database.WithEq("seller_wallet", wallet))
	return r.Find(ctx, opts...)
}

// Update persists the full listing document and refreshes the UpdatedAt timestamp.
// This is used for status transitions, price edits, sale metadata updates, and sync reconciliation.
func (r *marketplaceListingRepository) Update(ctx context.Context, listing *domain.MarketplaceListing) error {
	listing.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": listing.ID}, bson.M{"$set": listing})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update marketplace listing failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// Delete soft-deletes a marketplace listing through the shared repository helper.
// Lifecycle policy around cancellation or archival is handled by services before this call is made.
func (r *marketplaceListingRepository) Delete(ctx context.Context, id string) error {
	return r.Repository.Delete(ctx, id)
}

var _ ports.MarketplaceListingRepository = (*marketplaceListingRepository)(nil)

type marketplacePurchaseRepository struct {
	*pkgmongodb.Repository[domain.MarketplacePurchase]
	col *mongo.Collection
}

// NewMarketplacePurchaseRepository wires marketplace purchase persistence to the MongoDB marketplace_purchases collection.
// Purchase verification and fulfillment logic remain outside the repository layer.
func NewMarketplacePurchaseRepository(client *pkgmongodb.Client) ports.MarketplacePurchaseRepository {
	return &marketplacePurchaseRepository{
		Repository: pkgmongodb.NewRepository[domain.MarketplacePurchase](client, "marketplace_purchases"),
		col:        client.Collection("marketplace_purchases"),
	}
}

// FindByListing returns purchases for a listing while preserving any pagination or filters.
// This supports listing-level sales history and operator-side settlement review.
func (r *marketplacePurchaseRepository) FindByListing(ctx context.Context, listingID string, opts ...database.QueryOption) ([]*domain.MarketplacePurchase, int64, error) {
	opts = append(opts, database.WithEq("listing_id", listingID))
	return r.Find(ctx, opts...)
}

// FindByBuyer returns purchases made by a wallet with any caller-supplied query options.
// It is the primary query for purchase history in buyer-facing account screens.
func (r *marketplacePurchaseRepository) FindByBuyer(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.MarketplacePurchase, int64, error) {
	opts = append(opts, database.WithEq("buyer_wallet", wallet))
	return r.Find(ctx, opts...)
}

// FindBySeller returns purchases tied to a seller wallet.
// The result is useful for revenue reporting, dispute handling, and settlement workflows.
func (r *marketplacePurchaseRepository) FindBySeller(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.MarketplacePurchase, int64, error) {
	opts = append(opts, database.WithEq("seller_wallet", wallet))
	return r.Find(ctx, opts...)
}

// FindByPaymentTxID resolves a purchase using its payment transaction hash.
// This lets payment processors or blockchain listeners map a payment back to the purchase record.
func (r *marketplacePurchaseRepository) FindByPaymentTxID(ctx context.Context, txID string) (*domain.MarketplacePurchase, error) {
	return r.FindOne(ctx, database.WithEq("payment_tx_id", txID))
}

// Update persists the full purchase document and refreshes the UpdatedAt timestamp.
// Services call this after payment confirmation, fulfillment, cancellation, or reconciliation updates.
func (r *marketplacePurchaseRepository) Update(ctx context.Context, purchase *domain.MarketplacePurchase) error {
	purchase.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": purchase.ID}, bson.M{"$set": purchase})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update marketplace purchase failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.MarketplacePurchaseRepository = (*marketplacePurchaseRepository)(nil)

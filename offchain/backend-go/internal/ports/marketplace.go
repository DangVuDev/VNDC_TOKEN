package ports

import (
	"context"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

type MarketplaceListingRepository interface {
	Create(ctx context.Context, listing *domain.MarketplaceListing) error
	FindByID(ctx context.Context, id string) (*domain.MarketplaceListing, error)
	FindByOnchainListingID(ctx context.Context, onchainListingID string) (*domain.MarketplaceListing, error)
	Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.MarketplaceListing, int64, error)
	FindBySeller(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.MarketplaceListing, int64, error)
	Update(ctx context.Context, listing *domain.MarketplaceListing) error
	Delete(ctx context.Context, id string) error
}

type MarketplacePurchaseRepository interface {
	Create(ctx context.Context, purchase *domain.MarketplacePurchase) error
	FindByID(ctx context.Context, id string) (*domain.MarketplacePurchase, error)
	FindByListing(ctx context.Context, listingID string, opts ...database.QueryOption) ([]*domain.MarketplacePurchase, int64, error)
	FindByBuyer(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.MarketplacePurchase, int64, error)
	FindBySeller(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.MarketplacePurchase, int64, error)
	FindByPaymentTxID(ctx context.Context, txID string) (*domain.MarketplacePurchase, error)
	Update(ctx context.Context, purchase *domain.MarketplacePurchase) error
}

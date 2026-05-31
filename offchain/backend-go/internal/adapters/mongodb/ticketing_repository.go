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

type serviceTicketProductRepository struct {
	*pkgmongodb.Repository[domain.ServiceTicketProduct]
	col *mongo.Collection
}

// NewServiceTicketProductRepository wires service ticket product persistence to the MongoDB service_ticket_products collection.
// Catalog validation and issuance policies stay outside the repository boundary.
func NewServiceTicketProductRepository(client *pkgmongodb.Client) ports.ServiceTicketProductRepository {
	return &serviceTicketProductRepository{
		Repository: pkgmongodb.NewRepository[domain.ServiceTicketProduct](client, "service_ticket_products"),
		col:        client.Collection("service_ticket_products"),
	}
}

// FindByCode resolves a ticket product by its public code.
// This lookup is typically used when public links or scanner tools identify products by code instead of internal IDs.
func (r *serviceTicketProductRepository) FindByCode(ctx context.Context, code string) (*domain.ServiceTicketProduct, error) {
	return r.FindOne(ctx, database.WithEq("code", code))
}

// FindBySeller returns ticket products listed by a seller wallet.
// It powers organizer inventory screens and seller-scoped reporting.
func (r *serviceTicketProductRepository) FindBySeller(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.ServiceTicketProduct, int64, error) {
	opts = append(opts, database.WithEq("seller_wallet", wallet))
	return r.Find(ctx, opts...)
}

// Update persists the full product document and refreshes UpdatedAt.
// This is used after schedule, pricing, availability, or organizer metadata changes.
func (r *serviceTicketProductRepository) Update(ctx context.Context, product *domain.ServiceTicketProduct) error {
	product.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": product.ID}, bson.M{"$set": product})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update service ticket product failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.ServiceTicketProductRepository = (*serviceTicketProductRepository)(nil)

type serviceTicketPurchaseRepository struct {
	*pkgmongodb.Repository[domain.ServiceTicketPurchase]
	col *mongo.Collection
}

// NewServiceTicketPurchaseRepository wires service ticket purchase persistence to the MongoDB service_ticket_purchases collection.
// Purchase authorization, fulfillment, and payment workflows remain outside this layer.
func NewServiceTicketPurchaseRepository(client *pkgmongodb.Client) ports.ServiceTicketPurchaseRepository {
	return &serviceTicketPurchaseRepository{
		Repository: pkgmongodb.NewRepository[domain.ServiceTicketPurchase](client, "service_ticket_purchases"),
		col:        client.Collection("service_ticket_purchases"),
	}
}

// FindByTicketCode resolves a purchase by its ticket code.
// Scanner flows use this lookup to find the purchase that owns a presented ticket.
func (r *serviceTicketPurchaseRepository) FindByTicketCode(ctx context.Context, code string) (*domain.ServiceTicketPurchase, error) {
	return r.FindOne(ctx, database.WithEq("ticket_code", code))
}

// FindByProduct returns purchases for a given ticket product.
// This is the common query for sales summaries and attendee export flows.
func (r *serviceTicketPurchaseRepository) FindByProduct(ctx context.Context, productID string, opts ...database.QueryOption) ([]*domain.ServiceTicketPurchase, int64, error) {
	opts = append(opts, database.WithEq("product_id", productID))
	return r.Find(ctx, opts...)
}

// FindByBuyer returns purchases made by a buyer wallet.
// It powers customer history views and support lookups.
func (r *serviceTicketPurchaseRepository) FindByBuyer(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.ServiceTicketPurchase, int64, error) {
	opts = append(opts, database.WithEq("buyer_wallet", wallet))
	return r.Find(ctx, opts...)
}

// FindByPaymentTxID resolves a ticket purchase using its payment transaction hash.
// This connects payment confirmation events back to the purchase document.
func (r *serviceTicketPurchaseRepository) FindByPaymentTxID(ctx context.Context, txID string) (*domain.ServiceTicketPurchase, error) {
	return r.FindOne(ctx, database.WithEq("payment_tx_id", txID))
}

// Update persists the full purchase document and refreshes the UpdatedAt timestamp.
// It is used after payment confirmation, ticket issuance, scan-state changes, or support-driven corrections.
func (r *serviceTicketPurchaseRepository) Update(ctx context.Context, purchase *domain.ServiceTicketPurchase) error {
	purchase.UpdatedAt = time.Now().UTC()
	res, err := r.col.UpdateOne(ctx, bson.M{"_id": purchase.ID}, bson.M{"$set": purchase})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "update service ticket purchase failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

var _ ports.ServiceTicketPurchaseRepository = (*serviceTicketPurchaseRepository)(nil)

// ─── Scan Log Repository ──────────────────────────────────────────────────────

type serviceTicketScanLogRepository struct {
	*pkgmongodb.Repository[domain.ServiceTicketScanLog]
}

// NewServiceTicketScanLogRepository wires scan-log persistence to the MongoDB service_ticket_scan_logs collection.
// Scan validation policy stays in services while this repository only handles storage and retrieval.
func NewServiceTicketScanLogRepository(client *pkgmongodb.Client) ports.ServiceTicketScanLogRepository {
	return &serviceTicketScanLogRepository{
		Repository: pkgmongodb.NewRepository[domain.ServiceTicketScanLog](client, "service_ticket_scan_logs"),
	}
}

// FindByProduct returns scan logs for a specific product while preserving query options.
// Organizers can use this to review venue activity and attendance behavior for one product.
func (r *serviceTicketScanLogRepository) FindByProduct(ctx context.Context, productID string, opts ...database.QueryOption) ([]*domain.ServiceTicketScanLog, int64, error) {
	opts = append(opts, database.WithEq("product_id", productID))
	return r.Find(ctx, opts...)
}

// FindByPurchase returns scan logs tied to a purchase document.
// This is useful when auditing re-entry attempts or support cases for one attendee.
func (r *serviceTicketScanLogRepository) FindByPurchase(ctx context.Context, purchaseID string, opts ...database.QueryOption) ([]*domain.ServiceTicketScanLog, int64, error) {
	opts = append(opts, database.WithEq("purchase_id", purchaseID))
	return r.Find(ctx, opts...)
}

// FindByScanner returns scan logs created by a scanner wallet.
// The query supports staff activity review and scanner-side operational audits.
func (r *serviceTicketScanLogRepository) FindByScanner(ctx context.Context, scannerWallet string, opts ...database.QueryOption) ([]*domain.ServiceTicketScanLog, int64, error) {
	opts = append(opts, database.WithEq("scanner_wallet", scannerWallet))
	return r.Find(ctx, opts...)
}

var _ ports.ServiceTicketScanLogRepository = (*serviceTicketScanLogRepository)(nil)

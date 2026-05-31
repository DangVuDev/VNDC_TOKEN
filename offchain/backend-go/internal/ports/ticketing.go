package ports

import (
	"context"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

type ServiceTicketProductRepository interface {
	Create(ctx context.Context, product *domain.ServiceTicketProduct) error
	FindByID(ctx context.Context, id string) (*domain.ServiceTicketProduct, error)
	FindByCode(ctx context.Context, code string) (*domain.ServiceTicketProduct, error)
	Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.ServiceTicketProduct, int64, error)
	FindBySeller(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.ServiceTicketProduct, int64, error)
	Update(ctx context.Context, product *domain.ServiceTicketProduct) error
}

type ServiceTicketPurchaseRepository interface {
	Create(ctx context.Context, purchase *domain.ServiceTicketPurchase) error
	FindByID(ctx context.Context, id string) (*domain.ServiceTicketPurchase, error)
	FindByTicketCode(ctx context.Context, code string) (*domain.ServiceTicketPurchase, error)
	FindByProduct(ctx context.Context, productID string, opts ...database.QueryOption) ([]*domain.ServiceTicketPurchase, int64, error)
	FindByBuyer(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.ServiceTicketPurchase, int64, error)
	FindByPaymentTxID(ctx context.Context, txID string) (*domain.ServiceTicketPurchase, error)
	Update(ctx context.Context, purchase *domain.ServiceTicketPurchase) error
}

type ServiceTicketScanLogRepository interface {
	Create(ctx context.Context, log *domain.ServiceTicketScanLog) error
	FindByProduct(ctx context.Context, productID string, opts ...database.QueryOption) ([]*domain.ServiceTicketScanLog, int64, error)
	FindByPurchase(ctx context.Context, purchaseID string, opts ...database.QueryOption) ([]*domain.ServiceTicketScanLog, int64, error)
	FindByScanner(ctx context.Context, scannerWallet string, opts ...database.QueryOption) ([]*domain.ServiceTicketScanLog, int64, error)
}

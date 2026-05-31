package ticketing

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"

	transactionapp "github.com/vndc/backend/internal/application/transaction"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
	"github.com/vndc/backend/pkg/timeutil"
)

type transferSubmitter interface {
	SubmitTransfer(ctx context.Context, req *transactionapp.SubmitTransferRequest) (*domain.Transaction, error)
}

type Service struct {
	productRepo         ports.ServiceTicketProductRepository
	purchaseRepo        ports.ServiceTicketPurchaseRepository
	scanLogRepo         ports.ServiceTicketScanLogRepository
	transferSvc         transferSubmitter
	defaultPaymentToken string
	log                 logger.Logger
}

// NewService constructs the ticketing application service with product, purchase, scan-log, and transfer dependencies.
// It centralizes service-ticket commerce flows without leaking storage or payment details to handlers.
func NewService(
	productRepo ports.ServiceTicketProductRepository,
	purchaseRepo ports.ServiceTicketPurchaseRepository,
	scanLogRepo ports.ServiceTicketScanLogRepository,
	transferSvc transferSubmitter,
	defaultPaymentToken string,
	log logger.Logger,
) *Service {
	return &Service{
		productRepo:         productRepo,
		purchaseRepo:        purchaseRepo,
		scanLogRepo:         scanLogRepo,
		transferSvc:         transferSvc,
		defaultPaymentToken: normalizeWallet(defaultPaymentToken),
		log:                 log.Named("ticketing_service"),
	}
}

// CreateProduct creates a service-ticket product with validated sale window, stock mode, and usage constraints.
// This is the administrative entry point for defining ticketed services before any purchases occur.
func (s *Service) CreateProduct(ctx context.Context, req *CreateProductRequest, actorWallet string) (*domain.ServiceTicketProduct, error) {
	creator := normalizeWallet(actorWallet)
	if creator == "" {
		return nil, apperr.ErrForbidden
	}

	category, err := parseCategory(req.Category)
	if err != nil {
		return nil, err
	}
	ticketType := strings.TrimSpace(req.TicketType)
	if ticketType == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ticket_type is required")
	}
	if _, err := parsePositiveAmount(req.UnitPrice, "unit_price"); err != nil {
		return nil, err
	}

	saleMode, stockMode, err := resolveModes(req.SaleMode, req.StockMode, category)
	if err != nil {
		return nil, err
	}
	saleStart, saleEnd, err := parseUnixRange(req.SaleStartsAt, req.SaleEndsAt, "sale_starts_at", "sale_ends_at")
	if err != nil {
		return nil, err
	}
	if err := validateSaleWindow(saleMode, saleStart, saleEnd); err != nil {
		return nil, err
	}

	useFrom, useUntil, err := parseUnixRange(req.UseValidFrom, req.UseValidUntil, "use_valid_from", "use_valid_until")
	if err != nil {
		return nil, err
	}
	useDurationDays := int64(0)
	if req.UseDurationDays != nil {
		if *req.UseDurationDays < 0 {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "use_duration_days must be greater than or equal to 0")
		}
		useDurationDays = *req.UseDurationDays
	}
	if useDurationDays > 0 && useUntil != nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "cannot set both use_duration_days and use_valid_until")
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		// Auto-generate: "TK" + 8 uppercase hex chars from a UUID
		raw := strings.ReplaceAll(uuid.NewString(), "-", "")
		code = "TK" + strings.ToUpper(raw[:8])
	}
	if existing, err := s.productRepo.FindByCode(ctx, code); err == nil && existing != nil {
		return nil, apperr.New(apperr.ErrCodeConflict, "ticket code already exists")
	} else if err != nil && !apperr.IsNotFound(err) {
		return nil, err
	}

	seller := firstNonEmpty(normalizeWallet(req.SellerWallet), creator)
	currencyToken := firstNonEmpty(normalizeWallet(req.CurrencyToken), s.defaultPaymentToken)
	if currencyToken == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "currency_token is required")
	}

	totalStock, availableStock, err := buildInitialStock(stockMode, req.TotalStock)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	product := &domain.ServiceTicketProduct{
		BaseEntity:      domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Code:            code,
		Category:        category,
		TicketType:      ticketType,
		Status:          domain.ServiceTicketProductActive,
		SaleMode:        saleMode,
		StockMode:       stockMode,
		Title:           strings.TrimSpace(req.Title),
		Description:     strings.TrimSpace(req.Description),
		ImageURI:        strings.TrimSpace(req.ImageURI),
		MetadataURI:     strings.TrimSpace(req.MetadataURI),
		Metadata:        req.Metadata,
		CreatorWallet:   creator,
		SellerWallet:    seller,
		CurrencyToken:   currencyToken,
		UnitPrice:       strings.TrimSpace(req.UnitPrice),
		TotalStock:      totalStock,
		AvailableStock:  availableStock,
		ReservedStock:   0,
		SoldStock:       0,
		SaleStartsAt:    saleStart,
		SaleEndsAt:      saleEnd,
		UseValidFrom:    useFrom,
		UseValidUntil:   useUntil,
		UseDurationDays: useDurationDays,
		AllowedScanners: normalizeWalletSlice(req.AllowedScanners),
	}

	if err := s.productRepo.Create(ctx, product); err != nil {
		return nil, err
	}
	return product, nil
}

// UpdateProduct mutates an existing service-ticket product while preserving stock and date consistency rules.
// The method supports seller-side maintenance without allowing invalid transitions such as shrinking stock below reserved amounts.
func (s *Service) UpdateProduct(ctx context.Context, id string, req *UpdateProductRequest, actorWallet string) (*domain.ServiceTicketProduct, error) {
	product, err := s.productRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	actor := normalizeWallet(actorWallet)
	if actor == "" || (!strings.EqualFold(actor, product.CreatorWallet) && !strings.EqualFold(actor, product.SellerWallet)) {
		return nil, apperr.ErrForbidden
	}

	if req.Category != "" {
		category, err := parseCategory(req.Category)
		if err != nil {
			return nil, err
		}
		product.Category = category
	}
	if req.TicketType != "" {
		product.TicketType = strings.TrimSpace(req.TicketType)
	}
	if req.Status != "" {
		status, err := parseProductStatus(req.Status)
		if err != nil {
			return nil, err
		}
		product.Status = status
	}
	if req.SaleMode != "" {
		saleMode, err := parseSaleMode(req.SaleMode)
		if err != nil {
			return nil, err
		}
		product.SaleMode = saleMode
	}
	if req.StockMode != "" {
		stockMode, err := parseStockMode(req.StockMode)
		if err != nil {
			return nil, err
		}
		if product.StockMode != stockMode {
			if stockMode == domain.ServiceTicketStockModeUnlimited {
				if product.ReservedStock > 0 {
					return nil, apperr.New(apperr.ErrCodeConflict, "cannot switch to unlimited while reserved stock exists")
				}
				product.TotalStock = 0
				product.AvailableStock = 0
			}
			product.StockMode = stockMode
		}
	}

	if title := strings.TrimSpace(req.Title); title != "" {
		product.Title = title
	}
	if req.Description != "" {
		product.Description = strings.TrimSpace(req.Description)
	}
	if req.ImageURI != "" {
		product.ImageURI = strings.TrimSpace(req.ImageURI)
	}
	if req.MetadataURI != "" {
		product.MetadataURI = strings.TrimSpace(req.MetadataURI)
	}
	if req.Metadata != nil {
		product.Metadata = req.Metadata
	}
	if req.SellerWallet != "" {
		seller := normalizeWallet(req.SellerWallet)
		if seller == "" {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid seller_wallet")
		}
		product.SellerWallet = seller
	}
	if req.CurrencyToken != "" {
		token := normalizeWallet(req.CurrencyToken)
		if token == "" {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid currency_token")
		}
		product.CurrencyToken = token
	}
	if req.UnitPrice != "" {
		if _, err := parsePositiveAmount(req.UnitPrice, "unit_price"); err != nil {
			return nil, err
		}
		product.UnitPrice = strings.TrimSpace(req.UnitPrice)
	}

	if req.TotalStock != nil {
		if *req.TotalStock <= 0 {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "total_stock must be greater than 0")
		}
		product.TotalStock = *req.TotalStock
	}

	if req.SaleStartsAt != nil || req.SaleEndsAt != nil {
		saleStart := product.SaleStartsAt
		saleEnd := product.SaleEndsAt
		if req.SaleStartsAt != nil {
			parsed, err := parseUnixTimestamp(req.SaleStartsAt, "sale_starts_at")
			if err != nil {
				return nil, err
			}
			saleStart = parsed
		}
		if req.SaleEndsAt != nil {
			parsed, err := parseUnixTimestamp(req.SaleEndsAt, "sale_ends_at")
			if err != nil {
				return nil, err
			}
			saleEnd = parsed
		}
		product.SaleStartsAt = saleStart
		product.SaleEndsAt = saleEnd
	}

	if req.UseValidFrom != nil || req.UseValidUntil != nil {
		useFrom := product.UseValidFrom
		useUntil := product.UseValidUntil
		if req.UseValidFrom != nil {
			parsed, err := parseUnixTimestamp(req.UseValidFrom, "use_valid_from")
			if err != nil {
				return nil, err
			}
			useFrom = parsed
		}
		if req.UseValidUntil != nil {
			parsed, err := parseUnixTimestamp(req.UseValidUntil, "use_valid_until")
			if err != nil {
				return nil, err
			}
			useUntil = parsed
		}
		if useFrom != nil && useUntil != nil && useUntil.Before(*useFrom) {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "use_valid_until must be greater than or equal to use_valid_from")
		}
		product.UseValidFrom = useFrom
		product.UseValidUntil = useUntil
	}

	if req.UseDurationDays != nil {
		if *req.UseDurationDays < 0 {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "use_duration_days must be greater than or equal to 0")
		}
		product.UseDurationDays = *req.UseDurationDays
	}

	if req.SetAllowedScanners != nil {
		product.AllowedScanners = normalizeWalletSlice(*req.SetAllowedScanners)
	}

	if product.UseDurationDays > 0 && product.UseValidUntil != nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "cannot set both use_duration_days and use_valid_until")
	}
	if err := validateSaleWindow(product.SaleMode, product.SaleStartsAt, product.SaleEndsAt); err != nil {
		return nil, err
	}
	if product.StockMode == domain.ServiceTicketStockModeLimited {
		if product.TotalStock <= 0 {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "total_stock must be greater than 0 for limited stock mode")
		}
		minStock := product.SoldStock + product.ReservedStock
		if product.TotalStock < minStock {
			return nil, apperr.New(apperr.ErrCodeConflict, "total_stock is lower than sold + reserved")
		}
		product.AvailableStock = product.TotalStock - minStock
	} else {
		product.TotalStock = 0
		product.AvailableStock = 0
		if product.ReservedStock == 0 {
			product.ReservedStock = 0
		}
	}

	if err := s.productRepo.Update(ctx, product); err != nil {
		return nil, err
	}
	return product, nil
}

// PurchaseProduct creates a pending service-ticket purchase, reserves stock when limited, and submits the payment transfer.
// It is the main buyer entry point for ticketed-service checkout flows.
func (s *Service) PurchaseProduct(ctx context.Context, productID, actorWallet string, req *PurchaseProductRequest) (*domain.ServiceTicketPurchase, error) {
	if s.transferSvc == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "transaction service is unavailable")
	}

	buyer := normalizeWallet(actorWallet)
	fromWallet := normalizeWallet(req.FromWallet)
	if buyer == "" || fromWallet == "" || !strings.EqualFold(buyer, fromWallet) {
		return nil, apperr.ErrForbidden
	}

	product, err := s.productRepo.FindByID(ctx, productID)
	if err != nil {
		return nil, err
	}
	if product.Status != domain.ServiceTicketProductActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ticket product is not active")
	}
	if strings.EqualFold(product.SellerWallet, buyer) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "seller cannot buy own ticket product")
	}

	now := time.Now().UTC()
	if err := ensureProductOnSale(now, product); err != nil {
		return nil, err
	}

	quantity := req.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	if product.StockMode == domain.ServiceTicketStockModeLimited && product.AvailableStock < quantity {
		return nil, apperr.New(apperr.ErrCodeConflict, "insufficient ticket stock")
	}

	totalPrice, err := multiplyPrice(product.UnitPrice, quantity)
	if err != nil {
		return nil, err
	}
	expiresAt := computePurchaseExpiry(now, product)

	purchase := &domain.ServiceTicketPurchase{
		BaseEntity:    domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		ProductID:     product.ID,
		BuyerWallet:   buyer,
		SellerWallet:  product.SellerWallet,
		Quantity:      quantity,
		UnitPrice:     product.UnitPrice,
		TotalPrice:    totalPrice,
		CurrencyToken: product.CurrencyToken,
		Status:        domain.ServiceTicketPurchasePendingPayment,
		TicketCode:    buildTicketCode(product.Code, product.TicketType),
		Metadata:      req.Metadata,
		ExpiresAt:     expiresAt,
	}
	if err := s.purchaseRepo.Create(ctx, purchase); err != nil {
		return nil, err
	}

	if product.StockMode == domain.ServiceTicketStockModeLimited {
		product.AvailableStock -= quantity
		product.ReservedStock += quantity
		if err := s.productRepo.Update(ctx, product); err != nil {
			purchase.Status = domain.ServiceTicketPurchaseFailed
			purchase.FailureReason = err.Error()
			_ = s.purchaseRepo.Update(ctx, purchase)
			return nil, err
		}
	}

	txRecord, err := s.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
		FromWallet:  fromWallet,
		ToWallet:    product.SellerWallet,
		Amount:      totalPrice,
		Nonce:       req.Nonce,
		Deadline:    req.Deadline,
		Signature:   req.Signature,
		Type:        string(domain.TxTypeServiceTicketBuy),
		ContextType: "SERVICE_TICKET_PURCHASE",
		ContextID:   purchase.ID,
		ContextRef:  product.ID,
	})
	if err != nil {
		if product.StockMode == domain.ServiceTicketStockModeLimited {
			product.AvailableStock += quantity
			product.ReservedStock -= quantity
			_ = s.productRepo.Update(ctx, product)
		}
		purchase.Status = domain.ServiceTicketPurchaseFailed
		purchase.FailureReason = err.Error()
		_ = s.purchaseRepo.Update(ctx, purchase)
		return nil, err
	}

	purchase.PaymentTxID = txRecord.ID
	if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
		return nil, err
	}
	return purchase, nil
}

func (s *Service) ListProducts(ctx context.Context, actorWallet string, filter *ListProductsQuery, pageReq pagination.Request) ([]*domain.ServiceTicketProduct, int64, error) {
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
		database.WithSort(sortField(pageReq.SortBy, "created_at"), sortDirection(pageReq.SortDir)),
	}
	if filter != nil && filter.Category != "" {
		category, err := parseCategory(filter.Category)
		if err != nil {
			return nil, 0, err
		}
		opts = append(opts, database.WithEq("category", category))
	}
	if filter != nil && strings.TrimSpace(filter.TicketType) != "" {
		opts = append(opts, database.WithEq("ticket_type", strings.TrimSpace(filter.TicketType)))
	}
	if filter != nil && filter.Status != "" {
		status, err := parseProductStatus(filter.Status)
		if err != nil {
			return nil, 0, err
		}
		opts = append(opts, database.WithEq("status", status))
	}
	if filter != nil && filter.SaleMode != "" {
		saleMode, err := parseSaleMode(filter.SaleMode)
		if err != nil {
			return nil, 0, err
		}
		opts = append(opts, database.WithEq("sale_mode", saleMode))
	}
	if filter != nil && filter.StockMode != "" {
		stockMode, err := parseStockMode(filter.StockMode)
		if err != nil {
			return nil, 0, err
		}
		opts = append(opts, database.WithEq("stock_mode", stockMode))
	}
	if filter != nil && filter.Search != "" {
		opts = append(opts, database.WithLike("title", strings.TrimSpace(filter.Search)))
	}
	if filter != nil && filter.Mine {
		wallet := normalizeWallet(actorWallet)
		if wallet == "" {
			return nil, 0, apperr.ErrForbidden
		}
		return s.productRepo.FindBySeller(ctx, wallet, opts...)
	}
	if filter != nil && filter.SellerWallet != "" {
		wallet := normalizeWallet(filter.SellerWallet)
		if wallet == "" {
			return nil, 0, apperr.New(apperr.ErrCodeBadRequest, "invalid seller_wallet")
		}
		return s.productRepo.FindBySeller(ctx, wallet, opts...)
	}
	return s.productRepo.Find(ctx, opts...)
}

func (s *Service) GetProduct(ctx context.Context, id string) (*domain.ServiceTicketProduct, error) {
	return s.productRepo.FindByID(ctx, id)
}

func (s *Service) ListPurchases(ctx context.Context, actorWallet string, filter *ListPurchasesQuery, pageReq pagination.Request) ([]*domain.ServiceTicketPurchase, int64, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, 0, apperr.ErrForbidden
	}
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
		database.WithSort(sortField(pageReq.SortBy, "created_at"), sortDirection(pageReq.SortDir)),
	}
	if filter != nil && filter.ProductID != "" {
		opts = append(opts, database.WithEq("product_id", strings.TrimSpace(filter.ProductID)))
	}
	if filter != nil && filter.Status != "" {
		status, err := parsePurchaseStatus(filter.Status)
		if err != nil {
			return nil, 0, err
		}
		opts = append(opts, database.WithEq("status", status))
	}
	return s.purchaseRepo.FindByBuyer(ctx, wallet, opts...)
}

func (s *Service) GetPurchase(ctx context.Context, id, actorWallet string) (*domain.ServiceTicketPurchase, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, apperr.ErrForbidden
	}
	purchase, err := s.purchaseRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(purchase.BuyerWallet, wallet) && !strings.EqualFold(purchase.SellerWallet, wallet) {
		return nil, apperr.ErrForbidden
	}
	return purchase, nil
}

func (s *Service) VerifyTicket(ctx context.Context, purchaseID, actorWallet string, req *VerifyTicketRequest) (*VerifyTicketResponse, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, apperr.ErrForbidden
	}

	purchase, err := s.purchaseRepo.FindByID(ctx, purchaseID)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(purchase.BuyerWallet, wallet) && !strings.EqualFold(purchase.SellerWallet, wallet) {
		return nil, apperr.ErrForbidden
	}

	ticketCode := strings.TrimSpace(req.TicketCode)
	if ticketCode == "" || !strings.EqualFold(ticketCode, purchase.TicketCode) {
		return &VerifyTicketResponse{Valid: false, Reason: "invalid ticket_code", Purchase: purchase}, nil
	}

	valid, reason, updated, err := s.evaluateTicketValidity(ctx, purchase)
	if err != nil {
		return nil, err
	}
	if updated != nil {
		purchase = updated
	}

	return &VerifyTicketResponse{
		Valid:    valid,
		Reason:   reason,
		Purchase: purchase,
	}, nil
}

func (s *Service) UseTicket(ctx context.Context, purchaseID, actorWallet string, req *UseTicketRequest) (*domain.ServiceTicketPurchase, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, apperr.ErrForbidden
	}

	purchase, err := s.purchaseRepo.FindByID(ctx, purchaseID)
	if err != nil {
		return nil, err
	}
	// Allow seller or any authorized scanner
	if !strings.EqualFold(purchase.SellerWallet, wallet) {
		product, pErr := s.productRepo.FindByID(ctx, purchase.ProductID)
		if pErr != nil || !isScannerAllowed(product, wallet) {
			return nil, apperr.ErrForbidden
		}
	}

	ticketCode := strings.TrimSpace(req.TicketCode)
	if ticketCode == "" || !strings.EqualFold(ticketCode, purchase.TicketCode) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid ticket_code")
	}

	valid, reason, updated, err := s.evaluateTicketValidity(ctx, purchase)
	if err != nil {
		return nil, err
	}
	if updated != nil {
		purchase = updated
	}
	if !valid {
		return nil, apperr.New(apperr.ErrCodeConflict, "ticket cannot be used: "+reason)
	}

	now := time.Now().UTC()
	purchase.Status = domain.ServiceTicketPurchaseUsed
	purchase.UsedAt = &now
	purchase.UsedByWallet = wallet
	purchase.UsedNote = strings.TrimSpace(req.UsedNote)
	purchase.FailureReason = ""
	if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
		return nil, err
	}
	return purchase, nil
}

func parseCategory(raw string) (domain.ServiceTicketCategory, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case string(domain.ServiceTicketCategoryEventSeat):
		return domain.ServiceTicketCategoryEventSeat, nil
	case string(domain.ServiceTicketCategoryRetakeExam):
		return domain.ServiceTicketCategoryRetakeExam, nil
	case string(domain.ServiceTicketCategoryGradeUpgrade):
		return domain.ServiceTicketCategoryGradeUpgrade, nil
	case string(domain.ServiceTicketCategoryComputerRental):
		return domain.ServiceTicketCategoryComputerRental, nil
	case string(domain.ServiceTicketCategoryParkingMonthly):
		return domain.ServiceTicketCategoryParkingMonthly, nil
	case "", string(domain.ServiceTicketCategoryOther):
		return domain.ServiceTicketCategoryOther, nil
	default:
		return "", apperr.New(apperr.ErrCodeBadRequest, "invalid category")
	}
}

func parseProductStatus(raw string) (domain.ServiceTicketProductStatus, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case string(domain.ServiceTicketProductActive):
		return domain.ServiceTicketProductActive, nil
	case string(domain.ServiceTicketProductInactive):
		return domain.ServiceTicketProductInactive, nil
	case string(domain.ServiceTicketProductArchived):
		return domain.ServiceTicketProductArchived, nil
	default:
		return "", apperr.New(apperr.ErrCodeBadRequest, "invalid product status")
	}
}

func parseSaleMode(raw string) (domain.ServiceTicketSaleMode, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case string(domain.ServiceTicketSaleModeAlwaysOn):
		return domain.ServiceTicketSaleModeAlwaysOn, nil
	case string(domain.ServiceTicketSaleModeWindowed):
		return domain.ServiceTicketSaleModeWindowed, nil
	default:
		return "", apperr.New(apperr.ErrCodeBadRequest, "invalid sale_mode")
	}
}

func parseStockMode(raw string) (domain.ServiceTicketStockMode, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case string(domain.ServiceTicketStockModeLimited):
		return domain.ServiceTicketStockModeLimited, nil
	case string(domain.ServiceTicketStockModeUnlimited):
		return domain.ServiceTicketStockModeUnlimited, nil
	default:
		return "", apperr.New(apperr.ErrCodeBadRequest, "invalid stock_mode")
	}
}

func parsePurchaseStatus(raw string) (domain.ServiceTicketPurchaseStatus, error) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case string(domain.ServiceTicketPurchasePendingPayment):
		return domain.ServiceTicketPurchasePendingPayment, nil
	case string(domain.ServiceTicketPurchaseCompleted):
		return domain.ServiceTicketPurchaseCompleted, nil
	case string(domain.ServiceTicketPurchaseFailed):
		return domain.ServiceTicketPurchaseFailed, nil
	case string(domain.ServiceTicketPurchaseUsed):
		return domain.ServiceTicketPurchaseUsed, nil
	case string(domain.ServiceTicketPurchaseExpired):
		return domain.ServiceTicketPurchaseExpired, nil
	default:
		return "", apperr.New(apperr.ErrCodeBadRequest, "invalid purchase status")
	}
}

func (s *Service) evaluateTicketValidity(ctx context.Context, purchase *domain.ServiceTicketPurchase) (bool, string, *domain.ServiceTicketPurchase, error) {
	if purchase == nil {
		return false, "purchase_not_found", nil, apperr.ErrNotFound
	}

	switch purchase.Status {
	case domain.ServiceTicketPurchasePendingPayment:
		return false, "payment_pending", purchase, nil
	case domain.ServiceTicketPurchaseFailed:
		return false, "payment_failed", purchase, nil
	case domain.ServiceTicketPurchaseUsed:
		return false, "already_used", purchase, nil
	case domain.ServiceTicketPurchaseExpired:
		return false, "expired", purchase, nil
	}

	product, err := s.productRepo.FindByID(ctx, purchase.ProductID)
	if err != nil {
		return false, "product_not_found", purchase, err
	}

	now := time.Now().UTC()
	if product.UseValidFrom != nil && now.Before(*product.UseValidFrom) {
		return false, "not_in_use_window", purchase, nil
	}
	if purchase.ExpiresAt != nil && now.After(*purchase.ExpiresAt) {
		purchase.Status = domain.ServiceTicketPurchaseExpired
		purchase.FailureReason = "ticket expired"
		if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
			return false, "expired", purchase, err
		}
		return false, "expired", purchase, nil
	}

	if purchase.Status != domain.ServiceTicketPurchaseCompleted {
		return false, "invalid_status", purchase, nil
	}
	return true, "valid", purchase, nil
}

func parsePositiveAmount(raw, field string) (*big.Int, error) {
	v := strings.TrimSpace(raw)
	n, ok := new(big.Int).SetString(v, 10)
	if !ok || n.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, fmt.Sprintf("%s must be a positive integer string", field))
	}
	return n, nil
}

func parseUnixTimestamp(raw *int64, field string) (*time.Time, error) {
	if raw == nil {
		return nil, nil
	}
	if *raw <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, fmt.Sprintf("%s must be a positive unix timestamp", field))
	}
	t := time.Unix(*raw, 0).UTC()
	return &t, nil
}

func parseUnixRange(fromRaw, untilRaw *int64, fromField, untilField string) (*time.Time, *time.Time, error) {
	from, err := parseUnixTimestamp(fromRaw, fromField)
	if err != nil {
		return nil, nil, err
	}
	until, err := parseUnixTimestamp(untilRaw, untilField)
	if err != nil {
		return nil, nil, err
	}
	if from != nil && until != nil && until.Before(*from) {
		return nil, nil, apperr.New(apperr.ErrCodeBadRequest, fmt.Sprintf("%s must be greater than or equal to %s", untilField, fromField))
	}
	return from, until, nil
}

func defaultModesForCategory(category domain.ServiceTicketCategory) (domain.ServiceTicketSaleMode, domain.ServiceTicketStockMode) {
	switch category {
	case domain.ServiceTicketCategoryRetakeExam:
		return domain.ServiceTicketSaleModeAlwaysOn, domain.ServiceTicketStockModeUnlimited
	case domain.ServiceTicketCategoryEventSeat:
		return domain.ServiceTicketSaleModeWindowed, domain.ServiceTicketStockModeLimited
	default:
		return domain.ServiceTicketSaleModeAlwaysOn, domain.ServiceTicketStockModeLimited
	}
}

func resolveModes(rawSaleMode, rawStockMode string, category domain.ServiceTicketCategory) (domain.ServiceTicketSaleMode, domain.ServiceTicketStockMode, error) {
	defaultSaleMode, defaultStockMode := defaultModesForCategory(category)

	saleMode := defaultSaleMode
	if strings.TrimSpace(rawSaleMode) != "" {
		parsed, err := parseSaleMode(rawSaleMode)
		if err != nil {
			return "", "", err
		}
		saleMode = parsed
	}

	stockMode := defaultStockMode
	if strings.TrimSpace(rawStockMode) != "" {
		parsed, err := parseStockMode(rawStockMode)
		if err != nil {
			return "", "", err
		}
		stockMode = parsed
	}

	return saleMode, stockMode, nil
}

func validateSaleWindow(mode domain.ServiceTicketSaleMode, start, end *time.Time) error {
	if mode == domain.ServiceTicketSaleModeAlwaysOn {
		return nil
	}
	if start == nil || end == nil {
		return apperr.New(apperr.ErrCodeBadRequest, "windowed sale_mode requires both sale_starts_at and sale_ends_at")
	}
	if end.Before(*start) {
		return apperr.New(apperr.ErrCodeBadRequest, "sale_ends_at must be greater than or equal to sale_starts_at")
	}
	return nil
}

func buildInitialStock(stockMode domain.ServiceTicketStockMode, totalStockRaw *int64) (int64, int64, error) {
	if stockMode == domain.ServiceTicketStockModeUnlimited {
		return 0, 0, nil
	}
	if totalStockRaw == nil || *totalStockRaw <= 0 {
		return 0, 0, apperr.New(apperr.ErrCodeBadRequest, "total_stock must be greater than 0 for limited stock mode")
	}
	return *totalStockRaw, *totalStockRaw, nil
}

func ensureProductOnSale(now time.Time, product *domain.ServiceTicketProduct) error {
	switch product.SaleMode {
	case domain.ServiceTicketSaleModeAlwaysOn:
		return nil
	case domain.ServiceTicketSaleModeWindowed:
		if product.SaleStartsAt == nil || product.SaleEndsAt == nil {
			return apperr.New(apperr.ErrCodeBadRequest, "ticket sale window is not configured")
		}
		if now.Before(*product.SaleStartsAt) {
			return apperr.New(apperr.ErrCodeBadRequest, "ticket product is not open for sale yet")
		}
		if now.After(*product.SaleEndsAt) {
			return apperr.New(apperr.ErrCodeBadRequest, "ticket product sale window has ended")
		}
		return nil
	default:
		return apperr.New(apperr.ErrCodeBadRequest, "invalid sale_mode")
	}
}

func computePurchaseExpiry(now time.Time, product *domain.ServiceTicketProduct) *time.Time {
	if product.UseDurationDays > 0 {
		expires := now.Add(time.Duration(product.UseDurationDays) * 24 * time.Hour)
		return &expires
	}
	if product.UseValidUntil != nil {
		expires := product.UseValidUntil.UTC()
		return &expires
	}
	return nil
}

func multiplyPrice(unitPrice string, quantity int64) (string, error) {
	if quantity <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "quantity must be greater than 0")
	}
	unit, err := parsePositiveAmount(unitPrice, "unit_price")
	if err != nil {
		return "", err
	}
	return new(big.Int).Mul(unit, big.NewInt(quantity)).String(), nil
}

// normalizeWalletSlice normalizes and deduplicates a slice of wallet addresses.
func normalizeWalletSlice(wallets []string) []string {
	seen := make(map[string]struct{}, len(wallets))
	out := make([]string, 0, len(wallets))
	for _, w := range wallets {
		n := normalizeWallet(w)
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out
}

// isScannerAllowed returns true if wallet is one of the product's allowed scanners.
func isScannerAllowed(product *domain.ServiceTicketProduct, wallet string) bool {
	if product == nil {
		return false
	}
	for _, s := range product.AllowedScanners {
		if strings.EqualFold(s, wallet) {
			return true
		}
	}
	return false
}

func normalizeWallet(wallet string) string {
	w := strings.TrimSpace(wallet)
	if w == "" || !common.IsHexAddress(w) {
		return ""
	}
	return common.HexToAddress(w).Hex()
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func buildTicketCode(productCode, ticketType string) string {
	seed := strings.ToUpper(strings.TrimSpace(productCode))
	if seed == "" {
		seed = "TICKET"
	}
	typePart := strings.ToUpper(strings.TrimSpace(ticketType))
	typePart = strings.ReplaceAll(typePart, " ", "_")
	if typePart == "" {
		typePart = "GEN"
	}
	parts := strings.Split(uuid.NewString(), "-")
	if len(parts) < 2 {
		return fmt.Sprintf("%s-%s-%s", seed, typePart, strings.ToUpper(uuid.NewString()[:8]))
	}
	return fmt.Sprintf("%s-%s-%s%s", seed, typePart, strings.ToUpper(parts[0][:4]), strings.ToUpper(parts[1][:4]))
}

func sortField(v, fallback string) string {
	f := strings.TrimSpace(v)
	if f == "" {
		return fallback
	}
	return f
}

func sortDirection(v string) database.SortOrder {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "asc", "1", "true":
		return database.SortAsc
	default:
		return database.SortDesc
	}
}

// ScanByCode processes a scan request by ticket code.
// It records the scan attempt and marks the ticket as used if valid.
func (s *Service) ScanByCode(ctx context.Context, req *ScanByCodeRequest, actorWallet string) (*ScanByCodeResponse, error) {
	scanner := normalizeWallet(actorWallet)
	if scanner == "" {
		return nil, apperr.ErrForbidden
	}

	ticketCode := strings.ToUpper(strings.TrimSpace(req.TicketCode))
	if ticketCode == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ticket_code is required")
	}

	scanLog := &domain.ServiceTicketScanLog{
		BaseEntity:    domain.BaseEntity{ID: uuid.NewString(), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		TicketCode:    ticketCode,
		ScannerWallet: scanner,
		Location:      strings.TrimSpace(req.Location),
		DeviceID:      strings.TrimSpace(req.DeviceID),
		Note:          strings.TrimSpace(req.Note),
	}

	persist := func(result domain.ServiceTicketScanResult) {
		scanLog.Result = result
		if s.scanLogRepo != nil {
			_ = s.scanLogRepo.Create(ctx, scanLog)
		}
	}

	purchase, err := s.purchaseRepo.FindByTicketCode(ctx, ticketCode)
	if err != nil {
		persist(domain.ServiceTicketScanNotFound)
		return &ScanByCodeResponse{Result: domain.ServiceTicketScanNotFound}, nil
	}

	scanLog.PurchaseID = purchase.ID
	scanLog.ProductID = purchase.ProductID
	scanLog.BuyerWallet = purchase.BuyerWallet

	product, err := s.productRepo.FindByID(ctx, purchase.ProductID)
	if err != nil {
		persist(domain.ServiceTicketScanNotFound)
		return &ScanByCodeResponse{Result: domain.ServiceTicketScanNotFound, Purchase: purchase}, nil
	}

	scanLog.ProductTitle = product.Title
	scanLog.TicketType = product.TicketType

	// Authorization: seller or allowed scanner
	if !strings.EqualFold(product.SellerWallet, scanner) && !isScannerAllowed(product, scanner) {
		persist(domain.ServiceTicketScanUnauthorized)
		return nil, apperr.ErrForbidden
	}

	if product.Status != domain.ServiceTicketProductActive {
		persist(domain.ServiceTicketScanProductInactive)
		return &ScanByCodeResponse{Result: domain.ServiceTicketScanProductInactive, Purchase: purchase, Product: product}, nil
	}

	valid, reason, updated, err := s.evaluateTicketValidity(ctx, purchase)
	if err != nil {
		return nil, err
	}
	if updated != nil {
		purchase = updated
	}

	if !valid {
		var result domain.ServiceTicketScanResult
		switch reason {
		case "already_used":
			result = domain.ServiceTicketScanAlreadyUsed
		case "expired":
			result = domain.ServiceTicketScanExpired
		default:
			result = domain.ServiceTicketScanInvalidCode
		}
		persist(result)
		resp := &ScanByCodeResponse{Result: result, Purchase: purchase, Product: product}
		if purchase.UsedAt != nil {
			formatted := timeutil.FormatRFC3339UTC7(*purchase.UsedAt)
			resp.UsedAt = &formatted
			resp.UsedByWallet = purchase.UsedByWallet
		}
		return resp, nil
	}

	// Mark ticket as used
	now := time.Now().UTC()
	purchase.Status = domain.ServiceTicketPurchaseUsed
	purchase.UsedAt = &now
	purchase.UsedByWallet = scanner
	purchase.UsedNote = strings.TrimSpace(req.Note)
	if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
		return nil, err
	}

	persist(domain.ServiceTicketScanSuccess)
	return &ScanByCodeResponse{Result: domain.ServiceTicketScanSuccess, Purchase: purchase, Product: product}, nil
}

// ListScanLogs returns scan logs for a product (seller only).
func (s *Service) ListScanLogs(ctx context.Context, actorWallet string, filter *ListScanLogsQuery, pageReq pagination.Request) ([]*domain.ServiceTicketScanLog, int64, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, 0, apperr.ErrForbidden
	}
	if s.scanLogRepo == nil {
		return nil, 0, apperr.New(apperr.ErrCodeInternal, "scan log repository unavailable")
	}

	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
		database.WithSort("created_at", database.SortDesc),
	}

	if filter != nil && filter.ProductID != "" {
		// Ensure caller owns the product
		product, err := s.productRepo.FindByID(ctx, filter.ProductID)
		if err != nil {
			return nil, 0, err
		}
		if !strings.EqualFold(product.SellerWallet, wallet) && !strings.EqualFold(product.CreatorWallet, wallet) {
			return nil, 0, apperr.ErrForbidden
		}
		return s.scanLogRepo.FindByProduct(ctx, filter.ProductID, opts...)
	}

	return s.scanLogRepo.FindByScanner(ctx, wallet, opts...)
}

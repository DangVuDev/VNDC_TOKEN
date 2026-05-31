package domain

import "time"

type ServiceTicketCategory string

const (
	ServiceTicketCategoryEventSeat      ServiceTicketCategory = "EVENT_SEAT"
	ServiceTicketCategoryRetakeExam     ServiceTicketCategory = "RETAKE_EXAM"
	ServiceTicketCategoryGradeUpgrade   ServiceTicketCategory = "GRADE_UPGRADE"
	ServiceTicketCategoryComputerRental ServiceTicketCategory = "COMPUTER_RENTAL"
	ServiceTicketCategoryParkingMonthly ServiceTicketCategory = "PARKING_MONTHLY"
	ServiceTicketCategoryOther          ServiceTicketCategory = "OTHER"
)

type ServiceTicketProductStatus string

const (
	ServiceTicketProductActive   ServiceTicketProductStatus = "ACTIVE"
	ServiceTicketProductInactive ServiceTicketProductStatus = "INACTIVE"
	ServiceTicketProductArchived ServiceTicketProductStatus = "ARCHIVED"
)

type ServiceTicketSaleMode string

const (
	ServiceTicketSaleModeAlwaysOn ServiceTicketSaleMode = "ALWAYS_ON"
	ServiceTicketSaleModeWindowed ServiceTicketSaleMode = "WINDOWED"
)

type ServiceTicketStockMode string

const (
	ServiceTicketStockModeLimited   ServiceTicketStockMode = "LIMITED"
	ServiceTicketStockModeUnlimited ServiceTicketStockMode = "UNLIMITED"
)

type ServiceTicketPurchaseStatus string

const (
	ServiceTicketPurchasePendingPayment ServiceTicketPurchaseStatus = "PENDING_PAYMENT"
	ServiceTicketPurchaseCompleted      ServiceTicketPurchaseStatus = "COMPLETED"
	ServiceTicketPurchaseFailed         ServiceTicketPurchaseStatus = "FAILED"
	ServiceTicketPurchaseUsed           ServiceTicketPurchaseStatus = "USED"
	ServiceTicketPurchaseExpired        ServiceTicketPurchaseStatus = "EXPIRED"
)

// ServiceTicketProduct is a generic sellable service unit paid by VNDC token.
type ServiceTicketProduct struct {
	BaseEntity `bson:",inline"`

	Code            string                     `bson:"code" json:"code"`
	Category        ServiceTicketCategory      `bson:"category" json:"category"`
	TicketType      string                     `bson:"ticket_type" json:"ticket_type"`
	Status          ServiceTicketProductStatus `bson:"status" json:"status"`
	SaleMode        ServiceTicketSaleMode      `bson:"sale_mode" json:"sale_mode"`
	StockMode       ServiceTicketStockMode     `bson:"stock_mode" json:"stock_mode"`
	Title           string                     `bson:"title" json:"title"`
	Description     string                     `bson:"description,omitempty" json:"description,omitempty"`
	ImageURI        string                     `bson:"image_uri,omitempty" json:"image_uri,omitempty"`
	MetadataURI     string                     `bson:"metadata_uri,omitempty" json:"metadata_uri,omitempty"`
	Metadata        map[string]interface{}     `bson:"metadata,omitempty" json:"metadata,omitempty"`
	CreatorWallet   string                     `bson:"creator_wallet" json:"creator_wallet"`
	SellerWallet    string                     `bson:"seller_wallet" json:"seller_wallet"`
	CurrencyToken   string                     `bson:"currency_token" json:"currency_token"`
	UnitPrice       string                     `bson:"unit_price" json:"unit_price"`
	TotalStock      int64                      `bson:"total_stock" json:"total_stock"`
	AvailableStock  int64                      `bson:"available_stock" json:"available_stock"`
	ReservedStock   int64                      `bson:"reserved_stock" json:"reserved_stock"`
	SoldStock       int64                      `bson:"sold_stock" json:"sold_stock"`
	SaleStartsAt    *time.Time                 `bson:"sale_starts_at,omitempty" json:"sale_starts_at,omitempty"`
	SaleEndsAt      *time.Time                 `bson:"sale_ends_at,omitempty" json:"sale_ends_at,omitempty"`
	UseValidFrom    *time.Time                 `bson:"use_valid_from,omitempty" json:"use_valid_from,omitempty"`
	UseValidUntil   *time.Time                 `bson:"use_valid_until,omitempty" json:"use_valid_until,omitempty"`
	UseDurationDays int64                      `bson:"use_duration_days,omitempty" json:"use_duration_days,omitempty"`
	// AllowedScanners lists wallet addresses that are allowed to scan/use tickets
	// for this product (in addition to the SellerWallet).
	AllowedScanners []string `bson:"allowed_scanners,omitempty" json:"allowed_scanners,omitempty"`
}

// ServiceTicketScanResult represents the outcome of a scan attempt.
type ServiceTicketScanResult string

const (
	ServiceTicketScanSuccess         ServiceTicketScanResult = "SUCCESS"
	ServiceTicketScanAlreadyUsed     ServiceTicketScanResult = "ALREADY_USED"
	ServiceTicketScanExpired         ServiceTicketScanResult = "EXPIRED"
	ServiceTicketScanInvalidCode     ServiceTicketScanResult = "INVALID_CODE"
	ServiceTicketScanUnauthorized    ServiceTicketScanResult = "UNAUTHORIZED_SCANNER"
	ServiceTicketScanNotFound        ServiceTicketScanResult = "NOT_FOUND"
	ServiceTicketScanProductInactive ServiceTicketScanResult = "PRODUCT_INACTIVE"
)

// ServiceTicketScanLog is an audit record for every scan attempt (success or failure).
type ServiceTicketScanLog struct {
	BaseEntity `bson:",inline"`

	PurchaseID    string                  `bson:"purchase_id,omitempty" json:"purchase_id,omitempty"`
	ProductID     string                  `bson:"product_id,omitempty" json:"product_id,omitempty"`
	TicketCode    string                  `bson:"ticket_code" json:"ticket_code"`
	ScannerWallet string                  `bson:"scanner_wallet" json:"scanner_wallet"`
	Result        ServiceTicketScanResult `bson:"result" json:"result"`
	Note          string                  `bson:"note,omitempty" json:"note,omitempty"`
	Location      string                  `bson:"location,omitempty" json:"location,omitempty"`
	DeviceID      string                  `bson:"device_id,omitempty" json:"device_id,omitempty"`
	// Denormalised snapshot for quick display
	BuyerWallet  string `bson:"buyer_wallet,omitempty" json:"buyer_wallet,omitempty"`
	ProductTitle string `bson:"product_title,omitempty" json:"product_title,omitempty"`
	TicketType   string `bson:"ticket_type,omitempty" json:"ticket_type,omitempty"`
}

// ServiceTicketPurchase tracks token payment and entitlement issuance for a product.
type ServiceTicketPurchase struct {
	BaseEntity `bson:",inline"`

	ProductID     string                      `bson:"product_id" json:"product_id"`
	BuyerWallet   string                      `bson:"buyer_wallet" json:"buyer_wallet"`
	SellerWallet  string                      `bson:"seller_wallet" json:"seller_wallet"`
	Quantity      int64                       `bson:"quantity" json:"quantity"`
	UnitPrice     string                      `bson:"unit_price" json:"unit_price"`
	TotalPrice    string                      `bson:"total_price" json:"total_price"`
	CurrencyToken string                      `bson:"currency_token" json:"currency_token"`
	Status        ServiceTicketPurchaseStatus `bson:"status" json:"status"`
	TicketCode    string                      `bson:"ticket_code" json:"ticket_code"`
	PaymentTxID   string                      `bson:"payment_tx_id,omitempty" json:"payment_tx_id,omitempty"`
	PaymentTxHash string                      `bson:"payment_tx_hash,omitempty" json:"payment_tx_hash,omitempty"`
	FailureReason string                      `bson:"failure_reason,omitempty" json:"failure_reason,omitempty"`
	Metadata      map[string]interface{}      `bson:"metadata,omitempty" json:"metadata,omitempty"`
	ExpiresAt     *time.Time                  `bson:"expires_at,omitempty" json:"expires_at,omitempty"`
	CompletedAt   *time.Time                  `bson:"completed_at,omitempty" json:"completed_at,omitempty"`
	UsedAt        *time.Time                  `bson:"used_at,omitempty" json:"used_at,omitempty"`
	UsedByWallet  string                      `bson:"used_by_wallet,omitempty" json:"used_by_wallet,omitempty"`
	UsedNote      string                      `bson:"used_note,omitempty" json:"used_note,omitempty"`
}

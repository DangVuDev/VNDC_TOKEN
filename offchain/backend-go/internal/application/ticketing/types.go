package ticketing

import "github.com/vndc/backend/internal/domain"

type CreateProductRequest struct {
	Code            string                 `json:"code"`
	Category        string                 `json:"category" binding:"required"`
	TicketType      string                 `json:"ticket_type" binding:"required"`
	Title           string                 `json:"title" binding:"required"`
	Description     string                 `json:"description"`
	ImageURI        string                 `json:"image_uri"`
	MetadataURI     string                 `json:"metadata_uri"`
	Metadata        map[string]interface{} `json:"metadata"`
	SellerWallet    string                 `json:"seller_wallet"`
	CurrencyToken   string                 `json:"currency_token"`
	UnitPrice       string                 `json:"unit_price" binding:"required"`
	SaleMode        string                 `json:"sale_mode"`
	SaleStartsAt    *int64                 `json:"sale_starts_at"`
	SaleEndsAt      *int64                 `json:"sale_ends_at"`
	StockMode       string                 `json:"stock_mode"`
	TotalStock      *int64                 `json:"total_stock"`
	UseValidFrom    *int64                 `json:"use_valid_from"`
	UseValidUntil   *int64                 `json:"use_valid_until"`
	UseDurationDays *int64                 `json:"use_duration_days"`
	AllowedScanners []string               `json:"allowed_scanners"`
}

type UpdateProductRequest struct {
	Category        string                 `json:"category"`
	TicketType      string                 `json:"ticket_type"`
	Status          string                 `json:"status"`
	SaleMode        string                 `json:"sale_mode"`
	StockMode       string                 `json:"stock_mode"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	ImageURI        string                 `json:"image_uri"`
	MetadataURI     string                 `json:"metadata_uri"`
	Metadata        map[string]interface{} `json:"metadata"`
	SellerWallet    string                 `json:"seller_wallet"`
	CurrencyToken   string                 `json:"currency_token"`
	UnitPrice       string                 `json:"unit_price"`
	TotalStock      *int64                 `json:"total_stock"`
	SaleStartsAt    *int64                 `json:"sale_starts_at"`
	SaleEndsAt      *int64                 `json:"sale_ends_at"`
	UseValidFrom    *int64                 `json:"use_valid_from"`
	UseValidUntil   *int64                 `json:"use_valid_until"`
	UseDurationDays *int64                 `json:"use_duration_days"`
	// SetAllowedScanners replaces the entire allowed_scanners list when non-nil.
	SetAllowedScanners *[]string `json:"allowed_scanners"`
}

type PurchaseProductRequest struct {
	FromWallet string                 `json:"from_wallet" binding:"required"`
	Quantity   int64                  `json:"quantity"`
	Nonce      string                 `json:"nonce" binding:"required"`
	Deadline   int64                  `json:"deadline" binding:"required"`
	Signature  string                 `json:"signature" binding:"required"`
	Metadata   map[string]interface{} `json:"metadata"`
}

type VerifyTicketRequest struct {
	TicketCode string `json:"ticket_code" binding:"required"`
}

type UseTicketRequest struct {
	TicketCode string `json:"ticket_code" binding:"required"`
	UsedNote   string `json:"used_note"`
}

type VerifyTicketResponse struct {
	Valid    bool                          `json:"valid"`
	Reason   string                        `json:"reason,omitempty"`
	Purchase *domain.ServiceTicketPurchase `json:"purchase,omitempty"`
}

// ScanByCodeRequest is used by the scanner endpoint (POST /tickets/scan).
type ScanByCodeRequest struct {
	TicketCode    string `json:"ticket_code" binding:"required"`
	ScannerWallet string `json:"scanner_wallet" binding:"required"`
	Location      string `json:"location"`
	DeviceID      string `json:"device_id"`
	Note          string `json:"note"`
}

// ScanByCodeResponse is returned from the scanner endpoint.
type ScanByCodeResponse struct {
	Result   domain.ServiceTicketScanResult `json:"result"`
	Purchase *domain.ServiceTicketPurchase  `json:"purchase,omitempty"`
	Product  *domain.ServiceTicketProduct   `json:"product,omitempty"`
	// Populated when result is ALREADY_USED
	UsedAt       *string `json:"used_at,omitempty"`
	UsedByWallet string  `json:"used_by_wallet,omitempty"`
}

type ListProductsQuery struct {
	Category     string `form:"category"`
	TicketType   string `form:"ticket_type"`
	Status       string `form:"status"`
	SaleMode     string `form:"sale_mode"`
	StockMode    string `form:"stock_mode"`
	SellerWallet string `form:"seller_wallet"`
	Mine         bool   `form:"mine"`
	Search       string `form:"search"`
}

type ListPurchasesQuery struct {
	ProductID string `form:"product_id"`
	Status    string `form:"status"`
}

type ListScanLogsQuery struct {
	ProductID string `form:"product_id"`
	Result    string `form:"result"`
}

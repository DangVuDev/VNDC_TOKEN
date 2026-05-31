package domain

import "time"

type MarketplaceListingStatus string

const (
	MarketplaceListingActive    MarketplaceListingStatus = "ACTIVE"
	MarketplaceListingSold      MarketplaceListingStatus = "SOLD"
	MarketplaceListingCancelled MarketplaceListingStatus = "CANCELLED"
)

type MarketplacePurchaseStatus string

const (
	MarketplacePurchasePendingPayment MarketplacePurchaseStatus = "PENDING_PAYMENT"
	MarketplacePurchasePendingCOD     MarketplacePurchaseStatus = "PENDING_COD"
	MarketplacePurchaseCancelled      MarketplacePurchaseStatus = "CANCELLED"
	MarketplacePurchaseReceived       MarketplacePurchaseStatus = "RECEIVED"
	MarketplacePurchasePacked         MarketplacePurchaseStatus = "PACKED"
	MarketplacePurchaseShipping       MarketplacePurchaseStatus = "SHIPPING"
	MarketplacePurchaseDelivered      MarketplacePurchaseStatus = "DELIVERED"
	MarketplacePurchaseCompleted      MarketplacePurchaseStatus = "COMPLETED"
	MarketplacePurchaseFailed         MarketplacePurchaseStatus = "FAILED"
)

// MarketplaceListing stores a fixed-price ERC1155 listing mirrored from on-chain escrow state.
type MarketplaceListing struct {
	BaseEntity `bson:",inline"`

	SellerWallet               string                   `bson:"seller_wallet" json:"seller_wallet"`
	BuyerWallet                string                   `bson:"buyer_wallet,omitempty" json:"buyer_wallet,omitempty"`
	NFTContractAddress         string                   `bson:"nft_contract_address" json:"nft_contract_address"`
	PaymentTokenAddress        string                   `bson:"payment_token_address" json:"payment_token_address"`
	MarketplaceContractAddress string                   `bson:"marketplace_contract_address" json:"marketplace_contract_address"`
	TokenID                    string                   `bson:"token_id" json:"token_id"`
	Amount                     string                   `bson:"amount" json:"amount"`
	Price                      string                   `bson:"price" json:"price"`
	RoyaltyPercentage          int                      `bson:"royalty_percentage" json:"royalty_percentage"`
	Status                     MarketplaceListingStatus `bson:"status" json:"status"`
	OnchainListingID           string                   `bson:"onchain_listing_id,omitempty" json:"onchain_listing_id,omitempty"`
	EscrowTxHash               string                   `bson:"escrow_tx_hash,omitempty" json:"escrow_tx_hash,omitempty"`
	FinalizeTxHash             string                   `bson:"finalize_tx_hash,omitempty" json:"finalize_tx_hash,omitempty"`
	CancelTxHash               string                   `bson:"cancel_tx_hash,omitempty" json:"cancel_tx_hash,omitempty"`
	Title                      string                   `bson:"title" json:"title"`
	Description                string                   `bson:"description,omitempty" json:"description,omitempty"`
	ImageURI                   string                   `bson:"image_uri,omitempty" json:"image_uri,omitempty"`
	MetadataURI                string                   `bson:"metadata_uri,omitempty" json:"metadata_uri,omitempty"`
	Category                   string                   `bson:"category,omitempty" json:"category,omitempty"`
	SoldAt                     *time.Time               `bson:"sold_at,omitempty" json:"sold_at,omitempty"`
}

// MarketplacePurchase tracks a buyer payment and the corresponding settlement result.
type MarketplacePurchase struct {
	BaseEntity `bson:",inline"`

	ListingID         string                    `bson:"listing_id" json:"listing_id"`
	BuyerWallet       string                    `bson:"buyer_wallet" json:"buyer_wallet"`
	SellerWallet      string                    `bson:"seller_wallet" json:"seller_wallet"`
	PaymentToken      string                    `bson:"payment_token" json:"payment_token"`
	Amount            string                    `bson:"amount" json:"amount"`
	Price             string                    `bson:"price" json:"price"`
	Status            MarketplacePurchaseStatus `bson:"status" json:"status"`
	PaymentMethod     string                    `bson:"payment_method" json:"payment_method"`
	PaymentTxID       string                    `bson:"payment_tx_id,omitempty" json:"payment_tx_id,omitempty"`
	PaymentTxHash     string                    `bson:"payment_tx_hash,omitempty" json:"payment_tx_hash,omitempty"`
	FinalizeTxHash    string                    `bson:"finalize_tx_hash,omitempty" json:"finalize_tx_hash,omitempty"`
	FailureReason     string                    `bson:"failure_reason,omitempty" json:"failure_reason,omitempty"`
	OnchainPurchaseID string                    `bson:"onchain_purchase_id" json:"onchain_purchase_id"`

	ListingTitle    string `bson:"listing_title,omitempty" json:"listing_title,omitempty"`
	ListingImageURI string `bson:"listing_image_uri,omitempty" json:"listing_image_uri,omitempty"`
	ListingCategory string `bson:"listing_category,omitempty" json:"listing_category,omitempty"`

	RecipientName    string     `bson:"recipient_name,omitempty" json:"recipient_name,omitempty"`
	RecipientPhone   string     `bson:"recipient_phone,omitempty" json:"recipient_phone,omitempty"`
	ShippingAddress  string     `bson:"shipping_address,omitempty" json:"shipping_address,omitempty"`
	DeliveryNote     string     `bson:"delivery_note,omitempty" json:"delivery_note,omitempty"`
	ExpectedDelivery *time.Time `bson:"expected_delivery,omitempty" json:"expected_delivery,omitempty"`
	PackedAt         *time.Time `bson:"packed_at,omitempty" json:"packed_at,omitempty"`
	ShippingAt       *time.Time `bson:"shipping_at,omitempty" json:"shipping_at,omitempty"`
	DeliveredAt      *time.Time `bson:"delivered_at,omitempty" json:"delivered_at,omitempty"`
}

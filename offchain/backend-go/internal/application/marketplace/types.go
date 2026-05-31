package marketplace

type CreateListingRequest struct {
	Title               string `json:"title" binding:"required"`
	Description         string `json:"description"`
	ImageURI            string `json:"image_uri"`
	MetadataURI         string `json:"metadata_uri"`
	NFTContractAddress  string `json:"nft_contract_address"`
	PaymentTokenAddress string `json:"payment_token_address"`
	TokenID             string `json:"token_id"`
	Amount              string `json:"amount" binding:"required"`
	Price               string `json:"price" binding:"required"`
	RoyaltyPercentage   int    `json:"royalty_percentage"`
	Category            string `json:"category"`
}

type MintAndListNFTRequest struct {
	Title               string `json:"title" binding:"required"`
	Description         string `json:"description"`
	ImageURI            string `json:"image_uri" binding:"required"`
	MetadataURI         string `json:"metadata_uri"`
	PaymentTokenAddress string `json:"payment_token_address"`
	NFTContractAddress  string `json:"nft_contract_address"`
	RoyaltyPercentage   int    `json:"royalty_percentage"`
}

type AdminMintCollectionRequest struct {
	To       string `json:"to" binding:"required"`
	TokenURI string `json:"token_uri" binding:"required"`
}

type AdminMintCollectionResponse struct {
	TokenID string `json:"token_id"`
	TxHash  string `json:"tx_hash"`
}

type AdminApproveCollectionRequest struct {
	Spender string `json:"spender" binding:"required"`
	TokenID string `json:"token_id" binding:"required"`
}

type AdminApproveCollectionResponse struct {
	TokenID string `json:"token_id"`
	TxHash  string `json:"tx_hash"`
}

type UpdateListingPriceRequest struct {
	Price string `json:"price" binding:"required"`
}

type BuyListingRequest struct {
	FromWallet    string `json:"from_wallet"`
	Nonce         string `json:"nonce"`
	Deadline      int64  `json:"deadline"`
	Signature     string `json:"signature"`
	PaymentMethod string `json:"payment_method"` // TOKEN (default) or COD

	RecipientName   string `json:"recipient_name"`
	RecipientPhone  string `json:"recipient_phone"`
	ShippingAddress string `json:"shipping_address"`
	DeliveryNote    string `json:"delivery_note"`
}

type ListListingsQuery struct {
	Status       string `form:"status"`
	SellerWallet string `form:"seller_wallet"`
	Mine         bool   `form:"mine"`
	Search       string `form:"search"`
}

type ListPurchasesQuery struct {
	ListingID string `form:"listing_id"`
	Status    string `form:"status"`
}

type UpdatePurchaseStatusRequest struct {
	Status                string `json:"status" binding:"required"`
	ExpectedDeliveryHours int    `json:"expected_delivery_hours"`
}

type CancelOrderBySellerRequest struct {
	FromWallet string `json:"from_wallet"`
	Nonce      string `json:"nonce"`
	Deadline   int64  `json:"deadline"`
	Signature  string `json:"signature"`
}

type SellerProfileResponse struct {
	Wallet            string `json:"wallet"`
	DisplayName       string `json:"display_name"`
	AvatarURI         string `json:"avatar_uri,omitempty"`
	Bio               string `json:"bio,omitempty"`
	TotalListings     int64  `json:"total_listings"`
	ActiveListings    int64  `json:"active_listings"`
	DeliveredOrders   int64  `json:"delivered_orders"`
	TotalRevenueWei   string `json:"total_revenue_wei"`
	AverageRatingText string `json:"average_rating_text"`
}

type ListOwnedNFTsQuery struct {
	SortBy  string `form:"sort_by"`
	SortDir string `form:"sort_dir"`
}

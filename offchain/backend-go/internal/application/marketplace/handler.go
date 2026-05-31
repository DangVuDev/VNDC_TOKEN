package marketplace

import (
	"github.com/gin-gonic/gin"

	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the marketplace HTTP handler with a module-scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("marketplace_handler")}
}

// RegisterRoutes wires public marketplace browsing routes, authenticated buyer/seller routes, and admin-only collection routes.
// This route split makes storefront discovery public while keeping listing mutation and order actions behind authentication and KYC checks.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	market := v1.Group("/marketplace")
	{
		market.GET("/listings", h.ListListings)
		market.GET("/listings/:id", h.GetListing)
		market.GET("/shops/:wallet", h.GetSellerProfile)
		market.GET("/nfts", protected, h.ListOwnedNFTs)
		market.GET("/nfts/:wallet", h.ListOwnedNFTsByWallet)
		market.POST("/nft-shop/mint-and-list", protected, middleware.RequireKYCLevel(1, userRepo), h.MintAndListNFT)
		market.POST("/listings", protected, middleware.RequireKYCLevel(1, userRepo), h.CreateListing)
		market.POST("/listings/:id/price", protected, middleware.RequireKYCLevel(1, userRepo), h.UpdateListingPrice)
		market.POST("/listings/:id/cancel", protected, middleware.RequireKYCLevel(1, userRepo), h.CancelListing)
		market.POST("/listings/:id/buy", protected, middleware.RequireKYCLevel(1, userRepo), h.BuyListing)
		market.GET("/purchases", protected, h.ListPurchases)
		market.GET("/purchases/:id", protected, h.GetPurchase)
		market.POST("/purchases/:id/cancel", protected, middleware.RequireKYCLevel(1, userRepo), h.CancelPurchase)
		market.GET("/seller/orders", protected, h.ListSellerOrders)
		market.POST("/seller/orders/:id/cancel", protected, middleware.RequireKYCLevel(1, userRepo), h.CancelOrderBySeller)
		market.POST("/seller/orders/:id/status", protected, middleware.RequireKYCLevel(1, userRepo), h.UpdateOrderStatus)

		admin := market.Group("/admin")
		admin.Use(protected, middleware.RequireRole("ADMIN", "SUPER_ADMIN"))
		{
			admin.POST("/collection/mint", h.AdminMintCollection)
			admin.POST("/collection/approve", h.AdminApproveCollection)
		}
	}
}

// CreateListing handles seller creation of a new marketplace listing.
// The seller wallet is always derived from middleware so clients cannot spoof ownership in the request body.
func (h *Handler) CreateListing(c *gin.Context) {
	req, ok := apihttp.Bind[CreateListingRequest](c)
	if !ok {
		return
	}
	listing, err := h.svc.CreateListing(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, listing)
}

// MintAndListNFT handles the one-step creator flow that mints an NFT and immediately creates a marketplace listing.
// It is a convenience transport endpoint over the combined mint-plus-list service orchestration.
func (h *Handler) MintAndListNFT(c *gin.Context) {
	req, ok := apihttp.Bind[MintAndListNFTRequest](c)
	if !ok {
		return
	}
	listing, err := h.svc.MintAndListNFT(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, listing)
}

// AdminMintCollection handles administrative minting of curated collection tokens.
// The response is intentionally compact and returns the new token ID plus the chain transaction hash.
func (h *Handler) AdminMintCollection(c *gin.Context) {
	req, ok := apihttp.Bind[AdminMintCollectionRequest](c)
	if !ok {
		return
	}
	tokenID, txHash, err := h.svc.MintCollectionToken(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &AdminMintCollectionResponse{TokenID: tokenID, TxHash: txHash})
}

// AdminApproveCollection handles administrative approval of a collection token for marketplace-related spending or transfer.
// It binds the approval request and returns the resulting approval transaction hash.
func (h *Handler) AdminApproveCollection(c *gin.Context) {
	req, ok := apihttp.Bind[AdminApproveCollectionRequest](c)
	if !ok {
		return
	}
	txHash, err := h.svc.ApproveCollectionToken(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &AdminApproveCollectionResponse{TokenID: req.TokenID, TxHash: txHash})
}

// UpdateListingPrice handles seller-side price updates for an existing listing.
// The acting wallet is injected from the authenticated request context to preserve ownership checks.
func (h *Handler) UpdateListingPrice(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[UpdateListingPriceRequest](c)
	if !ok {
		return
	}
	listing, err := h.svc.UpdateListingPrice(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, listing)
}

// CancelListing handles seller cancellation of an active listing.
// Conflict checks such as pending purchases remain the responsibility of the service layer.
func (h *Handler) CancelListing(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	listing, err := h.svc.CancelListing(c.Request.Context(), id, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, listing)
}

// BuyListing handles buyer creation of a purchase against a listing.
// It is the main checkout entry point for marketplace orders and NFT sales.
func (h *Handler) BuyListing(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[BuyListingRequest](c)
	if !ok {
		return
	}
	purchase, err := h.svc.BuyListing(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, purchase)
}

// ListListings handles public or authenticated browsing of marketplace listings with filters and pagination.
// When available, the caller wallet from middleware is passed through so the service can support owner-aware listing views.
func (h *Handler) ListListings(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListListingsQuery](c)
	if !ok {
		filter = &ListListingsQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListListings(c.Request.Context(), middleware.WalletAddress(c), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetListing handles retrieval of one listing by its ID.
// This route is read-only and suitable for product detail pages.
func (h *Handler) GetListing(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	listing, err := h.svc.GetListing(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, listing)
}

// ListOwnedNFTs handles authenticated retrieval of the caller's NFT inventory.
// The caller wallet is read from the session rather than a query parameter for safety.
func (h *Handler) ListOwnedNFTs(c *gin.Context) {
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListOwnedNFTs(c.Request.Context(), middleware.WalletAddress(c), *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// ListOwnedNFTsByWallet handles public or external-wallet inventory lookup for NFTs.
// Unlike ListOwnedNFTs, the target wallet is supplied explicitly via the route path.
func (h *Handler) ListOwnedNFTsByWallet(c *gin.Context) {
	wallet, ok := apihttp.PathParam(c, "wallet")
	if !ok {
		return
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListOwnedNFTs(c.Request.Context(), wallet, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// ListPurchases handles buyer-side paginated order history retrieval.
// The service receives the authenticated wallet to constrain results to the current buyer.
func (h *Handler) ListPurchases(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListPurchasesQuery](c)
	if !ok {
		filter = &ListPurchasesQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListPurchases(c.Request.Context(), middleware.WalletAddress(c), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetPurchase handles retrieval of one purchase visible to the current authenticated participant.
// Visibility rules are enforced downstream based on the caller wallet passed to the service.
func (h *Handler) GetPurchase(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	purchase, err := h.svc.GetPurchase(c.Request.Context(), id, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, purchase)
}

// CancelPurchase handles buyer-side cancellation of an eligible purchase.
// The handler is intentionally thin and forwards the authenticated wallet for participant verification.
func (h *Handler) CancelPurchase(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	purchase, err := h.svc.CancelPurchase(c.Request.Context(), id, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, purchase)
}

// ListSellerOrders handles seller-side paginated retrieval of incoming orders.
// It powers operational fulfillment views for the currently authenticated seller.
func (h *Handler) ListSellerOrders(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListPurchasesQuery](c)
	if !ok {
		filter = &ListPurchasesQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListSellerOrders(c.Request.Context(), middleware.WalletAddress(c), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// UpdateOrderStatus handles seller-side progression of an order through its allowed fulfillment states.
// The status-transition rules themselves remain centralized in the service layer.
func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[UpdatePurchaseStatusRequest](c)
	if !ok {
		return
	}
	purchase, err := h.svc.UpdatePurchaseStatus(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, purchase)
}

// CancelOrderBySeller handles seller-initiated cancellation of an order, including refund-related flows.
// It is distinct from buyer cancellation because the service applies different business rules and side effects.
func (h *Handler) CancelOrderBySeller(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[CancelOrderBySellerRequest](c)
	if !ok {
		return
	}
	purchase, err := h.svc.CancelPurchaseBySeller(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, purchase)
}

// GetSellerProfile handles retrieval of a seller storefront summary by wallet.
// This read-only endpoint is used for public shop and seller reputation views.
func (h *Handler) GetSellerProfile(c *gin.Context) {
	wallet, ok := apihttp.PathParam(c, "wallet")
	if !ok {
		return
	}
	profile, err := h.svc.GetSellerProfile(c.Request.Context(), wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, profile)
}

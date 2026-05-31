package ticketing

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

// NewHandler constructs the ticketing HTTP handler with a module-scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("ticketing_handler")}
}

// RegisterRoutes mounts public product-browsing endpoints and authenticated ticket purchase, verification, and scan endpoints.
// Mutation routes are guarded with authentication and, where appropriate, KYC middleware.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	tickets := v1.Group("/tickets")
	{
		tickets.GET("/products", h.ListProducts)
		tickets.GET("/products/:id", h.GetProduct)
		tickets.POST("/products", protected, middleware.RequireKYCLevel(1, userRepo), h.CreateProduct)
		tickets.PUT("/products/:id", protected, middleware.RequireKYCLevel(1, userRepo), h.UpdateProduct)
		tickets.POST("/products/:id/purchase", protected, middleware.RequireKYCLevel(1, userRepo), h.PurchaseProduct)
		tickets.GET("/purchases", protected, h.ListPurchases)
		tickets.GET("/purchases/:id", protected, h.GetPurchase)
		tickets.POST("/purchases/:id/verify", protected, h.VerifyTicket)
		tickets.POST("/purchases/:id/use", protected, middleware.RequireKYCLevel(1, userRepo), h.UseTicket)
		tickets.POST("/scan", protected, middleware.RequireKYCLevel(1, userRepo), h.ScanByCode)
		tickets.GET("/scan/logs", protected, middleware.RequireKYCLevel(1, userRepo), h.ListScanLogs)
	}
}

// CreateProduct handles creation of a new service-ticket product by the authenticated creator or seller.
// The actor wallet is taken from middleware so product ownership cannot be spoofed in the request body.
func (h *Handler) CreateProduct(c *gin.Context) {
	req, ok := apihttp.Bind[CreateProductRequest](c)
	if !ok {
		return
	}
	product, err := h.svc.CreateProduct(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, product)
}

// UpdateProduct handles seller- or creator-side updates to an existing ticket product.
// The service enforces which fields can change without breaking stock or sale-window invariants.
func (h *Handler) UpdateProduct(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[UpdateProductRequest](c)
	if !ok {
		return
	}
	product, err := h.svc.UpdateProduct(c.Request.Context(), id, req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, product)
}

// PurchaseProduct handles authenticated purchase of a ticket product.
// It is the main checkout entry point for service-ticket commerce flows.
func (h *Handler) PurchaseProduct(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[PurchaseProductRequest](c)
	if !ok {
		return
	}
	purchase, err := h.svc.PurchaseProduct(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, purchase)
}

// ListProducts handles paginated browsing of ticket products with optional filters.
// When the caller is authenticated, the current wallet can be forwarded for owner-aware listing behavior.
func (h *Handler) ListProducts(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListProductsQuery](c)
	if !ok {
		filter = &ListProductsQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListProducts(c.Request.Context(), middleware.WalletAddress(c), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetProduct handles retrieval of one ticket product by ID.
// This route is read-only and suitable for public product detail pages.
func (h *Handler) GetProduct(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	product, err := h.svc.GetProduct(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, product)
}

// ListPurchases handles paginated retrieval of the current buyer's ticket purchases.
// Purchase visibility remains scoped to the authenticated wallet.
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

// GetPurchase handles retrieval of one ticket purchase visible to the current participant.
// The service applies the participant-authorization checks using the wallet forwarded here.
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

// VerifyTicket handles a pre-use verification check for a ticket purchase.
// It returns a verification response rather than mutating ticket usage state.
func (h *Handler) VerifyTicket(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[VerifyTicketRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.VerifyTicket(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// UseTicket handles consumption of a ticket after verification and business-rule checks succeed.
// It is the mutating endpoint that marks the purchase or ticket as used.
func (h *Handler) UseTicket(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[UseTicketRequest](c)
	if !ok {
		return
	}
	purchase, err := h.svc.UseTicket(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, purchase)
}

// ScanByCode handles ticket scanning by a code payload rather than a purchase-specific route.
// This supports scanner workflows where the operator only has the presented scan code.
func (h *Handler) ScanByCode(c *gin.Context) {
	req, ok := apihttp.Bind[ScanByCodeRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.ScanByCode(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// ListScanLogs handles paginated retrieval of scan-history records relevant to the authenticated actor.
// It supports audit, support, and scanner-operations views.
func (h *Handler) ListScanLogs(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListScanLogsQuery](c)
	if !ok {
		filter = &ListScanLogsQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListScanLogs(c.Request.Context(), middleware.WalletAddress(c), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

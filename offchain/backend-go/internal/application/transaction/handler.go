// Package transaction — HTTP handlers for the transaction API.
// Handlers are thin: bind request → call service → write response.
package transaction

import (
	"github.com/gin-gonic/gin"

	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler contains all transaction-related HTTP handlers.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs a Handler.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("transaction_handler")}
}

// RegisterRoutes mounts all transaction routes onto a Gin router group.
// v1 group should already have auth middleware applied where needed.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string) {
	auth := middleware.Auth(jwtSecret)

	txGroup := v1.Group("/transactions")
	{
		txGroup.POST("/transfer", auth, h.SubmitTransfer)
		txGroup.GET("/:id", auth, h.GetTransaction)
		txGroup.GET("", auth, h.ListTransactions)
	}

	balGroup := v1.Group("/balance")
	{
		balGroup.GET("/:wallet", h.GetBalance) // public read
	}
}

// ─────────────────────────────────────────────
//  Handlers
// ─────────────────────────────────────────────

// SubmitTransfer godoc
// POST /v1/transactions/transfer
// Body: SubmitTransferRequest
func (h *Handler) SubmitTransfer(c *gin.Context) {
	req, ok := apihttp.Bind[SubmitTransferRequest](c)
	if !ok {
		return
	}

	ctx := c.Request.Context()
	tx, err := h.svc.SubmitTransfer(ctx, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	apihttp.Created(c, tx)
}

// GetTransaction godoc
// GET /v1/transactions/:id
func (h *Handler) GetTransaction(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}

	ctx := c.Request.Context()
	tx, err := h.svc.GetTransaction(ctx, id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	apihttp.OK(c, tx)
}

// ListTransactions godoc
// GET /v1/transactions?page=1&page_size=20
func (h *Handler) ListTransactions(c *gin.Context) {
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, nil)
		return
	}

	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		pageReq = &pagination.Request{}
	}
	pageReq.Normalize()

	ctx := c.Request.Context()
	items, total, err := h.svc.ListTransactions(ctx, wallet, pageReq.Page, pageReq.PageSize)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetBalance godoc
// GET /v1/balance/:wallet
func (h *Handler) GetBalance(c *gin.Context) {
	wallet, ok := apihttp.PathParam(c, "wallet")
	if !ok {
		return
	}

	ctx := c.Request.Context()
	balance, err := h.svc.GetBalance(ctx, wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	apihttp.OK(c, balance)
}

// Package transaction — HTTP handlers for the transaction API.
// Handlers are thin: bind request → call service → write response.
package transaction

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/vndc/backend/internal/domain"

	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler contains HTTP endpoints for transaction submission, history, cancellation, and balance-related reads.
// It keeps transport-specific concerns local, including caller-wallet checks that are naturally enforced at the HTTP boundary.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the transaction HTTP handler with a module-scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("transaction_handler")}
}

// RegisterRoutes mounts authenticated transaction APIs and public balance APIs under their respective prefixes.
// Sensitive write operations are protected with JWT, blacklist, rate-limit, and KYC middleware at registration time.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)

	txGroup := v1.Group("/transactions")
	{
		// Strict rate limiting on the transfer submission endpoint (5/min per IP).
		txGroup.POST("/transfer", protected, middleware.StrictRateLimit(), h.SubmitTransfer, middleware.RequireKYCLevel(1, userRepo))
		txGroup.GET("", protected, h.ListTransactions)
		txGroup.GET("/:id", protected, h.GetTransaction)
		txGroup.DELETE("/:id", protected, h.CancelTransaction)
		txGroup.GET("/stats", protected, h.GetStats)
	}

	balGroup := v1.Group("/balance")
	{
		balGroup.GET("/:wallet", h.GetBalance)
		balGroup.POST("/:wallet/sync", protected, h.SyncBalance)
	}
}

// ─────────────────────────────────────────────
//  SubmitTransfer
// ─────────────────────────────────────────────

// SubmitTransfer handles authenticated submission of a signed transfer request.
// Before calling the service, it enforces that the authenticated wallet matches the declared sender in the request body.
// POST /v1/transactions/transfer
func (h *Handler) SubmitTransfer(c *gin.Context) {
	req, ok := apihttp.Bind[SubmitTransferRequest](c)
	if !ok {
		return
	}

	// Security: the authenticated wallet must be the transfer sender.
	authWallet := middleware.WalletAddress(c)
	if !strings.EqualFold(authWallet, req.FromWallet) {
		apihttp.Fail(c, apperr.ErrForbidden)
		return
	}
	req.Type = string(domain.TxTypeTokenTransfer)

	tx, err := h.svc.SubmitTransfer(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, tx)
}

// ─────────────────────────────────────────────
//  GetTransaction
// ─────────────────────────────────────────────

// GetTransaction handles retrieval of one transaction and applies caller-level ownership enforcement.
// Only the sender or recipient may view the transaction from this transport boundary.
// GET /v1/transactions/:id
func (h *Handler) GetTransaction(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	tx, err := h.svc.GetTransaction(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	// Authorization: only the sender or recipient can view the transaction.
	callerWallet := middleware.WalletAddress(c)
	if !strings.EqualFold(tx.FromWallet, callerWallet) && !strings.EqualFold(tx.ToWallet, callerWallet) {
		apihttp.Fail(c, apperr.ErrForbidden)
		return
	}

	apihttp.OK(c, tx)
}

// ─────────────────────────────────────────────
//  ListTransactions
// ─────────────────────────────────────────────

// ListTransactions handles paginated transaction history for the authenticated wallet.
// The wallet comes from the session, preventing cross-account history queries through crafted parameters.
// GET /v1/transactions?page=1&page_size=20
func (h *Handler) ListTransactions(c *gin.Context) {
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, nil)
		return
	}

	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		pageReq = &pagination.Request{Page: 1, PageSize: 20}
	}
	pageReq.Normalize()

	items, total, err := h.svc.ListTransactions(c.Request.Context(), wallet, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// ─────────────────────────────────────────────
//  CancelTransaction
// ─────────────────────────────────────────────

// CancelTransaction handles user-initiated cancellation of an eligible transaction.
// The authenticated caller wallet is forwarded so the service can enforce ownership and status rules.
// DELETE /v1/transactions/:id
func (h *Handler) CancelTransaction(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	callerWallet := middleware.WalletAddress(c)
	if callerWallet == "" {
		apihttp.Fail(c, nil)
		return
	}
	tx, err := h.svc.CancelTransaction(c.Request.Context(), id, callerWallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, tx)
}

// ─────────────────────────────────────────────
//  GetStats
// ─────────────────────────────────────────────

// GetStats handles retrieval of aggregate transaction statistics for authenticated users or operators.
// It is a thin read-only endpoint that directly serializes the service response.
// GET /v1/transactions/stats
func (h *Handler) GetStats(c *gin.Context) {
	stats, err := h.svc.GetStats(c.Request.Context())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, stats)
}

// ─────────────────────────────────────────────
//  GetBalance
// ─────────────────────────────────────────────

// GetBalance handles the public balance lookup endpoint for an arbitrary wallet.
// This route remains unauthenticated because it exposes read-only balance state.
// GET /v1/balance/:wallet  (public)
func (h *Handler) GetBalance(c *gin.Context) {
	wallet, ok := apihttp.PathParam(c, "wallet")
	if !ok {
		return
	}
	balance, err := h.svc.GetBalance(c.Request.Context(), wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, balance)
}

// ─────────────────────────────────────────────
//  SyncBalance
// ─────────────────────────────────────────────

// SyncBalance handles an authenticated request to refresh the cached balance snapshot for a wallet.
// The service performs the actual blockchain-backed refresh and cache update.
// POST /v1/balance/:wallet/sync  (authenticated)
func (h *Handler) SyncBalance(c *gin.Context) {
	wallet, ok := apihttp.PathParam(c, "wallet")
	if !ok {
		return
	}
	balance, err := h.svc.SyncBalance(c.Request.Context(), wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, balance)
}

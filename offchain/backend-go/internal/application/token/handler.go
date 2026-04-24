// Package token — HTTP handlers for wallet balance, token transfers, and transaction history.
package token

import (
	"net/http"

	"github.com/gin-gonic/gin"

	_ "github.com/vndc/backend/internal/models" // swagger model registration
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler exposes all token management HTTP endpoints.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs a token Handler.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("token_handler")}
}

// RegisterRoutes mounts all token routes.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker) {
	tokens := r.Group("/tokens")
	{
		// Public — no auth required for balance queries
		tokens.GET("/balance/:wallet", h.GetBalance)

		protected := tokens.Group("")
		protected.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
		{
			protected.POST("/transfer", h.Transfer)
			protected.GET("/transactions", h.ListTransactions)
			protected.GET("/transactions/:id", h.GetTransaction)
		}
	}
}

// GetBalance godoc
//
//	@Summary      Get wallet token balance
//	@Description  Returns the on-chain confirmed balance, pending (unprocessed transfers) amount,
//	@Description  and spendable (available) balance for a given Ethereum wallet address.
//	@Description
//	@Description  This endpoint is **public** — no authentication required.
//	@Tags         Tokens
//	@Produce      json
//	@Param        wallet  path      string  true  "Checksummed Ethereum wallet address"  example(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045)
//	@Success      200     {object}  models.BalanceResponse
//	@Failure      400     {object}  models.ErrorResponse  "Invalid wallet address format"
//	@Failure      404     {object}  models.ErrorResponse  "Wallet not found"
//	@Failure      500     {object}  models.ErrorResponse  "Internal server error"
//	@Router       /tokens/balance/{wallet} [get]
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

// Transfer godoc
//
//	@Summary      Submit a signed token transfer
//	@Description  Processes an **EIP-712** (or EIP-191 personal_sign) off-chain token transfer.
//	@Description  The signature is verified server-side using the sender's wallet address.
//	@Description
//	@Description  **Replay protection**: Each `(from_wallet, nonce)` pair must be globally unique.
//	@Description  Use a monotonically increasing nonce or a random UUID converted to uint256.
//	@Description
//	@Description  **Deadline**: Unix timestamp (seconds). Transactions submitted after `deadline` are rejected.
//	@Tags         Tokens
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.TransferRequest   true  "EIP-712 signed transfer payload"
//	@Success      201   {object}  models.TransferResponse        "Transfer queued / recorded"
//	@Failure      400   {object}  models.ErrorResponse           "Missing fields / past deadline"
//	@Failure      401   {object}  models.ErrorResponse           "Invalid EIP-712 signature"
//	@Failure      402   {object}  models.ErrorResponse           "Insufficient balance"
//	@Failure      409   {object}  models.ErrorResponse           "Duplicate nonce"
//	@Failure      500   {object}  models.ErrorResponse           "Internal server error"
//	@Router       /tokens/transfer [post]
func (h *Handler) Transfer(c *gin.Context) {
	req, ok := apihttp.Bind[TransferRequest](c)
	if !ok {
		return
	}
	tx, err := h.svc.Transfer(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": tx})
}

// ListTransactions godoc
//
//	@Summary      List my transactions
//	@Description  Returns a paginated list of token transfers where the authenticated user is
//	@Description  either the sender or the recipient. Sorted by creation time, newest first.
//	@Tags         Tokens
//	@Produce      json
//	@Security     BearerAuth
//	@Param        page       query     int     false  "Page number (default: 1)"        example(1)
//	@Param        page_size  query     int     false  "Items per page (default: 20)"    example(20)
//	@Param        status     query     string  false  "Filter by status"                Enums(PENDING,COMPLETED,FAILED,CANCELLED)
//	@Success      200        {object}  models.TransactionListResponse
//	@Failure      401        {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      500        {object}  models.ErrorResponse  "Internal server error"
//	@Router       /tokens/transactions [get]
func (h *Handler) ListTransactions(c *gin.Context) {
	req, ok := apihttp.Bind[pagination.Request](c)
	if !ok {
		return
	}
	wallet := middleware.WalletAddress(c)
	txs, total, err := h.svc.ListTransactions(c.Request.Context(), wallet, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, txs, total, req.Page, req.PageSize)
}

// GetTransaction godoc
//
//	@Summary      Get a transaction by ID
//	@Description  Returns the full details for a single transfer. Users may only view transactions
//	@Description  where they are the sender or recipient. Admins may view any transaction.
//	@Tags         Tokens
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path      string  true  "Transaction ID (MongoDB ObjectID or UUID)"  example(65f1a2b3c4d5e6f7a8b9c0d2)
//	@Success      200  {object}  models.TransactionResponse
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      403  {object}  models.ErrorResponse  "Access denied — not sender or recipient"
//	@Failure      404  {object}  models.ErrorResponse  "Transaction not found"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /tokens/transactions/{id} [get]
func (h *Handler) GetTransaction(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	_ = middleware.WalletAddress(c) // used for authorization check inside service
	tx, err := h.svc.GetTransaction(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, tx)
}

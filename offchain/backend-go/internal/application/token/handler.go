// Package token — HTTP handlers for wallet balance, token transfers, and transaction history.
package token

import (
	"net/http"

	"github.com/gin-gonic/gin"

	_ "github.com/vndc/backend/internal/models" // swagger model registration
	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler exposes token-related HTTP endpoints for balances, signed transfers, transaction history, and privileged contract actions.
// It owns request binding, middleware-based identity extraction, and API response formatting at the transport layer.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the token HTTP handler and scopes a logger for endpoint-level diagnostics.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("token_handler")}
}

// RegisterRoutes mounts public, authenticated, and admin-only token routes under one module prefix.
// The route tree reflects the token domain's three transport access levels: public reads, user actions, and privileged writes.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	tokens := r.Group("/tokens")
	{
		// ── Public read-only endpoints ──────────────────────────────────
		tokens.GET("/balance/:wallet", h.GetBalance)
		tokens.GET("/nonce/:wallet", h.GetNonce)
		tokens.GET("/supply", h.GetContractInfo)
		tokens.GET("/paused", h.GetPaused)
		tokens.GET("/vesting/:holder", h.GetVestingInfo)

		// ── Authenticated user endpoints ────────────────────────────────
		protected := tokens.Group("")
		protected.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
		{
			protected.POST("/transfer", h.Transfer, middleware.RequireKYCLevel(1, userRepo))
			protected.GET("/transactions", h.ListTransactions)
			protected.GET("/transactions/:id", h.GetTransaction)
		}

		// ── Admin-only endpoints (require JWT + admin claim) ────────────────────────────────
		admin := tokens.Group("")
		admin.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
		admin.Use(middleware.RequireRole("ADMIN"))
		{
			admin.POST("/mint", h.Mint, middleware.RequireKYCLevel(1, userRepo))
			admin.POST("/vest", h.VestTokens, middleware.RequireKYCLevel(1, userRepo))
			admin.POST("/release-vested", h.ReleaseVested, middleware.RequireKYCLevel(1, userRepo))
			admin.POST("/pause", h.PauseContract, middleware.RequireKYCLevel(1, userRepo))
			admin.POST("/unpause", h.UnpauseContract, middleware.RequireKYCLevel(1, userRepo))
		}
	}
}

// GetBalance handles the public balance lookup endpoint for any wallet address.
// It logs the request boundary, delegates the dual-layer balance calculation to the service, and returns the normalized snapshot.
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
	h.log.Info("GetBalance request", logger.String("wallet", wallet))
	balance, err := h.svc.GetBalance(c.Request.Context(), wallet)
	if err != nil {
		h.log.Error("GetBalance error", logger.Err(err), logger.String("wallet", wallet))
		apihttp.Fail(c, err)
		return
	}
	h.log.Info("GetBalance response", logger.String("wallet", wallet), logger.String("onchain", balance.OnChain))
	apihttp.OK(c, balance)
}

// Transfer handles intake of a signed token transfer request from an authenticated user.
// The handler is deliberately thin: it binds the payload, delegates validation and persistence to the service, and emits a created response.
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

// ListTransactions handles transaction-history retrieval for the wallet embedded in the caller's JWT.
// It binds pagination parameters and keeps wallet identity server-derived so clients cannot list another user's history.
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
	req, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		return
	}
	wallet := middleware.WalletAddress(c)
	log := logger.FromContext(c.Request.Context())
	log.Debug("ListTransactions handler",
		logger.String("wallet_from_jwt", wallet),
	)
	txs, total, err := h.svc.ListTransactions(c.Request.Context(), wallet, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, txs, total, req.Page, req.PageSize)
}

// GetTransaction handles lookup of one transaction by ID.
// Authorization context comes from middleware and downstream layers rather than the path itself.
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

// ─────────────────────────────────────────────
//  New public read endpoints
// ─────────────────────────────────────────────

// GetNonce handles retrieval of the on-chain nonce required to build the next EIP-712 transfer payload.
// This endpoint is public because frontends need the nonce before they can sign a transfer request client-side.
// GetNonce godoc
//
//	@Summary      Get EIP-712 nonce for a wallet
//	@Description  Returns the current on-chain nonce that must be included in the typed-data
//	@Description  message before signing a meta-transfer. Increments atomically after each
//	@Description  successful transferWithSignature call.
//	@Tags         Tokens
//	@Produce      json
//	@Param        wallet  path      string  true  "Ethereum wallet address"
//	@Success      200     {object}  models.NonceResponse
//	@Failure      400     {object}  models.ErrorResponse  "Invalid wallet address"
//	@Failure      500     {object}  models.ErrorResponse  "Blockchain call failed"
//	@Router       /tokens/nonce/{wallet} [get]
func (h *Handler) GetNonce(c *gin.Context) {
	wallet, ok := apihttp.PathParam(c, "wallet")
	if !ok {
		return
	}
	resp, err := h.svc.GetNonce(c.Request.Context(), wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// GetContractInfo handles the public token-contract summary endpoint.
// It returns supply and pause-state information used by explorer-style or admin-adjacent frontend views.
// GetContractInfo godoc
//
//	@Summary      Get contract supply information
//	@Description  Returns the current total supply, maximum supply cap, and pause state.
//	@Tags         Tokens
//	@Produce      json
//	@Success      200  {object}  models.ContractInfoResponse
//	@Failure      500  {object}  models.ErrorResponse  "Blockchain call failed"
//	@Router       /tokens/supply [get]
func (h *Handler) GetContractInfo(c *gin.Context) {
	resp, err := h.svc.GetContractInfo(c.Request.Context())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// GetPaused handles the simplified public endpoint that exposes only the current pause flag.
// It reuses the broader contract-info service call and projects the single field required by clients.
// GetPaused godoc
//
//	@Summary      Get contract pause state
//	@Description  Returns whether token transfers are currently paused on-chain.
//	@Tags         Tokens
//	@Produce      json
//	@Success      200  {object}  models.ContractInfoResponse
//	@Failure      500  {object}  models.ErrorResponse
//	@Router       /tokens/paused [get]
func (h *Handler) GetPaused(c *gin.Context) {
	resp, err := h.svc.GetContractInfo(c.Request.Context())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	paused := &struct {
		Paused bool `json:"paused"`
	}{Paused: resp.Paused}
	apihttp.OK(c, paused)
}

// GetVestingInfo handles retrieval of one holder's vesting schedule summary.
// The handler is public and read-only because vesting state can be displayed without mutating any protected resources.
// GetVestingInfo godoc
//
//	@Summary      Get vesting schedule for a holder
//	@Description  Returns the active vesting schedule (amount, release time, lock status) for
//	@Description  the specified holder. Returns zeroed fields when no schedule exists.
//	@Tags         Tokens
//	@Produce      json
//	@Param        holder  path      string  true  "Ethereum address of the token holder"
//	@Success      200     {object}  models.VestingInfoResponse
//	@Failure      400     {object}  models.ErrorResponse  "Invalid holder address"
//	@Failure      500     {object}  models.ErrorResponse  "Blockchain call failed"
//	@Router       /tokens/vesting/{holder} [get]
func (h *Handler) GetVestingInfo(c *gin.Context) {
	holder, ok := apihttp.PathParam(c, "holder")
	if !ok {
		return
	}
	resp, err := h.svc.GetVestingInfo(c.Request.Context(), holder)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// ─────────────────────────────────────────────
//  Admin write endpoints
// ─────────────────────────────────────────────

// Mint handles the admin-only mint endpoint.
// It binds the mint request body and forwards execution to the privileged token service flow.
// Mint godoc
//
//	@Summary      Mint tokens (admin only)
//	@Description  Mints new VNDC tokens to the specified address. The relayer key must hold
//	@Description  MINTER_ROLE on the contract. Total supply must not exceed MAX_SUPPLY.
//	@Tags         Tokens
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.MintRequest  true  "Mint request"
//	@Success      200   {object}  models.TxResponse
//	@Failure      400   {object}  models.ErrorResponse  "Invalid parameters"
//	@Failure      401   {object}  models.ErrorResponse  "Unauthorized"
//	@Failure      403   {object}  models.ErrorResponse  "Admin role required"
//	@Failure      500   {object}  models.ErrorResponse  "Blockchain call failed"
//	@Router       /tokens/mint [post]
func (h *Handler) Mint(c *gin.Context) {
	req, ok := apihttp.Bind[MintRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.Mint(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// VestTokens handles creation of a token vesting schedule through an admin-only endpoint.
// All schedule validation and blockchain interaction remain inside the service layer.
// VestTokens godoc
//
//	@Summary      Create a vesting schedule (admin only)
//	@Description  Locks amount tokens for holder until releaseTime. The relayer key must hold
//	@Description  DEFAULT_ADMIN_ROLE. Reverts if holder already has an active schedule.
//	@Tags         Tokens
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.VestTokensRequest  true  "Vesting request"
//	@Success      200   {object}  models.TxResponse
//	@Failure      400   {object}  models.ErrorResponse
//	@Failure      401   {object}  models.ErrorResponse
//	@Failure      403   {object}  models.ErrorResponse
//	@Failure      500   {object}  models.ErrorResponse
//	@Router       /tokens/vest [post]
func (h *Handler) VestTokens(c *gin.Context) {
	req, ok := apihttp.Bind[VestTokensRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.VestTokens(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// ReleaseVested handles the administrative request to release matured vested tokens.
// It is a transport wrapper around the corresponding contract-management service operation.
// ReleaseVested godoc
//
//	@Summary      Release vested tokens (admin only)
//	@Description  Transfers previously vested tokens to the holder after the lock period.
//	@Description  Reverts on-chain if no schedule exists or lock has not expired.
//	@Tags         Tokens
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      models.ReleaseVestedRequest  true  "Release request"
//	@Success      200   {object}  models.TxResponse
//	@Failure      400   {object}  models.ErrorResponse
//	@Failure      401   {object}  models.ErrorResponse
//	@Failure      403   {object}  models.ErrorResponse
//	@Failure      500   {object}  models.ErrorResponse
//	@Router       /tokens/release-vested [post]
func (h *Handler) ReleaseVested(c *gin.Context) {
	req, ok := apihttp.Bind[ReleaseVestedRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.ReleaseVested(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// PauseContract handles the admin operation that pauses token transfers on-chain.
// The route has no request body because the action is fully determined by authentication and contract state.
// PauseContract godoc
//
//	@Summary      Pause the token contract (admin only)
//	@Description  Halts all VNDC token transfers until unpaused. Relayer key must hold PAUSER_ROLE.
//	@Tags         Tokens
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.TxResponse
//	@Failure      400  {object}  models.ErrorResponse  "Contract already paused"
//	@Failure      401  {object}  models.ErrorResponse
//	@Failure      403  {object}  models.ErrorResponse
//	@Failure      500  {object}  models.ErrorResponse
//	@Router       /tokens/pause [post]
func (h *Handler) PauseContract(c *gin.Context) {
	resp, err := h.svc.PauseContract(c.Request.Context())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// UnpauseContract handles the admin operation that resumes token transfers on-chain.
// It mirrors PauseContract and returns the resulting transaction hash wrapper from the service layer.
// UnpauseContract godoc
//
//	@Summary      Unpause the token contract (admin only)
//	@Description  Resumes VNDC token transfers. Relayer key must hold PAUSER_ROLE.
//	@Tags         Tokens
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.TxResponse
//	@Failure      400  {object}  models.ErrorResponse  "Contract not paused"
//	@Failure      401  {object}  models.ErrorResponse
//	@Failure      403  {object}  models.ErrorResponse
//	@Failure      500  {object}  models.ErrorResponse
//	@Router       /tokens/unpause [post]
func (h *Handler) UnpauseContract(c *gin.Context) {
	resp, err := h.svc.UnpauseContract(c.Request.Context())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

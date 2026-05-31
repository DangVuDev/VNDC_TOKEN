// Package transaction implements the core application service for VNDC meta-transactions.
// This is the heart of the off-chain layer — it validates, queues, and settles transactions.
package transaction

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

// Service orchestrates submission, cancellation, balance views, and operational queries for off-chain transactions.
// It is the main application boundary coordinating signature checks, nonce rules, and balance reservation logic.
type Service struct {
	txRepo    ports.TransactionRepository
	batchRepo ports.BatchRepository
	userRepo  ports.UserRepository
	balance   ports.BalanceCachePort
	token     ports.TokenContractPort // may be nil (no settlement without contract adapter)
	domain_   blockchain.Domain       // EIP-712 domain config
	log       logger.Logger
}

// NewService constructs a Service with all required dependencies.
// Dependency injection keeps transaction orchestration decoupled from the concrete repository, cache, and contract adapters.
func NewService(
	txRepo ports.TransactionRepository,
	batchRepo ports.BatchRepository,
	userRepo ports.UserRepository,
	balance ports.BalanceCachePort,
	token ports.TokenContractPort,
	eip712Domain blockchain.Domain,
	log logger.Logger,
) *Service {
	return &Service{
		txRepo:    txRepo,
		batchRepo: batchRepo,
		userRepo:  userRepo,
		balance:   balance,
		token:     token,
		domain_:   eip712Domain,
		log:       log.Named("transaction_service"),
	}
}

// ─────────────────────────────────────────────
//  SubmitTransfer — queue a signed meta-transfer
// ─────────────────────────────────────────────

// SubmitTransfer validates the EIP-712 signature, verifies nonce and KYC rules, reserves balance, and queues the transaction.
// This is the main ingress point for user-submitted off-chain transfers before worker-side settlement begins.
func (s *Service) SubmitTransfer(ctx context.Context, req *SubmitTransferRequest) (*domain.Transaction, error) {
	log := s.log.With(
		logger.String("op", "SubmitTransfer"),
		logger.String("from", req.FromWallet),
		logger.String("to", req.ToWallet),
		logger.String("amount", req.Amount),
		logger.String("nonce", req.Nonce),
	)

	// 1. Deadline check
	if time.Now().Unix() > req.Deadline {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Transaction deadline has passed")
	}

	// 2. Parse and validate amount
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid amount: must be a positive integer (wei)")
	}

	// 3. Normalize addresses
	fromAddr := normalizeAddress(req.FromWallet)
	toAddr := normalizeAddress(req.ToWallet)
	if fromAddr == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid from_wallet address")
	}
	if toAddr == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid to_wallet address")
	}
	if fromAddr == toAddr {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Cannot transfer to self")
	}

	// 4. Verify EIP-712 signature
	sigBytes, err := blockchain.HexToBytes(req.Signature)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Malformed signature hex")
	}

	nonce, ok := new(big.Int).SetString(req.Nonce, 10)
	if !ok || nonce.Sign() < 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid nonce: must be a non-negative integer (decimal)")
	}

	fromAddrObj := common.HexToAddress(fromAddr)
	toAddrObj := common.HexToAddress(toAddr)

	transferData := blockchain.TransferData{
		From:     fromAddrObj,
		To:       toAddrObj,
		Amount:   amount,
		Nonce:    nonce,
		Deadline: big.NewInt(req.Deadline),
	}

	if err := blockchain.VerifySignature(s.domain_, transferData, sigBytes, fromAddrObj); err != nil {
		log.Warn("signature verification failed", logger.Err(err))
		return nil, apperr.ErrInvalidSignature
	}

	// 5. Verify nonce uniqueness (replay attack prevention)
	if err := s.validateNonce(ctx, fromAddr, req.Nonce); err != nil {
		return nil, err
	}

	if err := s.ensureKYCVerified(ctx, fromAddr); err != nil {
		return nil, err
	}

	// 6. Balance check: on-chain balance minus pending amounts must cover the transfer.
	// We use direct BigInt math here to avoid Lua tonumber() precision loss on large wei amounts.
	onChainBalance := big.NewInt(0)
	if s.token != nil {
		balStr, balErr := s.token.BalanceOf(ctx, fromAddr)
		if balErr != nil {
			log.Error("failed to fetch on-chain balance", logger.Err(balErr))
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Failed to fetch balance", balErr)
		}
		if b, ok2 := new(big.Int).SetString(balStr, 10); ok2 {
			onChainBalance = b
		}
		log.Debug("on-chain balance fetched", logger.String("wallet", fromAddr), logger.String("balance", onChainBalance.String()))
	}

	pendingAmount, pendingErr := s.computePendingAmount(ctx, fromAddr)
	if pendingErr != nil {
		log.Warn("could not sum pending amounts, treating as 0", logger.Err(pendingErr))
		pendingAmount = big.NewInt(0)
	}

	available := new(big.Int).Sub(onChainBalance, pendingAmount)
	if available.Sign() < 0 {
		available = big.NewInt(0)
	}

	log.Debug("balance check",
		logger.String("on_chain", onChainBalance.String()),
		logger.String("pending", pendingAmount.String()),
		logger.String("available", available.String()),
		logger.String("required", amount.String()),
	)

	if available.Cmp(amount) < 0 {
		return nil, apperr.ErrInsufficientBalance
	}

	// Update the balance cache with the computed values (best-effort; failures are non-fatal)
	_ = s.balance.Set(ctx, fromAddr, &ports.BalanceSnapshot{
		OnChain:   onChainBalance.String(),
		Pending:   new(big.Int).Add(pendingAmount, amount).String(), // include this tx
		Available: new(big.Int).Sub(available, amount).String(),     // subtract this tx
		SyncedAt:  time.Now().UTC(),
	})

	// 7. Persist the queued transaction
	txType := domain.TxTypeTokenTransfer
	if req.Type == string(domain.TxTypeFundContribution) {
		txType = domain.TxTypeFundContribution
	} else if req.Type == string(domain.TxTypeMarketplaceBuy) {
		txType = domain.TxTypeMarketplaceBuy
	} else if req.Type == string(domain.TxTypeServiceTicketBuy) {
		txType = domain.TxTypeServiceTicketBuy
	}

	tx := &domain.Transaction{
		BaseEntity:  domain.BaseEntity{ID: uuid.NewString()},
		Type:        txType,
		Status:      domain.TxStatusPending,
		FromWallet:  fromAddr,
		ToWallet:    toAddr,
		Amount:      req.Amount,
		Nonce:       req.Nonce,
		Deadline:    req.Deadline,
		Signature:   req.Signature,
		ContextType: strings.TrimSpace(req.ContextType),
		ContextID:   strings.TrimSpace(req.ContextID),
		ContextRef:  strings.TrimSpace(req.ContextRef),
	}

	if err := s.txRepo.Create(ctx, tx); err != nil {
		return nil, err
	}

	log.Info("transaction queued", logger.String("tx_id", tx.ID))
	return tx, nil
}

// ─────────────────────────────────────────────
//  GetTransaction — fetch by ID
// ─────────────────────────────────────────────

// GetTransaction retrieves a single transaction by its ID.
// It is the basic read path for transaction detail screens and reconciliation tooling.
func (s *Service) GetTransaction(ctx context.Context, id string) (*domain.Transaction, error) {
	tx, err := s.txRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return tx, nil
}

// ─────────────────────────────────────────────
//  ListTransactions — paginated wallet history
// ─────────────────────────────────────────────

// ListTransactions returns paginated transaction history for a wallet across both sent and received activity.
// This powers wallet history views and related support or audit investigations.
func (s *Service) ListTransactions(ctx context.Context, wallet string, pageReq pagination.Request) ([]*domain.Transaction, int64, error) {
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
	}
	txs, total, err := s.txRepo.FindByWallet(ctx, wallet, opts...)
	if err != nil {
		return nil, 0, err
	}
	return txs, total, nil
}

// ─────────────────────────────────────────────
//  CancelTransaction — cancel a PENDING transaction
// ─────────────────────────────────────────────

// CancelTransaction cancels a pending or queued transaction and releases the reserved balance.
// Only the sender may perform this action, and only while the transaction has not yet reached final processing.
func (s *Service) CancelTransaction(ctx context.Context, id string, callerWallet string) (*domain.Transaction, error) {
	tx, err := s.txRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Authorization: only the sender can cancel
	if !strings.EqualFold(tx.FromWallet, callerWallet) {
		return nil, apperr.ErrForbidden
	}

	// Only PENDING transactions can be cancelled
	if tx.Status != domain.TxStatusPending && tx.Status != domain.TxStatusQueued {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Only pending transactions can be cancelled")
	}

	tx.Status = domain.TxStatusRolledBack
	tx.LastError = "Cancelled by user"
	updates := map[string]interface{}{
		"status":     tx.Status,
		"last_error": tx.LastError,
	}
	if err := s.txRepo.Update(ctx, tx.ID, updates); err != nil {
		return nil, err
	}

	// Release the reserved balance
	_ = s.balance.Rollback(ctx, tx.FromWallet, tx.Amount)

	s.log.Info("transaction cancelled",
		logger.String("tx_id", id),
		logger.String("wallet", callerWallet),
	)
	return tx, nil
}

// ensureKYCVerified blocks transaction flows for wallets whose user record is missing or not KYC-verified.
// This keeps regulated transfer actions aligned with compliance requirements at the application layer.
func (s *Service) ensureKYCVerified(ctx context.Context, wallet string) error {
	if s.userRepo == nil {
		return apperr.New(apperr.ErrCodeInternal, "user repository not initialised")
	}
	user, err := s.userRepo.FindByWallet(ctx, wallet)
	if err != nil || user == nil || !user.IsKYCVerified() {
		return apperr.New(apperr.ErrCodeForbidden, "KYC verification is required for token transfer activities")
	}
	return nil
}

// ─────────────────────────────────────────────
//  GetStats — admin transaction statistics
// ─────────────────────────────────────────────

// GetStats returns transaction counts grouped by status.
// It provides a compact operational snapshot for dashboards and admin monitoring.
func (s *Service) GetStats(ctx context.Context) (*TransactionStatsResponse, error) {
	pending, err := s.txRepo.CountByStatus(ctx, domain.TxStatusPending)
	if err != nil {
		return nil, err
	}
	processing, err := s.txRepo.CountByStatus(ctx, domain.TxStatusProcessing)
	if err != nil {
		return nil, err
	}
	success, err := s.txRepo.CountByStatus(ctx, domain.TxStatusSuccess)
	if err != nil {
		return nil, err
	}
	failed, err := s.txRepo.CountByStatus(ctx, domain.TxStatusFailed)
	if err != nil {
		return nil, err
	}

	return &TransactionStatsResponse{
		Pending:    pending,
		Processing: processing,
		Success:    success,
		Failed:     failed,
	}, nil
}

// ─────────────────────────────────────────────
//  GetBalance — dual-layer balance for a wallet
// ─────────────────────────────────────────────

// BalanceResponse contains the dual-layer balance breakdown.
type BalanceResponse struct {
	Wallet    string    `json:"wallet"`
	OnChain   string    `json:"on_chain"`
	Pending   string    `json:"pending"`
	Available string    `json:"available"`
	SyncedAt  time.Time `json:"synced_at"`
}

// GetBalance returns the dual-layer balance view for a wallet, combining on-chain state with off-chain pending reservations.
// It first consults the cache and falls back to chain reads when necessary.
func (s *Service) GetBalance(ctx context.Context, wallet string) (*BalanceResponse, error) {
	normalised := normalizeAddress(wallet)
	if normalised == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid wallet address")
	}

	snapshot, err := s.balance.Get(ctx, normalised)
	if err != nil {
		// Cache miss — fetch from chain if we have a contract adapter
		if s.token == nil {
			return &BalanceResponse{
				Wallet:    normalised,
				OnChain:   "0",
				Pending:   "0",
				Available: "0",
				SyncedAt:  time.Now().UTC(),
			}, nil
		}
		onChain, chainErr := s.token.BalanceOf(ctx, normalised)
		if chainErr != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "BalanceOf failed", chainErr)
		}
		snap := &ports.BalanceSnapshot{
			OnChain:   onChain,
			Pending:   "0",
			Available: onChain,
			SyncedAt:  time.Now().UTC(),
		}
		_ = s.balance.Set(ctx, normalised, snap)
		return &BalanceResponse{
			Wallet:    normalised,
			OnChain:   onChain,
			Pending:   "0",
			Available: onChain,
			SyncedAt:  snap.SyncedAt,
		}, nil
	}

	return &BalanceResponse{
		Wallet:    normalised,
		OnChain:   snapshot.OnChain,
		Pending:   snapshot.Pending,
		Available: snapshot.Available,
		SyncedAt:  snapshot.SyncedAt,
	}, nil
}

// ─────────────────────────────────────────────
//  SyncBalance — force sync wallet balance from chain
// ─────────────────────────────────────────────

// SyncBalance invalidates the cached balance snapshot and forces the next balance read to refresh from chain.
// This is useful after settlement, reconciliation, or support actions that may have left the cache stale.
func (s *Service) SyncBalance(ctx context.Context, wallet string) (*BalanceResponse, error) {
	normalised := normalizeAddress(wallet)
	if normalised == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid wallet address")
	}
	_ = s.balance.Invalidate(ctx, normalised)
	return s.GetBalance(ctx, normalised)
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

// computePendingAmount returns the total wei amount locked in pending, queued, or processing
// transactions sent from the given wallet.
// The result is used to derive the off-chain available balance seen by submission and balance-view flows.
func (s *Service) computePendingAmount(ctx context.Context, wallet string) (*big.Int, error) {
	total := big.NewInt(0)
	for _, status := range []domain.TransactionStatus{
		domain.TxStatusPending, domain.TxStatusQueued, domain.TxStatusProcessing,
	} {
		txs, err := s.txRepo.FindByStatus(ctx, status, 1000)
		if err != nil {
			continue
		}
		for _, tx := range txs {
			if !strings.EqualFold(tx.FromWallet, wallet) {
				continue
			}
			amt, ok := new(big.Int).SetString(tx.Amount, 10)
			if ok && amt.Sign() > 0 {
				total.Add(total, amt)
			}
		}
	}
	return total, nil
}

// validateNonce checks whether the submitted nonce is already attached to an active transaction for the wallet.
// This prevents replay and duplicate in-flight submissions before worker settlement occurs.
func (s *Service) validateNonce(ctx context.Context, wallet, nonce string) error {
	hasActive, err := s.txRepo.HasActiveNonce(ctx, wallet, nonce)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "nonce check failed", err)
	}
	if hasActive {
		return apperr.New(apperr.ErrCodeInvalidNonce,
			"nonce "+nonce+" is already in use by an active transaction")
	}
	return nil
}

// normalizeAddress lowercases and trims an Ethereum address and rejects values that do not match the expected shape.
// It provides a minimal canonical form used throughout transaction validation and querying.
func normalizeAddress(addr string) string {
	lower := strings.ToLower(strings.TrimSpace(addr))
	if !strings.HasPrefix(lower, "0x") || len(lower) != 42 {
		return ""
	}
	return lower
}

// Package token implements ERC-20 token operations: balance queries,
// meta-transaction submission (EIP-712 signed transfers), and transaction history.
package token

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
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

// Service orchestrates all token operations.
type Service struct {
	txRepo   ports.TransactionRepository
	userRepo ports.UserRepository
	balance  ports.BalanceCachePort
	token    ports.TokenContractPort
	domain_  blockchain.Domain // EIP-712 domain config
	log      logger.Logger
}

// NewService constructs the token Service.
func NewService(
	txRepo ports.TransactionRepository,
	userRepo ports.UserRepository,
	balance ports.BalanceCachePort,
	token ports.TokenContractPort,
	eip712Domain blockchain.Domain,
	log logger.Logger,
) *Service {
	return &Service{
		txRepo:   txRepo,
		userRepo: userRepo,
		balance:  balance,
		token:    token,
		domain_:  eip712Domain,
		log:      log.Named("token_service"),
	}
}

// ─────────────────────────────────────────────
//  GetBalance
// ─────────────────────────────────────────────

// GetBalance returns the dual-layer balance for a wallet.
// Reads from cache first; on miss, fetches from chain.
func (s *Service) GetBalance(ctx context.Context, wallet string) (*BalanceResponse, error) {
	wallet = normalizeAddress(wallet)
	if wallet == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid wallet address")
	}

	snapshot, err := s.balance.Get(ctx, wallet)
	if err == nil && snapshot != nil {
		return snapshotToBalance(wallet, snapshot), nil
	}

	// Cache miss — fetch from chain.
	if s.token == nil {
		// No on-chain client configured; return zero balance from DB pending only.
		return snapshotToBalance(wallet, &ports.BalanceSnapshot{
			OnChain:   "0",
			Pending:   s.pendingAmount(ctx, wallet),
			Available: "0",
			SyncedAt:  time.Now(),
		}), nil
	}
	onChain, err := s.token.BalanceOf(ctx, wallet)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "BalanceOf failed", err)
	}

	// Count pending wei in DB.
	pending := s.pendingAmount(ctx, wallet)

	onChainBig, _ := new(big.Int).SetString(onChain, 10)
	pendingBig, _ := new(big.Int).SetString(pending, 10)
	available := new(big.Int).Sub(onChainBig, pendingBig)
	if available.Sign() < 0 {
		available = big.NewInt(0)
	}

	snap := &ports.BalanceSnapshot{
		OnChain:   onChain,
		Pending:   pendingBig.String(),
		Available: available.String(),
		SyncedAt:  time.Now(),
	}
	_ = s.balance.Set(ctx, wallet, snap)

	return snapshotToBalance(wallet, snap), nil
}

// ─────────────────────────────────────────────
//  Transfer — submit EIP-712 meta-transaction
// ─────────────────────────────────────────────

// Transfer validates the EIP-712 signature, reserves balance atomically,
// and queues the transaction for on-chain settlement by the relayer worker.
func (s *Service) Transfer(ctx context.Context, req *TransferRequest) (*domain.Transaction, error) {
	log := logger.FromContext(ctx).With(
		logger.String("op", "Transfer"),
		logger.String("from", req.FromWallet),
		logger.String("to", req.ToWallet),
	)

	// ── 1. Deadline guard ────────────────────────────────────────────────
	if time.Now().Unix() > req.Deadline {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Transaction deadline has passed")
	}

	// ── 2. Parse amount ──────────────────────────────────────────────────
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Amount must be a positive integer (wei)")
	}

	// ── 3. Verify EIP-712 signature ─────────────────────────────────────
	sigBytes, err := hexToBytes(req.Signature)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Malformed signature hex")
	}

	nonce, ok2 := new(big.Int).SetString(req.Nonce, 10)
	if !ok2 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Nonce must be a decimal integer")
	}

	transferData := blockchain.TransferData{
		From:     common.HexToAddress(req.FromWallet),
		To:       common.HexToAddress(req.ToWallet),
		Amount:   amount,
		Nonce:    nonce,
		Deadline: big.NewInt(req.Deadline),
	}
	if err := blockchain.VerifySignature(s.domain_, transferData, sigBytes, common.HexToAddress(req.FromWallet)); err != nil {
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Signature verification failed")
	}

	// ── 4. Duplicate nonce check ─────────────────────────────────────────
	if err := s.checkNonce(ctx, req.FromWallet, req.Nonce); err != nil {
		return nil, err
	}

	// ── 5. Atomic balance reservation ───────────────────────────────────
	reserved, err := s.balance.CheckAndReserve(ctx, req.FromWallet, req.Amount)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Balance reservation failed", err)
	}
	if !reserved {
		return nil, apperr.New(apperr.ErrCodeInsufficientBalance, "Insufficient available balance")
	}

	// ── 6. Persist transaction ───────────────────────────────────────────
	tx := &domain.Transaction{
		BaseEntity: domain.BaseEntity{ID: uuid.NewString()},
		Type:       domain.TxTypeTokenTransfer,
		Status:     domain.TxStatusPending,
		FromWallet: normalizeAddress(req.FromWallet),
		ToWallet:   normalizeAddress(req.ToWallet),
		Amount:     req.Amount,
		Nonce:      req.Nonce,
		Deadline:   req.Deadline,
		Signature:  req.Signature,
	}
	if createErr := s.txRepo.Create(ctx, tx); createErr != nil {
		// Rollback reserved balance.
		_ = s.balance.Rollback(ctx, req.FromWallet, req.Amount)
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "Persist transaction failed", createErr)
	}

	log.Info("transfer queued", logger.String("tx_id", tx.ID), logger.String("amount", req.Amount))
	return tx, nil
}

// ─────────────────────────────────────────────
//  Transaction queries
// ─────────────────────────────────────────────

// GetTransaction returns a single transaction by ID.
// Users can only retrieve their own transactions (enforced by the handler).
func (s *Service) GetTransaction(ctx context.Context, txID string) (*domain.Transaction, error) {
	tx, err := s.txRepo.FindByID(ctx, txID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	return tx, nil
}

// ListTransactions returns a paginated list of transactions for a wallet.
func (s *Service) ListTransactions(ctx context.Context, wallet string, page *pagination.Request) ([]*domain.Transaction, int64, error) {
	page.Normalize()
	wallet = normalizeAddress(wallet)
	txs, total, err := s.txRepo.FindByWallet(ctx, wallet)
	if err != nil {
		return nil, 0, err
	}
	// Apply pagination manually (repository returns all for this wallet).
	start := int64((page.Page - 1) * page.PageSize)
	end := start + int64(page.PageSize)
	if start >= total {
		return []*domain.Transaction{}, total, nil
	}
	if end > total {
		end = total
	}
	return txs[start:end], total, nil
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

// pendingAmount sums unconfirmed (PENDING/QUEUED/PROCESSING) amounts for a wallet.
func (s *Service) pendingAmount(ctx context.Context, wallet string) string {
	statuses := []domain.TransactionStatus{
		domain.TxStatusPending, domain.TxStatusQueued, domain.TxStatusProcessing,
	}
	total := big.NewInt(0)
	for _, status := range statuses {
		txs, _ := s.txRepo.FindByStatus(ctx, status, 1000)
		for _, tx := range txs {
			if !strings.EqualFold(tx.FromWallet, wallet) {
				continue
			}
			amt, ok := new(big.Int).SetString(tx.Amount, 10)
			if ok {
				total.Add(total, amt)
			}
		}
	}
	return total.String()
}

// checkNonce rejects duplicate nonces for a given wallet.
func (s *Service) checkNonce(ctx context.Context, wallet, nonce string) error {
	txs, _, err := s.txRepo.FindByWallet(ctx, wallet)
	if err != nil {
		return nil // non-fatal — don't block submission on DB error
	}
	for _, tx := range txs {
		if tx.Nonce == nonce && !tx.IsTerminal() {
			return apperr.New(apperr.ErrCodeConflict, "Nonce already used by a pending transaction")
		}
	}
	return nil
}

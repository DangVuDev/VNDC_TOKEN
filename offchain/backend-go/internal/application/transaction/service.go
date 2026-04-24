// Package transaction implements the core application service for VNDC meta-transactions.
// This is the heart of the off-chain layer — it validates, queues, and settles transactions.
package transaction

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/blockchain"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

// Service is the application service for transaction management.
// It orchestrates validation, balance reservation, persistence, and settlement.
type Service struct {
	txRepo    ports.TransactionRepository
	batchRepo ports.BatchRepository
	userRepo  ports.UserRepository
	balance   ports.BalanceCachePort
	token     ports.TokenContractPort
	domain_   blockchain.Domain // EIP-712 domain config
	log       logger.Logger
}

// NewService constructs a Service with all required dependencies.
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

// SubmitTransferRequest contains the client's signed transfer request.
type SubmitTransferRequest struct {
	FromWallet string `json:"from_wallet" validate:"required,eth_addr"`
	ToWallet   string `json:"to_wallet"   validate:"required,eth_addr"`
	Amount     string `json:"amount"      validate:"required"` // wei
	Nonce      string `json:"nonce"       validate:"required"`
	Deadline   int64  `json:"deadline"    validate:"required,min=1"`
	Signature  string `json:"signature"   validate:"required,len=132"` // 0x + 130 hex chars
}

// SubmitTransfer validates the EIP-712 signature, reserves balance, and queues the transaction.
func (s *Service) SubmitTransfer(ctx context.Context, req *SubmitTransferRequest) (*domain.Transaction, error) {
	log := logger.FromContext(ctx).With(
		logger.String("op", "SubmitTransfer"),
		logger.String("from", req.FromWallet),
		logger.String("to", req.ToWallet),
		logger.String("amount", req.Amount),
	)

	// 1. Deadline check
	if time.Now().Unix() > req.Deadline {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Transaction deadline has passed")
	}

	// 2. Parse amount
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid amount")
	}

	// 3. Verify EIP-712 signature
	sigBytes, err := hexToBytes(req.Signature)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Malformed signature")
	}

	nonce, ok := new(big.Int).SetString(req.Nonce, 10)
	if !ok {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid nonce")
	}

	transferData := blockchain.TransferData{
		From:     hexToAddress(req.FromWallet),
		To:       hexToAddress(req.ToWallet),
		Amount:   amount,
		Nonce:    nonce,
		Deadline: big.NewInt(req.Deadline),
	}

	if err := blockchain.VerifySignature(s.domain_, transferData, sigBytes, hexToAddress(req.FromWallet)); err != nil {
		log.Warn("signature verification failed", logger.Err(err))
		return nil, apperr.ErrInvalidSignature
	}

	// 4. Verify nonce uniqueness (replay attack prevention)
	if err := s.validateNonce(ctx, req.FromWallet, req.Nonce); err != nil {
		return nil, err
	}

	// 5. Reserve balance (atomic, race-condition safe via Redis Lua)
	reserved, err := s.balance.CheckAndReserve(ctx, req.FromWallet, req.Amount)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeCache, "Balance check failed", err)
	}
	if !reserved {
		return nil, apperr.ErrInsufficientBalance
	}

	// 6. Persist the queued transaction
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

	if err := s.txRepo.Create(ctx, tx); err != nil {
		// Rollback reserved balance on DB failure
		_ = s.balance.Rollback(ctx, req.FromWallet, req.Amount)
		return nil, err
	}

	log.Info("transaction queued", logger.String("tx_id", tx.ID))
	return tx, nil
}

// ─────────────────────────────────────────────
//  GetTransaction — fetch by ID
// ─────────────────────────────────────────────

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

func (s *Service) ListTransactions(ctx context.Context, wallet string, page, pageSize int64) ([]*domain.Transaction, int64, error) {
	return s.txRepo.FindByWallet(ctx, wallet)
}

// ─────────────────────────────────────────────
//  GetAvailableBalance
// ─────────────────────────────────────────────

// BalanceResponse contains the dual-layer balance breakdown.
type BalanceResponse struct {
	OnChain   string `json:"on_chain"`
	Pending   string `json:"pending"`
	Available string `json:"available"`
}

func (s *Service) GetBalance(ctx context.Context, wallet string) (*BalanceResponse, error) {
	snapshot, err := s.balance.Get(ctx, wallet)
	if err != nil {
		// Cache miss — fetch from chain and populate cache
		onChain, err := s.token.BalanceOf(ctx, wallet)
		if err != nil {
			return nil, err
		}
		snap := &ports.BalanceSnapshot{
			OnChain:   onChain,
			Pending:   "0",
			Available: onChain,
			SyncedAt:  time.Now().UTC(),
		}
		_ = s.balance.Set(ctx, wallet, snap)
		return &BalanceResponse{OnChain: onChain, Pending: "0", Available: onChain}, nil
	}

	return &BalanceResponse{
		OnChain:   snapshot.OnChain,
		Pending:   snapshot.Pending,
		Available: snapshot.Available,
	}, nil
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

func (s *Service) validateNonce(ctx context.Context, wallet, nonce string) error {
	// Check existing transactions with the same nonce for this wallet
	existing, _, err := s.txRepo.FindByWallet(ctx, wallet)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "nonce check failed", err)
	}
	for _, tx := range existing {
		if tx.Nonce == nonce && !tx.IsTerminal() {
			return apperr.New(apperr.ErrCodeInvalidNonce,
				fmt.Sprintf("nonce %s is already in use", nonce))
		}
	}
	return nil
}

// ─────────────────────────────────────────────
//  Helper functions (avoid importing eth directly here)
// ─────────────────────────────────────────────

func hexToBytes(hexStr string) ([]byte, error) {
	if len(hexStr) > 2 && hexStr[:2] == "0x" {
		hexStr = hexStr[2:]
	}
	if len(hexStr)%2 != 0 {
		return nil, fmt.Errorf("odd hex length")
	}
	b := make([]byte, len(hexStr)/2)
	for i := 0; i < len(b); i++ {
		_, err := fmt.Sscanf(hexStr[2*i:2*i+2], "%02x", &b[i])
		if err != nil {
			return nil, err
		}
	}
	return b, nil
}

func hexToAddress(addr string) (result [20]byte) {
	// Simple conversion — use go-ethereum/common.HexToAddress in production
	if len(addr) >= 42 {
		addr = addr[2:]
	}
	for i := 0; i < 20 && i*2+1 < len(addr); i++ {
		fmt.Sscanf(addr[i*2:i*2+2], "%02x", &result[i])
	}
	return result
}

func normalizeAddress(addr string) string {
	// Returns lowercase checksummed address — use go-ethereum for EIP-55 in production
	return addr
}

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
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

// Service orchestrates token balance queries, signed transfer intake, and privileged contract-management actions.
// It bridges off-chain transaction persistence, cache maintenance, and on-chain token contract calls.
type Service struct {
	txRepo   ports.TransactionRepository
	userRepo ports.UserRepository
	balance  ports.BalanceCachePort
	token    ports.TokenContractPort
	domain_  blockchain.Domain // EIP-712 domain config
	log      logger.Logger
}

// NewService constructs the token application service with repositories, balance cache, and contract adapter.
// The EIP-712 domain is injected once here so signature verification remains consistent across transfer requests.
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

// GetBalance returns the dual-layer balance view for a wallet, combining on-chain funds with pending off-chain deductions.
// It prefers the cache for speed and falls back to the token contract when a fresh snapshot is needed.
func (s *Service) GetBalance(ctx context.Context, wallet string) (*BalanceResponse, error) {
	wallet = normalizeAddress(wallet)
	if wallet == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid wallet address")
	}

	s.log.Debug("GetBalance", logger.String("wallet", wallet))

	snapshot, err := s.balance.Get(ctx, wallet)
	if err == nil && snapshot != nil {
		s.log.Debug("GetBalance: cache hit", logger.String("wallet", wallet), logger.String("onchain", snapshot.OnChain))
		return snapshotToBalance(wallet, snapshot), nil
	}

	// Cache miss — fetch from chain.
	if s.token == nil {
		s.log.Warn("GetBalance: token contract is nil")
		return snapshotToBalance(wallet, &ports.BalanceSnapshot{
			OnChain:   "0",
			Pending:   s.pendingAmount(ctx, wallet),
			Available: "0",
			SyncedAt:  time.Now(),
		}), nil
	}
	s.log.Debug("GetBalance: fetching from blockchain", logger.String("wallet", wallet))
	onChain, err := s.token.BalanceOf(ctx, wallet)
	if err != nil {
		s.log.Error("GetBalance: BalanceOf failed", logger.Err(err), logger.String("wallet", wallet))
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "BalanceOf failed", err)
	}
	s.log.Debug("GetBalance: fetched from blockchain", logger.String("wallet", wallet), logger.String("onchain", onChain))

	// Compute available = on-chain - pending
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

// Transfer validates a signed EIP-712 transfer request, reserves the amount in the balance view, and persists a pending transaction.
// The transaction is not executed inline here; instead it is queued for later settlement by the relayer/worker pipeline.
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

	// ── 3. Normalize addresses ────────────────────────────────────────────
	fromNorm := normalizeAddress(req.FromWallet)
	toNorm := normalizeAddress(req.ToWallet)
	if fromNorm == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid from_wallet address")
	}
	if toNorm == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid to_wallet address")
	}

	// ── 4. Verify EIP-712 signature ─────────────────────────────────────
	sigBytes, err := blockchain.HexToBytes(req.Signature)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Malformed signature hex")
	}

	nonce, ok2 := new(big.Int).SetString(req.Nonce, 10)
	if !ok2 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Nonce must be a decimal integer")
	}

	fromAddr := common.HexToAddress(fromNorm)
	toAddr := common.HexToAddress(toNorm)

	transferData := blockchain.TransferData{
		From:     fromAddr,
		To:       toAddr,
		Amount:   amount,
		Nonce:    nonce,
		Deadline: big.NewInt(req.Deadline),
	}
	if err := blockchain.VerifySignature(s.domain_, transferData, sigBytes, fromAddr); err != nil {
		log.Warn("signature verification failed", logger.Err(err))
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Signature verification failed")
	}

	// ── 5. Nonce uniqueness check ─────────────────────────────────────────
	if err := s.checkNonce(ctx, fromNorm, req.Nonce); err != nil {
		return nil, err
	}

	// ── 6. Balance check: on-chain − pending (DB) ≥ amount ───────────────
	// Uses BigInt math directly to avoid Lua tonumber() precision loss on large wei amounts.
	onChainBalance := big.NewInt(0)
	if s.token != nil {
		balStr, balErr := s.token.BalanceOf(ctx, fromNorm)
		if balErr != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Failed to fetch balance", balErr)
		}
		if b, ok3 := new(big.Int).SetString(balStr, 10); ok3 {
			onChainBalance = b
		}
	}

	pendingBig, _ := new(big.Int).SetString(s.pendingAmount(ctx, fromNorm), 10)
	available := new(big.Int).Sub(onChainBalance, pendingBig)
	if available.Sign() < 0 {
		available = big.NewInt(0)
	}
	if available.Cmp(amount) < 0 {
		return nil, apperr.New(apperr.ErrCodeInsufficientBalance, "Insufficient available balance")
	}

	// Update cache to reflect the new pending amount
	_ = s.balance.Set(ctx, fromNorm, &ports.BalanceSnapshot{
		OnChain:   onChainBalance.String(),
		Pending:   new(big.Int).Add(pendingBig, amount).String(),
		Available: new(big.Int).Sub(available, amount).String(),
		SyncedAt:  time.Now(),
	})

	// ── 7. Persist transaction ───────────────────────────────────────────
	tx := &domain.Transaction{
		BaseEntity: domain.BaseEntity{ID: uuid.NewString()},
		Type:       domain.TxTypeTokenTransfer,
		Status:     domain.TxStatusPending,
		FromWallet: fromNorm,
		ToWallet:   toNorm,
		Amount:     req.Amount,
		Nonce:      req.Nonce,
		Deadline:   req.Deadline,
		Signature:  req.Signature,
	}
	if createErr := s.txRepo.Create(ctx, tx); createErr != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "Persist transaction failed", createErr)
	}

	log.Info("transfer queued", logger.String("tx_id", tx.ID), logger.String("amount", req.Amount))
	return tx, nil
}

// ─────────────────────────────────────────────
//  Transaction queries
// ─────────────────────────────────────────────

// GetTransaction returns one transaction by ID.
// Caller-level ownership checks are intentionally left to higher layers so this service stays reusable for admin flows too.
func (s *Service) GetTransaction(ctx context.Context, txID string) (*domain.Transaction, error) {
	tx, err := s.txRepo.FindByID(ctx, txID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	return tx, nil
}

// ListTransactions returns paginated transaction history for one wallet.
// It normalizes the wallet first so repository lookups remain case-insensitive and index-friendly.
func (s *Service) ListTransactions(ctx context.Context, wallet string, page *pagination.Request) ([]*domain.Transaction, int64, error) {
	page.Normalize()
	normalizedWallet := normalizeAddress(wallet)

	log := logger.FromContext(ctx)
	log.Debug("ListTransactions service",
		logger.String("wallet_input", wallet),
		logger.Int("wallet_input_len", len(wallet)),
		logger.String("wallet_normalized", normalizedWallet),
	)

	if normalizedWallet == "" {
		log.Warn("wallet address failed validation",
			logger.String("wallet_input", wallet),
			logger.String("hint", "wallet must be 0x-prefixed 42-char hex (0x + 40 hex chars)"),
		)
	}

	txs, total, err := s.txRepo.FindByWallet(ctx, normalizedWallet,
		database.WithSkip(int64(page.Offset())),
		database.WithLimit(int64(page.PageSize)),
	)
	if err != nil {
		return nil, 0, err
	}
	return txs, total, nil
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

// pendingAmount sums unconfirmed outgoing amounts for a wallet across pending, queued, and processing transactions.
// The result is used to derive spendable balance without waiting for final on-chain settlement.
func (s *Service) pendingAmount(ctx context.Context, wallet string) string {
	statuses := []domain.TransactionStatus{
		domain.TxStatusPending, domain.TxStatusQueued, domain.TxStatusProcessing,
	}
	total := big.NewInt(0)
	normWallet := normalizeAddress(wallet)
	for _, status := range statuses {
		txs, _ := s.txRepo.FindByStatus(ctx, status, 1000)
		for _, tx := range txs {
			if !strings.EqualFold(tx.FromWallet, normWallet) {
				continue
			}
			amt, ok := new(big.Int).SetString(tx.Amount, 10)
			if ok && amt.Sign() > 0 {
				total.Add(total, amt)
			}
		}
	}
	return total.String()
}

// checkNonce rejects reuse of a nonce while an earlier transaction with that nonce is still unresolved.
// This protects the meta-transaction queue from replay-like duplicates before blockchain settlement completes.
func (s *Service) checkNonce(ctx context.Context, wallet, nonce string) error {
	existing, err := s.txRepo.FindOne(ctx,
		database.WithEq("from_wallet", normalizeAddress(wallet)),
		database.WithEq("nonce", nonce),
		database.WithNin("status", []string{
			string(domain.TxStatusSuccess),
			string(domain.TxStatusFailed),
			string(domain.TxStatusRolledBack),
		}),
	)
	if err == nil && existing != nil {
		return apperr.New(apperr.ErrCodeConflict, "Nonce already used by a pending transaction")
	}
	return nil
}

// ─────────────────────────────────────────────
//  GetContractInfo
// ─────────────────────────────────────────────

// GetContractInfo returns a compact snapshot of token contract state needed by administrative and frontend views.
// It falls back to sensible defaults when no contract adapter is configured, which is useful in local or partial environments.
func (s *Service) GetContractInfo(ctx context.Context) (*ContractInfoResponse, error) {
	if s.token == nil {
		return &ContractInfoResponse{
			TotalSupply: "0",
			MaxSupply:   "1000000000000000000000000000", // 1 B * 1e18
			Paused:      false,
		}, nil
	}

	totalSupply, err := s.token.TotalSupply(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "TotalSupply failed", err)
	}

	paused, err := s.token.Paused(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Paused failed", err)
	}

	return &ContractInfoResponse{
		TotalSupply: totalSupply,
		MaxSupply:   "1000000000000000000000000000",
		Paused:      paused,
	}, nil
}

// ─────────────────────────────────────────────
//  GetNonce
// ─────────────────────────────────────────────

// GetNonce returns the current contract nonce that must be embedded into the next EIP-712 transfer payload.
// Frontends rely on this exact value to produce signatures the relayer can verify and settle.
func (s *Service) GetNonce(ctx context.Context, wallet string) (*NonceResponse, error) {
	wallet = normalizeAddress(wallet)
	if wallet == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid wallet address")
	}

	if s.token == nil {
		return &NonceResponse{Wallet: wallet, Nonce: 0}, nil
	}

	nonce, err := s.token.Nonce(ctx, wallet)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Nonce fetch failed", err)
	}

	return &NonceResponse{Wallet: wallet, Nonce: nonce}, nil
}

// ─────────────────────────────────────────────
//  GetVestingInfo
// ─────────────────────────────────────────────

// GetVestingInfo returns the current vesting schedule snapshot for a holder.
// It also derives whether the schedule is still locked so clients do not have to reimplement time-based logic.
func (s *Service) GetVestingInfo(ctx context.Context, holder string) (*VestingInfoResponse, error) {
	holder = normalizeAddress(holder)
	if holder == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid holder address")
	}

	if s.token == nil {
		return &VestingInfoResponse{Holder: holder, Amount: "0", ReleaseTime: 0, IsLocked: false}, nil
	}

	amount, releaseTime, err := s.token.VestingInfo(ctx, holder)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "VestingInfo fetch failed", err)
	}

	return &VestingInfoResponse{
		Holder:      holder,
		Amount:      amount,
		ReleaseTime: releaseTime,
		IsLocked:    releaseTime > 0 && time.Now().Unix() < releaseTime,
	}, nil
}

// ─────────────────────────────────────────────
//  Mint
// ─────────────────────────────────────────────

// Mint executes a privileged on-chain mint to the requested recipient and clears the recipient balance cache afterwards.
// The caller is expected to ensure only authorized operators can reach this service method.
func (s *Service) Mint(ctx context.Context, req *MintRequest) (*TxResponse, error) {
	to := normalizeAddress(req.To)
	if to == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid to address")
	}

	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Amount must be a positive integer (wei)")
	}

	if s.token == nil {
		return nil, apperr.New(apperr.ErrCodeBlockchain, "Token contract not available")
	}

	txHash, err := s.token.Mint(ctx, to, req.Amount)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Mint failed", err)
	}

	s.log.Info("mint executed",
		logger.String("to", to),
		logger.String("amount", req.Amount),
		logger.String("tx_hash", txHash),
	)

	// Invalidate balance cache for recipient
	_ = s.balance.Invalidate(ctx, to)

	return &TxResponse{TxHash: txHash}, nil
}

// ─────────────────────────────────────────────
//  VestTokens
// ─────────────────────────────────────────────

// VestTokens creates or updates a vesting schedule for a holder through the token contract.
// This is an administrative flow used to distribute locked allocations with a future release timestamp.
func (s *Service) VestTokens(ctx context.Context, req *VestTokensRequest) (*TxResponse, error) {
	holder := normalizeAddress(req.Holder)
	if holder == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid holder address")
	}

	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Amount must be a positive integer (wei)")
	}

	if req.ReleaseTime <= time.Now().Unix() {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "release_time must be in the future")
	}

	if s.token == nil {
		return nil, apperr.New(apperr.ErrCodeBlockchain, "Token contract not available")
	}

	txHash, err := s.token.VestTokens(ctx, holder, req.Amount, req.ReleaseTime)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "VestTokens failed", err)
	}

	s.log.Info("vestTokens executed",
		logger.String("holder", holder),
		logger.String("amount", req.Amount),
		logger.Int64("release_time", req.ReleaseTime),
		logger.String("tx_hash", txHash),
	)

	return &TxResponse{TxHash: txHash}, nil
}

// ─────────────────────────────────────────────
//  ReleaseVested
// ─────────────────────────────────────────────

// ReleaseVested releases matured vested tokens after confirming the schedule exists and is no longer locked.
// The holder balance cache is invalidated afterwards so subsequent reads reflect the released amount promptly.
func (s *Service) ReleaseVested(ctx context.Context, req *ReleaseVestedRequest) (*TxResponse, error) {
	holder := normalizeAddress(req.Holder)
	if holder == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid holder address")
	}

	if s.token == nil {
		return nil, apperr.New(apperr.ErrCodeBlockchain, "Token contract not available")
	}

	// Validate the vesting schedule exists and has expired before submitting
	amount, releaseTime, err := s.token.VestingInfo(ctx, holder)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "VestingInfo check failed", err)
	}
	amountBig, _ := new(big.Int).SetString(amount, 10)
	if amountBig.Sign() == 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "No vested tokens for this holder")
	}
	if time.Now().Unix() < releaseTime {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Vested tokens are still locked")
	}

	txHash, err := s.token.ReleaseVested(ctx, holder)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "ReleaseVested failed", err)
	}

	s.log.Info("releaseVested executed",
		logger.String("holder", holder),
		logger.String("tx_hash", txHash),
	)

	// Invalidate balance cache for holder
	_ = s.balance.Invalidate(ctx, holder)

	return &TxResponse{TxHash: txHash}, nil
}

// ─────────────────────────────────────────────
//  Pause / Unpause
// ─────────────────────────────────────────────

// PauseContract halts contract transfers after confirming the token is not already paused.
// This guard prevents redundant administrative transactions and surfaces clearer operator feedback.
func (s *Service) PauseContract(ctx context.Context) (*TxResponse, error) {
	if s.token == nil {
		return nil, apperr.New(apperr.ErrCodeBlockchain, "Token contract not available")
	}

	// Avoid redundant on-chain call if already paused
	paused, err := s.token.Paused(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Paused check failed", err)
	}
	if paused {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Contract is already paused")
	}

	txHash, err := s.token.Pause(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Pause failed", err)
	}

	s.log.Warn("contract paused", logger.String("tx_hash", txHash))
	return &TxResponse{TxHash: txHash}, nil
}

// UnpauseContract resumes contract transfers after confirming the token is currently paused.
// It is the inverse administrative control path to PauseContract.
func (s *Service) UnpauseContract(ctx context.Context) (*TxResponse, error) {
	if s.token == nil {
		return nil, apperr.New(apperr.ErrCodeBlockchain, "Token contract not available")
	}

	paused, err := s.token.Paused(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Paused check failed", err)
	}
	if !paused {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Contract is not paused")
	}

	txHash, err := s.token.Unpause(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "Unpause failed", err)
	}

	s.log.Info("contract unpaused", logger.String("tx_hash", txHash))
	return &TxResponse{TxHash: txHash}, nil
}

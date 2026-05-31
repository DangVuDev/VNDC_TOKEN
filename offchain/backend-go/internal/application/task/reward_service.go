// Package task provides task-related reward processing services used to queue, process, and archive token rewards.
package task

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  RewardService — Token reward distribution
// ─────────────────────────────────────────────

// RewardService manages reward creation, queue processing, transaction handoff, and archival of completed reward records.
// It sits between activity-derived points and the transaction pipeline that ultimately settles token payouts.
type RewardService struct {
	rewardPendingRepo   ports.RewardRepository
	rewardProcessedRepo ports.RewardProcessedRepository
	activityRecordRepo  ports.ActivityRecordRepository
	transactionRepo     ports.TransactionRepository
	userRepo            ports.UserRepository
	log                 logger.Logger
	relayerAddress      string
	rewardRate          *big.Int // Wei per point
}

// NewRewardService constructs the reward service with pending/processed repositories and transaction dependencies.
// The relayer address and reward rate are injected so reward issuance stays configurable outside business logic.
func NewRewardService(
	rewardPendingRepo ports.RewardRepository,
	rewardProcessedRepo ports.RewardProcessedRepository,
	activityRecordRepo ports.ActivityRecordRepository,
	transactionRepo ports.TransactionRepository,
	userRepo ports.UserRepository,
	log logger.Logger,
	relayerAddress string,
	rewardRateWeiPerPoint *big.Int,
) *RewardService {
	return &RewardService{
		rewardPendingRepo:   rewardPendingRepo,
		rewardProcessedRepo: rewardProcessedRepo,
		activityRecordRepo:  activityRecordRepo,
		transactionRepo:     transactionRepo,
		userRepo:            userRepo,
		log:                 log.Named("reward_service"),
		relayerAddress:      relayerAddress,
		rewardRate:          rewardRateWeiPerPoint,
	}
}

// ─────────────────────────────────────────────
//  CreatePendingReward — Create reward from activity completion
// ─────────────────────────────────────────────

// CreatePendingReward creates a pending reward entry derived from activity completion or another point-producing event.
// This method normalizes the wallet, converts points to wei, and persists the reward into the pending queue.
func (s *RewardService) CreatePendingReward(
	ctx context.Context,
	activityRecordID string,
	studentWallet string,
	points int,
	source domain.RewardSource,
) (*domain.RewardPending, error) {
	// Validate input
	if studentWallet == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Student wallet is required")
	}
	if points <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Points must be positive")
	}

	// Checksum the wallet address (EIP-55)
	addr := common.HexToAddress(studentWallet)
	if addr == (common.Address{}) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid wallet address")
	}
	checksummedWallet := addr.Hex()

	// Calculate reward amount in wei: points * rewardRate
	rewardAmountWei := new(big.Int).Mul(big.NewInt(int64(points)), s.rewardRate)

	// Create pending reward
	reward := &domain.RewardPending{
		BaseEntity: domain.BaseEntity{
			ID: uuid.New().String(),
		},
		StudentWallet: checksummedWallet,
		RewardAmount:  rewardAmountWei.String(),
		RewardPoints:  points,
		RewardSource:  source,
		Status:        domain.RewardStatusPending,
		Description:   fmt.Sprintf("Activity reward: %d points", points),
	}

	// Link to activity record if provided
	if activityRecordID != "" {
		reward.ActivityRecordID = &activityRecordID
	}

	// Create in repository
	if err := s.rewardPendingRepo.Create(ctx, reward); err != nil {
		s.log.Error("failed to create pending reward", logger.Err(err))
		return nil, apperr.New(apperr.ErrCodeDatabase, "Failed to create reward")
	}

	s.log.Info("created pending reward",
		logger.String("reward_id", reward.ID),
		logger.String("wallet", checksummedWallet),
		logger.Int("points", points),
		logger.String("amount_wei", rewardAmountWei.String()),
	)

	return reward, nil
}

// ─────────────────────────────────────────────
//  ProcessPendingRewards — Batch process rewards
// ─────────────────────────────────────────────

// ProcessPendingRewards pulls a batch of pending rewards and attempts to hand each one off into the transaction pipeline.
// Failures on one reward do not abort the rest of the batch, which is important for resilient worker execution.
func (s *RewardService) ProcessPendingRewards(ctx context.Context, limit int64) ([]*domain.RewardPending, error) {
	// Get pending rewards
	rewards, err := s.rewardPendingRepo.FindPending(ctx, limit)
	if err != nil {
		s.log.Error("failed to fetch pending rewards", logger.Err(err))
		return nil, err
	}

	if len(rewards) == 0 {
		return rewards, nil
	}

	s.log.Info("processing pending rewards", logger.Int("count", len(rewards)))

	// Process each reward
	for _, reward := range rewards {
		if err := s.processSingleReward(ctx, reward); err != nil {
			s.log.Error("failed to process reward",
				logger.String("reward_id", reward.ID),
				logger.String("wallet", reward.StudentWallet),
				logger.Err(err),
			)
			// Continue processing other rewards despite errors
		}
	}

	return rewards, nil
}

// processSingleReward advances one pending reward into processing, creates the payout transaction, and updates queue metadata.
// When transaction creation fails, the reward is marked failed and scheduled for retry rather than silently dropped.
func (s *RewardService) processSingleReward(ctx context.Context, reward *domain.RewardPending) error {
	// Update status to PROCESSING
	if err := s.rewardPendingRepo.Update(ctx, reward.ID, map[string]any{
		"status": domain.RewardStatusProcessing,
	}); err != nil {
		return err
	}

	// Create transaction
	tx := &domain.Transaction{
		BaseEntity: domain.BaseEntity{
			ID: uuid.New().String(),
		},
		Type:        domain.TxTypeTokenTransfer,
		Status:      domain.TxStatusPending,
		FromWallet:  s.relayerAddress,
		ToWallet:    reward.StudentWallet,
		Amount:      reward.RewardAmount,
		ContextType: "ACTIVITY_REWARD",
		ContextID:   reward.ID,
		RetryCount:  0,
	}

	if err := s.transactionRepo.Create(ctx, tx); err != nil {
		s.log.Error("failed to create transaction for reward",
			logger.String("reward_id", reward.ID),
			logger.Err(err),
		)

		// Update reward with error
		_ = s.rewardPendingRepo.Update(ctx, reward.ID, map[string]any{
			"status":        domain.RewardStatusFailed,
			"last_error":    err.Error(),
			"retry_count":   reward.RetryCount + 1,
			"next_retry_at": time.Now().Add(5 * time.Minute),
		})

		return err
	}

	s.log.Info("created transaction for reward",
		logger.String("reward_id", reward.ID),
		logger.String("transaction_id", tx.ID),
		logger.String("wallet", reward.StudentWallet),
	)

	// Update reward with transaction ID and status
	if err := s.rewardPendingRepo.Update(ctx, reward.ID, map[string]any{
		"status":         domain.RewardStatusQueued,
		"transaction_id": tx.ID,
		"processed_at":   time.Now().UTC(),
	}); err != nil {
		s.log.Error("failed to update reward status",
			logger.String("reward_id", reward.ID),
			logger.Err(err),
		)
		return err
	}

	return nil
}

// ─────────────────────────────────────────────
//  MoveToProcessed — Archive successful rewards
// ─────────────────────────────────────────────

// MoveRewardToProcessed archives a reward from the pending queue into the processed-history collection.
// This preserves a durable audit trail of whether the payout ultimately succeeded or failed.
func (s *RewardService) MoveRewardToProcessed(
	ctx context.Context,
	pendingRewardID string,
	transactionID string,
	isSuccessful bool,
	errorMsg string,
) error {
	// Get the pending reward
	pending, err := s.rewardPendingRepo.FindByID(ctx, pendingRewardID)
	if err != nil {
		return err
	}
	if pending == nil {
		return apperr.ErrNotFound
	}

	// Create processed record
	processed := &domain.RewardProcessed{
		BaseEntity: domain.BaseEntity{
			ID: uuid.New().String(),
		},
		StudentWallet:    pending.StudentWallet,
		RewardAmount:     pending.RewardAmount,
		RewardPoints:     pending.RewardPoints,
		RewardSource:     pending.RewardSource,
		ActivityRecordID: pending.ActivityRecordID,
		ActivityClaimID:  pending.ActivityClaimID,
		ContextID:        pending.ContextID,
		TransactionID:    transactionID,
		OriginalRewardID: pendingRewardID,
		ProcessedAt:      time.Now().UTC(),
		IsSuccessful:     isSuccessful,
		FinalError:       errorMsg,
		Description:      pending.Description,
	}

	if err := s.rewardProcessedRepo.Create(ctx, processed); err != nil {
		return err
	}

	// Delete from pending (or mark as processed)
	if err := s.rewardPendingRepo.Update(ctx, pendingRewardID, map[string]any{
		"status": domain.RewardStatusProcessed,
	}); err != nil {
		return err
	}

	s.log.Info("moved reward to processed",
		logger.String("reward_id", pendingRewardID),
		logger.String("processed_id", processed.ID),
		logger.Bool("successful", isSuccessful),
	)

	return nil
}

// ─────────────────────────────────────────────
//  GetRewardHistory — Query reward records
// ─────────────────────────────────────────────

// GetUserRewardHistory retrieves both pending and processed rewards for one wallet and computes aggregate point totals.
// The combined response is intended for wallet history views and reward-overview dashboards.
func (s *RewardService) GetUserRewardHistory(ctx context.Context, wallet string) (*UserRewardHistory, error) {
	// Get pending rewards
	pendingRewards, _, err := s.rewardPendingRepo.FindByStudentWallet(ctx, wallet)
	if err != nil {
		return nil, err
	}

	// Get processed rewards
	processedRewards, _, err := s.rewardProcessedRepo.FindByStudentWallet(ctx, wallet)
	if err != nil {
		return nil, err
	}

	// Calculate totals
	var pendingTotal, processedTotal int
	for _, r := range pendingRewards {
		pendingTotal += r.RewardPoints
	}
	for _, r := range processedRewards {
		processedTotal += r.RewardPoints
	}

	return &UserRewardHistory{
		Wallet:           wallet,
		PendingRewards:   pendingRewards,
		ProcessedRewards: processedRewards,
		PendingPoints:    pendingTotal,
		ProcessedPoints:  processedTotal,
		TotalPoints:      pendingTotal + processedTotal,
	}, nil
}

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

// UserRewardHistory groups pending and processed reward records together with precomputed total-point summaries.
type UserRewardHistory struct {
	Wallet           string
	PendingRewards   []*domain.RewardPending
	ProcessedRewards []*domain.RewardProcessed
	PendingPoints    int
	ProcessedPoints  int
	TotalPoints      int
}

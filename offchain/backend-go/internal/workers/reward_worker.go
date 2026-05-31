// Package workers contains long-running background jobs that reconcile async platform workflows.
// This file groups reward payout workers and task-claim settlement workers that bridge off-chain reward state to on-chain execution.
package workers

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  RewardProcessingWorker
// ─────────────────────────────────────────────

// RewardProcessingWorker drains the pending reward queue and attempts direct on-chain payout through the task-manager pool.
// It is responsible for converting durable reward intents into settled blockchain payouts and corresponding audit records.
type RewardProcessingWorker struct {
	rewardPendingRepo   ports.RewardRepository
	rewardProcessedRepo ports.RewardProcessedRepository
	transactionRepo     ports.TransactionRepository
	taskManager         ports.TaskManagerContractPort
	activityRecordRepo  ports.ActivityRecordRepository
	log                 logger.Logger
	batchSize           int64
	tickInterval        time.Duration
	stopChan            chan struct{}
	stoppedChan         chan struct{}
	suspended           bool
}

// NewRewardProcessingWorker constructs the reward-queue processor with persistence, contract, and record-reconciliation dependencies.
// Default batch size and tick interval are embedded here because this worker predates the newer config-pattern workers.
func NewRewardProcessingWorker(
	rewardPendingRepo ports.RewardRepository,
	rewardProcessedRepo ports.RewardProcessedRepository,
	transactionRepo ports.TransactionRepository,
	taskManager ports.TaskManagerContractPort,
	activityRecordRepo ports.ActivityRecordRepository,
	log logger.Logger,
) *RewardProcessingWorker {
	return &RewardProcessingWorker{
		rewardPendingRepo:   rewardPendingRepo,
		rewardProcessedRepo: rewardProcessedRepo,
		transactionRepo:     transactionRepo,
		taskManager:         taskManager,
		activityRecordRepo:  activityRecordRepo,
		log:                 log.Named("reward_worker"),
		batchSize:           20,
		tickInterval:        15 * time.Second,
		stopChan:            make(chan struct{}),
		stoppedChan:         make(chan struct{}),
	}
}

// Start launches the reward processor asynchronously and returns immediately.
// This worker manages its own stop channels instead of using context-driven cancellation directly.
func (w *RewardProcessingWorker) Start() {
	go w.run()
	w.log.Info("reward processing worker started",
		logger.Int64("batch_size", w.batchSize),
		logger.Duration("interval", w.tickInterval),
	)
}

// Stop gracefully terminates the reward processor and waits until its run loop has exited.
func (w *RewardProcessingWorker) Stop() {
	close(w.stopChan)
	<-w.stoppedChan
	w.log.Info("reward processing worker stopped")
}

// run is the internal polling loop that wakes on a fixed cadence and processes one reward batch per tick.
func (w *RewardProcessingWorker) run() {
	defer close(w.stoppedChan)

	ticker := time.NewTicker(w.tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			w.processPendingRewards(ctx)
			cancel()
		}
	}
}

// processPendingRewards loads the next eligible reward batch, checks pool availability, and processes each reward independently.
// Pool-based suspension prevents repeated failing submissions when the task-manager treasury is temporarily underfunded.
func (w *RewardProcessingWorker) processPendingRewards(ctx context.Context) {
	if w.taskManager == nil {
		w.log.Warn("reward worker: task manager adapter unavailable")
		return
	}

	// Get pending rewards
	rewards, err := w.rewardPendingRepo.FindPending(ctx, w.batchSize)
	if err != nil {
		w.log.Error("failed to fetch pending rewards", logger.Err(err))
		return
	}

	if len(rewards) == 0 {
		return
	}

	if w.suspended {
		ok, bal, req, checkErr := w.hasEnoughPool(ctx, rewards[0].RewardAmount)
		if checkErr != nil {
			w.log.Warn("reward worker suspended: pool check failed", logger.Err(checkErr))
			return
		}
		if !ok {
			w.log.Warn("reward worker suspended: waiting admin funding",
				logger.String("pool_balance", bal),
				logger.String("required", req),
			)
			return
		}
		w.suspended = false
		w.log.Info("reward worker resumed after pool funded", logger.String("pool_balance", bal))
	}

	w.log.Info("processing pending rewards", logger.Int("count", len(rewards)))

	processedCount := 0
	for _, reward := range rewards {
		if err := w.processSingleReward(ctx, reward); err != nil {
			w.log.Error("failed to process reward",
				logger.String("reward_id", reward.ID),
				logger.String("wallet", reward.StudentWallet),
				logger.Err(err),
			)
		} else {
			processedCount++
		}
	}

	w.log.Info("reward processing batch complete",
		logger.Int("total", len(rewards)),
		logger.Int("processed", processedCount),
	)
}

// processSingleReward executes one full reward-settlement flow: validate amount, submit on-chain, persist transaction history, and archive the result.
// Each reward is handled independently so one failure does not abort the rest of the batch.
func (w *RewardProcessingWorker) processSingleReward(ctx context.Context, reward *domain.RewardPending) error {
	if reward.RewardAmount == "" {
		return fmt.Errorf("reward amount is empty")
	}
	amount, ok := new(big.Int).SetString(reward.RewardAmount, 10)
	if !ok || amount.Sign() <= 0 {
		return fmt.Errorf("invalid reward amount: %q", reward.RewardAmount)
	}

	ok, bal, req, checkErr := w.hasEnoughPool(ctx, reward.RewardAmount)
	if checkErr != nil {
		return fmt.Errorf("pool balance check failed: %w", checkErr)
	}
	if !ok {
		w.suspended = true
		w.log.Warn("reward worker suspended: insufficient pool balance",
			logger.String("reward_id", reward.ID),
			logger.String("pool_balance", bal),
			logger.String("required", req),
		)
		return nil
	}

	// Update status to PROCESSING
	if err := w.rewardPendingRepo.Update(ctx, reward.ID, map[string]any{
		"status": domain.RewardStatusProcessing,
	}); err != nil {
		return fmt.Errorf("failed to update status to PROCESSING: %w", err)
	}

	w.log.Debug("processing reward",
		logger.String("reward_id", reward.ID),
		logger.String("wallet", reward.StudentWallet),
		logger.Int("points", reward.RewardPoints),
	)

	now := time.Now().UTC()
	nonce := fmt.Sprintf("%d", now.UnixNano())
	txHash, err := w.taskManager.ClaimReward(ctx, "", reward.StudentWallet, reward.RewardAmount, nonce)
	if err != nil {
		if isInsufficientPoolError(err) {
			w.suspended = true
		}
		_ = w.rewardPendingRepo.Update(ctx, reward.ID, map[string]any{
			"status":        domain.RewardStatusFailed,
			"last_error":    err.Error(),
			"retry_count":   reward.RetryCount + 1,
			"next_retry_at": now.Add(5 * time.Minute),
			"updated_at":    now,
		})
		return fmt.Errorf("failed to settle reward via task manager: %w", err)
	}

	var txID *string
	tx := &domain.Transaction{
		BaseEntity:  domain.BaseEntity{ID: uuid.New().String(), CreatedAt: now, UpdatedAt: now},
		Type:        domain.TxTypeTaskClaim,
		Status:      domain.TxStatusSuccess,
		FromWallet:  "TASK_MANAGER_POOL",
		ToWallet:    strings.ToLower(strings.TrimSpace(reward.StudentWallet)),
		Amount:      reward.RewardAmount,
		Nonce:       nonce,
		Deadline:    now.Add(24 * time.Hour).Unix(),
		Signature:   "",
		TxHash:      txHash,
		ContextType: "ACTIVITY_REWARD",
		ContextID:   reward.ID,
		ContextRef: func() string {
			if reward.ActivityRecordID == nil {
				return ""
			}
			return *reward.ActivityRecordID
		}(),
	}
	if w.transactionRepo != nil {
		if err := w.transactionRepo.Create(ctx, tx); err != nil {
			w.log.Error("failed to create reward transaction record",
				logger.String("reward_id", reward.ID),
				logger.Err(err),
			)
		} else {
			txID = &tx.ID
		}
	}

	processed := &domain.RewardProcessed{
		BaseEntity:       domain.BaseEntity{ID: uuid.New().String(), CreatedAt: now, UpdatedAt: now},
		StudentWallet:    reward.StudentWallet,
		RewardAmount:     reward.RewardAmount,
		RewardPoints:     reward.RewardPoints,
		RewardSource:     reward.RewardSource,
		ActivityRecordID: reward.ActivityRecordID,
		ActivityClaimID:  reward.ActivityClaimID,
		ContextID:        reward.ContextID,
		TransactionID: func() string {
			if txID == nil {
				return ""
			}
			return *txID
		}(),
		TxHash:           txHash,
		OriginalRewardID: reward.ID,
		ProcessedAt:      now,
		IsSuccessful:     true,
		Description:      reward.Description,
	}
	if err := w.rewardProcessedRepo.Create(ctx, processed); err != nil {
		return fmt.Errorf("failed to create reward processed record: %w", err)
	}

	updates := map[string]any{
		"status":       domain.RewardStatusProcessed,
		"processed_at": now,
		"updated_at":   now,
	}
	if txID != nil {
		updates["transaction_id"] = *txID
	}

	if err := w.rewardPendingRepo.Update(ctx, reward.ID, map[string]any{
		"status":       updates["status"],
		"processed_at": updates["processed_at"],
		"updated_at":   updates["updated_at"],
		"transaction_id": func() any {
			if txID == nil {
				return nil
			}
			return *txID
		}(),
	}); err != nil {
		return fmt.Errorf("failed to update status to PROCESSED: %w", err)
	}

	if reward.ActivityRecordID != nil && *reward.ActivityRecordID != "" && w.activityRecordRepo != nil {
		if err := w.activityRecordRepo.Update(ctx, *reward.ActivityRecordID, map[string]any{
			"status":     domain.ActivityRecordStatusConfirmed,
			"updated_at": now,
		}); err != nil {
			w.log.Error("failed to confirm activity record after reward payout",
				logger.String("reward_id", reward.ID),
				logger.String("record_id", *reward.ActivityRecordID),
				logger.Err(err),
			)
		}
	}

	w.log.Info("reward settled via task manager",
		logger.String("reward_id", reward.ID),
		logger.String("wallet", reward.StudentWallet),
		logger.String("amount", amount.String()),
		logger.String("tx_hash", txHash),
	)

	return nil
}

// hasEnoughPool checks whether the task-manager reward treasury can cover the requested reward amount.
// It also returns normalized balance strings for operator-friendly logging when the worker suspends itself.
func (w *RewardProcessingWorker) hasEnoughPool(ctx context.Context, rewardAmount string) (bool, string, string, error) {
	required, ok := new(big.Int).SetString(rewardAmount, 10)
	if !ok || required.Sign() <= 0 {
		return false, "0", rewardAmount, nil
	}
	poolStr, err := w.taskManager.PoolBalance(ctx)
	if err != nil {
		return false, "0", required.String(), err
	}
	pool, ok := new(big.Int).SetString(poolStr, 10)
	if !ok {
		return false, poolStr, required.String(), nil
	}
	return pool.Cmp(required) >= 0, pool.String(), required.String(), nil
}

// ─────────────────────────────────────────────
//  RewardSettlementWorker — Settlement tracking
// ─────────────────────────────────────────────

// RewardSettlementWorker watches queued rewards that are waiting on a separate transaction lifecycle and moves them into processed history once final.
// This worker exists for flows where reward completion depends on an already-created transaction reaching a terminal state later.
type RewardSettlementWorker struct {
	rewardPendingRepo   ports.RewardRepository
	rewardProcessedRepo ports.RewardProcessedRepository
	transactionRepo     ports.TransactionRepository
	activityRecordRepo  ports.ActivityRecordRepository
	log                 logger.Logger
	tickInterval        time.Duration
	stopChan            chan struct{}
	stoppedChan         chan struct{}
}

// NewRewardSettlementWorker constructs the worker that reconciles queued rewards against final transaction outcomes.
func NewRewardSettlementWorker(
	rewardPendingRepo ports.RewardRepository,
	rewardProcessedRepo ports.RewardProcessedRepository,
	transactionRepo ports.TransactionRepository,
	activityRecordRepo ports.ActivityRecordRepository,
	log logger.Logger,
) *RewardSettlementWorker {
	return &RewardSettlementWorker{
		rewardPendingRepo:   rewardPendingRepo,
		rewardProcessedRepo: rewardProcessedRepo,
		transactionRepo:     transactionRepo,
		activityRecordRepo:  activityRecordRepo,
		log:                 log.Named("reward_settlement_worker"),
		tickInterval:        30 * time.Second,
		stopChan:            make(chan struct{}),
		stoppedChan:         make(chan struct{}),
	}
}

// Start launches the reward-settlement tracker asynchronously.
func (w *RewardSettlementWorker) Start() {
	go w.run()
	w.log.Info("reward settlement worker started", logger.Duration("interval", w.tickInterval))
}

// Stop gracefully shuts down the reward-settlement tracker and waits for its loop to exit.
func (w *RewardSettlementWorker) Stop() {
	close(w.stopChan)
	<-w.stoppedChan
	w.log.Info("reward settlement worker stopped")
}

// run is the internal polling loop that periodically checks whether queued reward transactions have reached terminal status.
func (w *RewardSettlementWorker) run() {
	defer close(w.stoppedChan)

	ticker := time.NewTicker(w.tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			w.checkSettlements(ctx)
			cancel()
		}
	}
}

// checkSettlements scans queued rewards, loads their linked transactions, and archives each reward once the transaction becomes terminal.
// Successful and failed terminal outcomes both get converted into immutable processed-history records.
func (w *RewardSettlementWorker) checkSettlements(ctx context.Context) {
	// Get all queued rewards
	rewards, _, err := w.rewardPendingRepo.FindByStatus(ctx, domain.RewardStatusQueued)
	if err != nil {
		w.log.Error("failed to fetch queued rewards", logger.Err(err))
		return
	}

	if len(rewards) == 0 {
		return
	}

	w.log.Debug("checking reward settlements", logger.Int("count", len(rewards)))

	settledCount := 0
	for _, reward := range rewards {
		if reward.TransactionID == nil {
			continue
		}

		tx, err := w.transactionRepo.FindByID(ctx, *reward.TransactionID)
		if err != nil {
			w.log.Error("failed to find transaction for reward",
				logger.String("reward_id", reward.ID),
				logger.String("tx_id", *reward.TransactionID),
				logger.Err(err),
			)
			continue
		}

		if tx == nil {
			continue
		}

		// Check if transaction is terminal
		if tx.IsTerminal() {
			isSuccessful := tx.Status == domain.TxStatusSuccess
			errorMsg := ""
			if !isSuccessful {
				errorMsg = tx.LastError
			}

			if err := w.moveRewardToProcessed(ctx, reward, tx, isSuccessful, errorMsg); err != nil {
				w.log.Error("failed to move reward to processed",
					logger.String("reward_id", reward.ID),
					logger.Err(err),
				)
			} else {
				settledCount++
			}
		}
	}

	if settledCount > 0 {
		w.log.Info("settled rewards",
			logger.Int("total_checked", len(rewards)),
			logger.Int("settled", settledCount),
		)
	}
}

// moveRewardToProcessed materializes the immutable processed-history record and updates the original queue item to processed status.
// For successful outcomes it also confirms the linked activity record so academic progress reflects the completed payout.
func (w *RewardSettlementWorker) moveRewardToProcessed(
	ctx context.Context,
	pending *domain.RewardPending,
	tx *domain.Transaction,
	isSuccessful bool,
	errorMsg string,
) error {
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
		TransactionID:    tx.ID,
		TxHash:           tx.TxHash,
		BlockNumber:      tx.BlockNumber,
		OriginalRewardID: pending.ID,
		ProcessedAt:      time.Now().UTC(),
		SettledAt:        tx.SettledAt,
		IsSuccessful:     isSuccessful,
		FinalError:       errorMsg,
		Description:      pending.Description,
	}

	if err := w.rewardProcessedRepo.Create(ctx, processed); err != nil {
		return fmt.Errorf("failed to create processed record: %w", err)
	}

	// Update pending to mark as processed
	if err := w.rewardPendingRepo.Update(ctx, pending.ID, map[string]any{
		"status": domain.RewardStatusProcessed,
	}); err != nil {
		return fmt.Errorf("failed to update pending reward status: %w", err)
	}

	if isSuccessful && pending.ActivityRecordID != nil && *pending.ActivityRecordID != "" && w.activityRecordRepo != nil {
		now := time.Now().UTC()
		if err := w.activityRecordRepo.Update(ctx, *pending.ActivityRecordID, map[string]any{
			"status":     domain.ActivityRecordStatusConfirmed,
			"updated_at": now,
		}); err != nil {
			w.log.Error("failed to confirm activity record after reward settlement",
				logger.String("reward_id", pending.ID),
				logger.String("record_id", *pending.ActivityRecordID),
				logger.Err(err),
			)
		}
	}

	w.log.Info("reward settled",
		logger.String("reward_id", pending.ID),
		logger.String("processed_id", processed.ID),
		logger.String("tx_hash", tx.TxHash),
		logger.Bool("successful", isSuccessful),
	)

	return nil
}

// ─────────────────────────────────────────────
//  ClaimWorker — Task claim settlement
// ─────────────────────────────────────────────

// ClaimWorkerConfig tunes how aggressively approved student claims are submitted to the task-manager contract.
type ClaimWorkerConfig struct {
	BatchSize    int
	TickInterval time.Duration
	MaxRetries   int
}

// DefaultClaimWorkerConfig returns conservative settings suitable for local development and moderate claim throughput.
func DefaultClaimWorkerConfig() ClaimWorkerConfig {
	return ClaimWorkerConfig{
		BatchSize:    5,
		TickInterval: 15 * time.Second,
		MaxRetries:   3,
	}
}

// ClaimWorker polls approved student claims, submits the reward claim on-chain, and reconciles the resulting user/task side effects.
// It is the background bridge between academic approval workflows and actual token delivery.
type ClaimWorker struct {
	claimRepo   ports.StudentClaimRepository
	taskRepo    ports.TaskRepository
	userRepo    ports.UserRepository
	txRepo      ports.TransactionRepository
	taskManager ports.TaskManagerContractPort
	cfg         ClaimWorkerConfig
	log         logger.Logger
	suspended   bool
}

// NewClaimWorker constructs the task-claim settlement worker with repositories, contract access, and operational settings.
func NewClaimWorker(
	claimRepo ports.StudentClaimRepository,
	taskRepo ports.TaskRepository,
	userRepo ports.UserRepository,
	txRepo ports.TransactionRepository,
	taskManager ports.TaskManagerContractPort,
	cfg ClaimWorkerConfig,
	log logger.Logger,
) *ClaimWorker {
	return &ClaimWorker{
		claimRepo:   claimRepo,
		taskRepo:    taskRepo,
		userRepo:    userRepo,
		txRepo:      txRepo,
		taskManager: taskManager,
		cfg:         cfg,
		log:         log.Named("claim_worker"),
	}
}

// Run starts the periodic claim-settlement loop and blocks until the provided context is cancelled.
// An initial batch is attempted immediately so newly approved claims do not wait for the first ticker interval.
func (w *ClaimWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.cfg.TickInterval)
	defer ticker.Stop()

	w.log.Info("claim worker started",
		logger.Int("batch_size", w.cfg.BatchSize),
		logger.Duration("interval", w.cfg.TickInterval),
	)

	if err := w.processBatch(ctx); err != nil {
		w.log.Error("claim batch error (initial)", logger.Err(err))
	}

	for {
		select {
		case <-ctx.Done():
			w.log.Info("claim worker stopped")
			return
		case <-ticker.C:
			if err := w.processBatch(ctx); err != nil {
				w.log.Error("claim batch error", logger.Err(err))
			}
		}
	}
}

// processBatch loads approved claims, enforces treasury suspension semantics, and submits up to the configured batch size.
// The worker stops early when pool funding becomes insufficient so the remaining claims stay untouched for the next run.
func (w *ClaimWorker) processBatch(ctx context.Context) error {
	claims, _, err := w.claimRepo.FindByStatus(ctx, domain.ClaimStatusApproved)
	if err != nil {
		return err
	}
	if len(claims) == 0 {
		return nil
	}

	if w.suspended {
		ok, bal, req, checkErr := w.hasEnoughPool(ctx, claims[0].RewardAmount)
		if checkErr != nil {
			w.log.Warn("claim worker suspended: pool check failed", logger.Err(checkErr))
			return nil
		}
		if !ok {
			w.log.Warn("claim worker suspended: waiting admin funding",
				logger.String("pool_balance", bal),
				logger.String("required", req),
			)
			return nil
		}
		w.suspended = false
		w.log.Info("claim worker resumed after pool funded", logger.String("pool_balance", bal))
	}

	submitted := 0
	for _, claim := range claims {
		if submitted >= w.cfg.BatchSize {
			break
		}

		ok, bal, req, checkErr := w.hasEnoughPool(ctx, claim.RewardAmount)
		if checkErr != nil {
			w.log.Warn("claim settle: pool balance check failed",
				logger.String("claim_id", claim.ID),
				logger.Err(checkErr),
			)
			continue
		}
		if !ok {
			w.suspended = true
			w.log.Warn("claim worker suspended: insufficient pool balance",
				logger.String("claim_id", claim.ID),
				logger.String("pool_balance", bal),
				logger.String("required", req),
			)
			break
		}

		w.settle(ctx, claim)
		submitted++
	}

	if submitted > 0 {
		w.log.Info("claim batch processed", logger.Int("count", submitted))
	}
	return nil
}

// settle executes one claim through the full happy-path settlement flow, including on-chain submission, claim-state transition, user-point updates, and task slot adjustment.
// Errors are handled locally and reflected back into claim status so the batch loop can continue with the next item.
func (w *ClaimWorker) settle(ctx context.Context, claim *domain.StudentClaim) {
	var task *domain.Task
	if w.taskRepo != nil {
		loadedTask, err := w.taskRepo.FindByID(ctx, claim.TaskID)
		if err == nil {
			task = loadedTask
		} else {
			w.log.Warn("claim settle: task lookup failed, continue with treasury mode",
				logger.String("claim_id", claim.ID),
				logger.String("task_id", claim.TaskID),
				logger.Err(err),
			)
		}
	}

	taskIDForChain := claim.TaskID
	if task != nil && task.OnchainTaskId != "" {
		taskIDForChain = task.OnchainTaskId
	}

	nonceBig, ok := new(big.Int).SetString(claim.Nonce, 10)
	if !ok || nonceBig.Sign() < 0 {
		w.markFailed(ctx, claim, "invalid nonce: "+claim.Nonce)
		return
	}

	w.log.Info("claim settle: submitting on-chain",
		logger.String("claim_id", claim.ID),
		logger.String("student", claim.StudentWallet),
		logger.String("task_id", taskIDForChain),
		logger.String("reward", claim.RewardAmount),
	)

	txHash, err := w.taskManager.ClaimReward(
		ctx,
		taskIDForChain,
		claim.StudentWallet,
		claim.RewardAmount,
		claim.Nonce,
	)
	if err != nil {
		if isInsufficientPoolError(err) {
			w.suspended = true
			w.log.Warn("claim worker suspended after on-chain insufficient pool",
				logger.String("claim_id", claim.ID),
				logger.Err(err),
			)
			return
		}
		w.log.Error("claim settle: on-chain submission failed",
			logger.String("claim_id", claim.ID),
			logger.String("student", claim.StudentWallet),
			logger.Err(err),
		)
		w.markFailed(ctx, claim, err.Error())
		return
	}

	now := time.Now().UTC()

	if w.txRepo != nil {
		fromWallet := ""
		if task != nil {
			fromWallet = strings.ToLower(strings.TrimSpace(task.ContractAddr))
		}
		txRecord := &domain.Transaction{
			BaseEntity: domain.BaseEntity{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Type:       domain.TxTypeTaskClaim,
			Status:     domain.TxStatusSuccess,
			FromWallet: fromWallet,
			ToWallet:   strings.ToLower(strings.TrimSpace(claim.StudentWallet)),
			Amount:     claim.RewardAmount,
			Nonce:      claim.Nonce,
			Deadline:   claim.Deadline,
			Signature:  claim.Signature,
			TxHash:     txHash,
		}
		if err := w.txRepo.Create(ctx, txRecord); err != nil {
			w.log.Error("claim settle: save transaction record failed",
				logger.String("claim_id", claim.ID),
				logger.Err(err),
			)
		}
	}

	activityPoints := activityPointsFromReward(claim.RewardAmount)
	claim.TxHash = txHash
	claim.Status = domain.ClaimStatusTokenReceived
	claim.ActivityPoints = activityPoints
	claim.UpdatedAt = now
	if err := w.claimRepo.Update(ctx, claim); err != nil {
		w.log.Error("claim settle: update claim failed",
			logger.String("claim_id", claim.ID),
			logger.Err(err),
		)
		return
	}

	if w.userRepo != nil {
		user, userErr := w.userRepo.FindByWallet(ctx, claim.StudentWallet)
		if userErr == nil && user != nil {
			if err := w.userRepo.Update(ctx, user.ID, map[string]interface{}{
				"activity_points": user.ActivityPoints + activityPoints,
			}); err != nil {
				w.log.Error("claim settle: update user activity points failed",
					logger.String("student", claim.StudentWallet),
					logger.Err(err),
				)
			}
		} else if userErr != nil {
			w.log.Error("claim settle: update user activity points failed",
				logger.String("student", claim.StudentWallet),
				logger.Err(userErr),
			)
		}
	}

	if task != nil {
		task.CurrentSlots++
		task.UpdatedAt = now
		if err := w.taskRepo.Update(ctx, task); err != nil {
			w.log.Warn("claim settle: increment task slots failed",
				logger.String("task_id", task.ID),
				logger.Err(err),
			)
		}
	}

	w.log.Info("claim settled: tokens transferred to student",
		logger.String("claim_id", claim.ID),
		logger.String("student", claim.StudentWallet),
		logger.String("reward", claim.RewardAmount),
		logger.String("tx_hash", txHash),
	)
}

// markFailed persists terminal failure details back onto the claim so operators and users can inspect why settlement did not complete.
func (w *ClaimWorker) markFailed(ctx context.Context, claim *domain.StudentClaim, reason string) {
	claim.Status = domain.ClaimStatusFailed
	claim.ErrorMsg = reason
	claim.UpdatedAt = time.Now().UTC()
	if err := w.claimRepo.Update(ctx, claim); err != nil {
		w.log.Error("markFailed: update claim failed",
			logger.String("claim_id", claim.ID),
			logger.Err(err),
		)
	}
}

// activityPointsFromReward converts token-denominated reward amounts into integer activity points for user-profile accumulation.
// The conversion uses whole-token units and falls back to a minimum of one point for malformed or extremely small values.
func activityPointsFromReward(rewardAmount string) int64 {
	amt, ok := new(big.Int).SetString(rewardAmount, 10)
	if !ok || amt.Sign() <= 0 {
		return 1
	}
	base := big.NewInt(1_000_000_000_000_000_000)
	points := new(big.Int).Div(amt, base)
	if points.Sign() <= 0 {
		return 1
	}
	if !points.IsInt64() {
		return 1
	}
	return points.Int64()
}

// hasEnoughPool checks whether the task-manager treasury can satisfy the requested claim amount.
// Balance strings are returned to support detailed suspension and recovery logs.
func (w *ClaimWorker) hasEnoughPool(ctx context.Context, rewardAmount string) (bool, string, string, error) {
	required, ok := new(big.Int).SetString(rewardAmount, 10)
	if !ok || required.Sign() <= 0 {
		return false, "0", rewardAmount, nil
	}
	poolStr, err := w.taskManager.PoolBalance(ctx)
	if err != nil {
		return false, "0", required.String(), err
	}
	pool, ok := new(big.Int).SetString(poolStr, 10)
	if !ok {
		return false, poolStr, required.String(), nil
	}
	return pool.Cmp(required) >= 0, pool.String(), required.String(), nil
}

// isInsufficientPoolError performs lightweight message matching for treasury-underfunded contract failures.
// This lets workers switch into suspended mode even when the adapter does not expose a structured error type.
func isInsufficientPoolError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "insufficient pool") || strings.Contains(msg, "insufficient token balance")
}

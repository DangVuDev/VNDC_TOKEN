// Package task implements business logic for the task reward system.
// Architecture: all task metadata lives OFFCHAIN in MongoDB.
// Onchain stores task registry and handles final reward disbursement.
// Backend orchestrates: verify proof → sign EIP-712 → submit on-chain → record result.
//
// Two clusters are supported:
//
//	Cluster 1 — Learning (READING, VIDEO, QUIZ): time-based heartbeat + optional quiz.
//	Cluster 2 — Activity (PHYSICAL): one-time physical proof codes.
package task

import (
	"context"
	"crypto/rand"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// claimDeadline is how long an approved claim signature stays valid.
const claimDeadline = 1 * time.Hour

// sessionTimeout is the maximum idle time before a session is auto-expired.
const sessionTimeout = 2 * time.Hour

// Service handles task creation, student progress tracking, proof validation, and claim signing workflows.
// It coordinates off-chain repositories with optional on-chain signing support for final reward claims.
type Service struct {
	taskRepo     ports.TaskRepository
	claimRepo    ports.StudentClaimRepository
	proofRepo    ports.ProofCodeRepository
	progressRepo ports.UserProgressRepository
	userRepo     ports.UserRepository
	signer       *blockchain.TaskSigner
	log          logger.Logger
}

// NewService constructs the task Service.
// The loose parameter typing keeps the bootstrap call site stable while allowing optional dependencies to be injected progressively.
func NewService(taskRepo interface{}, claimRepo interface{}, contractPort interface{}, eip712Domain interface{}, log logger.Logger, extra ...interface{}) *Service {
	svc := &Service{log: log.Named("task_service")}
	if r, ok := taskRepo.(ports.TaskRepository); ok {
		svc.taskRepo = r
	}
	if r, ok := claimRepo.(ports.StudentClaimRepository); ok {
		svc.claimRepo = r
	}
	// extra[0] = ProofCodeRepository, extra[1] = UserProgressRepository, extra[2] = TaskSigner
	for _, e := range extra {
		switch v := e.(type) {
		case ports.ProofCodeRepository:
			svc.proofRepo = v
		case ports.UserProgressRepository:
			svc.progressRepo = v
		case ports.UserRepository:
			svc.userRepo = v
		case *blockchain.TaskSigner:
			svc.signer = v
		}
	}
	return svc
}

// CreateTask persists a new task with all metadata off-chain.
// It translates request payloads into the domain model while leaving policy validation to higher-level callers.
func (s *Service) CreateTask(ctx context.Context, req *CreateTaskRequest) (*domain.Task, error) {
	if s.taskRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "task repository not initialised")
	}
	now := time.Now().UTC()
	reqs := domain.TaskRequirements{}
	if req.MinTimeSeconds != nil {
		reqs.MinTimeSeconds = *req.MinTimeSeconds
	}
	if req.MinQuizScore != nil {
		reqs.MinQuizScore = *req.MinQuizScore
	}

	// Convert quiz questions from request to domain
	var quizQuestions []domain.QuizQuestion
	for _, q := range req.QuizQuestions {
		quizQuestions = append(quizQuestions, domain.QuizQuestion{
			ID:           q.ID,
			Question:     q.Question,
			Options:      q.Options,
			CorrectIndex: q.CorrectIndex,
		})
	}

	task := &domain.Task{
		BaseEntity:    domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Title:         req.Title,
		Description:   req.Description,
		Cluster:       domain.TaskCluster(req.Cluster),
		TaskType:      domain.TaskType(req.TaskType),
		Requirements:  reqs,
		RewardAmount:  req.RewardAmount,
		MaxSlots:      req.MaxSlots,
		CurrentSlots:  0,
		Status:        domain.TaskStatusActive,
		OnchainTaskId: req.OnchainTaskId,
		ContractAddr:  req.ContractAddr,
		ContentURL:    "",
		QuizQuestions: quizQuestions,
	}

	// Set content URL if provided
	if req.ContentURL != nil {
		task.ContentURL = *req.ContentURL
	}

	if req.ExpiresIn != nil && *req.ExpiresIn > 0 {
		exp := now.Add(time.Duration(*req.ExpiresIn) * time.Second)
		task.ExpiresAt = &exp
	}
	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, err
	}
	return task, nil
}

// PauseTask marks a task as paused in off-chain storage without invoking any contract-side change.
// This is intended for operational control over visibility and participation without changing on-chain registry state.
func (s *Service) PauseTask(ctx context.Context, id string) (*domain.Task, error) {
	return s.setStatus(ctx, id, domain.TaskStatusPaused)
}

// ResumeTask marks a task as active again in off-chain storage.
// It is the inverse of PauseTask and is used when a temporarily paused task is reopened.
func (s *Service) ResumeTask(ctx context.Context, id string) (*domain.Task, error) {
	return s.setStatus(ctx, id, domain.TaskStatusActive)
}

// setStatus is the shared helper behind pause/resume flows.
// Centralizing the state mutation avoids duplicating task lookup and update logic.
func (s *Service) setStatus(ctx context.Context, id string, status domain.TaskStatus) (*domain.Task, error) {
	if s.taskRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "task repository not initialised")
	}
	task, err := s.taskRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	task.Status = status
	task.UpdatedAt = time.Now().UTC()
	if err := s.taskRepo.Update(ctx, task); err != nil {
		return nil, err
	}
	return task, nil
}

// ─────────────────────────────────────────────
//  Admin — Task read
// ─────────────────────────────────────────────

// CreateProofCodes bulk-inserts proof codes for a Cluster 2 task.
// This supports physical or activity-based tasks where completion is validated through one-time codes.
func (s *Service) CreateProofCodes(ctx context.Context, taskID string, codes []string) ([]*domain.ProofCode, error) {
	if s.proofRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "proof code repository not initialised")
	}
	task, err := s.taskRepo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task.Cluster != domain.TaskClusterActivity {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "proof codes only apply to ACTIVITY cluster tasks")
	}
	now := time.Now().UTC()
	var docs []*domain.ProofCode
	for _, code := range codes {
		docs = append(docs, &domain.ProofCode{
			BaseEntity: domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			Code:       code,
			TaskID:     taskID,
			IsUsed:     false,
		})
	}
	if err := s.proofRepo.BulkCreate(ctx, docs); err != nil {
		return nil, err
	}
	return docs, nil
}

// ListProofCodes returns proof codes for a task in paginated form for administrative use.
// It is intended for staff-side inventory review rather than public task consumption.
func (s *Service) ListProofCodes(ctx context.Context, taskID string, page, pageSize int64) ([]*domain.ProofCode, int64, error) {
	if s.proofRepo == nil {
		return nil, 0, apperr.New(apperr.ErrCodeInternal, "proof code repository not initialised")
	}
	return s.proofRepo.FindByTaskID(ctx, taskID, database.WithPagination(page, pageSize))
}

// GetTask returns one task by ID.
// This is the simplest read path used by task detail pages and dependent orchestration flows.
func (s *Service) GetTask(ctx context.Context, id string) (*domain.Task, error) {
	if s.taskRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "task repository not initialised")
	}
	return s.taskRepo.FindByID(ctx, id)
}

// ListTasks returns paginated tasks with an optional status filter.
// It backs both administrative management views and filtered task discovery flows.
func (s *Service) ListTasks(ctx context.Context, status *domain.TaskStatus, page, pageSize int64) ([]*domain.Task, int64, error) {
	if s.taskRepo == nil {
		return nil, 0, apperr.New(apperr.ErrCodeInternal, "task repository not initialised")
	}
	opts := []database.QueryOption{
		database.WithPagination(page, pageSize),
	}
	if status != nil {
		return s.taskRepo.FindByStatus(ctx, *status, opts...)
	}
	return s.taskRepo.FindAll(ctx, opts...)
}

// ─────────────────────────────────────────────
//  Cluster 1 — Learning session
// ─────────────────────────────────────────────

// StartLearningSession begins a learning session for a student.
// It enforces task eligibility and ensures a student has at most one active progress record for the task.
func (s *Service) StartLearningSession(ctx context.Context, taskID, wallet string) (*domain.UserProgress, error) {
	if s.progressRepo == nil || s.taskRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "repositories not initialised")
	}
	task, err := s.taskRepo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task.Status != domain.TaskStatusActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task is not active")
	}
	if task.Cluster != domain.TaskClusterLearning {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "this task is not a LEARNING cluster task")
	}
	if task.ExpiresAt != nil && time.Now().UTC().After(*task.ExpiresAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task has expired")
	}

	// Return existing active session
	existing, _ := s.progressRepo.FindByTaskAndUser(ctx, taskID, wallet)
	if existing != nil && existing.Status == domain.ProgressStatusInProgress {
		return existing, nil
	}
	if existing != nil && (existing.Status == domain.ProgressStatusCompleted || existing.Status == domain.ProgressStatusClaimed) {
		return nil, apperr.New(apperr.ErrCodeConflict, "task already completed or claimed")
	}

	now := time.Now().UTC()
	progress := &domain.UserProgress{
		BaseEntity:     domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		UserWallet:     wallet,
		TaskID:         taskID,
		Status:         domain.ProgressStatusInProgress,
		StartTime:      now,
		HeartbeatCount: 0,
	}
	if err := s.progressRepo.Create(ctx, progress); err != nil {
		return nil, err
	}
	return progress, nil
}

// RecordHeartbeat marks that the student is still actively engaging with content.
// Heartbeats are the off-chain signal used to prove continued participation in time-based learning tasks.
func (s *Service) RecordHeartbeat(ctx context.Context, progressID, wallet string) (*domain.UserProgress, error) {
	if s.progressRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "progress repository not initialised")
	}
	progress, err := s.progressRepo.FindByID(ctx, progressID)
	if err != nil {
		return nil, err
	}
	if progress.UserWallet != wallet {
		return nil, apperr.New(apperr.ErrCodeForbidden, "not your session")
	}
	if progress.Status != domain.ProgressStatusInProgress {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "session is not in progress")
	}
	now := time.Now().UTC()
	progress.HeartbeatCount++
	progress.LastHeartbeat = &now
	progress.UpdatedAt = now
	if err := s.progressRepo.Update(ctx, progress); err != nil {
		return nil, err
	}
	return progress, nil
}

// CompleteLearningTask validates a completed learning session and returns an approved reward claim.
// It checks engagement duration, quiz score where applicable, duplicate claims, and finalizes progress state before claim signing.
func (s *Service) CompleteLearningTask(ctx context.Context, taskID, wallet, progressID string, quizScore *int) (*domain.StudentClaim, error) {
	if s.taskRepo == nil || s.progressRepo == nil || s.claimRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "repositories not initialised")
	}

	task, err := s.taskRepo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task.Status != domain.TaskStatusActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task is not active")
	}
	if task.CurrentSlots >= task.MaxSlots {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task slots are full")
	}

	progress, err := s.progressRepo.FindByID(ctx, progressID)
	if err != nil {
		return nil, err
	}
	if progress.UserWallet != wallet {
		return nil, apperr.New(apperr.ErrCodeForbidden, "not your session")
	}
	if progress.TaskID != taskID {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "session does not match task")
	}
	if progress.Status != domain.ProgressStatusInProgress {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "session is not in progress")
	}

	// Validate minimum engagement time
	elapsed := progress.ElapsedSeconds()
	if task.Requirements.MinTimeSeconds > 0 && elapsed < task.Requirements.MinTimeSeconds {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "minimum engagement time not met — keep learning!")
	}

	// Validate quiz score (QUIZ tasks only)
	if task.TaskType == domain.TaskTypeQuiz {
		if quizScore == nil {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "quiz score is required for QUIZ tasks")
		}
		if *quizScore < task.Requirements.MinQuizScore {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "quiz score below minimum threshold")
		}
		progress.QuizScore = quizScore
	}

	// Check for duplicate claim
	existingClaim, _ := s.claimRepo.FindByTaskAndStudent(ctx, taskID, wallet)
	if existingClaim != nil && (existingClaim.Status == domain.ClaimStatusApproved || existingClaim.Status == domain.ClaimStatusTokenReceived) {
		return nil, apperr.New(apperr.ErrCodeConflict, "already claimed this task")
	}

	// Mark progress complete
	now := time.Now().UTC()
	progress.Status = domain.ProgressStatusCompleted
	progress.CompletedAt = &now
	if err := s.progressRepo.Update(ctx, progress); err != nil {
		return nil, err
	}

	return s.buildAndSignClaim(ctx, task, wallet, "LEARNING_COMPLETED")
}

// ─────────────────────────────────────────────
//  Cluster 2 — Physical proof code
// ─────────────────────────────────────────────

// SubmitProofCode validates a physical proof code and returns an approved claim.
// This is the Cluster 2 flow where real-world participation is proven through one-time codes rather than heartbeats.
func (s *Service) SubmitProofCode(ctx context.Context, taskID, wallet, code string) (*domain.StudentClaim, error) {
	if s.taskRepo == nil || s.proofRepo == nil || s.claimRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "repositories not initialised")
	}

	task, err := s.taskRepo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task.Status != domain.TaskStatusActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task is not active")
	}
	if task.Cluster != domain.TaskClusterActivity {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "proof codes only apply to ACTIVITY cluster tasks")
	}
	if task.CurrentSlots >= task.MaxSlots {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task slots are full")
	}
	if task.ExpiresAt != nil && time.Now().UTC().After(*task.ExpiresAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task has expired")
	}

	// Check for duplicate claim
	existingClaim, _ := s.claimRepo.FindByTaskAndStudent(ctx, taskID, wallet)
	if existingClaim != nil && (existingClaim.Status == domain.ClaimStatusApproved || existingClaim.Status == domain.ClaimStatusTokenReceived) {
		return nil, apperr.New(apperr.ErrCodeConflict, "already claimed this task")
	}

	// Validate the proof code (hide details to prevent enumeration attacks)
	proofCode, err := s.proofRepo.FindByCode(ctx, code)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid proof code")
	}
	if proofCode.TaskID != taskID {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "proof code does not match this task")
	}
	if proofCode.IsUsed {
		return nil, apperr.New(apperr.ErrCodeConflict, "proof code has already been used")
	}

	// Atomically mark the code as used
	if err := s.proofRepo.MarkUsed(ctx, proofCode.ID, wallet); err != nil {
		return nil, err
	}

	return s.buildAndSignClaim(ctx, task, wallet, "PROOF_CODE")
}

// ─────────────────────────────────────────────
//  Shared claim building
// ─────────────────────────────────────────────

// buildAndSignClaim creates a StudentClaim record and, when possible, attaches an EIP-712 backend signature.
// It centralizes claim construction so all successful completion paths produce a consistent off-chain claim payload.
func (s *Service) buildAndSignClaim(ctx context.Context, task *domain.Task, wallet, proof string) (*domain.StudentClaim, error) {
	if err := s.ensureKYCVerified(ctx, wallet); err != nil {
		return nil, err
	}

	nonce := randomNonce()
	deadline := time.Now().Add(claimDeadline).Unix()

	var sig string
	if s.signer != nil && task.OnchainTaskId != "" {
		rewardBig, ok := new(big.Int).SetString(task.RewardAmount, 10)
		if !ok {
			rewardBig = big.NewInt(0)
		}
		var err error
		sig, err = s.signer.SignClaim(
			task.OnchainTaskId,
			common.HexToAddress(wallet),
			rewardBig, nonce, big.NewInt(deadline),
		)
		if err != nil {
			s.log.Warn("EIP-712 signing failed — claim still approved", logger.Err(err))
		}
	}

	now := time.Now().UTC()
	claim := &domain.StudentClaim{
		BaseEntity:    domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		TaskID:        task.ID,
		StudentWallet: wallet,
		Nonce:         nonce.String(),
		Deadline:      deadline,
		Proof:         proof,
		RewardAmount:  task.RewardAmount,
		Signature:     sig,
		Status:        domain.ClaimStatusApproved,
	}
	if err := s.claimRepo.Create(ctx, claim); err != nil {
		return nil, err
	}
	return claim, nil
}

// ─────────────────────────────────────────────
//  Generic claim (legacy / free-form proof)
// ─────────────────────────────────────────────

// SubmitClaim records the student's off-chain proof submission through the generic legacy path.
// This path exists for task types that do not go through the specialized learning-session or proof-code flows.
func (s *Service) SubmitClaim(ctx context.Context, taskID, walletAddr, proof string) (*domain.StudentClaim, error) {
	if s.taskRepo == nil || s.claimRepo == nil {
		nonce := randomNonce()
		deadline := time.Now().Add(24 * time.Hour).Unix()
		now := time.Now().UTC()
		return &domain.StudentClaim{
			BaseEntity:    domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			TaskID:        taskID,
			StudentWallet: walletAddr,
			Nonce:         nonce.String(),
			Deadline:      deadline,
			Proof:         proof,
			Status:        domain.ClaimStatusApproved,
		}, nil
	}

	task, err := s.taskRepo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task.Status != domain.TaskStatusActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task is not active")
	}
	if task.CurrentSlots >= task.MaxSlots {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task slots are full")
	}
	if task.ExpiresAt != nil && time.Now().UTC().After(*task.ExpiresAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "task has expired")
	}

	existing, _ := s.claimRepo.FindByTaskAndStudent(ctx, taskID, walletAddr)
	if existing != nil && (existing.Status == domain.ClaimStatusApproved || existing.Status == domain.ClaimStatusTokenReceived) {
		return nil, apperr.New(apperr.ErrCodeConflict, "already claimed this task")
	}

	return s.buildAndSignClaim(ctx, task, walletAddr, proof)
}

// UpdateClaimTx records the on-chain transaction result for a previously approved claim.
// It is called by backend processes after claimReward-like settlement completes or changes state on-chain.
func (s *Service) UpdateClaimTx(ctx context.Context, claimID, txHash, status string) error {
	if s.claimRepo == nil {
		return nil
	}
	claim, err := s.claimRepo.FindByID(ctx, claimID)
	if err != nil {
		return err
	}
	claim.TxHash = txHash
	claim.Status = status
	claim.UpdatedAt = time.Now().UTC()
	if status == domain.ClaimStatusTokenReceived {
		claim.ActivityPoints = 1
	}
	return s.claimRepo.Update(ctx, claim)
}

// GetStudentClaims returns paginated claim history for a wallet.
// This is the primary query for student-facing reward history and support-side claim review.
func (s *Service) GetStudentClaims(ctx context.Context, wallet string, page, pageSize int64) ([]*domain.StudentClaim, int64, error) {
	if s.claimRepo == nil {
		return []*domain.StudentClaim{}, 0, nil
	}
	opts := []database.QueryOption{database.WithPagination(page, pageSize)}
	return s.claimRepo.FindByStudent(ctx, wallet, opts...)
}

// GetUserProgress returns the progress record for a task and wallet pair.
// Callers use this to resume or inspect in-flight learning sessions.
func (s *Service) GetUserProgress(ctx context.Context, taskID, wallet string) (*domain.UserProgress, error) {
	if s.progressRepo == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "progress repository not initialised")
	}
	return s.progressRepo.FindByTaskAndUser(ctx, taskID, wallet)
}

// ExpireHangingSessions marks in-progress sessions that exceeded sessionTimeout as expired.
// A background worker uses this to clean up abandoned learning sessions and keep progress state accurate.
func (s *Service) ExpireHangingSessions(ctx context.Context) (int, error) {
	if s.progressRepo == nil {
		return 0, nil
	}
	sessions, _, err := s.progressRepo.FindByStatus(ctx, domain.ProgressStatusInProgress,
		database.WithPagination(1, 500),
	)
	if err != nil {
		return 0, err
	}
	cutoff := time.Now().UTC().Add(-sessionTimeout)
	count := 0
	for _, sess := range sessions {
		if sess.UpdatedAt.Before(cutoff) {
			sess.Status = domain.ProgressStatusExpired
			if err := s.progressRepo.Update(ctx, sess); err != nil {
				s.log.Error("expire session failed", logger.String("id", sess.ID), logger.Err(err))
				continue
			}
			count++
		}
	}
	return count, nil
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

// randomNonce generates a cryptographically random nonce for claim signing payloads.
// The nonce helps ensure each claim signature remains unique and replay-resistant.
func randomNonce() *big.Int {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return new(big.Int).SetBytes(b)
}

// ensureKYCVerified enforces that a wallet belongs to a user with sufficient KYC verification.
// Reward-bearing task flows call this before producing claims that could lead to token distribution.
func (s *Service) ensureKYCVerified(ctx context.Context, wallet string) error {
	if s.userRepo == nil {
		return apperr.New(apperr.ErrCodeInternal, "user repository not initialised")
	}
	user, err := s.userRepo.FindByWallet(ctx, wallet)
	if err != nil {
		return apperr.New(apperr.ErrCodeForbidden, "KYC verification is required for token-reward activities")
	}
	if user == nil || !user.IsKYCVerified() {
		return apperr.New(apperr.ErrCodeForbidden, "KYC verification is required for token-reward activities")
	}
	return nil
}

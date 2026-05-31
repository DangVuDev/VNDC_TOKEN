package task

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
)

// taskService is the local interface consumed by the HTTP handler.
// Defining the boundary here keeps the handler testable and decoupled from one concrete implementation type.
type taskService interface {
	CreateTask(ctx context.Context, req *CreateTaskRequest) (*domain.Task, error)
	PauseTask(ctx context.Context, id string) (*domain.Task, error)
	ResumeTask(ctx context.Context, id string) (*domain.Task, error)
	GetTask(ctx context.Context, id string) (*domain.Task, error)
	ListTasks(ctx context.Context, status *domain.TaskStatus, page, pageSize int64) ([]*domain.Task, int64, error)
	// Generic claim
	SubmitClaim(ctx context.Context, taskID, walletAddr, proof string) (*domain.StudentClaim, error)
	UpdateClaimTx(ctx context.Context, claimID, txHash, status string) error
	GetStudentClaims(ctx context.Context, wallet string, page, pageSize int64) ([]*domain.StudentClaim, int64, error)
	// Admin — proof codes
	CreateProofCodes(ctx context.Context, taskID string, codes []string) ([]*domain.ProofCode, error)
	ListProofCodes(ctx context.Context, taskID string, page, pageSize int64) ([]*domain.ProofCode, int64, error)
	// Cluster 1 — learning sessions
	StartLearningSession(ctx context.Context, taskID, wallet string) (*domain.UserProgress, error)
	RecordHeartbeat(ctx context.Context, progressID, wallet string) (*domain.UserProgress, error)
	CompleteLearningTask(ctx context.Context, taskID, wallet, progressID string, quizScore *int) (*domain.StudentClaim, error)
	GetUserProgress(ctx context.Context, taskID, wallet string) (*domain.UserProgress, error)
	// Cluster 2 — physical proof codes
	SubmitProofCode(ctx context.Context, taskID, wallet, code string) (*domain.StudentClaim, error)
}

// Handler handles task-related HTTP requests for public task discovery, student claim flows, and admin management actions.
// It translates HTTP inputs into service calls and shapes custom response payloads for task-specific frontend needs.
type Handler struct {
	svc taskService
	log logger.Logger
}

// NewHandler constructs the task HTTP handler and accepts any implementation satisfying the local taskService interface.
// This extra indirection is useful when different task-service variants are wired during testing or composition.
func NewHandler(svc interface{}, log logger.Logger) *Handler {
	h := &Handler{log: log}
	if s, ok := svc.(taskService); ok {
		h.svc = s
	}
	return h
}

// RegisterRoutes wires public task routes, authenticated student workflows, and admin management endpoints.
// Route grouping exposes the task module's access model directly in the transport layer.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	tasks := router.Group("/tasks")
	{
		// Public
		tasks.GET("", h.ListTasks)
		tasks.GET("/:taskId", h.GetTask)

		// Authenticated student routes
		auth := tasks.Group("")
		auth.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
		{
			// Generic claim (backwards-compatible)
			auth.POST("/:taskId/claims", h.SubmitClaim, middleware.RequireKYCLevel(1, userRepo))
			auth.GET("/claims/my", h.GetMyClaims)
			auth.POST("/claims/:claimId/confirm", h.ConfirmClaim, middleware.RequireKYCLevel(1, userRepo))

			// Cluster 1 — Learning session
			auth.POST("/:taskId/session/start", h.StartSession, middleware.RequireKYCLevel(1, userRepo))
			auth.POST("/:taskId/session/heartbeat", h.Heartbeat)
			auth.POST("/:taskId/session/complete", h.CompleteTask)
			auth.GET("/:taskId/progress", h.GetProgress)

			// Cluster 2 — Physical proof code
			// Rate limited at 5 req/min per wallet to prevent brute-force
			proof := auth.Group("")
			proof.Use(middleware.RateLimit(5, 10))
			proof.POST("/:taskId/proof-code", h.SubmitProofCode)
		}

		// Admin routes
		admin := tasks.Group("/admin")
		admin.Use(middleware.AuthWithBlacklist(jwtSecret, blacklistChecker))
		admin.Use(middleware.RequireRole("ADMIN"))
		{
			admin.POST("", h.CreateTask)
			admin.POST("/:id/pause", h.PauseTask)
			admin.POST("/:id/resume", h.ResumeTask)
			// Proof code management
			admin.POST("/:id/proof-codes", h.CreateProofCodes)
			admin.GET("/:id/proof-codes", h.ListProofCodes)
		}
	}
}

// ─────────────────────────────────────────────
//  Public handlers
// ─────────────────────────────────────────────

// ListTasks handles public task discovery with optional status filtering and manual pagination parsing.
// The handler shapes a custom payload that includes both task items and pagination metadata.
// ListTasks GET /v1/tasks
func (h *Handler) ListTasks(c *gin.Context) {
	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.DefaultQuery("page_size", "20"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var statusFilter *domain.TaskStatus
	if s := c.Query("status"); s != "" {
		ts := domain.TaskStatus(s)
		statusFilter = &ts
	}

	tasks, total, err := h.svc.ListTasks(c.Request.Context(), statusFilter, page, pageSize)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	resp := make([]TaskResponse, 0, len(tasks))
	for _, t := range tasks {
		resp = append(resp, taskToResponse(t))
	}
	apihttp.OK(c, &gin.H{
		"tasks": resp,
		"pagination": gin.H{
			"page":        page,
			"page_size":   pageSize,
			"total":       total,
			"total_pages": (total + pageSize - 1) / pageSize,
		},
	})
}

// GetTask handles retrieval of one task by its route identifier.
// It converts the domain task into the response DTO expected by clients.
// GetTask GET /v1/tasks/:id
func (h *Handler) GetTask(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "taskId")
	if !ok {
		return
	}
	task, err := h.svc.GetTask(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	r := taskToResponse(task)
	apihttp.OK(c, &r)
}

// ─────────────────────────────────────────────
//  Authenticated student handlers
// ─────────────────────────────────────────────

// SubmitClaim handles the generic off-chain proof submission flow for a task.
// It requires an authenticated wallet and returns the claim details needed for subsequent contract interaction.
// SubmitClaim POST /v1/tasks/:taskId/claims
// Student submits off-chain proof. Backend records it and returns claim details
// including the nonce and deadline needed for the EIP-712 contract call.
func (h *Handler) SubmitClaim(c *gin.Context) {
	taskID := c.Param("taskId")
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, errUnauthorized())
		return
	}

	var req SubmitClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apihttp.Fail(c, err)
		return
	}

	claim, err := h.svc.SubmitClaim(c.Request.Context(), taskID, wallet, req.Proof)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	r := claimToResponse(claim)
	c.JSON(http.StatusCreated, gin.H{"claim": r})
}

// GetMyClaims handles paginated retrieval of the authenticated student's claim history.
// The wallet identity is sourced from middleware so users cannot request another student's claims.
// GetMyClaims GET /v1/tasks/claims/my
func (h *Handler) GetMyClaims(c *gin.Context) {
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, errUnauthorized())
		return
	}
	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.DefaultQuery("page_size", "20"), 10, 64)

	claims, total, err := h.svc.GetStudentClaims(c.Request.Context(), wallet, page, pageSize)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	resp := make([]StudentClaimResponse, 0, len(claims))
	for _, cl := range claims {
		resp = append(resp, claimToResponse(cl))
	}
	apihttp.OK(c, &gin.H{
		"claims": resp,
		"pagination": gin.H{
			"page":        page,
			"page_size":   pageSize,
			"total":       total,
			"total_pages": (total + pageSize - 1) / pageSize,
		},
	})
}

// ConfirmClaim handles the post-on-chain callback step where the client submits the resulting transaction hash.
// This lets the backend reconcile off-chain claim state with the on-chain reward-claim transaction.
// ConfirmClaim POST /v1/tasks/claims/:claimId/confirm
// After the student successfully calls claimReward() on the contract,
// they POST the tx hash here so the backend can update the claim record.
func (h *Handler) ConfirmClaim(c *gin.Context) {
	claimID := c.Param("claimId")

	var req struct {
		TxHash string `json:"tx_hash" binding:"required"`
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	status := req.Status
	if status == "" {
		status = "SUCCESS"
	}
	if err := h.svc.UpdateClaimTx(c.Request.Context(), claimID, req.TxHash, status); err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{"claim_id": claimID, "status": status, "tx_hash": req.TxHash})
}

// ─────────────────────────────────────────────
//  Admin handlers
// ─────────────────────────────────────────────

// CreateTask handles admin-side creation of a new task definition.
// The handler binds the request JSON manually and returns the created task DTO wrapper.
// CreateTask POST /v1/tasks/admin
func (h *Handler) CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	task, err := h.svc.CreateTask(c.Request.Context(), &req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	r := taskToResponse(task)
	c.JSON(http.StatusCreated, gin.H{"task": r})
}

// PauseTask handles the admin action that pauses an existing task.
// It is a thin wrapper around the service-level status transition.
// PauseTask POST /v1/tasks/admin/:id/pause
func (h *Handler) PauseTask(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	task, err := h.svc.PauseTask(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	r := taskToResponse(task)
	apihttp.OK(c, &r)
}

// ResumeTask handles the admin action that resumes a paused task.
// It mirrors PauseTask and returns the updated task snapshot.
// ResumeTask POST /v1/tasks/admin/:id/resume
func (h *Handler) ResumeTask(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	task, err := h.svc.ResumeTask(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	r := taskToResponse(task)
	apihttp.OK(c, &r)
}

// ─────────────────────────────────────────────
//  Mapping helpers
// ─────────────────────────────────────────────

// taskToResponse converts the domain task model into the response DTO used by task endpoints.
// This helper centralizes serialization of quiz questions, timestamps, and compatibility fields.
func taskToResponse(t *domain.Task) TaskResponse {
	// Convert quiz questions
	var quizDTOs []QuizQuestionDTO
	for _, q := range t.QuizQuestions {
		quizDTOs = append(quizDTOs, QuizQuestionDTO{
			ID:           q.ID,
			Question:     q.Question,
			Options:      q.Options,
			CorrectIndex: q.CorrectIndex,
		})
	}

	fmt.Printf("[DEBUG] taskToResponse called: cluster=%q, taskType=%q, contentURL=%q, quizLen=%d\n",
		t.Cluster, t.TaskType, t.ContentURL, len(t.QuizQuestions))

	r := TaskResponse{
		ID:                  t.ID,
		Title:               t.Title,
		Description:         t.Description,
		Cluster:             string(t.Cluster),
		TaskType:            string(t.TaskType),
		Requirements:        RequirementsDTO{MinTimeSeconds: t.Requirements.MinTimeSeconds, MinQuizScore: t.Requirements.MinQuizScore},
		RewardAmount:        t.RewardAmount,
		MaxSlots:            t.MaxSlots,
		CurrentSlots:        t.CurrentSlots,
		RemainingSlots:      t.MaxSlots - t.CurrentSlots,
		Status:              string(t.Status),
		OnchainTaskId:       t.OnchainTaskId,
		ContractAddress:     t.ContractAddr,
		ContentURL:          t.ContentURL,
		QuizQuestions:       quizDTOs,
		CreatedAt:           t.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:           t.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		DiagnosticTestField: "BINARY_IS_LATEST",
	}
	fmt.Printf("[DEBUG] taskToResponse result: cluster=%q, taskType=%q, contentURL=%q, json_cluster=%q\n",
		r.Cluster, r.TaskType, r.ContentURL, r.Cluster)
	if t.ExpiresAt != nil {
		s := t.ExpiresAt.Format("2006-01-02T15:04:05Z")
		r.ExpiresAt = &s
	}
	return r
}

// claimToResponse converts a domain claim record into the HTTP response shape expected by clients.
func claimToResponse(c *domain.StudentClaim) StudentClaimResponse {
	return StudentClaimResponse{
		ID:             c.ID,
		TaskID:         c.TaskID,
		StudentWallet:  c.StudentWallet,
		Nonce:          c.Nonce,
		Deadline:       c.Deadline,
		Signature:      c.Signature,
		Status:         c.Status,
		RewardAmount:   c.RewardAmount,
		ActivityPoints: c.ActivityPoints,
		TxHash:         c.TxHash,
		ErrorMessage:   c.ErrorMsg,
		CreatedAt:      c.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      c.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

// errUnauthorized creates the standard auth error used when wallet-bearing task endpoints lack an authenticated caller.
func errUnauthorized() error {
	return apperr.New(apperr.ErrCodeUnauthorized, "authentication required")
}

// ─────────────────────────────────────────────
//  Cluster 1 — Learning session handlers
// ─────────────────────────────────────────────

// StartSession handles the beginning of the learning-session proof-of-engagement flow.
// It creates or resumes a progress record tied to the authenticated wallet and the selected task.
// StartSession POST /v1/tasks/:taskId/session/start
func (h *Handler) StartSession(c *gin.Context) {
	taskID := c.Param("taskId")
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, errUnauthorized())
		return
	}
	progress, err := h.svc.StartLearningSession(c.Request.Context(), taskID, wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &StartSessionResponse{
		ProgressID: progress.ID,
		TaskID:     progress.TaskID,
		Status:     string(progress.Status),
		StartTime:  progress.StartTime.Format("2006-01-02T15:04:05Z"),
		Message:    "Session started. Send heartbeats periodically to prove engagement.",
	})
}

// Heartbeat handles periodic engagement pings for an active learning session.
// The service tracks elapsed time and heartbeat count used for later task-completion validation.
// Heartbeat POST /v1/tasks/:taskId/session/heartbeat
func (h *Handler) Heartbeat(c *gin.Context) {
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, errUnauthorized())
		return
	}
	var req HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	progress, err := h.svc.RecordHeartbeat(c.Request.Context(), req.ProgressID, wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &HeartbeatResponse{
		ProgressID:     progress.ID,
		HeartbeatCount: progress.HeartbeatCount,
		ElapsedSeconds: progress.ElapsedSeconds(),
		Status:         string(progress.Status),
	})
}

// CompleteTask handles the finalization of a learning task after the session and optional quiz are complete.
// Successful completion returns a claim response rather than only an acknowledgment so the next reward step can proceed immediately.
// CompleteTask POST /v1/tasks/:taskId/session/complete
func (h *Handler) CompleteTask(c *gin.Context) {
	taskID := c.Param("taskId")
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, errUnauthorized())
		return
	}
	var req CompleteTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	claim, err := h.svc.CompleteLearningTask(c.Request.Context(), taskID, wallet, req.ProgressID, req.QuizScore)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	r := claimToResponse(claim)
	c.JSON(http.StatusCreated, gin.H{"claim": r})
}

// GetProgress handles retrieval of the caller's current progress snapshot for a learning task.
// This endpoint supports resumable UX and client-side timers without exposing other users' progress.
// GetProgress GET /v1/tasks/:taskId/progress
func (h *Handler) GetProgress(c *gin.Context) {
	taskID := c.Param("taskId")
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, errUnauthorized())
		return
	}
	progress, err := h.svc.GetUserProgress(c.Request.Context(), taskID, wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &gin.H{
		"progress_id":     progress.ID,
		"task_id":         progress.TaskID,
		"status":          string(progress.Status),
		"start_time":      progress.StartTime.Format("2006-01-02T15:04:05Z"),
		"heartbeat_count": progress.HeartbeatCount,
		"elapsed_seconds": progress.ElapsedSeconds(),
		"quiz_score":      progress.QuizScore,
	})
}

// ─────────────────────────────────────────────
//  Cluster 2 — Physical proof code handler
// ─────────────────────────────────────────────

// SubmitProofCode handles the physical-proof-code claim flow for tasks in the corresponding cluster.
// The surrounding route group applies rate limiting to reduce brute-force attempts.
// SubmitProofCode POST /v1/tasks/:taskId/proof-code
func (h *Handler) SubmitProofCode(c *gin.Context) {
	taskID := c.Param("taskId")
	wallet := middleware.WalletAddress(c)
	if wallet == "" {
		apihttp.Fail(c, errUnauthorized())
		return
	}
	var req SubmitProofCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	claim, err := h.svc.SubmitProofCode(c.Request.Context(), taskID, wallet, req.Code)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	r := claimToResponse(claim)
	c.JSON(http.StatusCreated, gin.H{"claim": r})
}

// ─────────────────────────────────────────────
//  Admin — Proof code management
// ─────────────────────────────────────────────

// CreateProofCodes handles bulk creation of proof codes for an admin-managed task.
// It returns both the generated code list and the count so operators can verify issuance immediately.
// CreateProofCodes POST /v1/tasks/admin/:id/proof-codes
func (h *Handler) CreateProofCodes(c *gin.Context) {
	taskID, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	var req CreateProofCodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apihttp.Fail(c, err)
		return
	}
	codes, err := h.svc.CreateProofCodes(c.Request.Context(), taskID, req.Codes)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	resp := make([]ProofCodeResponse, 0, len(codes))
	for _, pc := range codes {
		resp = append(resp, proofCodeToResponse(pc))
	}
	c.JSON(http.StatusCreated, gin.H{"proof_codes": resp, "count": len(resp)})
}

// ListProofCodes handles paginated admin retrieval of proof codes attached to a task.
// Manual page parsing is kept here so the response can include custom pagination metadata.
// ListProofCodes GET /v1/tasks/admin/:id/proof-codes
func (h *Handler) ListProofCodes(c *gin.Context) {
	taskID, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.DefaultQuery("page_size", "50"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}
	codes, total, err := h.svc.ListProofCodes(c.Request.Context(), taskID, page, pageSize)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	resp := make([]ProofCodeResponse, 0, len(codes))
	for _, pc := range codes {
		resp = append(resp, proofCodeToResponse(pc))
	}
	apihttp.OK(c, &gin.H{
		"proof_codes": resp,
		"pagination": gin.H{
			"page": page, "page_size": pageSize,
			"total": total, "total_pages": (total + pageSize - 1) / pageSize,
		},
	})
}

// ─────────────────────────────────────────────
//  Mapping helpers
// ─────────────────────────────────────────────

// proofCodeToResponse converts a proof-code domain entity into the admin-facing response DTO.
func proofCodeToResponse(pc *domain.ProofCode) ProofCodeResponse {
	r := ProofCodeResponse{
		ID:         pc.ID,
		Code:       pc.Code,
		TaskID:     pc.TaskID,
		IsUsed:     pc.IsUsed,
		AssignedTo: pc.AssignedTo,
		CreatedAt:  pc.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
	if pc.UsedAt != nil {
		s := pc.UsedAt.Format("2006-01-02T15:04:05Z")
		r.UsedAt = &s
	}
	return r
}

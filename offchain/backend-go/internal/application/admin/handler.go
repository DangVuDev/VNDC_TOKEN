// Package admin — HTTP handlers for the admin statistics API.
// All routes require ADMIN role.
package admin

import (
	"github.com/gin-gonic/gin"

	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
)

// Handler exposes administrative HTTP endpoints for dashboard metrics, moderation queues, and analytics reads.
// It is responsible for request binding and response shaping, while all business decisions remain in the service layer.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the admin HTTP handler and scopes its logger for transport-layer diagnostics.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("admin_handler")}
}

// RegisterRoutes mounts all admin endpoints behind JWT authentication and elevated-role checks.
// This centralizes the transport boundary for privileged admin APIs so every route inherits the same access policy.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	adminOnly := middleware.RequireRole("ADMIN", "SUPER_ADMIN")

	adminGroup := v1.Group("/admin")
	adminGroup.Use(protected, adminOnly)
	{
		adminGroup.GET("/stats", h.GetStats)
		adminGroup.GET("/analytics", h.GetAnalytics)
		adminGroup.GET("/users", h.ListUsers)
		adminGroup.GET("/transactions/pending", h.ListPendingTransactions)
		adminGroup.POST("/transactions/:id/approve", h.ApprovePendingTransaction)
		adminGroup.POST("/transactions/:id/reject", h.RejectPendingTransaction)
	}
}

// GetStats handles the admin dashboard headline-metrics request.
// It delegates all aggregation work to the service and only converts the result into the standard API response envelope.
// GetStats godoc
//
//	@Summary      Admin platform statistics
//	@Description  Returns aggregated user counts (by KYC level, status, activity) and
//	@Description  transaction counts (by status). Requires ADMIN role.
//	@Tags         Admin
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  AdminStatsResponse
//	@Failure      401  {object}  map[string]any  "Missing or invalid Bearer token"
//	@Failure      403  {object}  map[string]any  "Requires ADMIN role"
//	@Failure      500  {object}  map[string]any  "Internal server error"
//	@Router       /admin/stats [get]
func (h *Handler) GetStats(c *gin.Context) {
	stats, err := h.svc.GetStats(c.Request.Context())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, stats)
}

// ListPendingTransactions handles the admin review queue endpoint for unresolved transactions.
// It normalizes paging inputs, maps domain transactions into response items, and returns a paged payload.
// ListPendingTransactions godoc
//
//	@Summary      List pending transactions (admin)
//	@Description  Returns a paginated list of transactions with PENDING status.
//	@Tags         Admin
//	@Produce      json
//	@Security     BearerAuth
//	@Param        page       query  int  false  "Page number (default: 1)"   example(1)
//	@Param        page_size  query  int  false  "Items per page (max: 100)"  example(20)
//	@Success      200  {object}  PendingTxListResponse
//	@Failure      401  {object}  map[string]any  "Missing or invalid Bearer token"
//	@Failure      403  {object}  map[string]any  "Requires ADMIN role"
//	@Failure      500  {object}  map[string]any  "Internal server error"
//	@Router       /admin/transactions/pending [get]
func (h *Handler) ListPendingTransactions(c *gin.Context) {
	req, ok := apihttp.BindQuery[ListPendingTxRequest](c)
	if !ok {
		return
	}

	txs, total, err := h.svc.ListPendingTransactions(c.Request.Context(), req.Page, req.PageSize)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	items := make([]*PendingTransactionItem, 0, len(txs))
	for _, tx := range txs {
		items = append(items, &PendingTransactionItem{
			ID:         tx.ID,
			Type:       string(tx.Type),
			FromWallet: tx.FromWallet,
			ToWallet:   tx.ToWallet,
			Amount:     tx.Amount,
			Status:     string(tx.Status),
			CreatedAt:  tx.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		})
	}

	apihttp.OK(c, &PendingTxListResponse{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// ApprovePendingTransaction handles the admin action that releases a reviewable transaction back into pending processing.
// The handler only resolves the path parameter and serializes the updated transaction summary.
// ApprovePendingTransaction godoc
//
//	@Summary      Approve pending transaction (admin)
//	@Description  Marks a queued/pending transaction as PENDING for worker pickup.
//	@Tags         Admin
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id  path  string  true  "Transaction ID"
//	@Success      200  {object}  PendingTransactionItem
//	@Failure      401  {object}  map[string]any
//	@Failure      403  {object}  map[string]any
//	@Failure      404  {object}  map[string]any
//	@Failure      500  {object}  map[string]any
//	@Router       /admin/transactions/{id}/approve [post]
func (h *Handler) ApprovePendingTransaction(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	tx, err := h.svc.ApprovePendingTransaction(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &PendingTransactionItem{
		ID:         tx.ID,
		Type:       string(tx.Type),
		FromWallet: tx.FromWallet,
		ToWallet:   tx.ToWallet,
		Amount:     tx.Amount,
		Status:     string(tx.Status),
		CreatedAt:  tx.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

// RejectPendingTransaction handles the admin rejection flow for queued or pending transactions.
// It binds the optional rejection reason and returns the updated transaction snapshot after service execution.
// RejectPendingTransaction godoc
//
//	@Summary      Reject pending transaction (admin)
//	@Description  Rejects a queued/pending transaction and rolls back reserved balance.
//	@Tags         Admin
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id  path  string  true  "Transaction ID"
//	@Param        body  body  RejectPendingTxRequest  false  "Reject reason"
//	@Success      200  {object}  PendingTransactionItem
//	@Failure      401  {object}  map[string]any
//	@Failure      403  {object}  map[string]any
//	@Failure      404  {object}  map[string]any
//	@Failure      500  {object}  map[string]any
//	@Router       /admin/transactions/{id}/reject [post]
func (h *Handler) RejectPendingTransaction(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[RejectPendingTxRequest](c)
	if !ok {
		return
	}
	tx, err := h.svc.RejectPendingTransaction(c.Request.Context(), id, req.Reason)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, &PendingTransactionItem{
		ID:         tx.ID,
		Type:       string(tx.Type),
		FromWallet: tx.FromWallet,
		ToWallet:   tx.ToWallet,
		Amount:     tx.Amount,
		Status:     string(tx.Status),
		CreatedAt:  tx.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

// GetAnalytics handles the broader admin analytics endpoint spanning multiple platform modules.
// Compared with GetStats, this route is aimed at sectioned reporting rather than only operational counters.
// GetAnalytics godoc
//
//	@Summary      Admin analytics — per-module statistics
//	@Description  Returns aggregated counts for all platform modules.
//	@Tags         Admin
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  AnalyticsResponse
//	@Failure      401  {object}  map[string]any  "Missing or invalid Bearer token"
//	@Failure      403  {object}  map[string]any  "Requires ADMIN role"
//	@Failure      500  {object}  map[string]any  "Internal server error"
//	@Router       /admin/analytics [get]
func (h *Handler) GetAnalytics(c *gin.Context) {
	data, err := h.svc.GetAnalytics(c.Request.Context())
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, data)
}

// ListUsers handles the admin user-directory endpoint with query-driven filtering and pagination.
// The service performs the actual lookup logic; the handler stays focused on HTTP concerns.
// ListUsers godoc
//
//	@Summary      Admin user list
//	@Description  Returns paginated, filterable list of all users. Requires ADMIN role.
//	@Tags         Admin
//	@Produce      json
//	@Security     BearerAuth
//	@Param        status    query  string  false  "Filter by status (ACTIVE/SUSPENDED/BANNED)"
//	@Param        kyc_level query  string  false  "Filter by KYC level (0/1/2)"
//	@Param        search    query  string  false  "Search by username or wallet"
//	@Param        page      query  int     false  "Page number (default: 1)"
//	@Param        page_size query  int     false  "Items per page (max: 100)"
//	@Success      200  {object}  AdminUserListResponse
//	@Failure      401  {object}  map[string]any
//	@Failure      403  {object}  map[string]any
//	@Failure      500  {object}  map[string]any
//	@Router       /admin/users [get]
func (h *Handler) ListUsers(c *gin.Context) {
	req, ok := apihttp.BindQuery[ListAdminUsersRequest](c)
	if !ok {
		return
	}
	result, err := h.svc.ListUsers(c.Request.Context(), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, result)
}

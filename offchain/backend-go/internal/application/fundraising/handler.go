package fundraising

import (
	"github.com/gin-gonic/gin"

	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler contains fundraising HTTP handlers for activity management, ledger reads, and contract-assisted fund operations.
// It keeps HTTP binding and actor extraction close to the transport edge while leaving financial rules to the service layer.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the fundraising HTTP handler with a scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("fundraising_handler")}
}

// RegisterRoutes mounts public fundraising read routes and protected activity-management or ledger-mutation routes.
// KYC-protected mutation endpoints ensure only verified actors can create, modify, or move funds.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	funds := v1.Group("/funds")
	{
		funds.GET("", h.ListActivities)
		funds.GET("/:id", h.GetActivity)
		funds.GET("/:id/ledger", h.ListLedger)
		funds.GET("/:id/summary", h.GetSummary)

		funds.POST("", protected, middleware.RequireKYCLevel(1, userRepo), h.CreateActivity)
		funds.PUT("/:id", protected, middleware.RequireKYCLevel(1, userRepo), h.UpdateActivity)
		funds.POST("/:id/close", protected, middleware.RequireKYCLevel(1, userRepo), h.CloseActivity)
		funds.POST("/:id/reopen", protected, middleware.RequireKYCLevel(1, userRepo), h.ReopenActivity)
		funds.POST("/:id/deputies", protected, middleware.RequireKYCLevel(1, userRepo), h.AddDeputy)
		funds.DELETE("/:id/deputies/:wallet", protected, middleware.RequireKYCLevel(1, userRepo), h.RemoveDeputy)
		funds.POST("/:id/contributions", protected, middleware.RequireKYCLevel(1, userRepo), h.RecordContribution)
		funds.POST("/:id/expenses", protected, middleware.RequireKYCLevel(1, userRepo), h.RecordExpense)
		funds.POST(":id/contract/create-pot", protected, middleware.RequireKYCLevel(1, userRepo), h.CreatePotOnChain)
		funds.POST(":id/contract/status", protected, middleware.RequireKYCLevel(1, userRepo), h.SetContractStatus)
		funds.POST(":id/contract/record-contribution", protected, middleware.RequireKYCLevel(1, userRepo), h.RecordContractContribution)
		funds.POST(":id/contract/spend", protected, middleware.RequireKYCLevel(1, userRepo), h.SpendContractFunds)
	}
}

// CreateActivity handles creation of a new fundraising activity initiated by the authenticated owner wallet.
// The handler binds the activity payload and returns the created activity record.
func (h *Handler) CreateActivity(c *gin.Context) {
	req, ok := apihttp.Bind[CreateFundActivityRequest](c)
	if !ok {
		return
	}
	activity, err := h.svc.CreateActivity(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, activity)
}

// ListActivities handles paginated fundraising-activity discovery with optional member/owner filters.
// The caller wallet is forwarded so the service can support mine/member-centric listings when requested.
func (h *Handler) ListActivities(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListFundActivitiesQuery](c)
	if !ok {
		filter = &ListFundActivitiesQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListActivities(c.Request.Context(), middleware.WalletAddress(c), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetActivity handles retrieval of one fundraising activity by ID.
// This is the detail endpoint for activity pages and contribution flows.
func (h *Handler) GetActivity(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	activity, err := h.svc.GetActivity(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, activity)
}

// UpdateActivity handles owner-side updates to fundraising metadata and configuration.
// The acting wallet comes from middleware so ownership checks remain server-controlled.
func (h *Handler) UpdateActivity(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[UpdateFundActivityRequest](c)
	if !ok {
		return
	}
	activity, err := h.svc.UpdateActivity(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, activity)
}

// AddDeputy handles owner-side assignment of an additional deputy wallet to an activity.
// Deputy-management semantics are enforced downstream by the service and optional contract adapter.
func (h *Handler) AddDeputy(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[AddDeputyRequest](c)
	if !ok {
		return
	}
	activity, err := h.svc.AddDeputy(c.Request.Context(), id, middleware.WalletAddress(c), req.Wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, activity)
}

// RemoveDeputy handles removal of one deputy wallet from an activity.
// The wallet to remove is taken from the path for an explicit, resource-oriented route shape.
func (h *Handler) RemoveDeputy(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	wallet, ok := apihttp.PathParam(c, "wallet")
	if !ok {
		return
	}
	activity, err := h.svc.RemoveDeputy(c.Request.Context(), id, middleware.WalletAddress(c), wallet)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, activity)
}

// CloseActivity handles the owner action that closes a fundraising activity to further routine operations.
// If configured, downstream service logic may also synchronize this status to the linked on-chain pot.
func (h *Handler) CloseActivity(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	activity, err := h.svc.CloseActivity(c.Request.Context(), id, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, activity)
}

// ReopenActivity handles reopening of a previously closed fundraising activity.
// Cancellation-state restrictions remain enforced by the service layer.
func (h *Handler) ReopenActivity(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	activity, err := h.svc.ReopenActivity(c.Request.Context(), id, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, activity)
}

// RecordContribution handles creation of a contribution entry and submission of the associated payment flow.
// The actor wallet is passed through from the authenticated session to prevent contributor spoofing.
func (h *Handler) RecordContribution(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[RecordContributionRequest](c)
	if !ok {
		return
	}
	entry, err := h.svc.RecordContribution(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, entry)
}

// RecordExpense handles recording of an outbound spending entry against a fundraising activity.
// Expense authorization and balance-availability checks are delegated to the service layer.
func (h *Handler) RecordExpense(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[RecordExpenseRequest](c)
	if !ok {
		return
	}
	entry, err := h.svc.RecordExpense(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, entry)
}

// ListLedger handles paginated retrieval of ledger entries for one fundraising activity.
// It provides the audit-style financial history behind activity finance screens.
func (h *Handler) ListLedger(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListLedger(c.Request.Context(), id, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetSummary handles retrieval of aggregated fundraising summary data for one activity.
// This is the compact read endpoint for totals, balances, and high-level status.
func (h *Handler) GetSummary(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	summary, err := h.svc.GetSummary(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, summary)
}

// CreatePotOnChain handles the explicit action that provisions the on-chain funding pot for an existing activity.
// It is separate from generic activity creation so operators can manage synchronization manually when needed.
func (h *Handler) CreatePotOnChain(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	resp, err := h.svc.CreatePotOnChain(c.Request.Context(), id, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// SetContractStatus handles direct status changes on the underlying on-chain funding pot.
// The service coordinates contract interaction and any mirrored off-chain state adjustments.
func (h *Handler) SetContractStatus(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[SetContractStatusRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.SetContractStatus(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// RecordContractContribution handles manual reconciliation of a contribution known to have occurred at the contract layer.
// This endpoint exists for operator-side synchronization or recovery workflows.
func (h *Handler) RecordContractContribution(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[ManualContractContributionRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.RecordContractContribution(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// SpendContractFunds handles manual contract-spend recording for operator-driven fund disbursement flows.
// The service remains responsible for reconciling ledger effects and contract-side semantics.
func (h *Handler) SpendContractFunds(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[ManualContractSpendRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.SpendContractFunds(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

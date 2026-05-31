package dao

import (
	"github.com/gin-gonic/gin"

	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the DAO HTTP handler with a module-scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("dao_handler")}
}

// RegisterRoutes wires public DAO read endpoints and authenticated governance write endpoints.
// Governance mutations are protected with authentication and KYC middleware so only verified users can participate.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	dao := v1.Group("/dao")
	{
		dao.GET("", h.ListDAOs)
		dao.GET("/:id", h.GetDAO)
		dao.GET("/:id/proposals", h.ListProposals)
		dao.GET("/proposals/:proposalId", h.GetProposal)
		dao.GET("/proposals/:proposalId/votes", h.ListVotes)

		dao.POST("", protected, middleware.RequireKYCLevel(1, userRepo), h.CreateDAO)
		dao.POST("/:id/status", protected, middleware.RequireKYCLevel(1, userRepo), h.SetDAOStatus)
		dao.POST("/:id/proposals", protected, middleware.RequireKYCLevel(1, userRepo), h.CreateProposal)
		dao.POST("/proposals/:proposalId/vote", protected, middleware.RequireKYCLevel(1, userRepo), h.CastVote)
		dao.POST("/proposals/:proposalId/queue", protected, middleware.RequireKYCLevel(1, userRepo), h.QueueProposal)
		dao.POST("/proposals/:proposalId/execute", protected, middleware.RequireKYCLevel(1, userRepo), h.ExecuteProposal)
		dao.POST("/proposals/:proposalId/cancel", protected, middleware.RequireKYCLevel(1, userRepo), h.CancelProposal)
	}
}

// CreateDAO handles creation of a DAO organization initiated by the authenticated founder wallet.
// The handler binds the creation payload and returns the resulting persisted DAO record.
func (h *Handler) CreateDAO(c *gin.Context) {
	req, ok := apihttp.Bind[CreateDAORequest](c)
	if !ok {
		return
	}
	dao, err := h.svc.CreateDAO(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, dao)
}

// SetDAOStatus handles activation-state changes for an existing DAO.
// The acting wallet is taken from middleware so founder authorization stays server-controlled.
func (h *Handler) SetDAOStatus(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[SetDAOStatusRequest](c)
	if !ok {
		return
	}
	dao, err := h.svc.SetDAOActive(c.Request.Context(), id, middleware.WalletAddress(c), req.Active)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, dao)
}

// ListDAOs handles paginated retrieval of DAO organizations for discovery or governance dashboards.
// Query pagination is normalized here before delegating to the service.
func (h *Handler) ListDAOs(c *gin.Context) {
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListDAOs(c.Request.Context(), *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetDAO handles retrieval of one DAO by its path identifier.
// This is the main detail endpoint for DAO overview pages.
func (h *Handler) GetDAO(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	dao, err := h.svc.GetDAO(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, dao)
}

// CreateProposal handles proposal creation inside a specific DAO.
// It binds the proposal payload and derives the actor wallet from the authenticated request context.
func (h *Handler) CreateProposal(c *gin.Context) {
	daoID, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[CreateProposalRequest](c)
	if !ok {
		return
	}
	proposal, err := h.svc.CreateProposal(c.Request.Context(), daoID, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, proposal)
}

// CastVote handles submission of one governance vote for a proposal.
// Vote-choice validation lives in the service, while the handler stays focused on transport binding.
func (h *Handler) CastVote(c *gin.Context) {
	proposalID, ok := apihttp.PathParam(c, "proposalId")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[CastVoteRequest](c)
	if !ok {
		return
	}
	vote, err := h.svc.CastVote(c.Request.Context(), proposalID, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, vote)
}

// QueueProposal handles the governance action that moves a successful proposal into the queued state.
// The total voting power supplied by the caller is passed through to the service for downstream validation and on-chain execution.
func (h *Handler) QueueProposal(c *gin.Context) {
	proposalID, ok := apihttp.PathParam(c, "proposalId")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[QueueProposalRequest](c)
	if !ok {
		return
	}
	proposal, err := h.svc.QueueProposal(c.Request.Context(), proposalID, middleware.WalletAddress(c), req.TotalVotingPower)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, proposal)
}

// ExecuteProposal handles execution of a queued governance proposal.
// It is a thin authenticated wrapper around the service's execute flow.
func (h *Handler) ExecuteProposal(c *gin.Context) {
	proposalID, ok := apihttp.PathParam(c, "proposalId")
	if !ok {
		return
	}
	proposal, err := h.svc.ExecuteProposal(c.Request.Context(), proposalID, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, proposal)
}

// CancelProposal handles founder-side proposal cancellation with an optional reason payload.
// The service layer remains responsible for checking whether the proposal is still cancellable.
func (h *Handler) CancelProposal(c *gin.Context) {
	proposalID, ok := apihttp.PathParam(c, "proposalId")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[CancelProposalRequest](c)
	if !ok {
		return
	}
	proposal, err := h.svc.CancelProposal(c.Request.Context(), proposalID, middleware.WalletAddress(c), req.Reason)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, proposal)
}

// ListProposals handles paginated retrieval of proposals belonging to one DAO.
// This endpoint supports governance listings and proposal history views.
func (h *Handler) ListProposals(c *gin.Context) {
	daoID, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListProposals(c.Request.Context(), daoID, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// GetProposal handles retrieval of one proposal by ID.
// It is used for proposal detail views and governance status inspection.
func (h *Handler) GetProposal(c *gin.Context) {
	proposalID, ok := apihttp.PathParam(c, "proposalId")
	if !ok {
		return
	}
	proposal, err := h.svc.GetProposal(c.Request.Context(), proposalID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, proposal)
}

// ListVotes handles paginated retrieval of votes cast on a proposal.
// The handler normalizes paging and returns the service result in the standard paged envelope.
func (h *Handler) ListVotes(c *gin.Context) {
	proposalID, ok := apihttp.PathParam(c, "proposalId")
	if !ok {
		return
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListVotes(c.Request.Context(), proposalID, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

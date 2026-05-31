package campaign

import (
	"github.com/gin-gonic/gin"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler handles HTTP requests for crowdfunding campaign creation, discovery, and contribution flows.
// It keeps route-level access policy and request binding at the transport layer while delegating campaign rules to the service.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the campaign HTTP handler with a module-scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("campaign_handler")}
}

// RegisterRoutes mounts public campaign browsing endpoints and protected creation or contribution endpoints.
// Role and KYC checks at registration time make campaign-authoring and contribution policy explicit.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	campaigns := v1.Group("/campaigns")
	{
		// Public
		campaigns.GET("", h.ListCampaigns)
		campaigns.GET("/:id", h.GetCampaign)

		// LECTURER or ADMIN only
		campaigns.POST("", protected,
			middleware.RequireRole(string(domain.RoleModerator), string(domain.RoleAdmin), string(domain.RoleSuperAdmin), "LECTURER"),
			middleware.RequireKYCLevel(1, userRepo),
			h.CreateCampaign,
		)

		// Any authenticated user
		campaigns.POST("/:id/contribute", protected,
			middleware.RequireKYCLevel(1, userRepo),
			h.Contribute,
		)
	}
}

// CreateCampaign handles creation of a new crowdfunding campaign by an authorized creator.
// The creator wallet is sourced from the authenticated session rather than the request payload.
// CreateCampaign POST /v1/campaigns
func (h *Handler) CreateCampaign(c *gin.Context) {
	req, ok := apihttp.Bind[CreateCampaignRequest](c)
	if !ok {
		return
	}
	campaign, err := h.svc.CreateCampaign(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, campaign)
}

// GetCampaign handles retrieval of one campaign by ID.
// This route is public and read-only for campaign detail pages.
// GetCampaign GET /v1/campaigns/:id
func (h *Handler) GetCampaign(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	campaign, err := h.svc.GetCampaign(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, campaign)
}

// ListCampaigns handles paginated campaign discovery with optional status filtering.
// It binds both filter criteria and pagination before delegating to the service layer.
// ListCampaigns GET /v1/campaigns
func (h *Handler) ListCampaigns(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListCampaignsQuery](c)
	if !ok {
		filter = &ListCampaignsQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListCampaigns(c.Request.Context(), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// Contribute handles an authenticated user's contribution request against a campaign.
// The contributor wallet is taken from middleware so contributions cannot be submitted on behalf of another account.
// Contribute POST /v1/campaigns/:id/contribute
func (h *Handler) Contribute(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[ContributeRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.Contribute(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, resp)
}

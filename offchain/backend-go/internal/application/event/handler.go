package event

import (
	"github.com/gin-gonic/gin"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// Handler handles HTTP requests for event creation, discovery, ticket purchase, and check-in flows.
// It maps route-level access policy to the event service without embedding business rules in the transport layer.
type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the event HTTP handler with a module-scoped logger.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("event_handler")}
}

// RegisterRoutes mounts public event browsing endpoints and protected event-management or ticket-action endpoints.
// Role and KYC middleware applied here make the intended access model explicit at route-definition time.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker, userRepo ports.UserRepository) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	events := v1.Group("/events")
	{
		// Public
		events.GET("", h.ListEvents)
		events.GET("/:id", h.GetEvent)

		// ADMIN only — create event
		events.POST("", protected,
			middleware.RequireRole(string(domain.RoleAdmin), string(domain.RoleSuperAdmin)),
			middleware.RequireKYCLevel(1, userRepo),
			h.CreateEvent,
		)

		// Any authenticated user — buy a ticket
		events.POST("/:id/buy-ticket", protected,
			middleware.RequireKYCLevel(1, userRepo),
			h.BuyTicket,
		)

		// ADMIN or LECTURER — check-in (scan QR)
		events.POST("/:id/check-in", protected,
			middleware.RequireRole(
				string(domain.RoleAdmin),
				string(domain.RoleSuperAdmin),
				string(domain.RoleModerator),
				"LECTURER",
			),
			middleware.RequireKYCLevel(1, userRepo),
			h.CheckIn,
		)
	}
}

// CreateEvent handles administrative creation of a new event and its ticket inventory.
// The acting creator wallet is derived from middleware context rather than the request body.
// CreateEvent POST /v1/events
func (h *Handler) CreateEvent(c *gin.Context) {
	req, ok := apihttp.Bind[CreateEventRequest](c)
	if !ok {
		return
	}
	event, err := h.svc.CreateEvent(c.Request.Context(), req, middleware.WalletAddress(c))
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, event)
}

// GetEvent handles retrieval of one event by ID.
// This route is public because event detail pages do not require authentication.
// GetEvent GET /v1/events/:id
func (h *Handler) GetEvent(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	event, err := h.svc.GetEvent(c.Request.Context(), id)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, event)
}

// ListEvents handles public paginated event discovery with optional query filters.
// It binds both filter options and pagination, then returns a standard paged response.
// ListEvents GET /v1/events
func (h *Handler) ListEvents(c *gin.Context) {
	filter, ok := apihttp.BindQuery[ListEventsQuery](c)
	if !ok {
		filter = &ListEventsQuery{}
	}
	pageReq, ok := apihttp.BindQuery[pagination.Request](c)
	if !ok {
		defaultReq := pagination.DefaultRequest()
		pageReq = &defaultReq
	}
	pageReq.Normalize()
	items, total, err := h.svc.ListEvents(c.Request.Context(), filter, *pageReq)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, pageReq.Page, pageReq.PageSize)
}

// BuyTicket handles the authenticated purchase flow for one event ticket.
// The buyer wallet is always sourced from the authenticated session to prevent impersonation via request payloads.
// BuyTicket POST /v1/events/:id/buy-ticket
func (h *Handler) BuyTicket(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[BuyTicketRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.BuyTicket(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, resp)
}

// CheckIn handles staff-side ticket validation and attendance marking based on encrypted QR data.
// Role-gated access is enforced before this handler runs; the service performs the deeper ticket-validation logic.
// CheckIn POST /v1/events/:id/check-in
func (h *Handler) CheckIn(c *gin.Context) {
	id, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	req, ok := apihttp.Bind[CheckInRequest](c)
	if !ok {
		return
	}
	resp, err := h.svc.CheckIn(c.Request.Context(), id, middleware.WalletAddress(c), req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

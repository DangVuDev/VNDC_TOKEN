package notification

import (
	"github.com/gin-gonic/gin"

	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
)

type Handler struct {
	svc *Service
	log logger.Logger
}

// NewHandler constructs the notification HTTP handler with a module-scoped logger.
// The handler remains thin and mainly translates between HTTP requests and notification service calls.
func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log.Named("notification_handler")}
}

// RegisterRoutes wires notification endpoints for both admin broadcast management and authenticated user inbox access.
// Administrative creation/listing is separated from user self-service listing through route grouping and middleware.
func (h *Handler) RegisterRoutes(v1 *gin.RouterGroup, jwtSecret string, blacklistChecker middleware.BlacklistChecker) {
	protected := middleware.AuthWithBlacklist(jwtSecret, blacklistChecker)
	adminOnly := middleware.RequireRole("ADMIN", "SUPER_ADMIN")

	admin := v1.Group("/admin/notifications")
	admin.Use(protected, adminOnly)
	{
		admin.POST("", h.CreateAdminNotification)
		admin.GET("", h.ListAdminNotifications)
	}

	me := v1.Group("/users/me")
	me.Use(protected)
	{
		me.GET("/notifications", h.ListMyNotifications)
	}
}

// CreateAdminNotification handles creation of a system notification by an administrator.
// It binds the request body, stamps the current actor ID through middleware context, and returns the created item.
func (h *Handler) CreateAdminNotification(c *gin.Context) {
	req, ok := apihttp.Bind[CreateNotificationRequest](c)
	if !ok {
		return
	}
	item, err := h.svc.Create(c.Request.Context(), middleware.UserID(c), *req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Created(c, item)
}

// ListAdminNotifications handles the admin-facing notification list endpoint.
// The handler normalizes pagination defaults before delegating to the service and returning a paged response envelope.
func (h *Handler) ListAdminNotifications(c *gin.Context) {
	q, ok := apihttp.BindQuery[ListNotificationsQuery](c)
	if !ok {
		return
	}
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 {
		q.PageSize = 20
	}
	items, total, err := h.svc.ListForAdmin(c.Request.Context(), *q)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, q.Page, q.PageSize)
}

// ListMyNotifications handles the authenticated user's inbox-style notification listing.
// It derives the user identity from auth middleware rather than allowing the client to supply arbitrary target IDs.
func (h *Handler) ListMyNotifications(c *gin.Context) {
	q, ok := apihttp.BindQuery[ListNotificationsQuery](c)
	if !ok {
		return
	}
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 {
		q.PageSize = 20
	}
	items, total, err := h.svc.ListForUser(c.Request.Context(), middleware.UserID(c), *q)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.Paged(c, items, total, q.Page, q.PageSize)
}

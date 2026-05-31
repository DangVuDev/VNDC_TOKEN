package notification

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

type Service struct {
	repo ports.NotificationRepository
	log  logger.Logger
}

// NewService constructs the notification application service around the notification repository.
// The service is intentionally thin because the main value here is validation and response shaping.
func NewService(repo ports.NotificationRepository, log logger.Logger) *Service {
	return &Service{repo: repo, log: log.Named("notification_service")}
}

// Create validates and persists a system notification targeted either to all users or a single user.
// It normalizes display defaults such as icon and source so upstream callers can provide minimal input.
func (s *Service) Create(ctx context.Context, actorID string, req CreateNotificationRequest) (*NotificationItem, error) {
	nType := strings.ToLower(strings.TrimSpace(req.Type))
	if nType != string(domain.NotificationTypeInfo) &&
		nType != string(domain.NotificationTypeSuccess) &&
		nType != string(domain.NotificationTypeWarning) &&
		nType != string(domain.NotificationTypeError) {
		return nil, apperr.New(apperr.ErrCodeValidation, "type must be one of: info, success, warning, error")
	}

	title := strings.TrimSpace(req.Title)
	message := strings.TrimSpace(req.Message)
	if title == "" || message == "" {
		return nil, apperr.New(apperr.ErrCodeValidation, "title and message are required")
	}

	targetScope := strings.ToUpper(strings.TrimSpace(req.TargetScope))
	if targetScope == "" {
		targetScope = string(domain.NotificationTargetAll)
	}
	if targetScope != string(domain.NotificationTargetAll) && targetScope != string(domain.NotificationTargetUser) {
		return nil, apperr.New(apperr.ErrCodeValidation, "target_scope must be ALL or USER")
	}

	targetUserID := strings.TrimSpace(req.TargetUserID)
	if targetScope == string(domain.NotificationTargetUser) && targetUserID == "" {
		return nil, apperr.New(apperr.ErrCodeValidation, "target_user_id is required when target_scope=USER")
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && strings.TrimSpace(*req.ExpiresAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.ExpiresAt))
		if err != nil {
			return nil, apperr.New(apperr.ErrCodeValidation, "expires_at must be RFC3339 format")
		}
		if !parsed.After(time.Now().UTC()) {
			return nil, apperr.New(apperr.ErrCodeValidation, "expires_at must be in the future")
		}
		u := parsed.UTC()
		expiresAt = &u
	}

	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = defaultIconByType(domain.NotificationType(nType))
	}
	source := strings.TrimSpace(req.Source)
	if source == "" {
		source = "System"
	}

	n := &domain.SystemNotification{
		BaseEntity: domain.BaseEntity{
			ID:        uuid.NewString(),
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
		Type:         domain.NotificationType(nType),
		Icon:         icon,
		Title:        title,
		Message:      message,
		Source:       source,
		TargetScope:  domain.NotificationTargetScope(targetScope),
		TargetUserID: targetUserID,
		ExpiresAt:    expiresAt,
		CreatedByID:  actorID,
	}
	if err := s.repo.Create(ctx, n); err != nil {
		return nil, err
	}

	return mapItem(n), nil
}

// ListForUser returns paginated notifications visible to one user, optionally including expired rows.
// The repository handles target-scope filtering while the service maps domain rows to API items.
func (s *Service) ListForUser(ctx context.Context, userID string, q ListNotificationsQuery) ([]*NotificationItem, int64, error) {
	page, pageSize := normalizePage(q.Page, q.PageSize)
	rows, total, err := s.repo.FindForUser(ctx, userID, page, pageSize, q.IncludeExpired, strings.ToLower(strings.TrimSpace(q.Type)))
	if err != nil {
		return nil, 0, err
	}
	items := make([]*NotificationItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, mapItem(r))
	}
	return items, total, nil
}

// ListForAdmin returns paginated notifications for administrative review across all targets.
// This view is broader than the user view because admins can inspect global and user-specific messages alike.
func (s *Service) ListForAdmin(ctx context.Context, q ListNotificationsQuery) ([]*NotificationItem, int64, error) {
	page, pageSize := normalizePage(q.Page, q.PageSize)
	rows, total, err := s.repo.FindForAdmin(ctx, page, pageSize, q.IncludeExpired, strings.ToLower(strings.TrimSpace(q.Type)))
	if err != nil {
		return nil, 0, err
	}
	items := make([]*NotificationItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, mapItem(r))
	}
	return items, total, nil
}

// normalizePage applies default and maximum pagination bounds for notification list endpoints.
// Centralizing this logic keeps user and admin list behavior consistent.
func normalizePage(page, pageSize int64) (int64, int64) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

// defaultIconByType chooses a UI icon name from the semantic notification type.
// This allows clients to omit icon selection for common notification categories.
func defaultIconByType(t domain.NotificationType) string {
	switch t {
	case domain.NotificationTypeSuccess:
		return "check-circle"
	case domain.NotificationTypeWarning:
		return "warning"
	case domain.NotificationTypeError:
		return "close-circle"
	default:
		return "info-circle"
	}
}

// mapItem converts the persistence model into the lightweight response model exposed by the application layer.
// Keeping the mapping in one helper prevents repeated field-copy logic across list and create methods.
func mapItem(n *domain.SystemNotification) *NotificationItem {
	return &NotificationItem{
		ID:           n.ID,
		Type:         string(n.Type),
		Icon:         n.Icon,
		Title:        n.Title,
		Message:      n.Message,
		Source:       n.Source,
		TargetScope:  string(n.TargetScope),
		TargetUserID: n.TargetUserID,
		ExpiresAt:    n.ExpiresAt,
		CreatedAt:    n.CreatedAt,
	}
}

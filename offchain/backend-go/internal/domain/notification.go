package domain

import "time"

// NotificationType classifies UI style and icon mapping on clients.
type NotificationType string

const (
	NotificationTypeInfo    NotificationType = "info"
	NotificationTypeSuccess NotificationType = "success"
	NotificationTypeWarning NotificationType = "warning"
	NotificationTypeError   NotificationType = "error"
)

// NotificationTargetScope defines delivery audience.
type NotificationTargetScope string

const (
	NotificationTargetAll  NotificationTargetScope = "ALL"
	NotificationTargetUser NotificationTargetScope = "USER"
)

// SystemNotification is a persisted, non-realtime announcement pushed by admins.
type SystemNotification struct {
	BaseEntity `bson:",inline"`

	Type    NotificationType `bson:"type"    json:"type"`
	Icon    string           `bson:"icon"    json:"icon"`
	Title   string           `bson:"title"   json:"title"`
	Message string           `bson:"message" json:"message"`
	Source  string           `bson:"source"  json:"source"`

	TargetScope  NotificationTargetScope `bson:"target_scope"           json:"target_scope"`
	TargetUserID string                  `bson:"target_user_id,omitempty" json:"target_user_id,omitempty"`

	ExpiresAt   *time.Time `bson:"expires_at,omitempty"   json:"expires_at,omitempty"`
	CreatedByID string     `bson:"created_by_id"          json:"created_by_id"`
}

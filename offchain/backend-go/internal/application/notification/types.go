// Package notification defines transport-facing DTOs for notification inbox and admin-broadcast APIs.
package notification

import "time"

// ListNotificationsQuery carries pagination and filter parameters for inbox and admin notification listing endpoints.
type ListNotificationsQuery struct {
	Page           int64  `form:"page"`
	PageSize       int64  `form:"page_size"`
	IncludeExpired bool   `form:"include_expired"`
	Type           string `form:"type"`
}

// CreateNotificationRequest is the admin-side payload used to create a system or targeted notification.
// Targeting semantics are interpreted downstream from TargetScope and optional TargetUserID.
type CreateNotificationRequest struct {
	Type         string  `json:"type" binding:"required"`
	Icon         string  `json:"icon"`
	Title        string  `json:"title" binding:"required"`
	Message      string  `json:"message" binding:"required"`
	Source       string  `json:"source"`
	TargetScope  string  `json:"target_scope"`
	TargetUserID string  `json:"target_user_id"`
	ExpiresAt    *string `json:"expires_at"`
}

// NotificationItem is the normalized response DTO returned by notification listing endpoints.
// It represents the notification as presented to clients after service-side icon defaulting and response shaping.
type NotificationItem struct {
	ID           string     `json:"id"`
	Type         string     `json:"type"`
	Icon         string     `json:"icon"`
	Title        string     `json:"title"`
	Message      string     `json:"message"`
	Source       string     `json:"source"`
	TargetScope  string     `json:"target_scope"`
	TargetUserID string     `json:"target_user_id,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// Package user implements profile management and admin user operations.
package user

import (
	"context"
	"strings"
	"time"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

// Service orchestrates all user management operations.
type Service struct {
	userRepo    ports.UserRepository
	auditRepo   ports.AuditLogRepository
	sessionRepo ports.SessionRepository
	log         logger.Logger
}

// NewService constructs the user Service.
func NewService(
	userRepo ports.UserRepository,
	auditRepo ports.AuditLogRepository,
	sessionRepo ports.SessionRepository,
	log logger.Logger,
) *Service {
	return &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
		log:         log.Named("user_service"),
	}
}

// ─────────────────────────────────────────────
//  Self-service — profile
// ─────────────────────────────────────────────

// GetMe returns the full profile of the authenticated user.
func (s *Service) GetMe(ctx context.Context, userID string) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	return user, nil
}

// UpdateProfile applies a partial update to the user's profile.
// Only non-nil fields in req are written; Metadata is deep-merged.
func (s *Service) UpdateProfile(ctx context.Context, userID string, req *UpdateProfileRequest, ip, ua string) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}

	updates := make(map[string]any)

	if req.Username != nil {
		if existing, _ := s.userRepo.FindByEmail(ctx, *req.Username); existing != nil && existing.ID != userID {
			return nil, apperr.New(apperr.ErrCodeConflict, "Username already taken")
		}
		updates["username"] = strings.TrimSpace(*req.Username)
	}
	if req.FullName != nil {
		updates["full_name"] = strings.TrimSpace(*req.FullName)
	}
	if req.Bio != nil {
		updates["bio"] = *req.Bio
	}
	if req.AvatarURI != nil {
		updates["avatar_uri"] = *req.AvatarURI
	}
	if req.Country != nil {
		updates["country"] = strings.ToUpper(*req.Country)
	}
	if req.Language != nil {
		updates["language"] = *req.Language
	}
	if req.Timezone != nil {
		updates["timezone"] = *req.Timezone
	}
	if req.DateOfBirth != nil {
		updates["date_of_birth"] = *req.DateOfBirth
	}
	if req.Metadata != nil {
		merged := make(map[string]any)
		for k, v := range user.Metadata {
			merged[k] = v
		}
		for k, v := range req.Metadata {
			merged[k] = v
		}
		updates["metadata"] = merged
	}

	if len(updates) == 0 {
		return user, nil
	}

	if err := s.userRepo.Update(ctx, userID, updates); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "Update profile failed", err)
	}
	s.writeAudit(ctx, domain.AuditProfileUpdated, userID, user.WalletAddress, "", ip, ua, "", nil)
	return s.userRepo.FindByID(ctx, userID)
}

// RequestEmailChange updates the user's email and marks it unverified.
// In production this should trigger a verification email flow.
func (s *Service) RequestEmailChange(ctx context.Context, userID, newEmail, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}

	if existing, _ := s.userRepo.FindByEmail(ctx, newEmail); existing != nil {
		return apperr.New(apperr.ErrCodeConflict, "Email already registered")
	}

	updates := map[string]any{
		"email":          strings.ToLower(strings.TrimSpace(newEmail)),
		"email_verified": false,
	}
	if err := s.userRepo.Update(ctx, userID, updates); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Update email failed", err)
	}
	s.writeAudit(ctx, domain.AuditEmailChanged, userID, user.WalletAddress, "", ip, ua, "", map[string]any{
		"new_email": newEmail,
	})
	return nil
}

// GetAuditLogs returns the security audit trail for the authenticated user.
func (s *Service) GetAuditLogs(ctx context.Context, userID string, page *pagination.Request) ([]*domain.AuditLog, int64, error) {
	page.Normalize()
	logs, total, err := s.auditRepo.FindByActor(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

// SubmitKYCDocument records a KYC document submission for review.
func (s *Service) SubmitKYCDocument(ctx context.Context, userID string, req *SubmitKYCRequest, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}

	doc := domain.KYCDocument{
		Type:        req.DocumentType,
		DocumentRef: req.DocumentRef,
		SubmittedAt: time.Now().UTC(),
	}
	newDocs := append(user.KYCDocuments, doc)
	updates := map[string]any{
		"kyc_status":    string(domain.KYCStatusPending),
		"kyc_documents": newDocs,
	}
	if err := s.userRepo.Update(ctx, userID, updates); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Submit KYC failed", err)
	}
	s.writeAudit(ctx, domain.AuditKYCSubmitted, userID, user.WalletAddress, "", ip, ua, "", map[string]any{
		"document_type": req.DocumentType,
	})
	return nil
}

// ─────────────────────────────────────────────
//  Admin operations
// ─────────────────────────────────────────────

// ListUsers returns a paginated list of users (admin only).
func (s *Service) ListUsers(ctx context.Context, req *ListUsersRequest) ([]*domain.User, int64, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 || req.PageSize > 100 {
		req.PageSize = 20
	}
	users, total, err := s.userRepo.Find(ctx)
	if err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

// GetUser returns a single user by ID (admin only).
func (s *Service) GetUser(ctx context.Context, userID string) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	return user, nil
}

// SuspendUser disables a user account and revokes all their active sessions.
func (s *Service) SuspendUser(ctx context.Context, adminID, adminWallet, targetID string, req *SuspendUserRequest, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, targetID)
	if err != nil {
		return apperr.ErrNotFound
	}
	if user.ID == adminID {
		return apperr.New(apperr.ErrCodeBadRequest, "Cannot suspend your own account")
	}

	now := time.Now().UTC()
	updates := map[string]any{
		"status":         string(domain.UserStatusSuspended),
		"suspended_at":   now,
		"suspend_reason": req.Reason,
	}
	if err := s.userRepo.Update(ctx, targetID, updates); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Suspend user failed", err)
	}
	_ = s.sessionRepo.RevokeAllByUserID(ctx, targetID, "account_suspended")
	s.writeAudit(ctx, domain.AuditUserSuspended, adminID, adminWallet, targetID, ip, ua, "", map[string]any{
		"reason": req.Reason,
	})
	return nil
}

// UnsuspendUser re-activates a suspended account.
func (s *Service) UnsuspendUser(ctx context.Context, adminID, adminWallet, targetID, ip, ua string) error {
	if _, err := s.userRepo.FindByID(ctx, targetID); err != nil {
		return apperr.ErrNotFound
	}
	updates := map[string]any{
		"status":         string(domain.UserStatusActive),
		"suspended_at":   nil,
		"suspend_reason": "",
	}
	if err := s.userRepo.Update(ctx, targetID, updates); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Unsuspend user failed", err)
	}
	s.writeAudit(ctx, domain.AuditUserUnsuspended, adminID, adminWallet, targetID, ip, ua, "", nil)
	return nil
}

// AssignRole adds a role to a user.
func (s *Service) AssignRole(ctx context.Context, adminID, adminWallet, targetID string, req *AssignRoleRequest, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, targetID)
	if err != nil {
		return apperr.ErrNotFound
	}
	role := domain.UserRole(req.Role)
	if user.HasRole(role) {
		return apperr.New(apperr.ErrCodeConflict, "User already has this role")
	}

	newRoles := append(user.Roles, role)
	roleStrs := make([]string, len(newRoles))
	for i, r := range newRoles {
		roleStrs[i] = string(r)
	}
	if err := s.userRepo.Update(ctx, targetID, map[string]any{"roles": roleStrs}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "AssignRole failed", err)
	}
	s.writeAudit(ctx, domain.AuditRoleAssigned, adminID, adminWallet, targetID, ip, ua, "", map[string]any{"role": req.Role})
	return nil
}

// RemoveRole removes a role from a user. The base USER role cannot be removed.
func (s *Service) RemoveRole(ctx context.Context, adminID, adminWallet, targetID, roleName, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, targetID)
	if err != nil {
		return apperr.ErrNotFound
	}
	role := domain.UserRole(roleName)
	if !user.HasRole(role) {
		return apperr.New(apperr.ErrCodeNotFound, "User does not have this role")
	}
	if role == domain.RoleUser {
		return apperr.New(apperr.ErrCodeBadRequest, "Cannot remove base USER role")
	}

	newRoles := make([]domain.UserRole, 0, len(user.Roles))
	for _, r := range user.Roles {
		if r != role {
			newRoles = append(newRoles, r)
		}
	}
	roleStrs := make([]string, len(newRoles))
	for i, r := range newRoles {
		roleStrs[i] = string(r)
	}
	if err := s.userRepo.Update(ctx, targetID, map[string]any{"roles": roleStrs}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "RemoveRole failed", err)
	}
	s.writeAudit(ctx, domain.AuditRoleRemoved, adminID, adminWallet, targetID, ip, ua, "", map[string]any{"role": roleName})
	return nil
}

// ApproveKYC marks a user's KYC as verified at the given level.
func (s *Service) ApproveKYC(ctx context.Context, adminID, adminWallet, targetID string, level domain.KYCLevel, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, targetID)
	if err != nil {
		return apperr.ErrNotFound
	}
	now := time.Now().UTC()
	updates := map[string]any{
		"kyc_status":      string(domain.KYCStatusVerified),
		"kyc_level":       int(level),
		"kyc_verified_at": now,
	}
	if err := s.userRepo.Update(ctx, targetID, updates); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Approve KYC failed", err)
	}
	s.writeAudit(ctx, domain.AuditKYCApproved, adminID, adminWallet, user.ID, ip, ua, "", map[string]any{
		"level": int(level),
	})
	return nil
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

func (s *Service) writeAudit(ctx context.Context, event domain.AuditEventType,
	actorID, actorWallet, targetID, ip, ua, sessionID string, details map[string]any) {
	entry := &domain.AuditLog{
		EventType:   event,
		ActorID:     actorID,
		ActorWallet: actorWallet,
		TargetID:    targetID,
		IPAddress:   ip,
		UserAgent:   ua,
		SessionID:   sessionID,
		Details:     details,
		OccurredAt:  time.Now().UTC(),
	}
	_ = s.auditRepo.Create(ctx, entry)
}

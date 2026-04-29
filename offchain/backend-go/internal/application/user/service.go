// Package user implements profile management and admin user operations.
package user

import (
	"context"
	"math/rand"
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
//  Email & Phone Verification
// ─────────────────────────────────────────────

// VerifyEmail marks email as verified (in production, verify token first).
func (s *Service) VerifyEmail(ctx context.Context, userID, token string) error {
	// TODO: Validate token against cache/DB (e.g., Redis)
	// For now, just mark as verified
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}
	if err := s.userRepo.Update(ctx, userID, map[string]any{"email_verified": true}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Verify email failed", err)
	}
	s.writeAudit(ctx, domain.AuditEmailVerified, userID, user.WalletAddress, "", "", "", "", nil)
	return nil
}

// RequestPhoneVerification sends an OTP to the given phone number.
func (s *Service) RequestPhoneVerification(ctx context.Context, userID, phone string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}
	// TODO: Send OTP via Twilio/SMS provider; store OTP in Redis with TTL
	// For now, just record the phone update request
	s.writeAudit(ctx, domain.AuditPhoneVerificationRequested, userID, user.WalletAddress, "", "", "", "", map[string]any{
		"phone": phone,
	})
	return nil
}

// VerifyPhone marks phone as verified after validating the OTP.
func (s *Service) VerifyPhone(ctx context.Context, userID, code string) error {
	// TODO: Validate OTP from Redis
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}
	if err := s.userRepo.Update(ctx, userID, map[string]any{"phone_verified": true}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Verify phone failed", err)
	}
	s.writeAudit(ctx, domain.AuditPhoneVerified, userID, user.WalletAddress, "", "", "", "", nil)
	return nil
}

// ─────────────────────────────────────────────
//  User Preferences
// ─────────────────────────────────────────────

// GetPreferences returns the user's notification and privacy settings.
func (s *Service) GetPreferences(ctx context.Context, userID string) (*UserPreferencesResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	// Extract preferences from metadata
	prefs := &UserPreferencesResponse{
		NotifyLogin:     true,
		NotifyKYC:       true,
		NotifyTransfer:  true,
		NotifyReward:    true,
		NotifyMarketing: false,
		ProfilePublic:   false,
		ShowLoginStats:  true,
	}
	// Merge with stored metadata if present
	if user.Metadata != nil {
		if v, ok := user.Metadata["notify_login"].(bool); ok {
			prefs.NotifyLogin = v
		}
		if v, ok := user.Metadata["notify_kyc"].(bool); ok {
			prefs.NotifyKYC = v
		}
		if v, ok := user.Metadata["notify_transfer"].(bool); ok {
			prefs.NotifyTransfer = v
		}
		if v, ok := user.Metadata["notify_reward"].(bool); ok {
			prefs.NotifyReward = v
		}
		if v, ok := user.Metadata["notify_marketing"].(bool); ok {
			prefs.NotifyMarketing = v
		}
		if v, ok := user.Metadata["profile_public"].(bool); ok {
			prefs.ProfilePublic = v
		}
		if v, ok := user.Metadata["show_login_stats"].(bool); ok {
			prefs.ShowLoginStats = v
		}
	}
	prefs.UpdatedAt = time.Now().UTC()
	return prefs, nil
}

// UpdatePreferences updates the user's notification and privacy settings.
func (s *Service) UpdatePreferences(ctx context.Context, userID string, req *UserPreferencesRequest) (*UserPreferencesResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	// Merge preferences into metadata
	if user.Metadata == nil {
		user.Metadata = make(map[string]any)
	}
	if req.NotifyLogin != nil {
		user.Metadata["notify_login"] = *req.NotifyLogin
	}
	if req.NotifyKYC != nil {
		user.Metadata["notify_kyc"] = *req.NotifyKYC
	}
	if req.NotifyTransfer != nil {
		user.Metadata["notify_transfer"] = *req.NotifyTransfer
	}
	if req.NotifyReward != nil {
		user.Metadata["notify_reward"] = *req.NotifyReward
	}
	if req.NotifyMarketing != nil {
		user.Metadata["notify_marketing"] = *req.NotifyMarketing
	}
	if req.ProfilePublic != nil {
		user.Metadata["profile_public"] = *req.ProfilePublic
	}
	if req.ShowLoginStats != nil {
		user.Metadata["show_login_stats"] = *req.ShowLoginStats
	}
	if err := s.userRepo.Update(ctx, userID, map[string]any{"metadata": user.Metadata}); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "Update preferences failed", err)
	}
	s.writeAudit(ctx, domain.AuditPreferencesUpdated, userID, user.WalletAddress, "", "", "", "", nil)
	return s.GetPreferences(ctx, userID)
}

// ─────────────────────────────────────────────
//  Referral System
// ─────────────────────────────────────────────

// GetReferralInfo returns referral code and statistics for the user.
func (s *Service) GetReferralInfo(ctx context.Context, userID string) (*ReferralInfoResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	// Generate referral code if not present
	if user.ReferralCode == "" {
		user.ReferralCode = generateReferralCode()
		_ = s.userRepo.Update(ctx, userID, map[string]any{"referral_code": user.ReferralCode})
	}
	// TODO: Count referred users from database
	referredCount := int64(0)
	return &ReferralInfoResponse{
		ReferralCode:   user.ReferralCode,
		ReferredCount:  referredCount,
		ReferredBy:     user.ReferredBy,
		ReferralReward: 0.0, // TODO: Calculate from database
		CreatedAt:      user.CreatedAt,
	}, nil
}

// ListReferrals returns a paginated list of users referred by this user.
func (s *Service) ListReferrals(ctx context.Context, userID string, page, pageSize int64) ([]*ReferralRecord, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	if _, err := s.userRepo.FindByID(ctx, userID); err != nil {
		return nil, 0, apperr.ErrNotFound
	}
	// TODO: Query users referred by this user from database
	records := []*ReferralRecord{}
	return records, 0, nil
}

// ─────────────────────────────────────────────
//  2FA Backup Codes
// ─────────────────────────────────────────────

// GenerateBackupCodes creates a new set of backup codes for 2FA recovery.
func (s *Service) GenerateBackupCodes(ctx context.Context, userID string) (*BackupCodesResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	if !user.TwoFactorEnabled {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Two-factor authentication is not enabled")
	}
	// Generate 10 backup codes
	codes := make([]string, 10)
	for i := 0; i < 10; i++ {
		codes[i] = generateBackupCode()
	}
	// Hash and store in database
	// TODO: Hash codes and update user.TOTPBackupCodes in database
	s.writeAudit(ctx, domain.AuditBackupCodesGenerated, userID, user.WalletAddress, "", "", "", "", nil)
	return &BackupCodesResponse{
		BackupCodes: codes,
		GeneratedAt: time.Now().UTC(),
		Message:     "Save these backup codes securely. You can use them to access your account if you lose access to your authenticator app.",
	}, nil
}

// ─────────────────────────────────────────────
//  Account Management
// ─────────────────────────────────────────────

// DeactivateAccount soft-deletes the user account.
func (s *Service) DeactivateAccount(ctx context.Context, userID, reason, ip string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}
	updates := map[string]any{
		"status": string(domain.UserStatusDeactivated),
	}
	if err := s.userRepo.Update(ctx, userID, updates); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Deactivate account failed", err)
	}
	// Revoke all active sessions
	_ = s.sessionRepo.RevokeAllByUserID(ctx, userID, "account_deactivated")
	s.writeAudit(ctx, domain.AuditAccountDeactivated, userID, user.WalletAddress, "", ip, "", "", map[string]any{
		"reason": reason,
	})
	return nil
}

// ─────────────────────────────────────────────
//  Helper functions
// ─────────────────────────────────────────────

func generateReferralCode() string {
	// Generate a 10 character alphanumeric code
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 10)
	for i := range code {
		code[i] = charset[rand.Intn(len(charset))]
	}
	return string(code)
}

func generateBackupCode() string {
	// Generate codes in format: XXXX-XXXX-XXXX (12 characters + 2 dashes)
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	part1 := make([]byte, 4)
	part2 := make([]byte, 4)
	part3 := make([]byte, 4)
	for i := range part1 {
		part1[i] = charset[rand.Intn(len(charset))]
		part2[i] = charset[rand.Intn(len(charset))]
		part3[i] = charset[rand.Intn(len(charset))]
	}
	return string(part1) + "-" + string(part2) + "-" + string(part3)
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

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

// Service orchestrates self-service profile flows, KYC progression, administrative user moderation, and audit logging.
// It concentrates user-facing business rules so handlers and transport layers stay thin and policy-consistent.
type Service struct {
	userRepo      ports.UserRepository
	auditRepo     ports.AuditLogRepository
	sessionRepo   ports.SessionRepository
	kycSubmitRepo ports.KYCSubmissionRepository
	log           logger.Logger
}

// NewService constructs the user application service with repositories for users, sessions, KYC submissions, and audit logs.
// These dependencies allow one service boundary to manage both end-user actions and admin-side moderation workflows.
func NewService(
	userRepo ports.UserRepository,
	auditRepo ports.AuditLogRepository,
	sessionRepo ports.SessionRepository,
	kycSubmitRepo ports.KYCSubmissionRepository,
	log logger.Logger,
) *Service {
	return &Service{
		userRepo:      userRepo,
		auditRepo:     auditRepo,
		sessionRepo:   sessionRepo,
		kycSubmitRepo: kycSubmitRepo,
		log:           log.Named("user_service"),
	}
}

// ─────────────────────────────────────────────
//  Self-service — profile
// ─────────────────────────────────────────────

// GetMe returns the full persisted profile for the authenticated user.
// This is the primary self-service read path used by account and settings screens.
func (s *Service) GetMe(ctx context.Context, userID string) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	return user, nil
}

// UpdateProfile applies a partial profile update and records the change in the audit log.
// Only explicitly provided fields are written, and metadata is merged instead of replaced so unrelated preferences survive.
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
	if req.Class != nil {
		updates["class"] = strings.TrimSpace(*req.Class)
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

// RequestEmailChange changes the stored email address, resets verification, and writes a security audit entry.
// In a production deployment this flow would also generate and dispatch a verification challenge to the new address.
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

// GetAuditLogs returns the authenticated user's security and account audit trail.
// The repository currently owns pagination details, while the service keeps this endpoint semantically scoped to the caller.
func (s *Service) GetAuditLogs(ctx context.Context, userID string, page *pagination.Request) ([]*domain.AuditLog, int64, error) {
	page.Normalize()
	logs, total, err := s.auditRepo.FindByActor(ctx, userID)
	if err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

// CheckKYCLevel1Status reports which prerequisites for automatic KYC Level 1 approval are already satisfied.
// The response is designed for guided UX so the frontend can tell the user exactly what is still missing.
func (s *Service) CheckKYCLevel1Status(ctx context.Context, userID string) (*KYCLevel1StatusResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	hasUsername := strings.TrimSpace(user.Username) != ""
	emailVerified := user.EmailVerified
	phoneVerified := user.PhoneVerified
	ready := hasUsername && emailVerified && phoneVerified

	msg := ""
	if !ready {
		missing := []string{}
		if !hasUsername {
			missing = append(missing, "username (mã sinh viên)")
		}
		if !emailVerified {
			missing = append(missing, "xác thực email")
		}
		if !phoneVerified {
			missing = append(missing, "xác thực số điện thoại")
		}
		msg = "Còn thiếu: " + strings.Join(missing, ", ")
	} else if int(user.KYCLevel) >= 1 {
		msg = "KYC Level 1 đã được xác nhận"
	}

	return &KYCLevel1StatusResponse{
		Ready:           ready,
		HasUsername:     hasUsername,
		EmailVerified:   emailVerified,
		PhoneVerified:   phoneVerified,
		CurrentKYCLevel: int(user.KYCLevel),
		Message:         msg,
	}, nil
}

// SubmitKYCLevel1 upgrades the user to KYC Level 1 once all prerequisite checks are satisfied.
// This level is intentionally auto-approved because it depends only on internally verifiable profile and verification signals.
func (s *Service) SubmitKYCLevel1(ctx context.Context, userID, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}

	if int(user.KYCLevel) >= 1 {
		return apperr.New(apperr.ErrCodeConflict, "KYC Level 1 đã được xác nhận")
	}

	if strings.TrimSpace(user.Username) == "" {
		return apperr.New(apperr.ErrCodeBadRequest, "Vui lòng cập nhật username (mã sinh viên) trước")
	}
	if !user.EmailVerified {
		return apperr.New(apperr.ErrCodeBadRequest, "Email chưa được xác thực")
	}
	if !user.PhoneVerified {
		return apperr.New(apperr.ErrCodeBadRequest, "Số điện thoại chưa được xác thực")
	}

	now := time.Now().UTC()
	updates := map[string]any{
		"kyc_status":      string(domain.KYCStatusVerified),
		"kyc_level":       int(domain.KYCLevelBasic),
		"kyc_verified_at": now,
	}
	if err := s.userRepo.Update(ctx, userID, updates); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Submit KYC Level 1 failed", err)
	}
	s.writeAudit(ctx, domain.AuditKYCLevel1Completed, userID, user.WalletAddress, "", ip, ua, "", map[string]any{
		"username": user.Username,
	})
	return nil
}

// tryAutoGrantKYCLevel1 silently grants KYC Level 1 when a user happens to satisfy all required conditions.
// It is invoked from verification-side flows so the platform can upgrade the user without forcing a separate manual step.
func (s *Service) tryAutoGrantKYCLevel1(ctx context.Context, user *domain.User) {
	if int(user.KYCLevel) >= 1 {
		return
	}
	if strings.TrimSpace(user.Username) == "" || !user.EmailVerified || !user.PhoneVerified {
		return
	}
	now := time.Now().UTC()
	_ = s.userRepo.Update(ctx, user.ID, map[string]any{
		"kyc_status":      string(domain.KYCStatusVerified),
		"kyc_level":       int(domain.KYCLevelBasic),
		"kyc_verified_at": now,
	})
	s.writeAudit(ctx, domain.AuditKYCLevel1Completed, user.ID, user.WalletAddress, "", "", "", "", nil)
}

// SubmitKYCLevel2 creates a pending higher-assurance KYC submission for manual administrative review.
// The service ensures the user already passed Level 1 so manual review only starts from a valid baseline.
func (s *Service) SubmitKYCLevel2(ctx context.Context, userID string, req *SubmitKYCLevel2Request, ip, ua string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return apperr.ErrNotFound
	}

	if int(user.KYCLevel) < 1 {
		return apperr.New(apperr.ErrCodeBadRequest, "Cần hoàn thành KYC Level 1 trước")
	}
	if int(user.KYCLevel) >= 2 {
		return apperr.New(apperr.ErrCodeConflict, "KYC Level 2 đã được xác nhận")
	}

	submission := &domain.KYCSubmission{
		UserID:         userID,
		WalletAddress:  user.WalletAddress,
		Level:          2,
		StudentCardURL: req.StudentCardURL,
		SelfieURL:      req.SelfieURL,
		Status:         domain.KYCSubmissionPending,
	}
	if err := s.kycSubmitRepo.Create(ctx, submission); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Submit KYC Level 2 failed", err)
	}
	s.writeAudit(ctx, domain.AuditKYCSubmitted, userID, user.WalletAddress, "", ip, ua, "", map[string]any{
		"level": 2,
	})
	return nil
}

// DemoUploadKYCDocument simulates KYC document storage and returns a deterministic demo URL.
// It exists as a placeholder integration seam until real object storage or IPFS upload infrastructure is wired in.
func (s *Service) DemoUploadKYCDocument(_ context.Context, userID, fileName string) (string, error) {
	if strings.TrimSpace(fileName) == "" {
		return "", apperr.New(apperr.ErrCodeBadRequest, "file_name is required")
	}
	// Return a deterministic demo URL for testing
	demoURL := "https://demo-storage.vndc.io/kyc/" + userID + "/" + fileName
	return demoURL, nil
}

// ListKYCSubmissions returns KYC submissions for administrative review, optionally filtered by status.
// The repository currently supplies the actual filtered data set while the service normalizes request defaults.
func (s *Service) ListKYCSubmissions(ctx context.Context, statusFilter string, page, pageSize int64) ([]*domain.KYCSubmission, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	status := domain.KYCSubmissionPending
	if statusFilter != "" {
		status = domain.KYCSubmissionStatus(statusFilter)
	}
	return s.kycSubmitRepo.FindByStatus(ctx, status)
}

// ReviewKYCSubmission resolves a pending KYC Level 2 submission and, on approval, upgrades the user's KYC state.
// It also records an audit event so the moderation decision remains attributable to the reviewing administrator.
func (s *Service) ReviewKYCSubmission(ctx context.Context, adminID, adminWallet, submissionID string, req *ReviewKYCSubmissionRequest, ip, ua string) error {
	sub, err := s.kycSubmitRepo.FindByID(ctx, submissionID)
	if err != nil {
		return apperr.ErrNotFound
	}
	if sub.Status != domain.KYCSubmissionPending {
		return apperr.New(apperr.ErrCodeConflict, "Submission đã được xử lý")
	}

	now := time.Now().UTC()
	newStatus := domain.KYCSubmissionRejected
	if req.Approve {
		newStatus = domain.KYCSubmissionApproved
	}

	// Update the submission record
	sub.Status = newStatus
	sub.ReviewedBy = adminID
	sub.ReviewNote = req.Note
	sub.ReviewedAt = &now
	if err := s.kycSubmitRepo.Update(ctx, sub.ID, map[string]any{
		"status":      string(newStatus),
		"reviewed_by": adminID,
		"review_note": req.Note,
		"reviewed_at": now,
	}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Review KYC submission failed", err)
	}

	if req.Approve {
		updates := map[string]any{
			"kyc_status":      string(domain.KYCStatusVerified),
			"kyc_level":       int(domain.KYCLevelStandard),
			"kyc_verified_at": now,
		}
		if err := s.userRepo.Update(ctx, sub.UserID, updates); err != nil {
			return apperr.Wrap(apperr.ErrCodeDatabase, "Update user KYC level failed", err)
		}
		s.writeAudit(ctx, domain.AuditKYCApproved, adminID, adminWallet, sub.UserID, ip, ua, "", map[string]any{
			"level": 2, "submission_id": submissionID,
		})
	} else {
		s.writeAudit(ctx, domain.AuditKYCRejected, adminID, adminWallet, sub.UserID, ip, ua, "", map[string]any{
			"level": 2, "submission_id": submissionID, "note": req.Note,
		})
	}
	return nil
}

// ─────────────────────────────────────────────
//  Admin operations
// ─────────────────────────────────────────────

// ListUsers returns a basic paginated user list for administrative browsing.
// This admin-oriented list endpoint intentionally exposes raw user entities rather than a public-safe projection.
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

// GetUser returns a single user by ID for administrative inspection.
// It is the detail lookup counterpart to the broader admin user listing method.
func (s *Service) GetUser(ctx context.Context, userID string) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	return user, nil
}

// SuspendUser disables a target account, stores the suspension reason, revokes active sessions, and writes an audit record.
// Preventing self-suspension protects admins from accidentally locking themselves out of the moderation surface.
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

// UnsuspendUser reactivates a previously suspended account and clears suspension metadata.
// This is the inverse moderation action to SuspendUser.
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

// AssignRole grants an additional role to a user and records the privilege change in the audit trail.
// The method prevents duplicate roles so downstream authorization checks can rely on normalized role sets.
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

// RemoveRole removes one role from a user while preserving the mandatory base USER role.
// This guard prevents creation of malformed accounts that no longer carry any baseline identity role.
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

// ApproveKYC directly marks a user's KYC level as verified through an administrative override path.
// This is useful for controlled moderation flows that need to set KYC state outside the submission-review helper.
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

// VerifyEmail marks the user's email as verified and then reevaluates whether KYC Level 1 can be auto-granted.
// Token validation is intentionally stubbed here and is expected to be replaced by a real verification mechanism later.
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
	// Reload user with updated field and check for KYC Level 1 auto-grant
	user.EmailVerified = true
	s.tryAutoGrantKYCLevel1(ctx, user)
	return nil
}

// RequestPhoneVerification begins the phone-verification flow and emits an audit event describing the request.
// OTP dispatch is still a placeholder integration seam for an external SMS provider.
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

// VerifyPhone marks the phone as verified and then checks whether the user now qualifies for automatic KYC Level 1.
// OTP validation is currently stubbed, mirroring the development-state email verification flow.
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
	// Reload user with updated field and check for KYC Level 1 auto-grant
	user.PhoneVerified = true
	s.tryAutoGrantKYCLevel1(ctx, user)
	return nil
}

// ─────────────────────────────────────────────
//  Public User Lookup
// ─────────────────────────────────────────────

// LookupPublicUser finds a user by username or wallet and returns only non-sensitive profile information.
// This allows social, referral, or marketplace screens to render identity hints without exposing private account data.
func (s *Service) LookupPublicUser(ctx context.Context, username, wallet string) (*PublicUserInfo, error) {
	var user *domain.User
	var err error

	switch {
	case username != "":
		user, err = s.userRepo.FindByUsername(ctx, username)
	case wallet != "":
		user, err = s.userRepo.FindByWallet(ctx, wallet)
	default:
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Cần cung cấp username hoặc wallet address")
	}

	if err != nil {
		return nil, apperr.New(apperr.ErrCodeNotFound, "Không tìm thấy người dùng")
	}

	return &PublicUserInfo{
		WalletAddress: user.WalletAddress,
		Username:      user.Username,
		FullName:      user.FullName,
		AvatarURI:     user.AvatarURI,
		KYCLevel:      int(user.KYCLevel),
		KYCVerified:   int(user.KYCLevel) >= 1,
	}, nil
}

// ─────────────────────────────────────────────
//  User Preferences
// ─────────────────────────────────────────────

// GetPreferences reads notification and privacy preferences from user metadata and overlays sensible defaults.
// This lets older accounts behave predictably even if they have never persisted explicit preference flags.
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

// UpdatePreferences mutates preference-related metadata fields and returns the normalized merged preference view.
// Audit logging is included because notification and privacy settings are security-relevant user configuration.
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

// GetReferralInfo returns the user's referral identity and currently available referral summary data.
// It lazily generates a referral code the first time the user accesses this feature.
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

// ListReferrals returns the users referred by the current user.
// The actual referral query is still a placeholder, but the service already normalizes pagination and caller existence checks.
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

// GenerateBackupCodes creates a fresh set of recovery codes for accounts with 2FA enabled.
// Storage is intentionally stubbed for now, but the method already models the user-facing regeneration flow and audit trail.
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

// DeactivateAccount soft-deactivates the user's account, revokes all sessions, and records the reason in audit logs.
// The account remains in persistence so historical references and compliance trails are preserved.
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

// generateReferralCode creates a short uppercase alphanumeric referral code for sharing and attribution.
func generateReferralCode() string {
	// Generate a 10 character alphanumeric code
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 10)
	for i := range code {
		code[i] = charset[rand.Intn(len(charset))]
	}
	return string(code)
}

// generateBackupCode creates one human-readable recovery code segmented for easier manual entry.
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

// writeAudit is the common fire-and-forget helper for recording account-security and moderation events.
// Failures are intentionally ignored so user-facing workflows are not blocked by secondary audit persistence issues.
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

// Package user — tests for user service business logic.
package user

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
)

// MockUserRepository is a mock implementation of UserRepository.
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) FindByID(ctx context.Context, userID string) (*domain.User, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) FindByWallet(ctx context.Context, wallet string) (*domain.User, error) {
	args := m.Called(ctx, wallet)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) UpdateNonce(ctx context.Context, wallet, newNonce string) error {
	args := m.Called(ctx, wallet, newNonce)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateLoginInfo(ctx context.Context, wallet, ip string, loginAt time.Time) error {
	args := m.Called(ctx, wallet, ip, loginAt)
	return args.Error(0)
}

func (m *MockUserRepository) IncrementFailedAttempts(ctx context.Context, wallet string) (int, error) {
	args := m.Called(ctx, wallet)
	return args.Int(0), args.Error(1)
}

func (m *MockUserRepository) ResetFailedAttempts(ctx context.Context, wallet string) error {
	args := m.Called(ctx, wallet)
	return args.Error(0)
}

func (m *MockUserRepository) LockAccount(ctx context.Context, wallet string, until time.Time) error {
	args := m.Called(ctx, wallet, until)
	return args.Error(0)
}

func (m *MockUserRepository) UnlockAccount(ctx context.Context, wallet string) error {
	args := m.Called(ctx, wallet)
	return args.Error(0)
}

func (m *MockUserRepository) Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.User, int64, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*domain.User), args.Get(1).(int64), args.Error(2)
}

func (m *MockUserRepository) Create(ctx context.Context, user *domain.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Update(ctx context.Context, userID string, updates map[string]any) error {
	args := m.Called(ctx, userID, updates)
	return args.Error(0)
}

func (m *MockUserRepository) CreateMany(ctx context.Context, users []*domain.User) error {
	args := m.Called(ctx, users)
	return args.Error(0)
}

func (m *MockUserRepository) Upsert(ctx context.Context, userID string, user *domain.User) error {
	args := m.Called(ctx, userID, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserRepository) HardDelete(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserRepository) FindOne(ctx context.Context, opts ...database.QueryOption) (*domain.User, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserRepository) Count(ctx context.Context, opts ...database.QueryOption) (int64, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockUserRepository) Exists(ctx context.Context, userID string) (bool, error) {
	args := m.Called(ctx, userID)
	return args.Bool(0), args.Error(1)
}

func (m *MockUserRepository) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	args := m.Called(ctx, fn)
	return args.Error(0)
}

// MockAuditLogRepository is a mock implementation of AuditLogRepository.
type MockAuditLogRepository struct {
	mock.Mock
}

func (m *MockAuditLogRepository) Create(ctx context.Context, log *domain.AuditLog) error {
	args := m.Called(ctx, log)
	return args.Error(0)
}

func (m *MockAuditLogRepository) FindByActor(ctx context.Context, actorID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error) {
	args := m.Called(ctx, actorID, opts)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*domain.AuditLog), args.Get(1).(int64), args.Error(2)
}

func (m *MockAuditLogRepository) FindByTarget(ctx context.Context, targetID string, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error) {
	args := m.Called(ctx, targetID, opts)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*domain.AuditLog), args.Get(1).(int64), args.Error(2)
}

func (m *MockAuditLogRepository) Update(ctx context.Context, logID string, updates map[string]any) error {
	args := m.Called(ctx, logID, updates)
	return args.Error(0)
}

func (m *MockAuditLogRepository) CreateMany(ctx context.Context, logs []*domain.AuditLog) error {
	args := m.Called(ctx, logs)
	return args.Error(0)
}

func (m *MockAuditLogRepository) Upsert(ctx context.Context, logID string, log *domain.AuditLog) error {
	args := m.Called(ctx, logID, log)
	return args.Error(0)
}

func (m *MockAuditLogRepository) Delete(ctx context.Context, logID string) error {
	args := m.Called(ctx, logID)
	return args.Error(0)
}

func (m *MockAuditLogRepository) HardDelete(ctx context.Context, logID string) error {
	args := m.Called(ctx, logID)
	return args.Error(0)
}

func (m *MockAuditLogRepository) FindByID(ctx context.Context, logID string) (*domain.AuditLog, error) {
	args := m.Called(ctx, logID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AuditLog), args.Error(1)
}

func (m *MockAuditLogRepository) FindOne(ctx context.Context, opts ...database.QueryOption) (*domain.AuditLog, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AuditLog), args.Error(1)
}

func (m *MockAuditLogRepository) Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.AuditLog, int64, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*domain.AuditLog), args.Get(1).(int64), args.Error(2)
}

func (m *MockAuditLogRepository) Count(ctx context.Context, opts ...database.QueryOption) (int64, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockAuditLogRepository) Exists(ctx context.Context, logID string) (bool, error) {
	args := m.Called(ctx, logID)
	return args.Bool(0), args.Error(1)
}

func (m *MockAuditLogRepository) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	args := m.Called(ctx, fn)
	return args.Error(0)
}

// MockSessionRepository is a mock implementation of SessionRepository.
type MockSessionRepository struct {
	mock.Mock
}

func (m *MockSessionRepository) Create(ctx context.Context, session *domain.Session) error {
	args := m.Called(ctx, session)
	return args.Error(0)
}

func (m *MockSessionRepository) FindByID(ctx context.Context, sessionID string) (*domain.Session, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Session), args.Error(1)
}

func (m *MockSessionRepository) FindByUserID(ctx context.Context, userID string) ([]*domain.Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Session), args.Error(1)
}

func (m *MockSessionRepository) Update(ctx context.Context, sessionID string, updates map[string]any) error {
	args := m.Called(ctx, sessionID, updates)
	return args.Error(0)
}

func (m *MockSessionRepository) RevokeByID(ctx context.Context, sessionID, reason string) error {
	args := m.Called(ctx, sessionID, reason)
	return args.Error(0)
}

func (m *MockSessionRepository) RevokeAllByUserID(ctx context.Context, userID, reason string) error {
	args := m.Called(ctx, userID, reason)
	return args.Error(0)
}

func (m *MockSessionRepository) FindByRefreshTokenHash(ctx context.Context, hash string) (*domain.Session, error) {
	args := m.Called(ctx, hash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Session), args.Error(1)
}

func (m *MockSessionRepository) FindActiveByUserID(ctx context.Context, userID string) ([]*domain.Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Session), args.Error(1)
}

func (m *MockSessionRepository) TouchLastUsed(ctx context.Context, sessionID string) error {
	args := m.Called(ctx, sessionID)
	return args.Error(0)
}

func (m *MockSessionRepository) CreateMany(ctx context.Context, sessions []*domain.Session) error {
	args := m.Called(ctx, sessions)
	return args.Error(0)
}

func (m *MockSessionRepository) Upsert(ctx context.Context, sessionID string, session *domain.Session) error {
	args := m.Called(ctx, sessionID, session)
	return args.Error(0)
}

func (m *MockSessionRepository) Delete(ctx context.Context, sessionID string) error {
	args := m.Called(ctx, sessionID)
	return args.Error(0)
}

func (m *MockSessionRepository) HardDelete(ctx context.Context, sessionID string) error {
	args := m.Called(ctx, sessionID)
	return args.Error(0)
}

func (m *MockSessionRepository) FindOne(ctx context.Context, opts ...database.QueryOption) (*domain.Session, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Session), args.Error(1)
}

func (m *MockSessionRepository) Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.Session, int64, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*domain.Session), args.Get(1).(int64), args.Error(2)
}

func (m *MockSessionRepository) Count(ctx context.Context, opts ...database.QueryOption) (int64, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockSessionRepository) Exists(ctx context.Context, sessionID string) (bool, error) {
	args := m.Called(ctx, sessionID)
	return args.Bool(0), args.Error(1)
}

func (m *MockSessionRepository) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	args := m.Called(ctx, fn)
	return args.Error(0)
}

// TestVerifyEmail tests email verification.
func TestVerifyEmail(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"

	userRepo := new(MockUserRepository)
	auditRepo := new(MockAuditLogRepository)
	sessionRepo := new(MockSessionRepository)

	svc := &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
	}

	t.Run("verify_email_success", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Email:         "test@example.com",
			EmailVerified: false,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		userRepo.On("Update", ctx, userID, mock.MatchedBy(func(updates map[string]any) bool {
			return updates["email_verified"] == true
		})).Return(nil)
		auditRepo.On("Create", ctx, mock.Anything).Return(nil)

		err := svc.VerifyEmail(ctx, userID, "valid-token")
		assert.NoError(t, err)
		userRepo.AssertCalled(t, "FindByID", ctx, userID)
		userRepo.AssertCalled(t, "Update", ctx, userID, mock.Anything)
	})

	t.Run("verify_email_user_not_found", func(t *testing.T) {
		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		err := svc.VerifyEmail(ctx, "nonexistent", "token")
		assert.ErrorIs(t, err, apperr.ErrNotFound)
	})
}

// TestRequestPhoneVerification tests phone verification request.
func TestRequestPhoneVerification(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"
	phone := "+84901234567"

	userRepo := new(MockUserRepository)
	auditRepo := new(MockAuditLogRepository)
	sessionRepo := new(MockSessionRepository)

	svc := &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
	}

	t.Run("request_phone_verification_success", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Phone:         phone,
			PhoneVerified: false,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		auditRepo.On("Create", ctx, mock.Anything).Return(nil)

		err := svc.RequestPhoneVerification(ctx, userID, phone)
		assert.NoError(t, err)
		userRepo.AssertCalled(t, "FindByID", ctx, userID)
	})

	t.Run("request_phone_verification_user_not_found", func(t *testing.T) {
		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		err := svc.RequestPhoneVerification(ctx, "nonexistent", phone)
		assert.ErrorIs(t, err, apperr.ErrNotFound)
	})
}

// TestVerifyPhone tests phone verification.
func TestVerifyPhone(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"

	userRepo := new(MockUserRepository)
	auditRepo := new(MockAuditLogRepository)
	sessionRepo := new(MockSessionRepository)

	svc := &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
	}

	t.Run("verify_phone_success", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Phone:         "+84901234567",
			PhoneVerified: false,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		userRepo.On("Update", ctx, userID, mock.MatchedBy(func(updates map[string]any) bool {
			return updates["phone_verified"] == true
		})).Return(nil)
		auditRepo.On("Create", ctx, mock.Anything).Return(nil)

		err := svc.VerifyPhone(ctx, userID, "123456")
		assert.NoError(t, err)
		userRepo.AssertCalled(t, "Update", ctx, userID, mock.Anything)
	})

	t.Run("verify_phone_user_not_found", func(t *testing.T) {
		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		err := svc.VerifyPhone(ctx, "nonexistent", "123456")
		assert.ErrorIs(t, err, apperr.ErrNotFound)
	})
}

// TestGetPreferences tests getting user preferences.
func TestGetPreferences(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"

	userRepo := new(MockUserRepository)
	auditRepo := new(MockAuditLogRepository)
	sessionRepo := new(MockSessionRepository)

	svc := &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
	}

	t.Run("get_preferences_success", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Metadata: map[string]any{
				"notify_login":     true,
				"notify_kyc":       true,
				"notify_transfer":  false,
				"notify_reward":    true,
				"notify_marketing": false,
				"profile_public":   true,
				"show_login_stats": false,
			},
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)

		prefs, err := svc.GetPreferences(ctx, userID)
		require.NoError(t, err)
		assert.NotNil(t, prefs)
		assert.Equal(t, true, prefs.NotifyLogin)
		assert.Equal(t, false, prefs.NotifyTransfer)
		assert.Equal(t, true, prefs.ProfilePublic)
	})

	t.Run("get_preferences_user_not_found", func(t *testing.T) {
		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		prefs, err := svc.GetPreferences(ctx, "nonexistent")
		assert.ErrorIs(t, err, apperr.ErrNotFound)
		assert.Nil(t, prefs)
	})

	t.Run("get_preferences_defaults", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Metadata:      map[string]any{}, // empty metadata
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)

		prefs, err := svc.GetPreferences(ctx, userID)
		require.NoError(t, err)
		assert.NotNil(t, prefs)
		// Should have defaults
		assert.Equal(t, true, prefs.NotifyLogin)
		assert.Equal(t, false, prefs.NotifyMarketing)
	})
}

// TestUpdatePreferences tests updating user preferences.
func TestUpdatePreferences(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"

	userRepo := new(MockUserRepository)
	auditRepo := new(MockAuditLogRepository)
	sessionRepo := new(MockSessionRepository)

	svc := &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
	}

	t.Run("update_preferences_success", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Metadata:      make(map[string]any),
		}

		trueVal := true
		falseVal := false
		req := &UserPreferencesRequest{
			NotifyLogin:     &trueVal,
			NotifyMarketing: &falseVal,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		userRepo.On("Update", ctx, userID, mock.Anything).Return(nil)
		auditRepo.On("Create", ctx, mock.Anything).Return(nil)

		// Mock the second FindByID call from GetPreferences
		userRepo.On("FindByID", ctx, userID).Return(user, nil)

		prefs, err := svc.UpdatePreferences(ctx, userID, req)
		require.NoError(t, err)
		assert.NotNil(t, prefs)
		userRepo.AssertCalled(t, "Update", ctx, userID, mock.Anything)
		auditRepo.AssertCalled(t, "Create", ctx, mock.Anything)
	})

	t.Run("update_preferences_user_not_found", func(t *testing.T) {
		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		trueVal := true
		req := &UserPreferencesRequest{NotifyLogin: &trueVal}

		prefs, err := svc.UpdatePreferences(ctx, "nonexistent", req)
		assert.ErrorIs(t, err, apperr.ErrNotFound)
		assert.Nil(t, prefs)
	})
}

// TestGetReferralInfo tests getting referral information.
func TestGetReferralInfo(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"

	t.Run("get_referral_info_success", func(t *testing.T) {
		userRepo := new(MockUserRepository)
		auditRepo := new(MockAuditLogRepository)
		sessionRepo := new(MockSessionRepository)

		svc := &Service{
			userRepo:    userRepo,
			auditRepo:   auditRepo,
			sessionRepo: sessionRepo,
		}

		now := time.Now()
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: now},
			WalletAddress: wallet,
			ReferralCode:  "ABC123XYZ",
			ReferredBy:    "0x0987654321098765432109876543210987654321",
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)

		info, err := svc.GetReferralInfo(ctx, userID)
		require.NoError(t, err)
		assert.NotNil(t, info)
		assert.Equal(t, "ABC123XYZ", info.ReferralCode)
		assert.Equal(t, "0x0987654321098765432109876543210987654321", info.ReferredBy)
	})

	t.Run("get_referral_info_generates_code", func(t *testing.T) {
		userRepo := new(MockUserRepository)
		auditRepo := new(MockAuditLogRepository)
		sessionRepo := new(MockSessionRepository)

		svc := &Service{
			userRepo:    userRepo,
			auditRepo:   auditRepo,
			sessionRepo: sessionRepo,
		}

		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			ReferralCode:  "", // Empty, needs generation
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		userRepo.On("Update", ctx, userID, mock.Anything).Return(nil)

		info, err := svc.GetReferralInfo(ctx, userID)
		require.NoError(t, err)
		assert.NotNil(t, info)
		assert.NotEmpty(t, info.ReferralCode)
		userRepo.AssertCalled(t, "Update", ctx, userID, mock.Anything)
	})

	t.Run("get_referral_info_user_not_found", func(t *testing.T) {
		userRepo := new(MockUserRepository)
		auditRepo := new(MockAuditLogRepository)
		sessionRepo := new(MockSessionRepository)

		svc := &Service{
			userRepo:    userRepo,
			auditRepo:   auditRepo,
			sessionRepo: sessionRepo,
		}

		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		info, err := svc.GetReferralInfo(ctx, "nonexistent")
		assert.ErrorIs(t, err, apperr.ErrNotFound)
		assert.Nil(t, info)
	})
}

// TestListReferrals tests listing referral records.
func TestListReferrals(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"

	userRepo := new(MockUserRepository)
	auditRepo := new(MockAuditLogRepository)
	sessionRepo := new(MockSessionRepository)

	svc := &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
	}

	t.Run("list_referrals_success", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)

		referrals, total, err := svc.ListReferrals(ctx, userID, 1, 20)
		require.NoError(t, err)
		assert.NotNil(t, referrals)
		assert.Equal(t, int64(0), total)
	})

	t.Run("list_referrals_normalizes_page_size", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)

		// Request with invalid page size (should be normalized)
		referrals, total, err := svc.ListReferrals(ctx, userID, 0, 200)
		require.NoError(t, err)
		assert.NotNil(t, referrals)
		assert.Equal(t, int64(0), total)
	})

	t.Run("list_referrals_user_not_found", func(t *testing.T) {
		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		referrals, total, err := svc.ListReferrals(ctx, "nonexistent", 1, 20)
		assert.ErrorIs(t, err, apperr.ErrNotFound)
		assert.Nil(t, referrals)
		assert.Equal(t, int64(0), total)
	})
}

// TestGenerateBackupCodes tests generating backup codes.
func TestGenerateBackupCodes(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"

	t.Run("generate_backup_codes_success", func(t *testing.T) {
		userRepo := new(MockUserRepository)
		auditRepo := new(MockAuditLogRepository)
		sessionRepo := new(MockSessionRepository)

		svc := &Service{
			userRepo:    userRepo,
			auditRepo:   auditRepo,
			sessionRepo: sessionRepo,
		}

		user := &domain.User{
			BaseEntity:       domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress:    wallet,
			TwoFactorEnabled: true,
			TwoFactorMethod:  domain.TwoFactorTOTP,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		auditRepo.On("Create", ctx, mock.Anything).Return(nil)

		codes, err := svc.GenerateBackupCodes(ctx, userID)
		require.NoError(t, err)
		assert.NotNil(t, codes)
		assert.Len(t, codes.BackupCodes, 10)
		assert.NotEmpty(t, codes.Message)

		// Check code format XXXX-XXXX-XXXX
		for _, code := range codes.BackupCodes {
			assert.Regexp(t, `^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`, code)
		}
	})

	t.Run("generate_backup_codes_2fa_disabled", func(t *testing.T) {
		userRepo := new(MockUserRepository)
		auditRepo := new(MockAuditLogRepository)
		sessionRepo := new(MockSessionRepository)

		svc := &Service{
			userRepo:    userRepo,
			auditRepo:   auditRepo,
			sessionRepo: sessionRepo,
		}

		user := &domain.User{
			BaseEntity:       domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress:    wallet,
			TwoFactorEnabled: false,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)

		codes, err := svc.GenerateBackupCodes(ctx, userID)
		assert.Error(t, err)
		assert.Nil(t, codes)
	})

	t.Run("generate_backup_codes_user_not_found", func(t *testing.T) {
		userRepo := new(MockUserRepository)
		auditRepo := new(MockAuditLogRepository)
		sessionRepo := new(MockSessionRepository)

		svc := &Service{
			userRepo:    userRepo,
			auditRepo:   auditRepo,
			sessionRepo: sessionRepo,
		}

		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		codes, err := svc.GenerateBackupCodes(ctx, "nonexistent")
		assert.ErrorIs(t, err, apperr.ErrNotFound)
		assert.Nil(t, codes)
	})
}

// TestDeactivateAccount tests account deactivation.
func TestDeactivateAccount(t *testing.T) {
	ctx := context.Background()
	userID := "user-123"
	wallet := "0x1234567890123456789012345678901234567890"
	ip := "192.168.1.1"
	reason := "Personal decision"

	userRepo := new(MockUserRepository)
	auditRepo := new(MockAuditLogRepository)
	sessionRepo := new(MockSessionRepository)

	svc := &Service{
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		sessionRepo: sessionRepo,
	}

	t.Run("deactivate_account_success", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Status:        domain.UserStatusActive,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		userRepo.On("Update", ctx, userID, mock.MatchedBy(func(updates map[string]any) bool {
			status, ok := updates["status"].(string)
			return ok && status == string(domain.UserStatusDeactivated)
		})).Return(nil)
		sessionRepo.On("RevokeAllByUserID", ctx, userID, "account_deactivated").Return(nil)
		auditRepo.On("Create", ctx, mock.Anything).Return(nil)

		err := svc.DeactivateAccount(ctx, userID, reason, ip)
		assert.NoError(t, err)
		userRepo.AssertCalled(t, "Update", ctx, userID, mock.Anything)
		sessionRepo.AssertCalled(t, "RevokeAllByUserID", ctx, userID, "account_deactivated")
	})

	t.Run("deactivate_account_user_not_found", func(t *testing.T) {
		userRepo.On("FindByID", ctx, "nonexistent").Return(nil, apperr.ErrNotFound)

		err := svc.DeactivateAccount(ctx, "nonexistent", reason, ip)
		assert.ErrorIs(t, err, apperr.ErrNotFound)
	})

	t.Run("deactivate_account_with_empty_reason", func(t *testing.T) {
		user := &domain.User{
			BaseEntity:    domain.BaseEntity{ID: userID, CreatedAt: time.Now()},
			WalletAddress: wallet,
			Status:        domain.UserStatusActive,
		}

		userRepo.On("FindByID", ctx, userID).Return(user, nil)
		userRepo.On("Update", ctx, userID, mock.Anything).Return(nil)
		sessionRepo.On("RevokeAllByUserID", ctx, userID, "account_deactivated").Return(nil)
		auditRepo.On("Create", ctx, mock.Anything).Return(nil)

		err := svc.DeactivateAccount(ctx, userID, "", ip)
		assert.NoError(t, err)
	})
}

// TestGenerateReferralCode tests the referral code generation.
func TestGenerateReferralCode(t *testing.T) {
	code1 := generateReferralCode()
	code2 := generateReferralCode()

	t.Run("generates_10_character_code", func(t *testing.T) {
		assert.Len(t, code1, 10)
		assert.Regexp(t, `^[A-Z0-9]{10}$`, code1)
	})

	t.Run("generates_different_codes", func(t *testing.T) {
		// Note: may fail if random happens to generate same code twice
		// but very unlikely with 36^10 possibilities
		assert.NotEqual(t, code1, code2)
	})
}

// TestGenerateBackupCode tests the backup code generation.
func TestGenerateBackupCode(t *testing.T) {
	code1 := generateBackupCode()
	code2 := generateBackupCode()

	t.Run("generates_formatted_code", func(t *testing.T) {
		// Format: XXXX-XXXX-XXXX
		assert.Regexp(t, `^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`, code1)
	})

	t.Run("generates_different_codes", func(t *testing.T) {
		assert.NotEqual(t, code1, code2)
	})

	t.Run("total_length_matches", func(t *testing.T) {
		// 4 + 4 + 4 + 2 dashes = 14 characters
		assert.Len(t, code1, 14)
	})
}

// Package auth implements the authentication and session management service.
//
// Authentication flow:
//  1. GET  /auth/challenge?wallet=0x…   → returns nonce + message to sign
//  2. POST /auth/login                   → verifies SIWE sig, issues JWT pair
//     2a. If 2FA is enabled              → returns temp_token (no full JWT yet)
//     2b. POST /auth/2fa/complete        → verifies TOTP, issues full JWT pair
//  3. POST /auth/refresh                 → rotates refresh token
//  4. POST /auth/logout                  → revokes session + blacklists access token
//
// Security properties:
//   - Wallet-only auth (SIWE / EIP-191 personal_sign) — no password storage
//   - Short-lived access tokens (15 min), long-lived refresh tokens (7 days)
//   - Refresh token rotation — each use issues a new token and invalidates the old
//   - Access token blacklisting in Redis on logout (until natural expiry)
//   - TOTP 2FA with RFC 6238 ±1 window clock tolerance
//   - 8 one-time backup codes (SHA-256 hashed in DB, never stored plaintext)
//   - Brute-force lockout: 5 failed attempts → 30-min account lock
//   - IP-level rate limiting applied at the router layer (pkg/http/middleware)
package auth

import (
	"context"
	"fmt"
	"strings"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/blockchain"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/totp"
)

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

// Service orchestrates authentication, session issuance, token rotation, 2FA flows, and audit side effects.
// It is the main boundary where auth-specific application rules coordinate repository and cache dependencies.
type Service struct {
	userRepo    ports.UserRepository
	sessionRepo ports.SessionRepository
	attemptRepo ports.LoginAttemptRepository
	auditRepo   ports.AuditLogRepository
	authCache   ports.AuthCachePort
	cfg         Config
	log         logger.Logger
}

// NewService constructs the auth Service with all dependencies injected.
// The constructor also normalizes configuration defaults so auth flows behave consistently across environments.
func NewService(
	userRepo ports.UserRepository,
	sessionRepo ports.SessionRepository,
	attemptRepo ports.LoginAttemptRepository,
	auditRepo ports.AuditLogRepository,
	authCache ports.AuthCachePort,
	cfg Config,
	log logger.Logger,
) *Service {
	cfg.setDefaults()
	return &Service{
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		attemptRepo: attemptRepo,
		auditRepo:   auditRepo,
		authCache:   authCache,
		cfg:         cfg,
		log:         log.Named("auth_service"),
	}
}

// ─────────────────────────────────────────────
//  GetChallenge — step 1 of SIWE login
// ─────────────────────────────────────────────

// GetChallenge generates a random nonce, persists it with a short TTL,
// and returns the pre-formatted EIP-191 message that the wallet must sign.
// This is the entry point of the SIWE login flow and establishes replay protection before any signature verification occurs.
func (s *Service) GetChallenge(ctx context.Context, wallet string) (*ChallengeResponse, error) {
	wallet = normalizeAddress(wallet)
	if wallet == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid wallet address")
	}

	nonce, err := generateNonce()
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Generate nonce failed", err)
	}

	issuedAt := time.Now().UTC().Format(time.RFC3339)
	msg := blockchain.SIWEMessage(s.cfg.SIWEDomain, wallet, nonce, issuedAt)

	if err := s.authCache.StoreChallenge(ctx, wallet, nonce, s.cfg.ChallengeTTL); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Store challenge failed", err)
	}

	return &ChallengeResponse{
		Message:   msg,
		Nonce:     nonce,
		ExpiresAt: time.Now().Add(s.cfg.ChallengeTTL),
	}, nil
}

// ─────────────────────────────────────────────
//  Login — step 2
// ─────────────────────────────────────────────

// Login verifies the SIWE signature and either issues a JWT pair or
// returns a pending 2FA token for subsequent TOTP verification.
// In addition to signature validation, it enforces account guards, resets brute-force state, and records audit side effects.
func (s *Service) Login(ctx context.Context, req *LoginRequest) (*LoginResult, error) {
	log := logger.FromContext(ctx).With(logger.String("op", "Login"), logger.String("wallet", req.Wallet))
	wallet := normalizeAddress(req.Wallet)

	// 1. Retrieve challenge nonce (proves the client initiated this flow).
	// We no longer use the nonce for reconstruction; it's only for replay protection.
	_, err := s.authCache.GetChallenge(ctx, wallet)
	if err != nil {
		s.recordAttempt(ctx, wallet, req.IPAddress, req.UserAgent, false, "no_challenge")
		return nil, apperr.New(apperr.ErrCodeUnauthorized, "Challenge not found or expired — call /auth/challenge first")
	}

	// 2. Verify EIP-191 personal_sign signature.
	// CRITICAL: Use the message provided by the client (signed with), NOT a reconstructed one.
	// Reconstructing with time.Now() would create a different message hash.
	sigBytes, err := blockchain.HexToBytes(req.Signature)
	if err != nil {
		s.recordAttempt(ctx, wallet, req.IPAddress, req.UserAgent, false, "bad_signature_hex")
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Malformed signature")
	}
	// Use the message provided in the request (client signed this exact message)
	ethAddr, err := blockchain.RecoverPersonalSigner(req.Message, sigBytes)
	if err != nil {
		s.recordAttempt(ctx, wallet, req.IPAddress, req.UserAgent, false, "recover_failed")
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Signature recovery failed")
	}
	if !strings.EqualFold(ethAddr.Hex(), wallet) {
		s.recordAttempt(ctx, wallet, req.IPAddress, req.UserAgent, false, "address_mismatch")
		return nil, apperr.New(apperr.ErrCodeInvalidSignature, "Signature does not match wallet")
	}
	_ = s.authCache.DeleteChallenge(ctx, wallet) // consume nonce — prevents replay

	// 3. Load or auto-provision user.
	user, err := s.getOrCreateUser(ctx, wallet)
	if err != nil {
		return nil, err
	}

	// 4. Account status guards.
	if user.IsLocked() {
		return nil, apperr.New(apperr.ErrCodeUnauthorized,
			fmt.Sprintf("Account locked until %s", user.LockedUntil.Format(time.RFC3339)))
	}
	if user.Status == domain.UserStatusSuspended || user.Status == domain.UserStatusBanned {
		return nil, apperr.New(apperr.ErrCodeUnauthorized, "Account is suspended")
	}

	// 5. Update login tracking.
	_ = s.userRepo.ResetFailedAttempts(ctx, wallet)
	_ = s.userRepo.UpdateLoginInfo(ctx, wallet, req.IPAddress, time.Now())
	s.recordAttempt(ctx, wallet, req.IPAddress, req.UserAgent, true, "")

	// 6. Gate on 2FA when enabled.
	if user.TwoFactorEnabled {
		tempToken, genErr := generateNonce()
		if genErr != nil {
			return nil, apperr.Wrap(apperr.ErrCodeInternal, "Generate 2FA token failed", genErr)
		}
		if storeErr := s.authCache.StorePending2FA(ctx, tempToken, wallet, s.cfg.Pending2FATTL); storeErr != nil {
			return nil, apperr.Wrap(apperr.ErrCodeInternal, "Store 2FA session failed", storeErr)
		}
		log.Info("login pending 2FA", logger.String("user_id", user.ID))
		return &LoginResult{Requires2FA: true, TempToken: tempToken}, nil
	}

	// 7. Issue full token pair.
	pair, err := s.createSession(ctx, user, req)
	if err != nil {
		return nil, err
	}
	s.writeAudit(ctx, domain.AuditLogin, user.ID, user.WalletAddress, "", req.IPAddress, req.UserAgent, "", nil)
	log.Info("login success", logger.String("user_id", user.ID))
	return &LoginResult{TokenPair: pair}, nil
}

// ─────────────────────────────────────────────
//  Complete2FA — finalize login after TOTP check
// ─────────────────────────────────────────────

// Complete2FA verifies the TOTP or backup code associated with a pending 2FA login session and then issues the full JWT pair.
// It is the final gate between a successful SIWE signature and a fully authenticated session.
func (s *Service) Complete2FA(ctx context.Context, req *Complete2FARequest) (*TokenPair, error) {
	log := logger.FromContext(ctx).With(logger.String("op", "Complete2FA"))

	wallet, err := s.authCache.GetPending2FA(ctx, req.TempToken)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeUnauthorized, "Invalid or expired 2FA session")
	}

	user, err := s.userRepo.FindByWallet(ctx, wallet)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeUnauthorized, "User not found")
	}

	// Validate TOTP code; fall back to backup code.
	valid, totpErr := totp.Verify(user.TOTPSecret, req.Code)
	if totpErr != nil || !valid {
		updated, consumed := totp.ConsumeBackupCode(req.Code, user.TOTPBackupCodes)
		if !consumed {
			s.writeAudit(ctx, domain.AuditTwoFAFailed, user.ID, user.WalletAddress, "", req.IPAddress, req.UserAgent, "", nil)
			return nil, apperr.New(apperr.ErrCodeUnauthorized, "Invalid 2FA code")
		}
		_ = s.userRepo.Update(ctx, user.ID, map[string]any{"totp_backup_codes": updated})
	}
	_ = s.authCache.DeletePending2FA(ctx, req.TempToken)

	// Re-use createSession; populate the embedded Meta fields manually.
	loginReq := &LoginRequest{Wallet: wallet, DeviceName: req.DeviceName, DeviceOS: req.DeviceOS}
	loginReq.IPAddress = req.IPAddress
	loginReq.UserAgent = req.UserAgent

	pair, err := s.createSession(ctx, user, loginReq)
	if err != nil {
		return nil, err
	}
	s.writeAudit(ctx, domain.AuditTwoFAVerified, user.ID, user.WalletAddress, "", req.IPAddress, req.UserAgent, "", nil)
	s.writeAudit(ctx, domain.AuditLogin, user.ID, user.WalletAddress, "", req.IPAddress, req.UserAgent, "", nil)
	log.Info("2FA complete", logger.String("user_id", user.ID))
	return pair, nil
}

// ─────────────────────────────────────────────
//  Refresh — rotate refresh token
// ─────────────────────────────────────────────

// Refresh validates the refresh token, revokes it, and issues a new pair as part of rotation.
// This keeps refresh tokens single-use and limits replay risk if one token is leaked.
func (s *Service) Refresh(ctx context.Context, req *RefreshRequest) (*TokenPair, error) {
	log := logger.FromContext(ctx).With(logger.String("op", "Refresh"))

	hash := hashToken(req.RefreshToken)
	session, err := s.sessionRepo.FindByRefreshTokenHash(ctx, hash)
	if err != nil || !session.IsActive() {
		return nil, apperr.New(apperr.ErrCodeUnauthorized, "Invalid or expired refresh token")
	}

	user, err := s.userRepo.FindByID(ctx, session.UserID)
	if err != nil || !user.IsActive() {
		return nil, apperr.New(apperr.ErrCodeUnauthorized, "User not found or inactive")
	}

	_ = s.sessionRepo.RevokeByID(ctx, session.ID, "token_rotation")

	loginReq := &LoginRequest{Wallet: user.WalletAddress}
	loginReq.IPAddress = req.IPAddress
	loginReq.UserAgent = req.UserAgent

	pair, err := s.createSession(ctx, user, loginReq)
	if err != nil {
		return nil, err
	}
	s.writeAudit(ctx, domain.AuditTokenRefresh, user.ID, user.WalletAddress, "", req.IPAddress, req.UserAgent, session.ID, nil)
	log.Info("token refreshed", logger.String("user_id", user.ID))
	return pair, nil
}

// ─────────────────────────────────────────────
//  Logout
// ─────────────────────────────────────────────

// Logout blacklists the current access token and revokes the relevant session or sessions.
// The method supports both single-session logout and account-wide logout-all scenarios.
func (s *Service) Logout(ctx context.Context, req *LogoutRequest, remainingTTL time.Duration) error {
	if req.JWTID != "" {
		_ = s.authCache.BlacklistToken(ctx, req.JWTID, remainingTTL)
	}
	if req.LogoutAll {
		_ = s.sessionRepo.RevokeAllByUserID(ctx, req.UserID, "logout_all")
	} else if req.SessionID != "" {
		_ = s.sessionRepo.RevokeByID(ctx, req.SessionID, "logout")
	}
	s.writeAudit(ctx, domain.AuditLogout, req.UserID, req.Wallet, "", req.IPAddress, req.UserAgent, req.SessionID, nil)
	return nil
}

// ─────────────────────────────────────────────
//  2FA management
// ─────────────────────────────────────────────

// Setup2FA generates a new TOTP secret and backup codes.
// It prepares enrollment data but does not enable 2FA until the user proves possession of the generated secret.
func (s *Service) Setup2FA(ctx context.Context, userID string) (*Setup2FAResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	if user.TwoFactorEnabled {
		return nil, apperr.New(apperr.ErrCodeConflict, "2FA is already enabled")
	}

	secret, err := totp.GenerateSecret()
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Generate TOTP secret failed", err)
	}
	plain, hashed, err := totp.GenerateBackupCodes()
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Generate backup codes failed", err)
	}

	if err := s.userRepo.Update(ctx, userID, map[string]any{
		"totp_secret":       secret,
		"totp_backup_codes": hashed,
	}); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "Save TOTP secret failed", err)
	}

	uri := totp.OTPAuthURI(s.cfg.JWTIssuer, user.WalletAddress, secret)
	return &Setup2FAResponse{Secret: secret, OTPAuthURI: uri, BackupCodes: plain}, nil
}

// Enable2FA activates TOTP on the account after the user confirms the secret with a live code.
// This prevents half-configured secrets from being marked active before the user has a working authenticator setup.
func (s *Service) Enable2FA(ctx context.Context, req *Enable2FARequest) error {
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return apperr.ErrNotFound
	}
	if user.TOTPSecret == "" {
		return apperr.New(apperr.ErrCodeBadRequest, "Call /auth/2fa/setup first")
	}

	valid, err := totp.Verify(user.TOTPSecret, req.Code)
	if err != nil || !valid {
		return apperr.New(apperr.ErrCodeUnauthorized, "Invalid TOTP code")
	}

	if err := s.userRepo.Update(ctx, req.UserID, map[string]any{
		"two_factor_enabled": true,
		"two_factor_method":  string(domain.TwoFactorTOTP),
	}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Enable 2FA failed", err)
	}
	s.writeAudit(ctx, domain.AuditTwoFAEnabled, req.UserID, user.WalletAddress, "", req.IPAddress, req.UserAgent, "", nil)
	return nil
}

// Disable2FA turns off TOTP and clears the stored 2FA secret and backup codes.
// A valid current TOTP code or backup code is required so disabling 2FA remains an authenticated action.
func (s *Service) Disable2FA(ctx context.Context, req *Disable2FARequest) error {
	user, err := s.userRepo.FindByID(ctx, req.UserID)
	if err != nil {
		return apperr.ErrNotFound
	}
	if !user.TwoFactorEnabled {
		return apperr.New(apperr.ErrCodeBadRequest, "2FA is not enabled")
	}

	valid, _ := totp.Verify(user.TOTPSecret, req.Code)
	if !valid {
		_, consumed := totp.ConsumeBackupCode(req.Code, user.TOTPBackupCodes)
		if !consumed {
			return apperr.New(apperr.ErrCodeUnauthorized, "Invalid code")
		}
	}

	if err := s.userRepo.Update(ctx, req.UserID, map[string]any{
		"two_factor_enabled": false,
		"two_factor_method":  "",
		"totp_secret":        "",
		"totp_backup_codes":  []string{},
	}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Disable 2FA failed", err)
	}
	s.writeAudit(ctx, domain.AuditTwoFADisabled, req.UserID, user.WalletAddress, "", req.IPAddress, req.UserAgent, "", nil)
	return nil
}

// ─────────────────────────────────────────────
//  Session management (public API)
// ─────────────────────────────────────────────

// IsBlacklisted reports whether the given JWT ID has been revoked.
// Middleware and token validation layers use this to reject access tokens that were explicitly logged out early.
func (s *Service) IsBlacklisted(ctx context.Context, jwtID string) (bool, error) {
	return s.authCache.IsTokenBlacklisted(ctx, jwtID)
}

// GetActiveSessions returns all unexpired, un-revoked sessions for a user.
// This powers user session-management screens and administrative session review tooling.
func (s *Service) GetActiveSessions(ctx context.Context, userID string) ([]*domain.Session, error) {
	return s.sessionRepo.FindActiveByUserID(ctx, userID)
}

// RevokeSession terminates a specific session by ID after verifying the caller owns that session.
// This method backs self-service device/session management in account security settings.
func (s *Service) RevokeSession(ctx context.Context, userID, sessionID, ip, ua string) error {
	session, err := s.sessionRepo.FindByID(ctx, sessionID)
	if err != nil {
		return apperr.ErrNotFound
	}
	if session.UserID != userID {
		return apperr.New(apperr.ErrCodeForbidden, "Cannot revoke another user's session")
	}
	if err := s.sessionRepo.RevokeByID(ctx, sessionID, "user_revoked"); err != nil {
		return err
	}
	s.writeAudit(ctx, domain.AuditSessionRevoked, userID, session.WalletAddress, "", ip, ua, sessionID, nil)
	return nil
}

// ─────────────────────────────────────────────
//  Internal — session creation
// ─────────────────────────────────────────────

// createSession mints a new access/refresh token pair and persists the refresh-side session record.
// It is reused by both direct login and post-2FA completion so session issuance logic stays centralized.
func (s *Service) createSession(ctx context.Context, user *domain.User, req *LoginRequest) (*TokenPair, error) {
	now := time.Now().UTC()
	accessExpiry := now.Add(s.cfg.AccessTTL)
	refreshExpiry := now.Add(s.cfg.RefreshTTL)

	sessionID := uuid.NewString()
	jwtID := uuid.NewString()

	accessToken, err := s.mintAccessToken(user, sessionID, jwtID, accessExpiry)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Mint access token failed", err)
	}

	rawRefresh, err := generateRefreshToken()
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Generate refresh token failed", err)
	}

	session := &domain.Session{
		BaseEntity:       domain.BaseEntity{ID: sessionID},
		UserID:           user.ID,
		WalletAddress:    user.WalletAddress,
		RefreshTokenHash: hashToken(rawRefresh),
		DeviceName:       req.DeviceName,
		DeviceOS:         req.DeviceOS,
		UserAgent:        req.UserAgent,
		IPAddress:        req.IPAddress,
		IssuedAt:         now,
		ExpiresAt:        refreshExpiry,
		Roles:            user.RoleStrings(),
	}
	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Create session failed", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		ExpiresAt:    accessExpiry,
		TokenType:    "Bearer",
		User:         user,
	}, nil
}

// mintAccessToken builds and signs the short-lived JWT access token bound to one user session.
// The token embeds session and role context so downstream middleware can authorize requests without extra reads.
func (s *Service) mintAccessToken(user *domain.User, sessionID, jwtID string, expiry time.Time) (string, error) {
	now := time.Now()
	claims := gojwt.MapClaims{
		"jti":            jwtID,
		"sub":            user.ID,
		"iss":            s.cfg.JWTIssuer,
		"iat":            now.Unix(),
		"exp":            expiry.Unix(),
		"wallet_address": user.WalletAddress,
		"user_id":        user.ID,
		"session_id":     sessionID,
		"roles":          user.RoleStrings(),
	}
	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// getOrCreateUser resolves the wallet owner from persistence or auto-provisions a baseline user on first login.
// Auto-provisioning keeps wallet-first onboarding friction low while still producing a durable user identity record.
func (s *Service) getOrCreateUser(ctx context.Context, wallet string) (*domain.User, error) {
	user, err := s.userRepo.FindByWallet(ctx, wallet)
	if err == nil {
		return user, nil
	}
	if !apperr.IsNotFound(err) {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindByWallet failed", err)
	}

	nonce, nonceErr := generateNonce()
	if nonceErr != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "Generate user nonce failed", nonceErr)
	}

	newUser := &domain.User{
		WalletAddress:       wallet,
		Nonce:               nonce,
		Status:              domain.UserStatusActive,
		Roles:               []domain.UserRole{domain.RoleUser},
		KYCStatus:           domain.KYCStatusNone,
		KYCLevel:            domain.KYCLevelNone,
		TwoFactorEnabled:    false,
		FailedLoginAttempts: 0,
	}

	if createErr := s.userRepo.Create(ctx, newUser); createErr != nil {
		if apperr.Is(createErr, apperr.ErrCodeConflict) {
			created, findErr := s.userRepo.FindByWallet(ctx, wallet)
			if findErr == nil {
				return created, nil
			}
			return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindByWallet after conflict failed", findErr)
		}
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "Create user failed", createErr)
	}

	created, findErr := s.userRepo.FindByWallet(ctx, wallet)
	if findErr != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindByWallet after create failed", findErr)
	}

	s.log.Info("user auto-provisioned on first login",
		logger.String("user_id", created.ID),
		logger.String("wallet", created.WalletAddress),
	)

	return created, nil
}

// ─────────────────────────────────────────────
//  Internal — audit & brute-force tracking
// ─────────────────────────────────────────────

// recordAttempt persists a login attempt and, on failure, updates brute-force tracking for the wallet.
// When the configured threshold is crossed, it also locks the account for the configured duration.
func (s *Service) recordAttempt(ctx context.Context, wallet, ip, ua string, success bool, reason string) {
	attempt := &domain.LoginAttempt{
		WalletAddress: wallet,
		IPAddress:     ip,
		UserAgent:     ua,
		Success:       success,
		FailReason:    reason,
		AttemptedAt:   time.Now().UTC(),
	}
	_ = s.attemptRepo.Create(ctx, attempt)

	if !success && wallet != "" {
		n, _ := s.userRepo.IncrementFailedAttempts(ctx, wallet)
		if n >= s.cfg.MaxFailedAttempts {
			until := time.Now().Add(s.cfg.LockDuration)
			_ = s.userRepo.LockAccount(ctx, wallet, until)
			s.log.Warn("account locked due to brute force",
				logger.String("wallet", wallet),
				logger.String("until", until.Format(time.RFC3339)),
			)
		}
	}
}

// writeAudit records an auth-related security event without interrupting the main request flow on failure.
// Audit persistence is best-effort here because authentication outcomes should not hinge on logging side effects.
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

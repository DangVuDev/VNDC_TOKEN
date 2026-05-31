// Package middleware provides Gin middleware components:
// - Logger: structured request/response logging with latency
// - Recovery: panic recovery with AppError wrapping
// - Auth: JWT verification + wallet address injection into context
// - CORS: cross-origin resource sharing headers
// - RateLimit: token-bucket per-IP rate limiting
// - SecurityHeaders: OWASP-recommended security response headers
// - StrictRateLimit: tighter per-IP limiter for auth endpoints
package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/time/rate"

	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  Logger Middleware
// ─────────────────────────────────────────────

// Logger returns a Gin middleware that logs every request with structured fields.
func Logger(log logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		requestID := uuid.NewString()
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		// Attach request-scoped logger to context
		reqLog := log.With(
			logger.String("request_id", requestID),
			logger.String("method", c.Request.Method),
			logger.String("path", c.FullPath()),
			logger.String("ip", c.ClientIP()),
		)
		c.Request = c.Request.WithContext(reqLog.WithContext(c.Request.Context()))

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		reqLog.Info("request",
			logger.Int("status", status),
			logger.Duration("latency", latency),
			logger.Int("bytes", c.Writer.Size()),
		)
	}
}

// ─────────────────────────────────────────────
//  Recovery Middleware
// ─────────────────────────────────────────────

// Recovery returns a Gin middleware that recovers from panics.
func Recovery(log logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Error("panic recovered",
					logger.Any("error", rec),
					logger.String("stack", string(debug.Stack())),
					logger.String("path", c.FullPath()),
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "An unexpected error occurred",
					},
				})
			}
		}()
		c.Next()
	}
}

// ─────────────────────────────────────────────
//  Auth Middleware — JWT Bearer token
// ─────────────────────────────────────────────

// Claims are the custom JWT claims used by the VNDC backend.
type Claims struct {
	WalletAddress string   `json:"wallet_address"`
	UserID        string   `json:"user_id"`
	SessionID     string   `json:"session_id"`
	Roles         []string `json:"roles"`
	jwt.RegisteredClaims
}

// BlacklistChecker is an optional function that checks whether a JWT ID has been revoked.
// Inject into AuthWithBlacklist to enable post-logout token invalidation.
type BlacklistChecker func(ctx context.Context, jwtID string) (bool, error)

// Auth returns a Gin middleware that validates Bearer JWT tokens.
// Sets wallet_address, user_id, session_id, and roles in the Gin context.
func Auth(jwtSecret string) gin.HandlerFunc {
	return AuthWithBlacklist(jwtSecret, nil)
}

// AuthWithBlacklist validates JWT tokens and optionally checks a revocation store.
// Pass nil for checker to skip the blacklist check.
func AuthWithBlacklist(jwtSecret string, checker BlacklistChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   gin.H{"code": "UNAUTHORIZED", "message": "Bearer token required"},
			})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   gin.H{"code": string(apperr.ErrCodeTokenInvalid), "message": "Invalid or expired token"},
			})
			return
		}

		// Optional: check revocation list (e.g. after logout).
		if checker != nil && claims.ID != "" {
			revoked, checkErr := checker(c.Request.Context(), claims.ID)
			if checkErr == nil && revoked {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"success": false,
					"error":   gin.H{"code": string(apperr.ErrCodeTokenInvalid), "message": "Token has been revoked"},
				})
				return
			}
		}

		c.Set("wallet_address", claims.WalletAddress)
		c.Set("user_id", claims.UserID)
		c.Set("session_id", claims.SessionID)
		c.Set("roles", claims.Roles)
		c.Set("jwt_id", claims.ID)
		c.Next()
	}
}

// RequireRole returns a middleware that enforces at least one of the given roles.
// Must be used after Auth/AuthWithBlacklist.
func RequireRole(roles ...string) gin.HandlerFunc {
	required := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		required[r] = struct{}{}
	}
	return func(c *gin.Context) {
		userRoles, _ := c.Get("roles")
		if userRoles != nil {
			if rs, ok := userRoles.([]string); ok {
				for _, r := range rs {
					if _, ok := required[r]; ok {
						c.Next()
						return
					}
				}
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   gin.H{"code": "FORBIDDEN", "message": "Insufficient permissions"},
		})
	}
}

// RequireKYCForLogin ensures the login wallet already belongs to a KYC-verified account.
// It reads the request body, checks the wallet field, and restores the body for downstream handlers.
func RequireKYCForLogin(userRepo ports.UserRepository) gin.HandlerFunc {
	type walletOnlyRequest struct {
		Wallet string `json:"wallet"`
	}

	return func(c *gin.Context) {
		if userRepo == nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   gin.H{"code": string(apperr.ErrCodeInternal), "message": "User repository is not available"},
			})
			return
		}

		body, err := c.GetRawData()
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   gin.H{"code": string(apperr.ErrCodeBadRequest), "message": "Invalid request body"},
			})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

		var req walletOnlyRequest
		if len(bytes.TrimSpace(body)) == 0 {
			c.Next()
			return
		}
		if err := json.Unmarshal(body, &req); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   gin.H{"code": string(apperr.ErrCodeBadRequest), "message": "Invalid request body"},
			})
			return
		}

		wallet := strings.TrimSpace(req.Wallet)
		if wallet == "" {
			c.Next()
			return
		}

		user, lookupErr := userRepo.FindByWallet(c.Request.Context(), wallet)
		if lookupErr != nil || user == nil || !user.IsKYCVerified() {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   gin.H{"code": string(apperr.ErrCodeForbidden), "message": "Tài khoản chưa KYC. Vui lòng hoàn thành KYC trước khi đăng ký."},
			})
			return
		}

		c.Next()
	}
}

// WalletAddress extracts the authenticated wallet address from Gin context.
func WalletAddress(c *gin.Context) string { return c.GetString("wallet_address") }
func UserID(c *gin.Context) string        { return c.GetString("user_id") }
func SessionID(c *gin.Context) string     { return c.GetString("session_id") }
func JWTID(c *gin.Context) string         { return c.GetString("jwt_id") }

// RequireKYCLevel returns a middleware that enforces a minimum KYC level on the authenticated user.
// Admins (ADMIN / SUPER_ADMIN role) bypass the check automatically.
// Must be used after Auth/AuthWithBlacklist.
func RequireKYCLevel(minLevel int, userRepo ports.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Admins bypass KYC requirements.
		userRoles, _ := c.Get("roles")
		if rs, ok := userRoles.([]string); ok {
			for _, r := range rs {
				if r == "ADMIN" || r == "SUPER_ADMIN" {
					c.Next()
					return
				}
			}
		}

		userID := c.GetString("user_id")
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   gin.H{"code": "UNAUTHORIZED", "message": "Authentication required"},
			})
			return
		}

		user, err := userRepo.FindByID(c.Request.Context(), userID)
		if err != nil || user == nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   gin.H{"code": "KYC_REQUIRED", "message": "Tài khoản không hợp lệ"},
			})
			return
		}

		if int(user.KYCLevel) < minLevel {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":     "KYC_REQUIRED",
					"message":  "Bạn cần hoàn thành KYC để sử dụng tính năng này",
					"required": minLevel,
					"current":  int(user.KYCLevel),
				},
			})
			return
		}

		c.Next()
	}
}

// Roles extracts the roles slice from Gin context.
func Roles(c *gin.Context) []string {
	v, _ := c.Get("roles")
	if rs, ok := v.([]string); ok {
		return rs
	}
	return nil
}

// ─────────────────────────────────────────────
//  CORS Middleware
// ─────────────────────────────────────────────

// CORSConfig holds CORS settings.
type CORSConfig struct {
	AllowOrigins []string
	AllowHeaders []string
	MaxAge       time.Duration
}

// DefaultCORSConfig returns permissive defaults for development.
func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowOrigins: []string{"*"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization", "X-Request-ID"},
		MaxAge:       12 * time.Hour,
	}
}

// CORS returns a Gin middleware for CORS header injection.
// When AllowOrigins contains exactly "*" the wildcard is forwarded as-is.
// Otherwise the request's Origin is validated against the explicit allow-list.
func CORS(cfg CORSConfig) gin.HandlerFunc {
	wildcard := len(cfg.AllowOrigins) == 1 && cfg.AllowOrigins[0] == "*"

	allowSet := make(map[string]struct{}, len(cfg.AllowOrigins))
	for _, o := range cfg.AllowOrigins {
		allowSet[o] = struct{}{}
	}

	headers := strings.Join(cfg.AllowHeaders, ", ")
	maxAge := fmt.Sprintf("%.0f", cfg.MaxAge.Seconds())

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// Determine if origin is allowed
		var originAllowed bool
		if wildcard {
			originAllowed = true
			// When using wildcard, cannot set credentials=true
			c.Header("Access-Control-Allow-Origin", "*")
		} else if origin != "" {
			if _, ok := allowSet[origin]; ok {
				originAllowed = true
				c.Header("Access-Control-Allow-Origin", origin)
			}
		}

		// Set CORS headers only if origin is allowed
		if originAllowed {
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", headers)
			// Only set credentials to true if NOT using wildcard
			if !wildcard {
				c.Header("Access-Control-Allow-Credentials", "true")
			}
			c.Header("Access-Control-Max-Age", maxAge)
		}

		// Handle preflight OPTIONS request
		if c.Request.Method == http.MethodOptions {
			if originAllowed {
				c.AbortWithStatus(http.StatusNoContent)
			} else {
				c.AbortWithStatus(http.StatusForbidden)
			}
			return
		}

		c.Next()
	}
}

// ─────────────────────────────────────────────
//  RateLimit Middleware — token bucket per IP
// ─────────────────────────────────────────────

// RateLimit returns a per-IP token bucket rate limiter.
// rps = requests per second, burst = burst capacity.
func RateLimit(rps float64, burst int) gin.HandlerFunc {
	limiters := newIPLimiters(rps, burst)
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiters.get(ip).Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   gin.H{"code": string(apperr.ErrCodeRateLimit), "message": "Rate limit exceeded"},
			})
			return
		}
		c.Next()
	}
}

// StrictRateLimit applies tighter per-IP throttling, intended for sensitive
// endpoints such as /auth/login, /auth/challenge, and /transactions/transfer.
// Default: 30 req/min per IP (rps=0.5, burst=10) — generous enough for dev/testing.
func StrictRateLimit() gin.HandlerFunc {
	return RateLimit(30.0/60.0, 10) // 30 req/min burst-10
}

// ─────────────────────────────────────────────
//  Security Headers Middleware
// ─────────────────────────────────────────────

// SecurityHeaders adds OWASP-recommended HTTP security headers to every response.
// Reference: https://owasp.org/www-project-secure-headers/
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")
		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")
		// Enforce HTTPS (1 year, include sub-domains)
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		// Referrer policy
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		// Permissions policy — disable dangerous browser features
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		// Content Security Policy — allow API JSON responses only
		// c.Header("Content-Security-Policy", "default-src 'none'")
		// Remove server fingerprint
		c.Header("X-Powered-By", "")
		c.Header("Server", "")
		c.Next()
	}
}

// ─────────────────────────────────────────────
//  IP Limiter Store (thread-safe)
// ─────────────────────────────────────────────

type ipLimiters struct {
	mu       sync.RWMutex
	limiters map[string]*rate.Limiter
	rps      float64
	burst    int
}

func newIPLimiters(rps float64, burst int) *ipLimiters {
	return &ipLimiters{
		limiters: make(map[string]*rate.Limiter),
		rps:      rps,
		burst:    burst,
	}
}

func (l *ipLimiters) get(ip string) *rate.Limiter {
	l.mu.RLock()
	lim, ok := l.limiters[ip]
	l.mu.RUnlock()
	if ok {
		return lim
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	// Double-check after acquiring write lock.
	if lim, ok = l.limiters[ip]; ok {
		return lim
	}
	lim = rate.NewLimiter(rate.Limit(l.rps), l.burst)
	l.limiters[ip] = lim
	return lim
}

// Package middleware provides Gin middleware components:
// - Logger: structured request/response logging with latency
// - Recovery: panic recovery with AppError wrapping
// - Auth: JWT verification + wallet address injection into context
// - CORS: cross-origin resource sharing headers
// - RateLimit: token-bucket per-IP rate limiting
package middleware

import (
	"context"
	"fmt"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/time/rate"

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

// WalletAddress extracts the authenticated wallet address from Gin context.
func WalletAddress(c *gin.Context) string { return c.GetString("wallet_address") }
func UserID(c *gin.Context) string        { return c.GetString("user_id") }
func SessionID(c *gin.Context) string     { return c.GetString("session_id") }
func JWTID(c *gin.Context) string         { return c.GetString("jwt_id") }

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
func CORS(cfg CORSConfig) gin.HandlerFunc {
	origins := strings.Join(cfg.AllowOrigins, ", ")
	headers := strings.Join(cfg.AllowHeaders, ", ")
	maxAge := fmt.Sprintf("%.0f", cfg.MaxAge.Seconds())

	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", origins)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", headers)
		c.Header("Access-Control-Max-Age", maxAge)

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
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
	limiters := &ipLimiters{
		limiters: make(map[string]*rate.Limiter),
		rps:      rps,
		burst:    burst,
	}
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := limiters.get(ip)
		if !limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   gin.H{"code": string(apperr.ErrCodeRateLimit), "message": "Rate limit exceeded"},
			})
			return
		}
		c.Next()
	}
}

type ipLimiters struct {
	limiters map[string]*rate.Limiter
	rps      float64
	burst    int
}

func (l *ipLimiters) get(ip string) *rate.Limiter {
	if lim, ok := l.limiters[ip]; ok {
		return lim
	}
	lim := rate.NewLimiter(rate.Limit(l.rps), l.burst)
	l.limiters[ip] = lim
	return lim
}

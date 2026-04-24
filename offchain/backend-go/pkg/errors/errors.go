// Package errors provides structured error types following the
// error handling patterns used by top-tier tech companies (Stripe, Uber, Google).
// All errors are typed, carry a machine-readable code, HTTP status, and optional details.
package errors

import (
	"errors"
	"fmt"
	"net/http"
)

// ErrorCode is a machine-readable string identifier for error categories.
type ErrorCode string

const (
	// Generic
	ErrCodeInternal   ErrorCode = "INTERNAL_ERROR"
	ErrCodeNotFound   ErrorCode = "NOT_FOUND"
	ErrCodeBadRequest ErrorCode = "BAD_REQUEST"
	ErrCodeConflict   ErrorCode = "CONFLICT"
	ErrCodeTimeout    ErrorCode = "TIMEOUT"
	ErrCodeValidation ErrorCode = "VALIDATION_ERROR"

	// Auth
	ErrCodeUnauthorized ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden    ErrorCode = "FORBIDDEN"
	ErrCodeTokenExpired ErrorCode = "TOKEN_EXPIRED"
	ErrCodeTokenInvalid ErrorCode = "TOKEN_INVALID"

	// Blockchain
	ErrCodeInvalidSignature    ErrorCode = "INVALID_SIGNATURE"
	ErrCodeInvalidNonce        ErrorCode = "INVALID_NONCE"
	ErrCodeInsufficientBalance ErrorCode = "INSUFFICIENT_BALANCE"
	ErrCodeBlockchain          ErrorCode = "BLOCKCHAIN_ERROR"
	ErrCodeContractRevert      ErrorCode = "CONTRACT_REVERT"

	// Infrastructure
	ErrCodeDatabase  ErrorCode = "DATABASE_ERROR"
	ErrCodeCache     ErrorCode = "CACHE_ERROR"
	ErrCodeRateLimit ErrorCode = "RATE_LIMIT"
)

// AppError is the canonical error type for the entire application.
// It wraps an underlying error and adds semantic meaning via Code and StatusCode.
type AppError struct {
	Code       ErrorCode   `json:"code"`
	Message    string      `json:"message"`
	Details    interface{} `json:"details,omitempty"`
	StatusCode int         `json:"-"`
	Cause      error       `json:"-"`
	Op         string      `json:"-"` // Operation where error occurred (e.g., "transaction.Create")
}

func (e *AppError) Error() string {
	if e.Op != "" {
		return fmt.Sprintf("[%s] %s (op: %s): %v", e.Code, e.Message, e.Op, e.Cause)
	}
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error   { return e.Cause }
func (e *AppError) HTTPStatus() int { return e.StatusCode }

// ─────────────────────────────────────────────
//  Functional Option Pattern
// ─────────────────────────────────────────────

type Option func(*AppError)

func WithCause(cause error) Option {
	return func(e *AppError) { e.Cause = cause }
}

func WithDetails(details interface{}) Option {
	return func(e *AppError) { e.Details = details }
}

func WithOp(op string) Option {
	return func(e *AppError) { e.Op = op }
}

func WithStatus(status int) Option {
	return func(e *AppError) { e.StatusCode = status }
}

// ─────────────────────────────────────────────
//  Constructors
// ─────────────────────────────────────────────

// New creates a new AppError with automatic HTTP status mapping.
func New(code ErrorCode, message string, opts ...Option) *AppError {
	err := &AppError{
		Code:       code,
		Message:    message,
		StatusCode: codeToHTTPStatus(code),
	}
	for _, opt := range opts {
		opt(err)
	}
	return err
}

// Wrap wraps an existing error with an AppError.
func Wrap(code ErrorCode, message string, cause error, opts ...Option) *AppError {
	opts = append(opts, WithCause(cause))
	return New(code, message, opts...)
}

// ─────────────────────────────────────────────
//  Sentinel Errors (pre-built, reusable)
// ─────────────────────────────────────────────

var (
	ErrNotFound            = New(ErrCodeNotFound, "Resource not found")
	ErrUnauthorized        = New(ErrCodeUnauthorized, "Unauthorized")
	ErrForbidden           = New(ErrCodeForbidden, "Forbidden")
	ErrInternal            = New(ErrCodeInternal, "Internal server error")
	ErrInvalidSignature    = New(ErrCodeInvalidSignature, "Invalid signature")
	ErrInvalidNonce        = New(ErrCodeInvalidNonce, "Invalid nonce")
	ErrInsufficientBalance = New(ErrCodeInsufficientBalance, "Insufficient available balance")
	ErrRateLimit           = New(ErrCodeRateLimit, "Rate limit exceeded")
	ErrTokenExpired        = New(ErrCodeTokenExpired, "Token has expired")
)

// ─────────────────────────────────────────────
//  Inspection Helpers
// ─────────────────────────────────────────────

// As unwraps an error to *AppError.
func As(err error) (*AppError, bool) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr, true
	}
	return nil, false
}

// Is checks if an error has a specific code.
func Is(err error, code ErrorCode) bool {
	appErr, ok := As(err)
	return ok && appErr.Code == code
}

func IsNotFound(err error) bool            { return Is(err, ErrCodeNotFound) }
func IsUnauthorized(err error) bool        { return Is(err, ErrCodeUnauthorized) }
func IsValidation(err error) bool          { return Is(err, ErrCodeValidation) }
func IsInsufficientBalance(err error) bool { return Is(err, ErrCodeInsufficientBalance) }
func IsBlockchainError(err error) bool     { return Is(err, ErrCodeBlockchain) }

// HTTPStatus extracts HTTP status from any error (defaults to 500).
func HTTPStatus(err error) int {
	if appErr, ok := As(err); ok {
		return appErr.HTTPStatus()
	}
	return http.StatusInternalServerError
}

// ─────────────────────────────────────────────
//  ValidationError – for request validation
// ─────────────────────────────────────────────

// FieldError represents a single field validation failure.
type FieldError struct {
	Field   string `json:"field"`
	Tag     string `json:"tag"`
	Message string `json:"message"`
}

// ValidationError holds multiple field errors.
type ValidationError struct {
	Fields []FieldError `json:"fields"`
}

// NewValidationError creates a typed validation AppError.
func NewValidationError(fields []FieldError) *AppError {
	return New(
		ErrCodeValidation,
		"Request validation failed",
		WithDetails(ValidationError{Fields: fields}),
	)
}

// ─────────────────────────────────────────────
//  Internal: code → HTTP status mapping
// ─────────────────────────────────────────────

func codeToHTTPStatus(code ErrorCode) int {
	switch code {
	case ErrCodeNotFound:
		return http.StatusNotFound
	case ErrCodeBadRequest, ErrCodeValidation, ErrCodeInvalidNonce, ErrCodeInvalidSignature:
		return http.StatusBadRequest
	case ErrCodeUnauthorized, ErrCodeTokenExpired, ErrCodeTokenInvalid:
		return http.StatusUnauthorized
	case ErrCodeForbidden:
		return http.StatusForbidden
	case ErrCodeConflict:
		return http.StatusConflict
	case ErrCodeTimeout:
		return http.StatusGatewayTimeout
	case ErrCodeRateLimit:
		return http.StatusTooManyRequests
	case ErrCodeInsufficientBalance:
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

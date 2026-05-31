// Package http provides generic HTTP response helpers and request binding
// utilities following the patterns of top-tier backend teams.
package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/timeutil"
)

// ─────────────────────────────────────────────
//  Response[T] — generic envelope
// ─────────────────────────────────────────────

// Meta holds response metadata.
type Meta struct {
	RequestID string `json:"request_id,omitempty"`
	Timestamp string `json:"timestamp"`
}

// Response[T] is the standard API response envelope.
type Response[T any] struct {
	Success bool   `json:"success"`
	Data    *T     `json:"data,omitempty"`
	Error   *Error `json:"error,omitempty"`
	Meta    Meta   `json:"meta"`
}

// Error carries structured error information in the response.
type Error struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// PagedResponse[T] is the standard paginated response envelope.
type PagedResponse[T any] struct {
	Success    bool        `json:"success"`
	Data       []*T        `json:"data"`
	Pagination *Pagination `json:"pagination"`
	Meta       Meta        `json:"meta"`
}

// Pagination holds cursor/offset pagination metadata.
type Pagination struct {
	Total    int64 `json:"total"`
	Page     int64 `json:"page"`
	PageSize int64 `json:"page_size"`
	Pages    int64 `json:"pages"`
	HasNext  bool  `json:"has_next"`
	HasPrev  bool  `json:"has_prev"`
}

// ─────────────────────────────────────────────
//  Helpers — write JSON responses via Gin
// ─────────────────────────────────────────────

func meta(c *gin.Context) Meta {
	return Meta{
		RequestID: c.GetString("request_id"),
		Timestamp: timeutil.FormatRFC3339UTC7(time.Now()),
	}
}

// OK writes a 200 JSON response with data.
func OK[T any](c *gin.Context, data *T) {
	c.JSON(http.StatusOK, Response[T]{
		Success: true,
		Data:    data,
		Meta:    meta(c),
	})
}

// Created writes a 201 JSON response with data.
func Created[T any](c *gin.Context, data *T) {
	c.JSON(http.StatusCreated, Response[T]{
		Success: true,
		Data:    data,
		Meta:    meta(c),
	})
}

// NoContent writes a 204 response.
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// Paged writes a paginated 200 response.
func Paged[T any](c *gin.Context, items []*T, total, page, pageSize int64) {
	pages := total / pageSize
	if total%pageSize != 0 {
		pages++
	}
	c.JSON(http.StatusOK, PagedResponse[T]{
		Success: true,
		Data:    items,
		Pagination: &Pagination{
			Total:    total,
			Page:     page,
			PageSize: pageSize,
			Pages:    pages,
			HasNext:  page < pages,
			HasPrev:  page > 1,
		},
		Meta: meta(c),
	})
}

// Fail writes an error response. Extracts status from AppError or defaults to 500.
func Fail(c *gin.Context, err error) {
	status := apperr.HTTPStatus(err)
	apiErr := &Error{
		Code:    "INTERNAL_ERROR",
		Message: "An unexpected error occurred",
	}

	if appErr, ok := apperr.As(err); ok {
		apiErr.Code = string(appErr.Code)
		apiErr.Message = appErr.Message
		apiErr.Details = appErr.Details
	}

	c.AbortWithStatusJSON(status, Response[struct{}]{
		Success: false,
		Error:   apiErr,
		Meta:    meta(c),
	})
}

// ─────────────────────────────────────────────
//  Request binding with validation
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  Request binding with validation
// ─────────────────────────────────────────────

var validate = func() *validator.Validate {
	v := validator.New()
	// eth_addr: validate Ethereum address format (0x + 40 hex chars, case-insensitive)
	_ = v.RegisterValidation("eth_addr", func(fl validator.FieldLevel) bool {
		addr := fl.Field().String()
		if len(addr) != 42 {
			return false
		}
		if addr[:2] != "0x" && addr[:2] != "0X" {
			return false
		}
		for _, c := range addr[2:] {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				return false
			}
		}
		return true
	})
	return v
}()

// Bind binds and validates a JSON request body into T.
// On error, writes an appropriate error response and returns false.
func Bind[T any](c *gin.Context) (*T, bool) {
	var req T
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, apperr.New(apperr.ErrCodeBadRequest, "Invalid request body", apperr.WithCause(err)))
		return nil, false
	}

	if err := validate.Struct(req); err != nil {
		var ve validator.ValidationErrors
		if ok := toValidatorErrors(err, &ve); ok {
			Fail(c, ve)
			return nil, false
		}
		Fail(c, apperr.New(apperr.ErrCodeValidation, err.Error()))
		return nil, false
	}

	return &req, true
}

// BindQuery binds and validates query parameters into T.
func BindQuery[T any](c *gin.Context) (*T, bool) {
	var req T
	if err := c.ShouldBindQuery(&req); err != nil {
		Fail(c, apperr.New(apperr.ErrCodeBadRequest, "Invalid query parameters", apperr.WithCause(err)))
		return nil, false
	}
	return &req, true
}

// PathParam extracts a required path parameter.
func PathParam(c *gin.Context, name string) (string, bool) {
	val := c.Param(name)
	if val == "" {
		Fail(c, apperr.New(apperr.ErrCodeBadRequest, name+" is required"))
		return "", false
	}
	return val, true
}

// ─────────────────────────────────────────────
//  Internal: validator.ValidationErrors → AppError
// ─────────────────────────────────────────────

func toValidatorErrors(err error, ve *validator.ValidationErrors) bool {
	// not using errors.As to avoid import cycle; handled inline
	_ = ve
	return false // simplified; validation mapped in Bind via AppError
}

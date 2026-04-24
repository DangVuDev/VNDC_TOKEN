// Package pagination provides generic pagination primitives
// for offset-based and cursor-based pagination.
package pagination

import (
	"math"
)

// ─────────────────────────────────────────────
//  Request / Response types
// ─────────────────────────────────────────────

// Request holds client-supplied pagination parameters.
type Request struct {
	Page     int64  `form:"page"      json:"page"      validate:"min=1"`
	PageSize int64  `form:"page_size" json:"page_size" validate:"min=1,max=100"`
	SortBy   string `form:"sort_by"   json:"sort_by"`
	SortDir  string `form:"sort_dir"  json:"sort_dir"  validate:"omitempty,oneof=asc desc"`
}

// DefaultRequest returns safe defaults.
func DefaultRequest() Request {
	return Request{Page: 1, PageSize: 20, SortDir: "desc"}
}

// Normalize clamps page/page_size to safe values.
func (r *Request) Normalize() {
	if r.Page < 1 {
		r.Page = 1
	}
	if r.PageSize < 1 || r.PageSize > 100 {
		r.PageSize = 20
	}
	if r.SortDir != "asc" && r.SortDir != "desc" {
		r.SortDir = "desc"
	}
}

// Offset computes the skip value for the current page.
func (r *Request) Offset() int64 { return (r.Page - 1) * r.PageSize }

// Response[T] is the generic paginated response.
type Response[T any] struct {
	Items    []*T  `json:"items"`
	Total    int64 `json:"total"`
	Page     int64 `json:"page"`
	PageSize int64 `json:"page_size"`
	Pages    int64 `json:"pages"`
	HasNext  bool  `json:"has_next"`
	HasPrev  bool  `json:"has_prev"`
}

// New constructs a Response from items + total + request.
func New[T any](items []*T, total int64, req Request) *Response[T] {
	pages := int64(math.Ceil(float64(total) / float64(req.PageSize)))
	return &Response[T]{
		Items:    items,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Pages:    pages,
		HasNext:  req.Page < pages,
		HasPrev:  req.Page > 1,
	}
}

// Empty returns an empty paginated response.
func Empty[T any](req Request) *Response[T] {
	return New[T]([]*T{}, 0, req)
}

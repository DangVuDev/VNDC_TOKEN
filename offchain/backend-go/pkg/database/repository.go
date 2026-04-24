// Package database defines the generic Repository interface and query primitives.
// Follows the Repository pattern from DDD and Clean Architecture.
// All database adapters must implement this interface.
package database

import (
	"context"
	"time"
)

// ─────────────────────────────────────────────
//  Filter / Query builder
// ─────────────────────────────────────────────

// Op represents a filter operation.
type Op string

const (
	OpEq     Op = "eq"
	OpNe     Op = "ne"
	OpGt     Op = "gt"
	OpGte    Op = "gte"
	OpLt     Op = "lt"
	OpLte    Op = "lte"
	OpIn     Op = "in"
	OpNin    Op = "nin"
	OpLike   Op = "like" // case-insensitive contains
	OpExists Op = "exists"
	OpRegex  Op = "regex"
)

// SortOrder defines sort direction.
type SortOrder string

const (
	SortAsc  SortOrder = "asc"
	SortDesc SortOrder = "desc"
)

// Filter represents a single query predicate.
type Filter struct {
	Field    string
	Operator Op
	Value    interface{}
}

// Sort defines ordering.
type Sort struct {
	Field string
	Order SortOrder
}

// Cursor is an opaque pagination token.
type Cursor string

// Query is a composable, immutable query structure.
type Query struct {
	Filters []Filter
	Sorts   []Sort
	Limit   int64
	Skip    int64
	Fields  []string // projection
	Cursor  Cursor   // cursor-based pagination
}

// QueryOption is a functional option for Query.
type QueryOption func(*Query)

// NewQuery builds a Query from options.
func NewQuery(opts ...QueryOption) *Query {
	q := &Query{Limit: 20, Sorts: []Sort{{Field: "created_at", Order: SortDesc}}}
	for _, opt := range opts {
		opt(q)
	}
	return q
}

func WithEq(field string, value interface{}) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpEq, value}) }
}
func WithNe(field string, value interface{}) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpNe, value}) }
}
func WithGt(field string, value interface{}) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpGt, value}) }
}
func WithGte(field string, value interface{}) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpGte, value}) }
}
func WithLt(field string, value interface{}) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpLt, value}) }
}
func WithLte(field string, value interface{}) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpLte, value}) }
}
func WithIn(field string, values interface{}) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpIn, values}) }
}
func WithLike(field, pattern string) QueryOption {
	return func(q *Query) { q.Filters = append(q.Filters, Filter{field, OpLike, pattern}) }
}
func WithSort(field string, order SortOrder) QueryOption {
	return func(q *Query) { q.Sorts = []Sort{{field, order}} }
}
func WithLimit(limit int64) QueryOption {
	return func(q *Query) { q.Limit = limit }
}
func WithSkip(skip int64) QueryOption {
	return func(q *Query) { q.Skip = skip }
}
func WithFields(fields ...string) QueryOption {
	return func(q *Query) { q.Fields = fields }
}
func WithPagination(page, pageSize int64) QueryOption {
	return func(q *Query) {
		q.Limit = pageSize
		q.Skip = (page - 1) * pageSize
	}
}
func WithCursor(cursor Cursor) QueryOption {
	return func(q *Query) { q.Cursor = cursor }
}

// ─────────────────────────────────────────────
//  Base Entity
// ─────────────────────────────────────────────

// Entity is the base type embedded by all domain entities.
type Entity struct {
	ID        string     `bson:"_id,omitempty" json:"id"`
	CreatedAt time.Time  `bson:"created_at"    json:"created_at"`
	UpdatedAt time.Time  `bson:"updated_at"    json:"updated_at"`
	DeletedAt *time.Time `bson:"deleted_at"    json:"deleted_at,omitempty"`
}

// IsDeleted reports whether the entity is soft-deleted.
func (e Entity) IsDeleted() bool { return e.DeletedAt != nil }

// ─────────────────────────────────────────────
//  Repository[T] — generic interface
// ─────────────────────────────────────────────

// Repository is a generic CRUD interface for any domain type T.
// Implementations must be safe for concurrent use.
type Repository[T any] interface {
	// Read
	FindByID(ctx context.Context, id string) (*T, error)
	FindOne(ctx context.Context, opts ...QueryOption) (*T, error)
	Find(ctx context.Context, opts ...QueryOption) ([]*T, int64, error) // returns (items, total, err)
	Count(ctx context.Context, opts ...QueryOption) (int64, error)
	Exists(ctx context.Context, id string) (bool, error)

	// Write
	Create(ctx context.Context, entity *T) error
	CreateMany(ctx context.Context, entities []*T) error
	Update(ctx context.Context, id string, updates map[string]interface{}) error
	Upsert(ctx context.Context, id string, entity *T) error
	Delete(ctx context.Context, id string) error     // soft delete
	HardDelete(ctx context.Context, id string) error // physical delete

	// Transactions (for multi-document atomicity)
	WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

// ReadRepository is a read-only subset of Repository[T].
type ReadRepository[T any] interface {
	FindByID(ctx context.Context, id string) (*T, error)
	FindOne(ctx context.Context, opts ...QueryOption) (*T, error)
	Find(ctx context.Context, opts ...QueryOption) ([]*T, int64, error)
	Count(ctx context.Context, opts ...QueryOption) (int64, error)
	Exists(ctx context.Context, id string) (bool, error)
}

// Package mongodb provides a generic MongoDB repository implementation.
// It implements the database.Repository[T] interface for any bson-serializable type T.
package mongodb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
)

// ─────────────────────────────────────────────
//  Client
// ─────────────────────────────────────────────

// ClientConfig holds MongoDB connection configuration.
type ClientConfig struct {
	URI             string
	Database        string
	MaxPoolSize     uint64
	MinPoolSize     uint64
	MaxConnIdleTime time.Duration
	ConnectTimeout  time.Duration
}

// Client wraps a mongo.Client and the default database.
type Client struct {
	client *mongo.Client
	db     *mongo.Database
	cfg    ClientConfig
}

// NewClient creates and validates a MongoDB connection.
func NewClient(ctx context.Context, cfg ClientConfig) (*Client, error) {
	opts := options.Client().
		ApplyURI(cfg.URI).
		SetMaxPoolSize(cfg.MaxPoolSize).
		SetMinPoolSize(cfg.MinPoolSize).
		SetMaxConnIdleTime(cfg.MaxConnIdleTime).
		SetConnectTimeout(cfg.ConnectTimeout).
		SetRetryWrites(true).
		SetRetryReads(true)

	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("mongodb: connect: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		return nil, fmt.Errorf("mongodb: ping: %w", err)
	}

	return &Client{
		client: client,
		db:     client.Database(cfg.Database),
		cfg:    cfg,
	}, nil
}

// Collection returns a *mongo.Collection by name.
func (c *Client) Collection(name string) *mongo.Collection {
	return c.db.Collection(name)
}

// Health performs a liveness check.
func (c *Client) Health(ctx context.Context) error {
	return c.client.Ping(ctx, nil)
}

// Disconnect closes the connection pool.
func (c *Client) Disconnect(ctx context.Context) error {
	return c.client.Disconnect(ctx)
}

// StartSession returns a new session for transactions.
func (c *Client) StartSession() (mongo.Session, error) {
	return c.client.StartSession()
}

// ─────────────────────────────────────────────
//  Repository[T] — generic implementation
// ─────────────────────────────────────────────

// PointerType is a constraint for types usable as MongoDB documents.
// Any bson-serializable struct satisfies this.
type PointerType interface {
	any
}

// Repository[T] is a generic MongoDB repository working with *T.
// Assumes T has methods: GetID, SetID, SetCreatedAt, SetUpdatedAt.
type Repository[T PointerType] struct {
	col    *mongo.Collection
	client *Client
}

// NewRepository constructs a typed Repository for collection colName.
func NewRepository[T PointerType](client *Client, colName string) *Repository[T] {
	return &Repository[T]{
		col:    client.Collection(colName),
		client: client,
	}
}

// ── Read ──────────────────────────────────────

func (r *Repository[T]) FindByID(ctx context.Context, id string) (*T, error) {
	return r.FindOne(ctx, database.WithEq("_id", id))
}

func (r *Repository[T]) FindOne(ctx context.Context, opts ...database.QueryOption) (*T, error) {
	q := database.NewQuery(opts...)
	q.Limit = 1

	filter, findOpts := buildFindOptions(q)
	var entity T
	err := r.col.FindOne(ctx, filter, options.FindOne().SetProjection(findOpts.Projection)).Decode(&entity)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, apperr.ErrNotFound
		}
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindOne failed", err)
	}
	return &entity, nil
}

func (r *Repository[T]) Find(ctx context.Context, opts ...database.QueryOption) ([]*T, int64, error) {
	q := database.NewQuery(opts...)
	filter, findOpts := buildFindOptions(q)

	// Count total (for pagination)
	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "Count failed", err)
	}

	cursor, err := r.col.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "Find failed", err)
	}
	defer cursor.Close(ctx)

	var items []*T
	if err := cursor.All(ctx, &items); err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "Decode failed", err)
	}
	return items, total, nil
}

func (r *Repository[T]) Count(ctx context.Context, opts ...database.QueryOption) (int64, error) {
	q := database.NewQuery(opts...)
	filter, _ := buildFindOptions(q)
	n, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeDatabase, "Count failed", err)
	}
	return n, nil
}

func (r *Repository[T]) Exists(ctx context.Context, id string) (bool, error) {
	n, err := r.Count(ctx, database.WithEq("_id", id))
	return n > 0, err
}

// ── Write ─────────────────────────────────────

func (r *Repository[T]) Create(ctx context.Context, entity *T) error {
	// Convert to map to set timestamps and ID
	data, err := bson.Marshal(entity)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Marshal failed", err)
	}

	var doc bson.M
	if err := bson.Unmarshal(data, &doc); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Unmarshal failed", err)
	}

	now := time.Now().UTC()
	if id, ok := doc["_id"]; !ok || id == "" {
		doc["_id"] = uuid.NewString()
	}
	doc["created_at"] = now
	doc["updated_at"] = now

	if _, err := r.col.InsertOne(ctx, doc); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return apperr.New(apperr.ErrCodeConflict, "Entity already exists", apperr.WithCause(err))
		}
		return apperr.Wrap(apperr.ErrCodeDatabase, "Create failed", err)
	}
	return nil
}

func (r *Repository[T]) CreateMany(ctx context.Context, entities []*T) error {
	now := time.Now().UTC()
	docs := make([]interface{}, len(entities))

	for i, e := range entities {
		data, err := bson.Marshal(e)
		if err != nil {
			return apperr.Wrap(apperr.ErrCodeDatabase, "Marshal failed", err)
		}

		var doc bson.M
		if err := bson.Unmarshal(data, &doc); err != nil {
			return apperr.Wrap(apperr.ErrCodeDatabase, "Unmarshal failed", err)
		}

		if id, ok := doc["_id"]; !ok || id == "" {
			doc["_id"] = uuid.NewString()
		}
		doc["created_at"] = now
		doc["updated_at"] = now
		docs[i] = doc
	}

	if _, err := r.col.InsertMany(ctx, docs); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "CreateMany failed", err)
	}
	return nil
}

func (r *Repository[T]) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()

	result, err := r.col.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": updates},
	)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Update failed", err)
	}
	if result.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

func (r *Repository[T]) Upsert(ctx context.Context, id string, entity *T) error {
	now := time.Now().UTC()

	data, err := bson.Marshal(entity)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Marshal failed", err)
	}

	var doc bson.M
	if err := bson.Unmarshal(data, &doc); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Unmarshal failed", err)
	}

	doc["_id"] = id
	doc["updated_at"] = now

	opts := options.Replace().SetUpsert(true)
	if _, err := r.col.ReplaceOne(ctx, bson.M{"_id": id}, doc, opts); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "Upsert failed", err)
	}
	return nil
}

func (r *Repository[T]) Delete(ctx context.Context, id string) error {
	return r.Update(ctx, id, map[string]interface{}{
		"deleted_at": time.Now().UTC(),
	})
}

func (r *Repository[T]) HardDelete(ctx context.Context, id string) error {
	result, err := r.col.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "HardDelete failed", err)
	}
	if result.DeletedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// ── Transactions ─────────────────────────────

func (r *Repository[T]) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	session, err := r.client.StartSession()
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "StartSession failed", err)
	}
	defer session.EndSession(ctx)

	_, err = session.WithTransaction(ctx, func(sessCtx mongo.SessionContext) (interface{}, error) {
		return nil, fn(sessCtx)
	})
	return err
}

// ─────────────────────────────────────────────
//  Query builder — database.Query → mongo filter
// ─────────────────────────────────────────────

func buildFindOptions(q *database.Query) (bson.D, *options.FindOptions) {
	filter := bson.D{}

	for _, f := range q.Filters {
		switch f.Operator {
		case database.OpEq:
			filter = append(filter, bson.E{Key: f.Field, Value: f.Value})
		case database.OpNe:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$ne": f.Value}})
		case database.OpGt:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$gt": f.Value}})
		case database.OpGte:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$gte": f.Value}})
		case database.OpLt:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$lt": f.Value}})
		case database.OpLte:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$lte": f.Value}})
		case database.OpIn:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$in": f.Value}})
		case database.OpNin:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$nin": f.Value}})
		case database.OpLike:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$regex": f.Value, "$options": "i"}})
		case database.OpExists:
			filter = append(filter, bson.E{Key: f.Field, Value: bson.M{"$exists": f.Value}})
		}
	}

	// Exclude soft-deleted by default
	filter = append(filter, bson.E{Key: "deleted_at", Value: nil})

	findOpts := options.Find()
	if q.Limit > 0 {
		findOpts.SetLimit(q.Limit)
	}
	if q.Skip > 0 {
		findOpts.SetSkip(q.Skip)
	}

	// Sorting
	if len(q.Sorts) > 0 {
		sort := bson.D{}
		for _, s := range q.Sorts {
			dir := 1
			if s.Order == database.SortDesc {
				dir = -1
			}
			sort = append(sort, bson.E{Key: s.Field, Value: dir})
		}
		findOpts.SetSort(sort)
	}

	// Projection
	if len(q.Fields) > 0 {
		proj := bson.D{}
		for _, f := range q.Fields {
			proj = append(proj, bson.E{Key: f, Value: 1})
		}
		findOpts.SetProjection(proj)
	}

	return filter, findOpts
}

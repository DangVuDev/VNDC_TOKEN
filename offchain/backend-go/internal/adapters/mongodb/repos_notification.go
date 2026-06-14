package adapters

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	mongooptions "go.mongodb.org/mongo-driver/mongo/options"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
	apperr "github.com/vndc/backend/pkg/errors"
)

type notificationRepository struct {
	*pkgmongodb.Repository[domain.SystemNotification]
	col *mongo.Collection
}

// NewNotificationRepository wires system notifications to the MongoDB notifications collection.
// Centralizing notification reads here keeps targeting and expiry semantics consistent across the application.
func NewNotificationRepository(client *pkgmongodb.Client) ports.NotificationRepository {
	return &notificationRepository{
		Repository: pkgmongodb.NewRepository[domain.SystemNotification](client, "notifications"),
		col:        client.Collection("notifications"),
	}
}

// FindForUser returns notifications visible to a specific user with pagination and optional filters.
// It applies user-targeting, soft-delete, and expiry rules in one place so callers do not need to rebuild those conditions.
func (r *notificationRepository) FindForUser(ctx context.Context, userID string, page, pageSize int64, includeExpired bool, notifType string) ([]*domain.SystemNotification, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	now := time.Now().UTC()
	filter := bson.M{
		"$and": bson.A{
			bson.M{
				"$or": bson.A{
					bson.M{"deleted_at": bson.M{"$exists": false}},
					bson.M{"deleted_at": nil},
				},
			},
			bson.M{
				"$or": bson.A{
					bson.M{"target_scope": bson.M{"$exists": false}},
					bson.M{"target_scope": string(domain.NotificationTargetAll)},
					bson.M{"target_scope": string(domain.NotificationTargetUser), "target_user_id": userID},
				},
			},
		},
	}
	if !includeExpired {
		filter["$and"] = append(filter["$and"].(bson.A), bson.M{
			"$or": bson.A{
				bson.M{"expires_at": bson.M{"$exists": false}},
				bson.M{"expires_at": nil},
				bson.M{"expires_at": bson.M{"$gt": now}},
			},
		})
	}
	if notifType != "" {
		filter["$and"] = append(filter["$and"].(bson.A), bson.M{"type": notifType})
	}

	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "count notifications failed", err)
	}

	opts := mongooptions.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "find notifications failed", err)
	}
	defer cursor.Close(ctx)

	var rows []*domain.SystemNotification
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "decode notifications failed", err)
	}
	return rows, total, nil
}

// FindForAdmin returns all admin-visible notifications with pagination and optional filters.
// It reuses the same expiry and deletion rules as the user path but omits per-user visibility scoping.
func (r *notificationRepository) FindForAdmin(ctx context.Context, page, pageSize int64, includeExpired bool, notifType string) ([]*domain.SystemNotification, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	now := time.Now().UTC()
	filter := bson.M{
		"$and": bson.A{
			bson.M{
				"$or": bson.A{
					bson.M{"deleted_at": bson.M{"$exists": false}},
					bson.M{"deleted_at": nil},
				},
			},
		},
	}
	if !includeExpired {
		filter["$and"] = append(filter["$and"].(bson.A), bson.M{
			"$or": bson.A{
				bson.M{"expires_at": bson.M{"$exists": false}},
				bson.M{"expires_at": nil},
				bson.M{"expires_at": bson.M{"$gt": now}},
			},
		})
	}
	if notifType != "" {
		filter["$and"] = append(filter["$and"].(bson.A), bson.M{"type": notifType})
	}

	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "count notifications failed", err)
	}

	opts := mongooptions.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "find notifications failed", err)
	}
	defer cursor.Close(ctx)

	var rows []*domain.SystemNotification
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "decode notifications failed", err)
	}
	return rows, total, nil
}

var _ ports.NotificationRepository = (*notificationRepository)(nil)

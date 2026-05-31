package adapters

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
	apperr "github.com/vndc/backend/pkg/errors"
)

type kycSubmissionRepository struct {
	*pkgmongodb.Repository[domain.KYCSubmission]
	col *mongo.Collection
}

// NewKYCSubmissionRepository wires KYC submission persistence to the MongoDB kyc_submissions collection.
// It keeps document storage and approval-state retrieval separate from the KYC review workflow itself.
func NewKYCSubmissionRepository(client *pkgmongodb.Client) ports.KYCSubmissionRepository {
	return &kycSubmissionRepository{
		Repository: pkgmongodb.NewRepository[domain.KYCSubmission](client, "kyc_submissions"),
		col:        client.Collection("kyc_submissions"),
	}
}

// FindByUserID returns all KYC submissions submitted by a specific user.
// This lookup supports both internal review screens and user-facing KYC submission history views.
func (r *kycSubmissionRepository) FindByUserID(ctx context.Context, userID string) ([]*domain.KYCSubmission, error) {
	cursor, err := r.col.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindByUserID failed", err)
	}
	defer cursor.Close(ctx)
	var results []*domain.KYCSubmission
	if err := cursor.All(ctx, &results); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode kyc submissions failed", err)
	}
	return results, nil
}

// FindByStatus returns submissions that match a given workflow status and preserves caller options.
// It is the main query for review queues, audit exports, and filtered administrative search.
func (r *kycSubmissionRepository) FindByStatus(ctx context.Context, status domain.KYCSubmissionStatus, opts ...database.QueryOption) ([]*domain.KYCSubmission, int64, error) {
	opts = append(opts, database.WithEq("status", string(status)))
	return r.Find(ctx, opts...)
}

var _ ports.KYCSubmissionRepository = (*kycSubmissionRepository)(nil)

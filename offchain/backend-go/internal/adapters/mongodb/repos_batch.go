
package adapters

import (
	"context"

	"go.mongodb.org/mongo-driver/mongo"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
)

// ─────────────────────────────────────────────
//  batchRepository — implements ports.BatchRepository
// ─────────────────────────────────────────────

type batchRepository struct {
	*pkgmongodb.Repository[domain.Batch]
	col *mongo.Collection
}

// NewBatchRepository wires the batch repository to the MongoDB batches collection.
// Batch retrieval and persistence stay encapsulated so orchestration code can remain storage-agnostic.
func NewBatchRepository(client *pkgmongodb.Client) ports.BatchRepository {
	return &batchRepository{
		Repository: pkgmongodb.NewRepository[domain.Batch](client, "batches"),
		col:        client.Collection("batches"),
	}
}

// FindByStatus returns batches filtered by status using the shared repository helper.
// This supports worker coordination screens and internal batch-processing loops.
func (r *batchRepository) FindByStatus(ctx context.Context, status domain.BatchStatus) ([]*domain.Batch, error) {
	batches, _, err := r.Find(ctx, database.WithEq("status", string(status)))
	return batches, err
}

// FindByTxHash resolves the batch that owns a specific transaction hash.
// The lookup is used during settlement tracing, reconciliation, and failure investigation.
func (r *batchRepository) FindByTxHash(ctx context.Context, txHash string) (*domain.Batch, error) {
	return r.FindOne(ctx, database.WithEq("tx_hash", txHash))
}

var _ ports.BatchRepository = (*batchRepository)(nil)

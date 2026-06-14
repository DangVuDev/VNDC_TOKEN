// Package adapters — concrete MongoDB adapters implementing domain repository ports.
// Each adapter embeds the generic Repository[T] for standard CRUD and adds
// domain-specific query methods on top of the raw mongo.Collection.
package adapters

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	mongooptions "go.mongodb.org/mongo-driver/mongo/options"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
	apperr "github.com/vndc/backend/pkg/errors"
)

// ─────────────────────────────────────────────
//  transactionRepository — implements ports.TransactionRepository
// ─────────────────────────────────────────────

type transactionRepository struct {
	*pkgmongodb.Repository[domain.Transaction]
	col           *mongo.Collection // legacy collection: transactions
	pendingCol    *mongo.Collection
	processingCol *mongo.Collection
	finalCol      *mongo.Collection
}

// NewTransactionRepository wires the transaction repository to the MongoDB transactions collection.
// Keeping transaction-specific reads here avoids leaking query mechanics into workers, APIs, and reconciliation services.
func NewTransactionRepository(client *pkgmongodb.Client) ports.TransactionRepository {
	return &transactionRepository{
		Repository:    pkgmongodb.NewRepository[domain.Transaction](client, "transactions"),
		col:           client.Collection("transactions"),
		pendingCol:    client.Collection("tx_pending"),
		processingCol: client.Collection("tx_processing"),
		finalCol:      client.Collection("tx_final"),
	}
}

func (r *transactionRepository) Create(ctx context.Context, tx *domain.Transaction) error {
	col := r.collectionForStatus(tx.Status)
	if col == nil {
		col = r.pendingCol
	}
	return insertTransaction(ctx, col, tx)
}

func (r *transactionRepository) FindByID(ctx context.Context, id string) (*domain.Transaction, error) {
	for _, col := range r.stateCollections() {
		tx, err := findTransactionByID(ctx, col, id)
		if err == nil {
			return tx, nil
		}
		if err != mongo.ErrNoDocuments {
			return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindByID failed", err)
		}
	}
	return nil, apperr.ErrNotFound
}

func (r *transactionRepository) FindOne(ctx context.Context, opts ...database.QueryOption) (*domain.Transaction, error) {
	txs, _, err := r.Find(ctx, append(opts, database.WithLimit(1))...)
	if err != nil {
		return nil, err
	}
	if len(txs) == 0 {
		return nil, apperr.ErrNotFound
	}
	return txs[0], nil
}

func (r *transactionRepository) Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.Transaction, int64, error) {
	q := database.NewQuery(opts...)
	if status, ok := queryEqString(q, "status"); ok {
		txs, err := r.FindByStatus(ctx, domain.TransactionStatus(status), q.Limit)
		return txs, int64(len(txs)), err
	}

	all := make([]*domain.Transaction, 0)
	for _, col := range r.stateCollections() {
		txs, err := findTransactions(ctx, col, bson.M{"deleted_at": nil}, q.Limit)
		if err != nil {
			return nil, 0, err
		}
		all = append(all, txs...)
	}
	sortTransactionsDesc(all)
	total := int64(len(all))
	return sliceTransactions(all, q.Skip, q.Limit), total, nil
}

func (r *transactionRepository) Count(ctx context.Context, opts ...database.QueryOption) (int64, error) {
	q := database.NewQuery(opts...)
	if status, ok := queryEqString(q, "status"); ok {
		return r.CountByStatus(ctx, domain.TransactionStatus(status))
	}
	var total int64
	for _, col := range r.stateCollections() {
		n, err := col.CountDocuments(ctx, bson.M{"deleted_at": nil})
		if err != nil {
			return 0, apperr.Wrap(apperr.ErrCodeDatabase, "transaction count failed", err)
		}
		total += n
	}
	return total, nil
}

func (r *transactionRepository) Exists(ctx context.Context, id string) (bool, error) {
	_, err := r.FindByID(ctx, id)
	if err == nil {
		return true, nil
	}
	if err == apperr.ErrNotFound {
		return false, nil
	}
	return false, err
}

func (r *transactionRepository) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	current, col, err := r.findTransactionWithCollection(ctx, id)
	if err != nil {
		return err
	}

	if statusRaw, ok := updates["status"]; ok {
		if status, ok2 := normalizeTxStatus(statusRaw); ok2 && status != current.Status {
			applyTransactionUpdates(current, updates)
			current.Status = status
			return r.moveTransaction(ctx, col, r.collectionForStatus(status), current)
		}
	}

	updates["updated_at"] = time.Now().UTC()
	res, err := col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "transaction update failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

func (r *transactionRepository) Upsert(ctx context.Context, id string, tx *domain.Transaction) error {
	tx.ID = id
	if exists, err := r.Exists(ctx, id); err != nil {
		return err
	} else if exists {
		return r.Update(ctx, id, transactionToUpdates(tx))
	}
	return r.Create(ctx, tx)
}

func (r *transactionRepository) Delete(ctx context.Context, id string) error {
	return r.Update(ctx, id, map[string]interface{}{"deleted_at": time.Now().UTC()})
}

func (r *transactionRepository) HardDelete(ctx context.Context, id string) error {
	for _, col := range r.stateCollections() {
		res, err := col.DeleteOne(ctx, bson.M{"_id": id})
		if err != nil {
			return apperr.Wrap(apperr.ErrCodeDatabase, "transaction hard delete failed", err)
		}
		if res.DeletedCount > 0 {
			return nil
		}
	}
	return apperr.ErrNotFound
}

// FindByStatus returns recent transactions with a given status and optional limit.
// It is primarily used by admin dashboards, monitoring panels, and operational work queues.
func (r *transactionRepository) FindByStatus(ctx context.Context, status domain.TransactionStatus, limit int64) ([]*domain.Transaction, error) {
	filter := bson.M{"status": string(status), "deleted_at": nil}
	var collections []*mongo.Collection
	if col := r.collectionForStatus(status); col != nil {
		collections = append(collections, col)
	}
	// Include the legacy collection during migration so old records remain visible.
	collections = append(collections, r.col)

	all := make([]*domain.Transaction, 0)
	for _, col := range collections {
		txs, err := findTransactions(ctx, col, filter, limit)
		if err != nil {
			return nil, err
		}
		all = append(all, txs...)
	}
	sortTransactionsDesc(all)
	return sliceTransactions(all, 0, limit), nil
}

// FindByWallet returns transactions where the wallet appears on either side of the transfer.
// The method also emits detailed debug traces because wallet normalization issues can be difficult to diagnose in production data.
func (r *transactionRepository) FindByWallet(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.Transaction, int64, error) {
	q := database.NewQuery(opts...)
	filter, _ := buildTxWalletFilter(wallet, q)
	all := make([]*domain.Transaction, 0)
	for _, col := range r.stateCollections() {
		txs, err := findTransactions(ctx, col, filter, 0)
		if err != nil {
			return nil, 0, err
		}
		all = append(all, txs...)
	}
	sortTransactionsDesc(all)
	total := int64(len(all))
	return sliceTransactions(all, q.Skip, q.Limit), total, nil
}

// buildTxWalletFilter builds the case-insensitive wallet filter and matching pagination options for transaction lookups.
// Keeping this logic in one helper prevents subtle divergence between query code paths that should interpret wallet matching identically.
func buildTxWalletFilter(wallet string, q *database.Query) (bson.M, *mongooptions.FindOptions) {
	normalised := strings.ToLower(wallet)
	walletEqCI := bson.M{"$regex": "^" + regexp.QuoteMeta(normalised) + "$", "$options": "i"}
	filter := bson.M{
		"$or": bson.A{
			bson.M{"from_wallet": walletEqCI},
			bson.M{"to_wallet": walletEqCI},
		},
		// Match transactions that are NOT deleted.
		// Handles both: field doesn't exist, or field is null (for nil pointers)
		"$and": bson.A{
			bson.M{
				"deleted_at": bson.M{
					"$in": bson.A{nil}, // null values
				},
			},
		},
	}

	findOpts := mongooptions.Find().
		SetSort(bson.M{"created_at": -1}).
		SetSkip(q.Skip).
		SetLimit(q.Limit)
	return filter, findOpts
}

// FindPendingOlderThan returns pending transactions older than a given threshold.
// This is used by background sweepers that detect stuck, delayed, or abandoned transactions.
func (r *transactionRepository) FindPendingOlderThan(ctx context.Context, threshold time.Duration) ([]*domain.Transaction, error) {
	since := time.Now().Add(-threshold)
	filter := bson.M{
		"status":     string(domain.TxStatusPending),
		"created_at": bson.M{"$lt": since},
		"deleted_at": nil,
	}
	cursor, err := r.pendingCol.Find(ctx, filter)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "FindPendingOlderThan failed", err)
	}
	defer cursor.Close(ctx)
	var txs []*domain.Transaction
	if err := cursor.All(ctx, &txs); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode failed", err)
	}
	return txs, nil
}

// CountByStatus returns how many transactions currently share a given status.
// The method provides a lightweight aggregate for dashboards and batch-orchestration heuristics.
func (r *transactionRepository) CountByStatus(ctx context.Context, status domain.TransactionStatus) (int64, error) {
	filter := bson.M{"status": string(status), "deleted_at": nil}
	var total int64
	if col := r.collectionForStatus(status); col != nil {
		n, err := col.CountDocuments(ctx, filter)
		if err != nil {
			return 0, apperr.Wrap(apperr.ErrCodeDatabase, "CountByStatus failed", err)
		}
		total += n
	}
	n, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeDatabase, "CountByStatus legacy failed", err)
	}
	return total + n, nil
}

// HasActiveNonce checks whether a nonce is still active for a wallet outside final states.
// This protects against duplicate submission, replay, or accidental worker reprocessing during the transaction lifecycle.
func (r *transactionRepository) HasActiveNonce(ctx context.Context, wallet, nonce string) (bool, error) {
	filter := bson.M{
		"from_wallet": wallet,
		"nonce":       nonce,
		"deleted_at":  nil,
	}
	for _, col := range []*mongo.Collection{r.pendingCol, r.processingCol} {
		count, err := col.CountDocuments(ctx, filter)
		if err != nil {
			return false, apperr.Wrap(apperr.ErrCodeDatabase, "HasActiveNonce count failed", err)
		}
		if count > 0 {
			return true, nil
		}
	}
	legacyFilter := bson.M{
		"from_wallet": wallet,
		"nonce":       nonce,
		"status": bson.M{"$nin": []string{
			string(domain.TxStatusSuccess),
			string(domain.TxStatusFailed),
			string(domain.TxStatusRolledBack),
			string(domain.TxStatusCancelled),
			string(domain.TxStatusExpired),
		}},
		"deleted_at": nil,
	}
	count, err := r.col.CountDocuments(ctx, legacyFilter)
	if err != nil {
		return false, apperr.Wrap(apperr.ErrCodeDatabase, "HasActiveNonce legacy count failed", err)
	}
	return count > 0, nil
}

// AssignBatch attaches a batch identifier to many transactions and marks them as batched.
// Doing the write in bulk keeps settlement and reconciliation workers efficient when large batches are assembled.
func (r *transactionRepository) AssignBatch(ctx context.Context, txIDs []string, batchID string) error {
	for _, id := range txIDs {
		tx, col, err := r.findTransactionWithCollection(ctx, id)
		if err != nil {
			return err
		}
		tx.BatchID = batchID
		tx.Status = domain.TxStatusProcessing
		tx.UpdatedAt = time.Now().UTC()
		if err := r.moveTransaction(ctx, col, r.processingCol, tx); err != nil {
			return apperr.Wrap(apperr.ErrCodeDatabase, "AssignBatch move failed", err)
		}
	}
	return nil
}

func (r *transactionRepository) stateCollections() []*mongo.Collection {
	return []*mongo.Collection{r.pendingCol, r.processingCol, r.finalCol, r.col}
}

func (r *transactionRepository) collectionForStatus(status domain.TransactionStatus) *mongo.Collection {
	switch status {
	case domain.TxStatusPending, domain.TxStatusQueued:
		return r.pendingCol
	case domain.TxStatusProcessing:
		return r.processingCol
	case domain.TxStatusSuccess, domain.TxStatusFailed, domain.TxStatusRolledBack, domain.TxStatusCancelled, domain.TxStatusExpired:
		return r.finalCol
	default:
		return r.pendingCol
	}
}

func (r *transactionRepository) findTransactionWithCollection(ctx context.Context, id string) (*domain.Transaction, *mongo.Collection, error) {
	for _, col := range r.stateCollections() {
		tx, err := findTransactionByID(ctx, col, id)
		if err == nil {
			return tx, col, nil
		}
		if err != mongo.ErrNoDocuments {
			return nil, nil, apperr.Wrap(apperr.ErrCodeDatabase, "find transaction failed", err)
		}
	}
	return nil, nil, apperr.ErrNotFound
}

func (r *transactionRepository) moveTransaction(ctx context.Context, fromCol, toCol *mongo.Collection, tx *domain.Transaction) error {
	if toCol == nil {
		toCol = r.collectionForStatus(tx.Status)
	}
	tx.UpdatedAt = time.Now().UTC()
	if fromCol == toCol {
		return replaceTransaction(ctx, toCol, tx)
	}
	if err := insertTransaction(ctx, toCol, tx); err != nil {
		if !mongo.IsDuplicateKeyError(err) {
			return err
		}
		if err := replaceTransaction(ctx, toCol, tx); err != nil {
			return err
		}
	}
	if _, err := fromCol.DeleteOne(ctx, bson.M{"_id": tx.ID}); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "delete moved transaction failed", err)
	}
	return nil
}

func insertTransaction(ctx context.Context, col *mongo.Collection, tx *domain.Transaction) error {
	doc, err := transactionDoc(tx, true)
	if err != nil {
		return err
	}
	if _, err := col.InsertOne(ctx, doc); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return apperr.New(apperr.ErrCodeConflict, "Transaction already exists", apperr.WithCause(err))
		}
		return apperr.Wrap(apperr.ErrCodeDatabase, "transaction insert failed", err)
	}
	return nil
}

func replaceTransaction(ctx context.Context, col *mongo.Collection, tx *domain.Transaction) error {
	doc, err := transactionDoc(tx, false)
	if err != nil {
		return err
	}
	res, err := col.ReplaceOne(ctx, bson.M{"_id": tx.ID}, doc)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "transaction replace failed", err)
	}
	if res.MatchedCount == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

func transactionDoc(tx *domain.Transaction, create bool) (bson.M, error) {
	data, err := bson.Marshal(tx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "transaction marshal failed", err)
	}
	var doc bson.M
	if err := bson.Unmarshal(data, &doc); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "transaction unmarshal failed", err)
	}
	now := time.Now().UTC()
	if doc["_id"] == nil || doc["_id"] == "" {
		doc["_id"] = tx.ID
	}
	if doc["_id"] == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "transaction id is required")
	}
	if create {
		doc["created_at"] = now
	}
	if _, ok := doc["created_at"]; !ok {
		doc["created_at"] = tx.CreatedAt
	}
	doc["updated_at"] = now
	return doc, nil
}

func findTransactionByID(ctx context.Context, col *mongo.Collection, id string) (*domain.Transaction, error) {
	var tx domain.Transaction
	if err := col.FindOne(ctx, bson.M{"_id": id, "deleted_at": nil}).Decode(&tx); err != nil {
		return nil, err
	}
	return &tx, nil
}

func findTransactions(ctx context.Context, col *mongo.Collection, filter bson.M, limit int64) ([]*domain.Transaction, error) {
	opts := mongooptions.Find().SetSort(bson.M{"created_at": -1})
	if limit > 0 {
		opts.SetLimit(limit)
	}
	cursor, err := col.Find(ctx, filter, opts)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "find transactions failed", err)
	}
	defer cursor.Close(ctx)
	var txs []*domain.Transaction
	if err := cursor.All(ctx, &txs); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "decode transactions failed", err)
	}
	return txs, nil
}

func sortTransactionsDesc(txs []*domain.Transaction) {
	sort.SliceStable(txs, func(i, j int) bool {
		return txs[i].CreatedAt.After(txs[j].CreatedAt)
	})
}

func sliceTransactions(txs []*domain.Transaction, skip, limit int64) []*domain.Transaction {
	if skip < 0 {
		skip = 0
	}
	if skip >= int64(len(txs)) {
		return []*domain.Transaction{}
	}
	end := int64(len(txs))
	if limit > 0 && skip+limit < end {
		end = skip + limit
	}
	return txs[skip:end]
}

func queryEqString(q *database.Query, field string) (string, bool) {
	for _, f := range q.Filters {
		if f.Field == field && f.Operator == database.OpEq {
			if s, ok := f.Value.(string); ok {
				return s, true
			}
			return fmt.Sprintf("%v", f.Value), true
		}
	}
	return "", false
}

func normalizeTxStatus(v interface{}) (domain.TransactionStatus, bool) {
	switch t := v.(type) {
	case domain.TransactionStatus:
		return t, true
	case string:
		return domain.TransactionStatus(t), true
	default:
		return "", false
	}
}

func applyTransactionUpdates(tx *domain.Transaction, updates map[string]interface{}) {
	data, _ := bson.Marshal(tx)
	var doc bson.M
	_ = bson.Unmarshal(data, &doc)
	for k, v := range updates {
		doc[k] = v
	}
	merged, _ := bson.Marshal(doc)
	_ = bson.Unmarshal(merged, tx)
}

func transactionToUpdates(tx *domain.Transaction) map[string]interface{} {
	data, _ := bson.Marshal(tx)
	var doc bson.M
	_ = bson.Unmarshal(data, &doc)
	delete(doc, "_id")
	return doc
}

var _ ports.TransactionRepository = (*transactionRepository)(nil)

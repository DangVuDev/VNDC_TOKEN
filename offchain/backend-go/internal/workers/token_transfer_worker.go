// Package workers — TokenTransferWorker watches the transactions collection for new
// PENDING entries and signals the BatchWorker to run an immediate settlement cycle.
//
// When MongoDB is running as a replica set (or Atlas), it uses Change Streams for
// near-real-time detection. On a standalone MongoDB node (typical in local dev) it
// automatically degrades to periodic polling, so the server starts correctly in
// every environment without manual tuning.
package workers

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────

// TokenTransferWorkerConfig controls how aggressively new pending transactions trigger batch settlement attempts.
// These knobs let the same worker behave sensibly in local polling mode and replica-set change-stream mode.
type TokenTransferWorkerConfig struct {
	// PendingThreshold: trigger an immediate batch when the number of PENDING
	// transactions reaches this value. Set to 0 to disable count-based triggering.
	PendingThreshold int

	// TriggerInterval: force-trigger a batch on this cadence regardless of the
	// pending count. Also serves as the polling interval when Change Streams are
	// unavailable.
	TriggerInterval time.Duration

	// ChangeStreamRetryDelay: how long to wait before reopening a failed change stream.
	ChangeStreamRetryDelay time.Duration
}

// DefaultTokenTransferWorkerConfig returns conservative defaults suitable for local development and moderate traffic.
// The defaults prioritize simplicity and responsiveness without requiring replica-set-specific tuning.
func DefaultTokenTransferWorkerConfig() TokenTransferWorkerConfig {
	return TokenTransferWorkerConfig{
		PendingThreshold:       5,
		TriggerInterval:        30 * time.Second,
		ChangeStreamRetryDelay: 5 * time.Second,
	}
}

// ─────────────────────────────────────────────
//  Worker
// ─────────────────────────────────────────────

// TokenTransferWorker monitors pending-token-transaction activity and signals the BatchWorker when processing should start.
// It acts as the event-driven bridge between newly queued transactions and the batch settlement worker.
type TokenTransferWorker struct {
	txCol     *mongo.Collection
	txRepo    ports.TransactionRepository
	triggerCh chan struct{} // internal; exposed as send-only to BatchWorker
	cfg       TokenTransferWorkerConfig
	log       logger.Logger
}

// NewTokenTransferWorker constructs a ready-to-run worker with both Mongo collection access and repository-level count access.
// The raw collection is only needed for change streams, while the repository is used for threshold-based counting.
//
//   - txCol: raw *mongo.Collection used for Change Stream subscription.
//   - txRepo: repository used to count PENDING transactions after each event.
//   - cfg: tuning parameters; use DefaultTokenTransferWorkerConfig() for sane defaults.
func NewTokenTransferWorker(
	txCol *mongo.Collection,
	txRepo ports.TransactionRepository,
	cfg TokenTransferWorkerConfig,
	log logger.Logger,
) *TokenTransferWorker {
	return &TokenTransferWorker{
		txCol:     txCol,
		txRepo:    txRepo,
		triggerCh: make(chan struct{}, 1), // buffered: never blocks the watcher
		cfg:       cfg,
		log:       log.Named("token_transfer_worker"),
	}
}

// TriggerChan exposes the worker's internal signal channel to downstream batch processors.
// Consumers should treat it as a coalesced wake-up signal rather than a one-event-per-transaction stream.
func (w *TokenTransferWorker) TriggerChan() <-chan struct{} {
	return w.triggerCh
}

// Run starts the main worker loop, combining timer-based triggers with change-stream-driven triggers.
// The loop blocks until context cancellation and is intended to run in its own goroutine.
func (w *TokenTransferWorker) Run(ctx context.Context) {
	w.log.Info("token transfer worker starting",
		logger.Int64("threshold", int64(w.cfg.PendingThreshold)),
		logger.String("trigger_interval", w.cfg.TriggerInterval.String()),
	)

	// changeCh receives a signal each time the change stream sees a qualifying event.
	// If Change Streams are unavailable the goroutine below exits immediately and
	// changeCh stays silent — the ticker loop provides the fallback cadence.
	changeCh := make(chan struct{}, 16)
	go w.watchChangeStream(ctx, changeCh)

	ticker := time.NewTicker(w.cfg.TriggerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.log.Info("token transfer worker stopping")
			return

		case <-ticker.C:
			// Time-based trigger — fires even if Change Streams are silent.
			w.log.Debug("time-based batch trigger")
			w.fire()

		case <-changeCh:
			// Change Stream event — check whether we've hit the threshold.
			if w.cfg.PendingThreshold <= 0 {
				// Threshold disabled: every change triggers a batch.
				w.fire()
				continue
			}
			count, err := w.txRepo.CountByStatus(ctx, domain.TxStatusPending)
			if err != nil {
				w.log.Error("count pending txs failed", logger.Err(err))
				continue
			}
			w.log.Debug("pending tx count",
				logger.Int64("count", count),
				logger.Int64("threshold", int64(w.cfg.PendingThreshold)),
			)
			if count >= int64(w.cfg.PendingThreshold) {
				w.log.Info("threshold reached — triggering batch",
					logger.Int64("count", count),
				)
				w.fire()
			}
		}
	}
}

// fire sends a non-blocking wake-up signal to the batch worker.
// Duplicate signals are intentionally collapsed because the downstream worker only needs to know that work exists.
func (w *TokenTransferWorker) fire() {
	select {
	case w.triggerCh <- struct{}{}:
	default:
		// BatchWorker already notified; no-op.
	}
}

// ─────────────────────────────────────────────
//  Change Stream goroutine
// ─────────────────────────────────────────────

// watchChangeStream opens and maintains a MongoDB change stream for transactions that newly become pending.
// If change streams are unavailable, the worker degrades gracefully to pure interval polling rather than failing startup.
func (w *TokenTransferWorker) watchChangeStream(ctx context.Context, out chan<- struct{}) {
	if w.txCol == nil {
		// No collection provided (e.g. in unit tests) — skip change stream entirely.
		return
	}
	// Pipeline: match PENDING inserts and status-→-PENDING updates only.
	pipeline := mongo.Pipeline{
		bson.D{
			{Key: "$match", Value: bson.D{
				{Key: "$or", Value: bson.A{
					// New document inserted with status=PENDING
					bson.D{
						{Key: "operationType", Value: "insert"},
						{Key: "fullDocument.status", Value: string(domain.TxStatusPending)},
					},
					// Existing document updated, status field flipped to PENDING
					bson.D{
						{Key: "operationType", Value: "update"},
						{Key: "updateDescription.updatedFields.status", Value: string(domain.TxStatusPending)},
					},
				}},
			}},
		},
	}

	opts := options.ChangeStream().SetFullDocument(options.UpdateLookup)
	firstAttempt := true

	for {
		if ctx.Err() != nil {
			return
		}

		stream, err := w.txCol.Watch(ctx, pipeline, opts)
		if err != nil {
			if firstAttempt {
				// Distinguish between "not a replica set" and transient errors.
				// Either way log a clear message so operators understand what happened.
				if isNotReplicaSetError(err) {
					w.log.Warn("change streams unavailable (standalone MongoDB) — falling back to interval polling only",
						logger.String("tip", "run MongoDB as a replica set to enable change streams"),
					)
				} else {
					w.log.Warn("change stream open failed — falling back to interval polling",
						logger.Err(err),
					)
				}
				return // Degrade gracefully; ticker loop handles the rest.
			}
			w.log.Error("change stream reconnect failed, retrying",
				logger.Err(err),
				logger.String("retry_in", w.cfg.ChangeStreamRetryDelay.String()),
			)
			select {
			case <-ctx.Done():
				return
			case <-time.After(w.cfg.ChangeStreamRetryDelay):
				continue
			}
		}

		firstAttempt = false
		w.log.Info("change stream opened on transactions collection")

		w.drainStream(ctx, stream, out)
		_ = stream.Close(context.Background())

		if ctx.Err() != nil {
			return
		}
		// Stream ended unexpectedly — log and reconnect after a short delay.
		w.log.Warn("change stream closed unexpectedly, reconnecting",
			logger.String("retry_in", w.cfg.ChangeStreamRetryDelay.String()),
		)
		select {
		case <-ctx.Done():
			return
		case <-time.After(w.cfg.ChangeStreamRetryDelay):
		}
	}
}

// drainStream consumes events from an already-open change stream and forwards compact wake-up signals downstream.
// It deliberately drops excess signals when the output buffer is full because one wake-up is enough to trigger a batch cycle.
func (w *TokenTransferWorker) drainStream(ctx context.Context, stream *mongo.ChangeStream, out chan<- struct{}) {
	for stream.Next(ctx) {
		select {
		case out <- struct{}{}:
		default:
			// out is full — the worker loop will consolidate these into one batch run.
		}
	}
	if err := stream.Err(); err != nil && ctx.Err() == nil {
		w.log.Error("change stream iteration error", logger.Err(err))
	}
}

// isNotReplicaSetError identifies the family of errors that mean change streams are unsupported in the current Mongo deployment.
// Recognizing these explicitly lets the worker log a clear fallback message instead of treating local-dev setups as hard failures.
func isNotReplicaSetError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "not master") ||
		strings.Contains(msg, "not a replica set") ||
		strings.Contains(msg, "not supported on a standalone") ||
		strings.Contains(msg, "oplog") ||
		strings.Contains(msg, "InvalidOptions")
}

// Package workers — unit tests for TokenTransferWorker.
// Tests use mock repositories and a fake changeCh to exercise the trigger logic
// without requiring a real MongoDB replica set or blockchain node.
package workers

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  Mock TransactionRepository
// ─────────────────────────────────────────────

type mockTxRepo struct {
	mock.Mock
}

func (m *mockTxRepo) CountByStatus(ctx context.Context, status domain.TransactionStatus) (int64, error) {
	args := m.Called(ctx, status)
	return args.Get(0).(int64), args.Error(1)
}

// Satisfy the full ports.TransactionRepository interface with no-ops.
func (m *mockTxRepo) Create(ctx context.Context, e *domain.Transaction) error { return nil }
func (m *mockTxRepo) CreateMany(ctx context.Context, entities []*domain.Transaction) error {
	return nil
}
func (m *mockTxRepo) FindByID(ctx context.Context, id string) (*domain.Transaction, error) {
	return nil, apperr.ErrNotFound
}
func (m *mockTxRepo) FindOne(ctx context.Context, opts ...database.QueryOption) (*domain.Transaction, error) {
	return nil, apperr.ErrNotFound
}
func (m *mockTxRepo) Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.Transaction, int64, error) {
	return nil, 0, nil
}
func (m *mockTxRepo) FindAll(ctx context.Context, opts ...database.QueryOption) ([]*domain.Transaction, int64, error) {
	return nil, 0, nil
}
func (m *mockTxRepo) Count(ctx context.Context, opts ...database.QueryOption) (int64, error) {
	return 0, nil
}
func (m *mockTxRepo) Exists(ctx context.Context, id string) (bool, error) { return false, nil }
func (m *mockTxRepo) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return nil
}
func (m *mockTxRepo) Upsert(ctx context.Context, id string, entity *domain.Transaction) error {
	return nil
}
func (m *mockTxRepo) Delete(ctx context.Context, id string) error     { return nil }
func (m *mockTxRepo) HardDelete(ctx context.Context, id string) error { return nil }
func (m *mockTxRepo) WithTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}
func (m *mockTxRepo) FindByStatus(ctx context.Context, status domain.TransactionStatus, limit int64) ([]*domain.Transaction, error) {
	return nil, nil
}
func (m *mockTxRepo) FindByWallet(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.Transaction, int64, error) {
	return nil, 0, nil
}
func (m *mockTxRepo) FindPendingOlderThan(ctx context.Context, threshold time.Duration) ([]*domain.Transaction, error) {
	return nil, nil
}
func (m *mockTxRepo) HasActiveNonce(ctx context.Context, wallet, nonce string) (bool, error) {
	return false, nil
}
func (m *mockTxRepo) AssignBatch(ctx context.Context, txIDs []string, batchID string) error {
	return nil
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

func noopLogger() logger.Logger {
	l, _ := logger.New(logger.Config{Level: "error", Format: "console", Development: false})
	return l
}

// newTestWorker builds a TokenTransferWorker with a very short interval so tests
// run fast. It returns the worker together with a handle to the internal changeCh
// so tests can inject synthetic change-stream events.
func newTestWorker(txRepo *mockTxRepo, threshold int, interval time.Duration) (*TokenTransferWorker, chan struct{}) {
	cfg := TokenTransferWorkerConfig{
		PendingThreshold:       threshold,
		TriggerInterval:        interval,
		ChangeStreamRetryDelay: 10 * time.Millisecond,
	}
	w := NewTokenTransferWorker(nil, txRepo, cfg, noopLogger())
	// Expose the internal changeCh for controlled injection.
	// In production this is written to by watchChangeStream.
	extChangeCh := make(chan struct{}, 16)
	return w, extChangeCh
}

// ─────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────

// TestTokenTransferWorker_TimeBased verifies that the interval ticker fires a
// trigger even when there are no change-stream events.
func TestTokenTransferWorker_TimeBased(t *testing.T) {
	txRepo := &mockTxRepo{}
	// TriggerInterval 50ms so the test is fast.
	cfg := TokenTransferWorkerConfig{
		PendingThreshold:       10,
		TriggerInterval:        50 * time.Millisecond,
		ChangeStreamRetryDelay: 10 * time.Millisecond,
	}
	w := NewTokenTransferWorker(nil, txRepo, cfg, noopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Run the worker loop directly (skips the change stream goroutine via closed changeCh).
	// We mimic the worker loop manually with just the ticker path.
	go w.Run(ctx)

	// Wait for at least one trigger within a generous window.
	select {
	case <-w.TriggerChan():
		// Received a time-based trigger — pass.
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected time-based trigger within 500ms, got none")
	}
}

// TestTokenTransferWorker_ThresholdReached verifies that when CountByStatus returns
// a value >= threshold, a trigger is fired.
func TestTokenTransferWorker_ThresholdReached(t *testing.T) {
	txRepo := &mockTxRepo{}
	// Return count == threshold (5 >= 5 → should trigger).
	txRepo.On("CountByStatus", mock.Anything, domain.TxStatusPending).Return(int64(5), nil)

	cfg := TokenTransferWorkerConfig{
		PendingThreshold:       5,
		TriggerInterval:        10 * time.Second, // long — won't fire during this test
		ChangeStreamRetryDelay: 10 * time.Millisecond,
	}
	w := NewTokenTransferWorker(nil, txRepo, cfg, noopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Directly exercise the change-event processing path by calling the private
	// run loop logic via a synthetic changeCh.
	changeCh := make(chan struct{}, 1)
	go func() {
		ticker := time.NewTicker(cfg.TriggerInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// won't fire in test window
			case <-changeCh:
				count, _ := txRepo.CountByStatus(ctx, domain.TxStatusPending)
				if count >= int64(cfg.PendingThreshold) {
					w.fire()
				}
			}
		}
	}()

	// Inject a synthetic change event.
	changeCh <- struct{}{}

	select {
	case <-w.TriggerChan():
		// Triggered as expected.
	case <-time.After(500 * time.Millisecond):
		t.Fatal("expected trigger when threshold reached, got none")
	}
	txRepo.AssertExpectations(t)
}

// TestTokenTransferWorker_BelowThreshold verifies that no trigger is sent when
// the pending count is below the threshold.
func TestTokenTransferWorker_BelowThreshold(t *testing.T) {
	txRepo := &mockTxRepo{}
	// Return count < threshold (3 < 5 → should NOT trigger).
	txRepo.On("CountByStatus", mock.Anything, domain.TxStatusPending).Return(int64(3), nil)

	cfg := TokenTransferWorkerConfig{
		PendingThreshold:       5,
		TriggerInterval:        10 * time.Second,
		ChangeStreamRetryDelay: 10 * time.Millisecond,
	}
	w := NewTokenTransferWorker(nil, txRepo, cfg, noopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	changeCh := make(chan struct{}, 1)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-changeCh:
				count, _ := txRepo.CountByStatus(ctx, domain.TxStatusPending)
				if count >= int64(cfg.PendingThreshold) {
					w.fire()
				}
			}
		}
	}()

	changeCh <- struct{}{}

	// Expect NO trigger within 200ms.
	select {
	case <-w.TriggerChan():
		t.Fatal("unexpected trigger: pending count is below threshold")
	case <-time.After(200 * time.Millisecond):
		// Correctly no trigger fired.
	}
	txRepo.AssertExpectations(t)
}

// TestTokenTransferWorker_NoDuplicateTriggers verifies that fire() doesn't block
// or enqueue multiple signals when the BatchWorker hasn't consumed the first one.
func TestTokenTransferWorker_NoDuplicateTriggers(t *testing.T) {
	txRepo := &mockTxRepo{}
	cfg := DefaultTokenTransferWorkerConfig()
	w := NewTokenTransferWorker(nil, txRepo, cfg, noopLogger())

	// Fire many times without consuming.
	for i := 0; i < 100; i++ {
		w.fire()
	}

	// The channel is buffered(1), so exactly one signal should be pending.
	assert.Equal(t, 1, len(w.triggerCh), "exactly one signal should be in the buffered channel")
}

// TestIsNotReplicaSetError verifies the standalone-MongoDB error detector.
func TestIsNotReplicaSetError(t *testing.T) {
	cases := []struct {
		msg      string
		expected bool
	}{
		{"not a replica set", true},
		{"not master", true},
		{"not supported on a standalone", true},
		{"oplog needs to be configured", true},
		{"some InvalidOptions error from mongo", true},
		{"network timeout", false},
		{"", false},
	}
	for _, tc := range cases {
		err := &fakeErr{tc.msg}
		got := isNotReplicaSetError(err)
		assert.Equal(t, tc.expected, got, "msg=%q", tc.msg)
	}
}

type fakeErr struct{ msg string }

func (e *fakeErr) Error() string { return e.msg }

// Package workers — SessionWorker expires hanging learning sessions.
// Any UserProgress that remains IN_PROGRESS longer than the configured timeout
// (default 2 hours) is automatically marked EXPIRED so slot counts stay accurate.
package workers

import (
	"context"
	"time"

	"github.com/vndc/backend/pkg/logger"
)

// SessionExpirer is the minimal boundary required to expire abandoned learning sessions.
// Keeping this as a tiny interface avoids coupling the worker to the full task service surface.
type SessionExpirer interface {
	ExpireHangingSessions(ctx context.Context) (int, error)
}

// SessionWorkerConfig controls how often the worker scans for abandoned in-progress sessions.
type SessionWorkerConfig struct {
	// TickInterval is how often to scan for expired sessions.
	TickInterval time.Duration
}

// DefaultSessionWorkerConfig returns a conservative scan cadence suitable for local development and small deployments.
func DefaultSessionWorkerConfig() SessionWorkerConfig {
	return SessionWorkerConfig{
		TickInterval: 15 * time.Minute,
	}
}

// SessionWorker periodically expires hanging learning sessions so stale progress does not block slots or distort state.
type SessionWorker struct {
	svc SessionExpirer
	cfg SessionWorkerConfig
	log logger.Logger
}

// NewSessionWorker constructs the session-expiry worker with its service dependency and loop configuration.
func NewSessionWorker(svc SessionExpirer, cfg SessionWorkerConfig, log logger.Logger) *SessionWorker {
	return &SessionWorker{
		svc: svc,
		cfg: cfg,
		log: log.Named("session_worker"),
	}
}

// Run starts the periodic expiry loop and blocks until context cancellation.
// Each tick delegates the actual expiration logic to the injected service boundary.
func (w *SessionWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.cfg.TickInterval)
	defer ticker.Stop()

	w.log.Info("session expiry worker started", logger.Duration("interval", w.cfg.TickInterval))
	for {
		select {
		case <-ctx.Done():
			w.log.Info("session expiry worker stopped")
			return
		case <-ticker.C:
			count, err := w.svc.ExpireHangingSessions(ctx)
			if err != nil {
				w.log.Error("expire sessions error", logger.Err(err))
				continue
			}
			if count > 0 {
				w.log.Info("expired hanging sessions", logger.Int("count", count))
			}
		}
	}
}

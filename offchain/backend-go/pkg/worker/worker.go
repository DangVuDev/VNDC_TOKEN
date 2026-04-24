// Package worker provides a generic, configurable worker pool for background processing.
// Supports retry with backoff, graceful shutdown, and context propagation.
package worker

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  Job
// ─────────────────────────────────────────────

// Job[T] is a unit of work submitted to a Pool.
type Job[T any] struct {
	ID      string
	Payload T
	Attempt int
}

// Handler[T] is a function that processes a Job[T].
// Return a non-nil error to trigger a retry (up to MaxRetries).
type Handler[T any] func(ctx context.Context, job Job[T]) error

// ─────────────────────────────────────────────
//  Pool Config
// ─────────────────────────────────────────────

// Config holds worker pool configuration.
type Config struct {
	Workers       int           // number of goroutines
	BufferSize    int           // job channel capacity
	MaxRetries    int           // max retry attempts per job
	RetryDelay    time.Duration // base delay (exponential backoff)
	RetryMaxDelay time.Duration // cap on exponential delay
}

func DefaultConfig() Config {
	return Config{
		Workers:       4,
		BufferSize:    1000,
		MaxRetries:    3,
		RetryDelay:    5 * time.Second,
		RetryMaxDelay: 60 * time.Second,
	}
}

// ─────────────────────────────────────────────
//  Pool[T]
// ─────────────────────────────────────────────

// Pool[T] is a generic worker pool. T is the job payload type.
type Pool[T any] struct {
	cfg     Config
	handler Handler[T]
	jobs    chan Job[T]
	wg      sync.WaitGroup
	log     logger.Logger
}

// NewPool creates a new Pool with handler and config.
func NewPool[T any](cfg Config, handler Handler[T], log logger.Logger) *Pool[T] {
	return &Pool[T]{
		cfg:     cfg,
		handler: handler,
		jobs:    make(chan Job[T], cfg.BufferSize),
		log:     log.Named("worker"),
	}
}

// Submit enqueues a job. Returns an error if the pool is full.
func (p *Pool[T]) Submit(job Job[T]) error {
	select {
	case p.jobs <- job:
		return nil
	default:
		return fmt.Errorf("worker pool full (buffer=%d)", p.cfg.BufferSize)
	}
}

// Start launches worker goroutines. Runs until ctx is cancelled.
func (p *Pool[T]) Start(ctx context.Context) {
	for i := 0; i < p.cfg.Workers; i++ {
		p.wg.Add(1)
		go p.run(ctx, i)
	}
	p.log.Info("worker pool started", logger.Int("workers", p.cfg.Workers))
}

// Wait blocks until all workers have exited.
func (p *Pool[T]) Wait() { p.wg.Wait() }

// Close drains the job channel and stops accepting new jobs.
func (p *Pool[T]) Close() { close(p.jobs) }

func (p *Pool[T]) run(ctx context.Context, id int) {
	defer p.wg.Done()
	workerLog := p.log.With(logger.Int("worker_id", id))

	for {
		select {
		case <-ctx.Done():
			workerLog.Info("worker stopping", logger.String("reason", ctx.Err().Error()))
			return
		case job, ok := <-p.jobs:
			if !ok {
				return
			}
			p.process(ctx, workerLog, job)
		}
	}
}

func (p *Pool[T]) process(ctx context.Context, log logger.Logger, job Job[T]) {
	var err error
	for attempt := 0; attempt <= p.cfg.MaxRetries; attempt++ {
		job.Attempt = attempt
		err = p.handler(ctx, job)
		if err == nil {
			return
		}

		if attempt < p.cfg.MaxRetries {
			delay := backoff(p.cfg.RetryDelay, p.cfg.RetryMaxDelay, attempt)
			log.Warn("job failed, retrying",
				logger.String("job_id", job.ID),
				logger.Int("attempt", attempt+1),
				logger.Int("max_retries", p.cfg.MaxRetries),
				logger.Duration("retry_in", delay),
				logger.Err(err),
			)
			select {
			case <-ctx.Done():
				return
			case <-time.After(delay):
			}
		}
	}

	log.Error("job failed permanently",
		logger.String("job_id", job.ID),
		logger.Int("attempts", p.cfg.MaxRetries+1),
		logger.Err(err),
	)
}

// backoff computes exponential backoff capped at maxDelay.
func backoff(base, maxDelay time.Duration, attempt int) time.Duration {
	factor := math.Pow(2, float64(attempt))
	delay := time.Duration(float64(base) * factor)
	if delay > maxDelay {
		return maxDelay
	}
	return delay
}

// ─────────────────────────────────────────────
//  Ticker Worker — periodic background task
// ─────────────────────────────────────────────

// TickerWorker runs a function at a fixed interval until ctx is cancelled.
type TickerWorker struct {
	name     string
	interval time.Duration
	fn       func(ctx context.Context) error
	log      logger.Logger
}

// NewTickerWorker creates a periodic worker.
func NewTickerWorker(name string, interval time.Duration, fn func(ctx context.Context) error, log logger.Logger) *TickerWorker {
	return &TickerWorker{
		name:     name,
		interval: interval,
		fn:       fn,
		log:      log.Named(name),
	}
}

// Start begins execution. Blocks until ctx is cancelled.
func (w *TickerWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.log.Info("ticker worker started", logger.Duration("interval", w.interval))
	for {
		select {
		case <-ctx.Done():
			w.log.Info("ticker worker stopped")
			return
		case <-ticker.C:
			if err := w.fn(ctx); err != nil {
				w.log.Error("ticker worker error", logger.Err(err))
			}
		}
	}
}

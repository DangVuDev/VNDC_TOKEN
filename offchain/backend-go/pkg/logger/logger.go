// Package logger provides a production-grade structured logging abstraction
// built on top of go.uber.org/zap, following patterns from Uber, Google, and Netflix.
//
// Usage:
//
//	logger := logger.New(logger.Config{Level: "info", Format: "json"})
//	logger.Info("server started", logger.Field("port", 8080))
//	ctx = logger.WithContext(ctx, logger.With(logger.Field("user_id", "123")))
//	logger.FromContext(ctx).Info("handling request")
package logger

import (
	"context"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// ─────────────────────────────────────────────
//  Interface — decouple callers from zap
// ─────────────────────────────────────────────

// Logger is the primary logging interface used across the application.
type Logger interface {
	Debug(msg string, fields ...Field)
	Info(msg string, fields ...Field)
	Warn(msg string, fields ...Field)
	Error(msg string, fields ...Field)
	Fatal(msg string, fields ...Field)
	With(fields ...Field) Logger
	WithContext(ctx context.Context) context.Context
	Named(name string) Logger
	Sync() error
}

// Field is an alias for structured log field.
type Field = zap.Field

// Convenience constructors for Fields.
var (
	String   = zap.String
	Int      = zap.Int
	Int64    = zap.Int64
	Float64  = zap.Float64
	Bool     = zap.Bool
	Err      = zap.Error
	NamedErr = zap.NamedError
	Any      = zap.Any
	Duration = zap.Duration
	Stringer = zap.Stringer
	Binary   = zap.Binary
)

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────

// Config holds logger configuration.
type Config struct {
	Level       string // debug, info, warn, error, fatal
	Format      string // json | console
	Development bool   // enables caller info, stacktraces on Warn+
	OutputPaths []string
}

func DefaultConfig() Config {
	return Config{
		Level:       "info",
		Format:      "json",
		Development: false,
		OutputPaths: []string{"stdout"},
	}
}

// ─────────────────────────────────────────────
//  zapLogger — concrete implementation
// ─────────────────────────────────────────────

type zapLogger struct {
	zl *zap.Logger
}

// New constructs a Logger from Config.
func New(cfg Config) (Logger, error) {
	level, err := zap.ParseAtomicLevel(cfg.Level)
	if err != nil {
		return nil, err
	}

	encoderCfg := zap.NewProductionEncoderConfig()
	encoderCfg.TimeKey = "timestamp"
	encoderCfg.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderCfg.EncodeLevel = zapcore.LowercaseLevelEncoder
	encoderCfg.EncodeCaller = zapcore.ShortCallerEncoder

	var encoder zapcore.Encoder
	if cfg.Format == "console" {
		encoder = zapcore.NewConsoleEncoder(encoderCfg)
	} else {
		encoder = zapcore.NewJSONEncoder(encoderCfg)
	}

	var sink zapcore.WriteSyncer
	if len(cfg.OutputPaths) == 0 || cfg.OutputPaths[0] == "stdout" {
		sink = zapcore.AddSync(os.Stdout)
	} else {
		sink = zapcore.AddSync(os.Stdout) // extend with file sink if needed
	}

	core := zapcore.NewCore(encoder, sink, level)

	opts := []zap.Option{zap.AddCaller(), zap.AddCallerSkip(1)}
	if cfg.Development {
		opts = append(opts, zap.Development())
		opts = append(opts, zap.AddStacktrace(zapcore.WarnLevel))
	}

	zl := zap.New(core, opts...)
	return &zapLogger{zl: zl}, nil
}

// NewNop creates a no-op logger for tests.
func NewNop() Logger {
	return &zapLogger{zl: zap.NewNop()}
}

// Must panics if logger construction fails.
func Must(cfg Config) Logger {
	l, err := New(cfg)
	if err != nil {
		panic("logger: " + err.Error())
	}
	return l
}

// ─────────────────────────────────────────────
//  Interface implementation
// ─────────────────────────────────────────────

func (l *zapLogger) Debug(msg string, fields ...Field) { l.zl.Debug(msg, fields...) }
func (l *zapLogger) Info(msg string, fields ...Field)  { l.zl.Info(msg, fields...) }
func (l *zapLogger) Warn(msg string, fields ...Field)  { l.zl.Warn(msg, fields...) }
func (l *zapLogger) Error(msg string, fields ...Field) { l.zl.Error(msg, fields...) }
func (l *zapLogger) Fatal(msg string, fields ...Field) { l.zl.Fatal(msg, fields...) }
func (l *zapLogger) Sync() error                       { return l.zl.Sync() }

func (l *zapLogger) Named(name string) Logger {
	return &zapLogger{zl: l.zl.Named(name)}
}

func (l *zapLogger) With(fields ...Field) Logger {
	return &zapLogger{zl: l.zl.With(fields...)}
}

func (l *zapLogger) WithContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, contextKey{}, l)
}

// ─────────────────────────────────────────────
//  Context helpers — propagate logger through ctx
// ─────────────────────────────────────────────

type contextKey struct{}

// FromContext extracts a Logger from context.
// Returns a no-op logger if none found (never returns nil).
func FromContext(ctx context.Context) Logger {
	if l, ok := ctx.Value(contextKey{}).(Logger); ok {
		return l
	}
	return NewNop()
}

// WithFields returns a new Logger with fields attached.
func WithFields(l Logger, fields ...Field) Logger {
	return l.With(fields...)
}

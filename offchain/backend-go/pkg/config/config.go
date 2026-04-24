// Package config provides type-safe configuration management
// using Viper with environment variable override support.
// Follows 12-factor app principles.
package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// ─────────────────────────────────────────────
//  Root Config — strongly typed
// ─────────────────────────────────────────────

// Config is the top-level application configuration.
type Config struct {
	App        AppConfig        `mapstructure:"app"`
	HTTP       HTTPConfig       `mapstructure:"http"`
	Database   DatabaseConfig   `mapstructure:"database"`
	Cache      CacheConfig      `mapstructure:"cache"`
	Blockchain BlockchainConfig `mapstructure:"blockchain"`
	Auth       AuthConfig       `mapstructure:"auth"`
	Log        LogConfig        `mapstructure:"log"`
	Worker     WorkerConfig     `mapstructure:"worker"`
	Metrics    MetricsConfig    `mapstructure:"metrics"`
}

// AppConfig holds application-level settings.
type AppConfig struct {
	Name        string `mapstructure:"name"`
	Version     string `mapstructure:"version"`
	Environment string `mapstructure:"environment"` // development | staging | production
	Debug       bool   `mapstructure:"debug"`
}

// HTTPConfig holds HTTP server settings.
type HTTPConfig struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
	MaxBodySize  int64         `mapstructure:"max_body_size"` // bytes
	TLSEnabled   bool          `mapstructure:"tls_enabled"`
	TLSCertFile  string        `mapstructure:"tls_cert_file"`
	TLSKeyFile   string        `mapstructure:"tls_key_file"`
}

func (h HTTPConfig) Addr() string { return fmt.Sprintf("%s:%d", h.Host, h.Port) }

// DatabaseConfig holds MongoDB settings.
type DatabaseConfig struct {
	URI             string        `mapstructure:"uri"`
	Name            string        `mapstructure:"name"`
	MaxPoolSize     uint64        `mapstructure:"max_pool_size"`
	MinPoolSize     uint64        `mapstructure:"min_pool_size"`
	MaxConnIdleTime time.Duration `mapstructure:"max_conn_idle_time"`
	ConnectTimeout  time.Duration `mapstructure:"connect_timeout"`
	Timeout         time.Duration `mapstructure:"timeout"`
}

// CacheConfig holds Redis settings.
type CacheConfig struct {
	Addr         string        `mapstructure:"addr"`
	Password     string        `mapstructure:"password"`
	DB           int           `mapstructure:"db"`
	PoolSize     int           `mapstructure:"pool_size"`
	MinIdleConns int           `mapstructure:"min_idle_conns"`
	DialTimeout  time.Duration `mapstructure:"dial_timeout"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	MaxRetries   int           `mapstructure:"max_retries"`
	DefaultTTL   time.Duration `mapstructure:"default_ttl"`
	KeyPrefix    string        `mapstructure:"key_prefix"`
}

// BlockchainConfig holds Ethereum/EVM settings.
type BlockchainConfig struct {
	RPCURL               string        `mapstructure:"rpc_url"`
	WSURL                string        `mapstructure:"ws_url"`
	ChainID              int64         `mapstructure:"chain_id"`
	NetworkName          string        `mapstructure:"network_name"`
	TokenContractAddress string        `mapstructure:"token_contract_address"`
	NFTContractAddress   string        `mapstructure:"nft_contract_address"`
	RelayerAddress       string        `mapstructure:"relayer_address"`
	RelayerPrivateKey    string        `mapstructure:"relayer_private_key"`
	MaxGasPrice          int64         `mapstructure:"max_gas_price_gwei"`
	ConfirmationBlocks   uint64        `mapstructure:"confirmation_blocks"`
	ConfirmationInterval time.Duration `mapstructure:"confirmation_interval"`
	BatchSize            int           `mapstructure:"batch_size"`
	BatchTimeout         time.Duration `mapstructure:"batch_timeout"`
}

// AuthConfig holds JWT settings.
type AuthConfig struct {
	JWTSecret     string        `mapstructure:"jwt_secret"`
	JWTExpiry     time.Duration `mapstructure:"jwt_expiry"`
	RefreshExpiry time.Duration `mapstructure:"refresh_expiry"`
	Issuer        string        `mapstructure:"issuer"`
	AdminToken    string        `mapstructure:"admin_token"`
}

// LogConfig holds logger settings.
type LogConfig struct {
	Level       string `mapstructure:"level"`
	Format      string `mapstructure:"format"` // json | console
	Development bool   `mapstructure:"development"`
}

// WorkerConfig holds background worker settings.
type WorkerConfig struct {
	BatchSize       int           `mapstructure:"batch_size"`
	BatchTimeout    time.Duration `mapstructure:"batch_timeout"`
	SyncInterval    time.Duration `mapstructure:"sync_interval"`
	MaxWorkers      int           `mapstructure:"max_workers"`
	QueueBufferSize int           `mapstructure:"queue_buffer_size"`
	RetryMax        int           `mapstructure:"retry_max"`
	RetryDelay      time.Duration `mapstructure:"retry_delay"`
}

// MetricsConfig holds Prometheus settings.
type MetricsConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	Path    string `mapstructure:"path"`
	Port    int    `mapstructure:"port"`
}

// ─────────────────────────────────────────────
//  Loader
// ─────────────────────────────────────────────

// Load reads config from file + environment variables.
// Environment variables override file values (12-factor compliant).
// Example env: APP_HTTP_PORT=9090 maps to config.HTTP.Port
func Load(path string) (*Config, error) {
	v := viper.New()

	// File-based config
	v.SetConfigFile(path)
	v.SetConfigType("yaml")

	// Env var override — prefix "APP_", e.g. APP_HTTP_PORT
	v.SetEnvPrefix("APP")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Defaults
	setDefaults(v)

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("config: read file %q: %w", path, err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("config: unmarshal: %w", err)
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config: validation: %w", err)
	}

	return &cfg, nil
}

// validate performs basic sanity checks.
func (c *Config) validate() error {
	if c.HTTP.Port == 0 {
		return fmt.Errorf("http.port is required")
	}
	if c.Database.URI == "" {
		return fmt.Errorf("database.uri is required")
	}
	if c.Cache.Addr == "" {
		return fmt.Errorf("cache.addr is required")
	}
	if c.Blockchain.RPCURL == "" {
		return fmt.Errorf("blockchain.rpc_url is required")
	}
	if c.Auth.JWTSecret == "" {
		return fmt.Errorf("auth.jwt_secret is required")
	}
	return nil
}

// IsDevelopment returns true in development environment.
func (c *Config) IsDevelopment() bool { return c.App.Environment == "development" }
func (c *Config) IsProduction() bool  { return c.App.Environment == "production" }

// ─────────────────────────────────────────────
//  Defaults
// ─────────────────────────────────────────────

func setDefaults(v *viper.Viper) {
	v.SetDefault("app.name", "vndc-backend")
	v.SetDefault("app.version", "1.0.0")
	v.SetDefault("app.environment", "development")

	v.SetDefault("http.host", "0.0.0.0")
	v.SetDefault("http.port", 8080)
	v.SetDefault("http.read_timeout", "15s")
	v.SetDefault("http.write_timeout", "30s")
	v.SetDefault("http.idle_timeout", "60s")
	v.SetDefault("http.max_body_size", 1048576) // 1MB

	v.SetDefault("database.max_pool_size", 100)
	v.SetDefault("database.min_pool_size", 5)
	v.SetDefault("database.connect_timeout", "10s")
	v.SetDefault("database.timeout", "30s")
	v.SetDefault("database.max_conn_idle_time", "60s")

	v.SetDefault("cache.pool_size", 100)
	v.SetDefault("cache.min_idle_conns", 5)
	v.SetDefault("cache.dial_timeout", "5s")
	v.SetDefault("cache.read_timeout", "3s")
	v.SetDefault("cache.write_timeout", "3s")
	v.SetDefault("cache.max_retries", 3)
	v.SetDefault("cache.default_ttl", "10m")
	v.SetDefault("cache.key_prefix", "vndc:")

	v.SetDefault("blockchain.confirmation_blocks", 12)
	v.SetDefault("blockchain.confirmation_interval", "15s")
	v.SetDefault("blockchain.batch_size", 10)
	v.SetDefault("blockchain.batch_timeout", "5m")
	v.SetDefault("blockchain.max_gas_price_gwei", 100)

	v.SetDefault("auth.jwt_expiry", "24h")
	v.SetDefault("auth.refresh_expiry", "168h") // 7 days

	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")

	v.SetDefault("worker.batch_size", 10)
	v.SetDefault("worker.batch_timeout", "5m")
	v.SetDefault("worker.sync_interval", "10m")
	v.SetDefault("worker.max_workers", 4)
	v.SetDefault("worker.queue_buffer_size", 1000)
	v.SetDefault("worker.retry_max", 3)
	v.SetDefault("worker.retry_delay", "5s")

	v.SetDefault("metrics.enabled", true)
	v.SetDefault("metrics.path", "/metrics")
	v.SetDefault("metrics.port", 9090)
}

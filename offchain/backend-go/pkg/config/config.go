// Package config provides type-safe configuration management
// using Viper with environment variable override support.
// Follows 12-factor app principles.
package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
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

// BlockchainNetworkConfig holds Ethereum/EVM settings for a single network.
type BlockchainNetworkConfig struct {
	RPCURL                    string `mapstructure:"rpc_url"`
	WSURL                     string `mapstructure:"ws_url"`
	ChainID                   int64  `mapstructure:"chain_id"`
	NetworkName               string `mapstructure:"network_name"`
	TokenContractAddress      string `mapstructure:"token_contract_address"`
	NFTContractAddress        string `mapstructure:"nft_contract_address"`
	MarketplaceManagerAddress string `mapstructure:"marketplace_manager_address"`
	RelayerAddress            string `mapstructure:"relayer_address"`
	RelayerPrivateKey         string `mapstructure:"relayer_private_key"`
	FundingManagerAddress     string `mapstructure:"funding_manager_address"`
	DAOManagerAddress         string `mapstructure:"dao_manager_address"`
	TaskManagerAddress        string `mapstructure:"task_manager_address"`
	TaskManagerSignerPrivKey  string `mapstructure:"task_manager_signer_priv_key"`
	// QREncryptionKey is the secret used to derive the AES-256 key for event ticket QR codes.
	// Must be kept private. Falls back to JWTSecret if empty.
	QREncryptionKey      string        `mapstructure:"qr_encryption_key"`
	MaxGasPrice          int64         `mapstructure:"max_gas_price_gwei"`
	ConfirmationBlocks   uint64        `mapstructure:"confirmation_blocks"`
	ConfirmationInterval time.Duration `mapstructure:"confirmation_interval"`
	BatchSize            int           `mapstructure:"batch_size"`
	BatchTimeout         time.Duration `mapstructure:"batch_timeout"`
}

// BlockchainConfig holds the selected network plus optional named profiles.
type BlockchainConfig struct {
	BlockchainNetworkConfig `mapstructure:",squash"`
	ActiveNetwork           string                             `mapstructure:"active_network"`
	Networks                map[string]BlockchainNetworkConfig `mapstructure:"networks"`
}

// AuthConfig holds JWT settings.
type AuthConfig struct {
	JWTSecret     string        `mapstructure:"jwt_secret"`
	JWTExpiry     time.Duration `mapstructure:"jwt_expiry"`
	RefreshExpiry time.Duration `mapstructure:"refresh_expiry"`
	Issuer        string        `mapstructure:"issuer"`
	AdminToken    string        `mapstructure:"admin_token"`
	SIWEDomain    string        `mapstructure:"siwe_domain"`
}

// LogConfig holds logger settings.
type LogConfig struct {
	Level       string `mapstructure:"level"`
	Format      string `mapstructure:"format"` // json | console
	Development bool   `mapstructure:"development"`
}

// WorkerConfig holds background worker settings.
type WorkerConfig struct {
	BatchSize                 int           `mapstructure:"batch_size"`
	MaxTransactionsPerSession int           `mapstructure:"max_transactions_per_session"`
	BatchTimeout              time.Duration `mapstructure:"batch_timeout"`
	SyncInterval              time.Duration `mapstructure:"sync_interval"`
	MaxWorkers                int           `mapstructure:"max_workers"`
	QueueBufferSize           int           `mapstructure:"queue_buffer_size"`
	RetryMax                  int           `mapstructure:"retry_max"`
	RetryDelay                time.Duration `mapstructure:"retry_delay"`

	// TokenTransferWorker — Change Stream-based auto-batch trigger.
	// PendingThreshold: fire an immediate batch when PENDING tx count reaches this.
	// TriggerInterval: also fire on this cadence (doubles as poll interval for standalone MongoDB).
	// ChangeStreamRetryDelay: wait before reopening a failed change stream connection.
	PendingThreshold       int           `mapstructure:"pending_threshold"`
	TriggerInterval        time.Duration `mapstructure:"trigger_interval"`
	ChangeStreamRetryDelay time.Duration `mapstructure:"change_stream_retry_delay"`
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
// Example env: APP_HTTP_PORT=9090 maps to config.HTTP.Port.
func Load(path string) (*Config, error) {
	return LoadForNetwork(path, "")
}

// LoadForNetwork loads config and applies the selected blockchain network profile.
// The explicit network is meant for CLI usage, e.g. --network sepolia.
func LoadForNetwork(path, network string) (*Config, error) {
	loadDotEnvFiles(path)

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

	if err := cfg.applyBlockchainNetworkProfile(requestedBlockchainNetwork(v, network)); err != nil {
		return nil, fmt.Errorf("config: blockchain network: %w", err)
	}
	cfg.applyEnvironmentOverrides()

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config: validation: %w", err)
	}

	return &cfg, nil
}

func loadDotEnvFiles(configPath string) {
	candidates := []string{".env"}
	if configPath != "" {
		configDir := filepath.Dir(configPath)
		candidates = append(candidates,
			filepath.Join(configDir, ".env"),
			filepath.Join(configDir, "..", ".env"),
		)
	}

	seen := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		cleaned := filepath.Clean(candidate)
		if _, ok := seen[cleaned]; ok {
			continue
		}
		seen[cleaned] = struct{}{}
		loadDotEnvFile(cleaned)
	}
}

func loadDotEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close() //nolint:errcheck

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		os.Setenv(key, cleanDotEnvValue(value)) //nolint:errcheck
	}
}

func cleanDotEnvValue(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 2 {
		first := value[0]
		last := value[len(value)-1]
		if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
			return value[1 : len(value)-1]
		}
	}
	return value
}

func requestedBlockchainNetwork(v *viper.Viper, explicit string) string {
	if value := strings.TrimSpace(explicit); value != "" {
		return value
	}
	if value := strings.TrimSpace(os.Getenv("APP_BLOCKCHAIN_ACTIVE_NETWORK")); value != "" {
		return value
	}
	if value := strings.TrimSpace(os.Getenv("BLOCKCHAIN_NETWORK")); value != "" {
		return value
	}
	if value := strings.TrimSpace(os.Getenv("VNDC_CHAIN")); value != "" {
		return value
	}
	if value := strings.TrimSpace(os.Getenv("CHAIN_NETWORK")); value != "" {
		return value
	}
	return v.GetString("blockchain.active_network")
}

func normalizeBlockchainNetworkKey(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "default":
		return ""
	case "localhost", "hardhat":
		return "local"
	case "mainnet", "eth", "etherum":
		return "ethereum"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func blockchainNetworkLookupKeys(key string) []string {
	switch key {
	case "local":
		return []string{"local", "localhost", "hardhat"}
	case "ethereum":
		return []string{"ethereum", "mainnet", "eth", "etherum"}
	default:
		return []string{key}
	}
}

func (c *Config) applyBlockchainNetworkProfile(active string) error {
	active = normalizeBlockchainNetworkKey(active)
	if active == "" {
		active = normalizeBlockchainNetworkKey(c.Blockchain.ActiveNetwork)
	}
	c.Blockchain.ActiveNetwork = active

	if active == "" || len(c.Blockchain.Networks) == 0 {
		return nil
	}

	var (
		profile BlockchainNetworkConfig
		found   bool
	)
	for _, key := range blockchainNetworkLookupKeys(active) {
		if candidate, ok := c.Blockchain.Networks[key]; ok {
			profile = candidate
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("%q is not defined in blockchain.networks", active)
	}

	c.Blockchain.BlockchainNetworkConfig = mergeBlockchainNetworkProfile(
		profile,
		c.Blockchain.BlockchainNetworkConfig,
		active,
	)
	return nil
}

func (c *Config) applyEnvironmentOverrides() {
	active := c.Blockchain.ActiveNetwork
	c.Database.URI = firstEnvValue(c.Database.URI, "APP_DATABASE_URI", "DATABASE_URI", "MONGODB_URI")
	c.Auth.JWTSecret = firstEnvValue(c.Auth.JWTSecret, "APP_AUTH_JWT_SECRET", "JWT_SECRET")
	c.Auth.AdminToken = firstEnvValue(c.Auth.AdminToken, "APP_AUTH_ADMIN_TOKEN", "ADMIN_TOKEN")
	c.Auth.SIWEDomain = firstEnvValue(c.Auth.SIWEDomain, "APP_AUTH_SIWE_DOMAIN", "SIWE_DOMAIN")
	if c.Auth.JWTSecret == "" && !c.IsProduction() {
		c.Auth.JWTSecret = "vndc-dev-jwt-secret"
	}

	c.Blockchain.RPCURL = c.blockchainEnvValue(active, "RPC_URL", c.Blockchain.RPCURL, "ETH_RPC_URL")
	c.Blockchain.WSURL = c.blockchainEnvValue(active, "WS_URL", c.Blockchain.WSURL, "ETH_WS_URL")
	c.Blockchain.TokenContractAddress = c.blockchainEnvValue(active, "TOKEN_CONTRACT_ADDRESS", c.Blockchain.TokenContractAddress, "VNDC_TOKEN_ADDRESS")
	c.Blockchain.NFTContractAddress = c.blockchainEnvValue(active, "NFT_CONTRACT_ADDRESS", c.Blockchain.NFTContractAddress, "VNDC_NFT_ADDRESS")
	c.Blockchain.MarketplaceManagerAddress = c.blockchainEnvValue(active, "MARKETPLACE_MANAGER_ADDRESS", c.Blockchain.MarketplaceManagerAddress)
	c.Blockchain.RelayerAddress = c.blockchainEnvValue(active, "RELAYER_ADDRESS", c.Blockchain.RelayerAddress, "RELAYER_ADDRESS")
	c.Blockchain.RelayerPrivateKey = c.blockchainEnvValue(active, "RELAYER_PRIVATE_KEY", c.Blockchain.RelayerPrivateKey, "RELAYER_PRIVATE_KEY")
	c.Blockchain.FundingManagerAddress = c.blockchainEnvValue(active, "FUNDING_MANAGER_ADDRESS", c.Blockchain.FundingManagerAddress)
	c.Blockchain.DAOManagerAddress = c.blockchainEnvValue(active, "DAO_MANAGER_ADDRESS", c.Blockchain.DAOManagerAddress)
	c.Blockchain.TaskManagerAddress = c.blockchainEnvValue(active, "TASK_MANAGER_ADDRESS", c.Blockchain.TaskManagerAddress)
	c.Blockchain.TaskManagerSignerPrivKey = c.blockchainEnvValue(active, "TASK_MANAGER_SIGNER_PRIV_KEY", c.Blockchain.TaskManagerSignerPrivKey, "TASK_MANAGER_SIGNER_PRIV_KEY")
	c.Blockchain.QREncryptionKey = c.blockchainEnvValue(active, "QR_ENCRYPTION_KEY", c.Blockchain.QREncryptionKey, "QR_ENCRYPTION_KEY")
}

func (c *Config) blockchainEnvValue(active, field, fallback string, legacyLocalKeys ...string) string {
	keys := make([]string, 0, 8+len(legacyLocalKeys))
	for _, key := range blockchainNetworkLookupKeys(normalizeBlockchainNetworkKey(active)) {
		upper := strings.ToUpper(strings.ReplaceAll(key, "-", "_"))
		keys = append(keys,
			"APP_BLOCKCHAIN_NETWORKS_"+upper+"_"+field,
			"APP_BLOCKCHAIN_"+upper+"_"+field,
			upper+"_"+field,
		)
	}
	keys = append(keys, "APP_BLOCKCHAIN_"+field)
	if normalizeBlockchainNetworkKey(active) == "local" {
		keys = append(keys, legacyLocalKeys...)
	}
	return firstEnvValue(fallback, keys...)
}

func firstEnvValue(fallback string, keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return fallback
}

func mergeBlockchainNetworkProfile(profile, fallback BlockchainNetworkConfig, active string) BlockchainNetworkConfig {
	merged := profile
	if merged.NetworkName == "" {
		merged.NetworkName = active
	}
	if merged.QREncryptionKey == "" {
		merged.QREncryptionKey = fallback.QREncryptionKey
	}
	if merged.MaxGasPrice == 0 {
		merged.MaxGasPrice = fallback.MaxGasPrice
	}
	if merged.ConfirmationBlocks == 0 {
		merged.ConfirmationBlocks = fallback.ConfirmationBlocks
	}
	if merged.ConfirmationInterval == 0 {
		merged.ConfirmationInterval = fallback.ConfirmationInterval
	}
	if merged.BatchSize == 0 {
		merged.BatchSize = fallback.BatchSize
	}
	if merged.BatchTimeout == 0 {
		merged.BatchTimeout = fallback.BatchTimeout
	}
	return merged
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
	v.SetDefault("blockchain.active_network", "local")

	v.SetDefault("auth.jwt_expiry", "24h")
	v.SetDefault("auth.refresh_expiry", "168h") // 7 days

	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")

	v.SetDefault("worker.batch_size", 10)
	v.SetDefault("worker.max_transactions_per_session", 10)
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

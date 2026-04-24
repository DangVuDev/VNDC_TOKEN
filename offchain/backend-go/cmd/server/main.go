// cmd/server/main.go -- Application entry point.
// Wires all layers (MongoDB, Redis, Ethereum, services, HTTP) together,
// starts the server, and performs graceful shutdown.
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/vndc/backend/docs"
	mongoadapters "github.com/vndc/backend/internal/adapters/mongodb"
	authapp "github.com/vndc/backend/internal/application/auth"
	tokenapp "github.com/vndc/backend/internal/application/token"
	userapp "github.com/vndc/backend/internal/application/user"
	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/cache/redis"
	"github.com/vndc/backend/pkg/config"
	"github.com/vndc/backend/pkg/database/mongodb"
	apperr "github.com/vndc/backend/pkg/errors"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
)

func main() {
	// 1. Load configuration
	cfgPath := envOrDefault("CONFIG_PATH", "config/config.yaml")
	cfg, err := config.Load(cfgPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: load config: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize logger
	log := logger.Must(logger.Config{
		Level:       cfg.Log.Level,
		Format:      cfg.Log.Format,
		Development: cfg.Log.Development,
	})
	defer log.Sync() //nolint:errcheck

	log.Info("starting VNDC backend",
		logger.String("env", cfg.App.Environment),
		logger.String("version", cfg.App.Version),
	)

	// 3. Root context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ctx = log.WithContext(ctx)

	// 4. Connect MongoDB
	mongoClient, err := mongodb.NewClient(ctx, mongodb.ClientConfig{
		URI:             cfg.Database.URI,
		Database:        cfg.Database.Name,
		MaxPoolSize:     cfg.Database.MaxPoolSize,
		MinPoolSize:     cfg.Database.MinPoolSize,
		MaxConnIdleTime: cfg.Database.MaxConnIdleTime,
		ConnectTimeout:  cfg.Database.ConnectTimeout,
	})
	if err != nil {
		log.Fatal("MongoDB connection failed", logger.Err(err))
	}
	defer func() {
		if err := mongoClient.Disconnect(context.Background()); err != nil {
			log.Error("MongoDB disconnect error", logger.Err(err))
		}
	}()
	log.Info("MongoDB connected")

	// 5. Connect Redis
	redisClient, err := redis.NewClient(ctx, redis.ClientConfig{
		Addr:         cfg.Cache.Addr,
		Password:     cfg.Cache.Password,
		DB:           cfg.Cache.DB,
		PoolSize:     cfg.Cache.PoolSize,
		MinIdleConns: cfg.Cache.MinIdleConns,
		DialTimeout:  cfg.Cache.DialTimeout,
		ReadTimeout:  cfg.Cache.ReadTimeout,
		WriteTimeout: cfg.Cache.WriteTimeout,
		MaxRetries:   cfg.Cache.MaxRetries,
		KeyPrefix:    cfg.Cache.KeyPrefix,
	})
	if err != nil {
		log.Fatal("Redis connection failed", logger.Err(err))
	}
	defer redisClient.Close()
	log.Info("Redis connected")

	// 6. Connect Ethereum RPC
	ethClient, err := blockchain.NewClient(ctx, blockchain.ClientConfig{
		RPCURL:               cfg.Blockchain.RPCURL,
		WSURL:                cfg.Blockchain.WSURL,
		ChainID:              cfg.Blockchain.ChainID,
		ConfirmationBlocks:   cfg.Blockchain.ConfirmationBlocks,
		ConfirmationInterval: cfg.Blockchain.ConfirmationInterval,
	}, log)
	if err != nil {
		log.Fatal("Ethereum client connection failed", logger.Err(err))
	}
	defer ethClient.Close()
	log.Info("Ethereum client connected", logger.String("chain_id", ethClient.ChainID().String()))

	// 7. Build repositories
	userRepo := mongoadapters.NewUserRepository(mongoClient)
	sessionRepo := mongoadapters.NewSessionRepository(mongoClient)
	attemptRepo := mongoadapters.NewLoginAttemptRepository(mongoClient)
	auditRepo := mongoadapters.NewAuditLogRepository(mongoClient)
	txRepo := mongoadapters.NewTransactionRepository(mongoClient)

	// 8. Build cache adapters
	authCache := redis.NewAuthCache(redisClient, cfg.Cache.KeyPrefix)
	rawBalanceCache := redis.NewBalanceCache(redisClient, cfg.Cache.DefaultTTL)
	balanceCache := mongoadapters.NewBalanceCacheAdapter(rawBalanceCache)

	// 9. Build EIP-712 domain
	eip712Domain := blockchain.Domain{
		Name:    "VNDCToken",
		Version: "1",
		ChainID: ethClient.ChainID(),
	}
	if addr := cfg.Blockchain.TokenContractAddress; addr != "" {
		eip712Domain.VerifyingContract = common.HexToAddress(addr)
	}

	// 10. Build application services
	authSvc := authapp.NewService(
		userRepo, sessionRepo, attemptRepo, auditRepo, authCache,
		authapp.Config{
			JWTSecret:  cfg.Auth.JWTSecret,
			JWTIssuer:  cfg.App.Name,
			SIWEDomain: cfg.HTTP.Host,
		},
		log,
	)
	userSvc := userapp.NewService(userRepo, auditRepo, sessionRepo, log)
	tokenSvc := tokenapp.NewService(txRepo, userRepo, balanceCache, nil, eip712Domain, log)

	// 11. Build Gin router
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(
		middleware.Recovery(log),
		middleware.Logger(log),
		middleware.CORS(middleware.DefaultCORSConfig()),
		middleware.RateLimit(100, 200),
	)

	blacklistChecker := middleware.BlacklistChecker(authSvc.IsBlacklisted)

	// Swagger UI (disabled in production)
	if !cfg.IsProduction() {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	// Health endpoints (unauthenticated)
	router.GET("/health", func(c *gin.Context) {
		mongoErr := mongoClient.Health(c.Request.Context())
		redisErr := redisClient.Health(c.Request.Context())
		ethErr := ethClient.Health(c.Request.Context())

		healthy := mongoErr == nil && redisErr == nil && ethErr == nil
		status := http.StatusOK
		if !healthy {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{
			"healthy": healthy,
			"status": gin.H{
				"mongodb":  healthStatus(mongoErr),
				"redis":    healthStatus(redisErr),
				"ethereum": healthStatus(ethErr),
			},
		})
	})
	router.GET("/ready", func(c *gin.Context) {
		apihttp.OK(c, &gin.H{"ready": true})
	})

	// API v1
	v1 := router.Group("/v1")
	authapp.NewHandler(authSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker)
	userapp.NewHandler(userSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker)
	tokenapp.NewHandler(tokenSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker)

	log.Info("routes registered",
		logger.String("auth", "/v1/auth/*"),
		logger.String("users", "/v1/users/*"),
		logger.String("tokens", "/v1/tokens/*"),
	)

	// 12. Start HTTP server
	srv := &http.Server{
		Addr:         cfg.HTTP.Addr(),
		Handler:      router,
		ReadTimeout:  cfg.HTTP.ReadTimeout,
		WriteTimeout: cfg.HTTP.WriteTimeout,
		IdleTimeout:  cfg.HTTP.IdleTimeout,
	}
	go func() {
		log.Info("HTTP server listening", logger.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("HTTP server error", logger.Err(err))
		}
	}()

	// 13. Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	log.Info("shutdown signal received", logger.String("signal", sig.String()))
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("HTTP server shutdown error", logger.Err(err))
	}
	log.Info("server stopped gracefully")
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func healthStatus(err error) string {
	if err == nil {
		return "ok"
	}
	return "error: " + apperr.New(apperr.ErrCodeInternal, err.Error()).Error()
}

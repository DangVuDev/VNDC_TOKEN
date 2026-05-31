package main

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	adminapp "github.com/vndc/backend/internal/application/admin"
	authapp "github.com/vndc/backend/internal/application/auth"
	campaignapp "github.com/vndc/backend/internal/application/campaign"
	daoapp "github.com/vndc/backend/internal/application/dao"
	eventapp "github.com/vndc/backend/internal/application/event"
	fundapp "github.com/vndc/backend/internal/application/fundraising"
	marketapp "github.com/vndc/backend/internal/application/marketplace"
	notificationapp "github.com/vndc/backend/internal/application/notification"
	taskapp "github.com/vndc/backend/internal/application/task"
	ticketapp "github.com/vndc/backend/internal/application/ticketing"
	tokenapp "github.com/vndc/backend/internal/application/token"
	transactionapp "github.com/vndc/backend/internal/application/transaction"
	userapp "github.com/vndc/backend/internal/application/user"
	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/cache/redis"
	"github.com/vndc/backend/pkg/config"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
)

type routeServices struct {
	authSvc         *authapp.Service
	userSvc         *userapp.Service
	notificationSvc *notificationapp.Service
	tokenSvc        *tokenapp.Service
	txSvc           *transactionapp.Service
	fundSvc         *fundapp.Service
	marketSvc       *marketapp.Service
	ticketSvc       *ticketapp.Service
	daoSvc          *daoapp.Service
	taskSvc         *taskapp.Service
	campaignSvc     *campaignapp.Service
	eventSvc        *eventapp.Service
	activityHandler *taskapp.ActivityHandler
}

func buildRouter(
	cfg *config.Config,
	log logger.Logger,
	mongoClient interface {
		Health(ctx context.Context) error
	},
	redisClient *redis.Client,
	ethClient *blockchain.Client,
	repos repositories,
	svcs routeServices,
) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()

	corsConfig := middleware.DefaultCORSConfig()
	if cfg.IsProduction() {
		corsConfig.AllowOrigins = []string{"https://app.vndc.io"}
	} else {
		corsConfig.AllowOrigins = []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"http://localhost:5174",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:5173",
			"http://127.0.0.1:5174",
		}
	}

	router.Use(
		middleware.Recovery(log),
		middleware.Logger(log),
		middleware.CORS(corsConfig),
		middleware.SecurityHeaders(),
		middleware.RateLimit(100, 200),
	)

	blacklistChecker := middleware.BlacklistChecker(svcs.authSvc.IsBlacklisted)

	if !cfg.IsProduction() {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	router.GET("/health", func(c *gin.Context) {
		mongoErr := mongoClient.Health(c.Request.Context())
		var redisErr error
		if redisClient != nil {
			redisErr = redisClient.Health(c.Request.Context())
		}
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

	v1 := router.Group("/v1")
	authapp.NewHandler(svcs.authSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker)
	userapp.NewHandler(svcs.userSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	notificationapp.NewHandler(svcs.notificationSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker)
	tokenapp.NewHandler(svcs.tokenSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	transactionapp.NewHandler(svcs.txSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	fundapp.NewHandler(svcs.fundSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	marketapp.NewHandler(svcs.marketSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	ticketapp.NewHandler(svcs.ticketSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	daoapp.NewHandler(svcs.daoSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	taskapp.NewHandler(svcs.taskSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	campaignapp.NewHandler(svcs.campaignSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	eventapp.NewHandler(svcs.eventSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)
	svcs.activityHandler.RegisterActivityRoutes(v1, cfg.Auth.JWTSecret, repos.userRepo)

	adminSvc := adminapp.NewService(
		repos.userRepo,
		repos.txRepo,
		repos.kycSubmitRepo,
		repos.marketListingRepo,
		repos.daoRepo,
		repos.daoProposalRepo,
		repos.campaignRepo,
		repos.ticketProductRepo,
		repos.taskRepo,
		repos.activityRepo,
		log,
	)
	adminapp.NewHandler(adminSvc, log).RegisterRoutes(v1, cfg.Auth.JWTSecret, blacklistChecker, repos.userRepo)

	log.Info("routes registered",
		logger.String("auth", "/v1/auth/*"),
		logger.String("users", "/v1/users/*"),
		logger.String("tokens", "/v1/tokens/*"),
		logger.String("transactions", "/v1/transactions/*"),
		logger.String("funds", "/v1/funds/*"),
		logger.String("marketplace", "/v1/marketplace/*"),
		logger.String("tickets", "/v1/tickets/*"),
		logger.String("dao", "/v1/dao/*"),
		logger.String("balance", "/v1/balance/*"),
		logger.String("tasks", "/v1/tasks/*"),
		logger.String("activities", "/v1/activities/*"),
		logger.String("admin", "/v1/admin/*"),
	)

	return router
}

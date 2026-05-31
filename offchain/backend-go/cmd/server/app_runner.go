package main

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/vndc/backend/docs"
	mongoadapters "github.com/vndc/backend/internal/adapters/mongodb"
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
	"github.com/vndc/backend/pkg/cache/redis"
	"github.com/vndc/backend/pkg/config"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

func runApp() {
	cfgPath := envOrDefault("CONFIG_PATH", "config/config.yaml")
	cfg, err := config.Load(cfgPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: load config: %v\n", err)
		os.Exit(1)
	}

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

	ctx, cancel := createRootContext(log)
	defer cancel()

	mongoClient, err := connectMongo(ctx, cfg)
	if err != nil {
		log.Fatal("MongoDB connection failed", logger.Err(err))
	}
	defer func() {
		if err := mongoClient.Disconnect(context.Background()); err != nil {
			log.Error("MongoDB disconnect error", logger.Err(err))
		}
	}()
	log.Info("MongoDB connected")

	redisClient, err := connectRedis(ctx, cfg)
	if err != nil {
		log.Warn("Redis connection failed - continuing without cache", logger.Err(err))
		redisClient = nil
	} else {
		defer redisClient.Close()
		log.Info("Redis connected")
	}

	ethClient, err := connectEthereum(ctx, cfg, log)
	if err != nil {
		log.Fatal("Ethereum client connection failed", logger.Err(err))
	}
	defer ethClient.Close()
	log.Info("Ethereum client connected", logger.String("chain_id", ethClient.ChainID().String()))

	repos := buildRepositories(mongoClient)

	authCache := redis.NewAuthCache(redisClient, cfg.Cache.KeyPrefix)
	rawBalanceCache := redis.NewBalanceCache(redisClient, cfg.Cache.DefaultTTL)
	balanceCache := mongoadapters.NewBalanceCacheAdapter(rawBalanceCache)

	eip712Domain := buildEIP712Domain(cfg, ethClient.ChainID())
	tokenContractPort := initTokenContractAdapter(ethClient, cfg, log)
	erc721CollectionPort := initERC721CollectionAdapter(ethClient, cfg, log)

	authSvc := authapp.NewService(
		repos.userRepo, repos.sessionRepo, repos.attemptRepo, repos.auditRepo, authCache,
		authapp.Config{
			JWTSecret: cfg.Auth.JWTSecret,
			JWTIssuer: cfg.App.Name,
			SIWEDomain: func() string {
				if cfg.Auth.SIWEDomain != "" {
					return cfg.Auth.SIWEDomain
				}
				return "localhost"
			}(),
		},
		log,
	)
	userSvc := userapp.NewService(repos.userRepo, repos.auditRepo, repos.sessionRepo, repos.kycSubmitRepo, log)
	notificationSvc := notificationapp.NewService(repos.notificationRepo, log)
	tokenSvc := tokenapp.NewService(repos.txRepo, repos.userRepo, balanceCache, tokenContractPort, eip712Domain, log)
	txSvc := transactionapp.NewService(repos.txRepo, repos.batchRepo, repos.userRepo, balanceCache, tokenContractPort, eip712Domain, log)
	marketSvc := marketapp.NewService(repos.marketListingRepo, repos.marketPurchaseRepo, repos.nftRepo, repos.userRepo, nil, erc721CollectionPort, txSvc, cfg.Blockchain.NFTContractAddress, cfg.Blockchain.TokenContractAddress, cfg.Blockchain.RelayerAddress, log)
	ticketSvc := ticketapp.NewService(repos.ticketProductRepo, repos.ticketPurchaseRepo, repos.ticketScanLogRepo, txSvc, cfg.Blockchain.TokenContractAddress, log)

	marketAdapter := initMarketplaceAdapter(ethClient, cfg, log)
	if marketAdapter != nil {
		marketSvc = marketapp.NewService(repos.marketListingRepo, repos.marketPurchaseRepo, repos.nftRepo, repos.userRepo, marketAdapter, erc721CollectionPort, txSvc, cfg.Blockchain.NFTContractAddress, cfg.Blockchain.TokenContractAddress, cfg.Blockchain.RelayerAddress, log)
	}

	daoAdapter := initDAOAdapter(ethClient, cfg, log)

	var daoSvc *daoapp.Service
	if daoAdapter != nil {
		daoSvc = daoapp.NewService(repos.daoRepo, repos.daoProposalRepo, repos.daoVoteRepo, daoAdapter, log, repos.nftRepo, balanceCache, tokenContractPort, cfg.Blockchain.TokenContractAddress)
	} else {
		daoSvc = daoapp.NewService(repos.daoRepo, repos.daoProposalRepo, repos.daoVoteRepo, nil, log, repos.nftRepo, balanceCache, tokenContractPort, cfg.Blockchain.TokenContractAddress)
	}

	fundingAdapter := initFundingAdapter(ethClient, cfg, log)

	var fundSvc *fundapp.Service
	if fundingAdapter != nil {
		fundSvc = fundapp.NewService(repos.fundActivityRepo, repos.fundLedgerRepo, fundingAdapter, txSvc, log)
	} else {
		fundSvc = fundapp.NewService(repos.fundActivityRepo, repos.fundLedgerRepo, nil, txSvc, log)
	}

	taskSigner := initTaskSigner(cfg, ethClient.ChainID(), log)
	taskManagerAdapter := initTaskManagerAdapter(ethClient, cfg, log)

	taskSvc := taskapp.NewService(repos.taskRepo, repos.claimRepo, tokenContractPort, eip712Domain, log,
		repos.proofCodeRepo, repos.progressRepo, repos.userRepo, taskSigner)

	campaignSvc := campaignapp.NewService(repos.campaignRepo, repos.contributionRepo, balanceCache, txSvc, log)

	activitySvc := taskapp.NewActivityService(repos.activityRepo, repos.userRepo, log)
	rewardRateWeiPerPoint, _ := new(big.Int).SetString("1000000000000000000", 10)
	activityRecordSvc := taskapp.NewActivityRecordService(
		repos.activityRepo,
		repos.activityRecordRepo,
		repos.rewardPendingRepo,
		repos.userRepo,
		rewardRateWeiPerPoint,
		log,
	)
	enrollmentSvc := taskapp.NewActivityEnrollmentService(
		repos.activityRepo,
		repos.enrollmentRepo,
		repos.activityRecordRepo,
		repos.rewardPendingRepo,
		repos.userRepo,
		rewardRateWeiPerPoint,
		log,
	)
	learningSubmitSvc := taskapp.NewLearningSubmissionService(
		repos.activityRepo,
		repos.activityRecordRepo,
		repos.learningSubmissionRepo,
		repos.rewardPendingRepo,
		repos.userRepo,
		rewardRateWeiPerPoint,
		log,
	)
	activityHandler := taskapp.NewActivityHandler(activitySvc, activityRecordSvc, enrollmentSvc, learningSubmitSvc, log)

	qrSecret := cfg.Blockchain.QREncryptionKey
	if qrSecret == "" {
		qrSecret = cfg.Auth.JWTSecret
	}
	eventSvc := eventapp.NewService(repos.evtRepo, repos.ticketEvtRepo, balanceCache, txSvc, qrSecret, cfg.Blockchain.TokenContractAddress, log)

	startBackgroundWorkers(workerDeps{
		ctx:                 ctx,
		cfg:                 cfg,
		log:                 log,
		mongoClient:         mongoClient,
		txRepo:              repos.txRepo,
		batchRepo:           repos.batchRepo,
		balanceCache:        balanceCache,
		tokenContractPort:   tokenContractPort,
		fundingAdapter:      fundingAdapter,
		marketAdapter:       marketAdapter,
		marketListingRepo:   repos.marketListingRepo,
		marketPurchaseRepo:  repos.marketPurchaseRepo,
		ticketProductRepo:   repos.ticketProductRepo,
		ticketPurchaseRepo:  repos.ticketPurchaseRepo,
		fundSync:            fundSvc,
		taskSvc:             taskSvc,
		campaignRepo:        repos.campaignRepo,
		contributionRepo:    repos.contributionRepo,
		txSvc:               txSvc,
		daoProposalRepo:     repos.daoProposalRepo,
		daoVoteRepo:         repos.daoVoteRepo,
		userRepo:            repos.userRepo,
		daoAdapter:          daoAdapter,
		claimRepo:           repos.claimRepo,
		taskRepo:            repos.taskRepo,
		taskManagerAdapter:  taskManagerAdapter,
		rewardPendingRepo:   repos.rewardPendingRepo,
		rewardProcessedRepo: repos.rewardProcessedRepo,
		activityRecordRepo:  repos.activityRecordRepo,
	})

	router := buildRouter(cfg, log, mongoClient, redisClient, ethClient, repos, routeServices{
		authSvc:         authSvc,
		userSvc:         userSvc,
		notificationSvc: notificationSvc,
		tokenSvc:        tokenSvc,
		txSvc:           txSvc,
		fundSvc:         fundSvc,
		marketSvc:       marketSvc,
		ticketSvc:       ticketSvc,
		daoSvc:          daoSvc,
		taskSvc:         taskSvc,
		campaignSvc:     campaignSvc,
		eventSvc:        eventSvc,
		activityHandler: activityHandler,
	})

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

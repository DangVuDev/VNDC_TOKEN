package main

import (
	"context"
	"time"

	transactionapp "github.com/vndc/backend/internal/application/transaction"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/internal/workers"
	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/config"
	"github.com/vndc/backend/pkg/database/mongodb"
	"github.com/vndc/backend/pkg/logger"
)

type transferSubmitter interface {
	SubmitTransfer(ctx context.Context, req *transactionapp.SubmitTransferRequest) (*domain.Transaction, error)
}

type workerDeps struct {
	ctx                 context.Context
	cfg                 *config.Config
	log                 logger.Logger
	mongoClient         *mongodb.Client
	txRepo              ports.TransactionRepository
	batchRepo           ports.BatchRepository
	balanceCache        ports.BalanceCachePort
	tokenContractPort   ports.TokenContractPort
	fundingAdapter      ports.FundingContractPort
	marketAdapter       ports.MarketplaceContractPort
	marketListingRepo   ports.MarketplaceListingRepository
	marketPurchaseRepo  ports.MarketplacePurchaseRepository
	ticketProductRepo   ports.ServiceTicketProductRepository
	ticketPurchaseRepo  ports.ServiceTicketPurchaseRepository
	fundSync            workers.FundContributionSync
	taskSvc             workers.SessionExpirer
	campaignRepo        ports.FundraisingCampaignRepository
	contributionRepo    ports.FundraisingContributionRepository
	txSvc               transferSubmitter
	daoProposalRepo     ports.DAOProposalRepository
	daoVoteRepo         ports.DAOVoteRepository
	userRepo            ports.UserRepository
	daoAdapter          *blockchain.DAOManagerAdapter
	claimRepo           ports.StudentClaimRepository
	taskRepo            ports.TaskRepository
	taskManagerAdapter  ports.TaskManagerContractPort
	rewardPendingRepo   ports.RewardRepository
	rewardProcessedRepo ports.RewardProcessedRepository
	activityRecordRepo  ports.ActivityRecordRepository
}

func startBackgroundWorkers(d workerDeps) {
	batchWorkerCfg := workers.BatchWorkerConfig{
		BatchSize:    d.cfg.Worker.BatchSize,
		TickInterval: d.cfg.Worker.BatchTimeout,
		MaxRetries:   d.cfg.Worker.RetryMax,
		RetryDelay:   d.cfg.Worker.RetryDelay,
	}
	if batchWorkerCfg.BatchSize == 0 {
		batchWorkerCfg.BatchSize = 10
	}
	if batchWorkerCfg.TickInterval == 0 {
		batchWorkerCfg.TickInterval = 10 * time.Second
	}
	if d.tokenContractPort != nil {
		batchWorker := workers.NewBatchWorker(
			d.txRepo,
			d.batchRepo,
			d.balanceCache,
			d.tokenContractPort,
			d.fundingAdapter,
			d.marketAdapter,
			d.marketListingRepo,
			d.marketPurchaseRepo,
			d.ticketProductRepo,
			d.ticketPurchaseRepo,
			d.fundSync,
			batchWorkerCfg,
			d.log,
		)

		ttCfg := workers.TokenTransferWorkerConfig{
			PendingThreshold:       d.cfg.Worker.PendingThreshold,
			TriggerInterval:        d.cfg.Worker.TriggerInterval,
			ChangeStreamRetryDelay: d.cfg.Worker.ChangeStreamRetryDelay,
		}
		if ttCfg.PendingThreshold == 0 {
			ttCfg.PendingThreshold = 5
		}
		if ttCfg.TriggerInterval == 0 {
			ttCfg.TriggerInterval = 30 * time.Second
		}
		if ttCfg.ChangeStreamRetryDelay == 0 {
			ttCfg.ChangeStreamRetryDelay = 5 * time.Second
		}
		txCollection := d.mongoClient.Collection("transactions")
		ttWorker := workers.NewTokenTransferWorker(txCollection, d.txRepo, ttCfg, d.log)
		batchWorker.SetTriggerChan(ttWorker.TriggerChan())

		go ttWorker.Run(d.ctx)
		go batchWorker.Run(d.ctx)
		d.log.Info("token transfer worker started (change stream / polling)")
		d.log.Info("batch settlement worker started")
	} else {
		d.log.Warn("batch settlement worker disabled (no token contract adapter)")
	}

	sessionWorker := workers.NewSessionWorker(d.taskSvc, workers.DefaultSessionWorkerConfig(), d.log)
	go sessionWorker.Run(d.ctx)
	d.log.Info("session expiry worker started")

	campaignWorker := workers.NewCampaignWorker(d.campaignRepo, d.contributionRepo, d.txSvc, d.log)
	go campaignWorker.Run(d.ctx)
	d.log.Info("campaign worker started")

	daoWorker := workers.NewDAOWorker(d.daoProposalRepo, d.daoVoteRepo, d.userRepo, d.daoAdapter, d.log)
	go daoWorker.Run(d.ctx)
	d.log.Info("dao worker started")

	if d.taskManagerAdapter != nil {
		claimWorker := workers.NewClaimWorker(
			d.claimRepo, d.taskRepo, d.userRepo, d.txRepo, d.taskManagerAdapter,
			workers.DefaultClaimWorkerConfig(), d.log,
		)
		go claimWorker.Run(d.ctx)
		d.log.Info("claim settlement worker started")
	} else {
		d.log.Warn("claim settlement worker disabled (no task manager adapter)")
	}

	if d.taskManagerAdapter != nil {
		rewardProcessingWorker := workers.NewRewardProcessingWorker(
			d.rewardPendingRepo,
			d.rewardProcessedRepo,
			d.txRepo,
			d.taskManagerAdapter,
			d.activityRecordRepo,
			d.log,
		)
		rewardProcessingWorker.Start()
		d.log.Info("reward processing worker started (task manager mode)")
	} else {
		d.log.Warn("reward processing worker disabled (no task manager adapter)")
	}
}

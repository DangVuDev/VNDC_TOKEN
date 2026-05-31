package main

import (
	mongoadapters "github.com/vndc/backend/internal/adapters/mongodb"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database/mongodb"
)

type repositories struct {
	userRepo               ports.UserRepository
	sessionRepo            ports.SessionRepository
	attemptRepo            ports.LoginAttemptRepository
	auditRepo              ports.AuditLogRepository
	txRepo                 ports.TransactionRepository
	batchRepo              ports.BatchRepository
	taskRepo               ports.TaskRepository
	claimRepo              ports.StudentClaimRepository
	proofCodeRepo          ports.ProofCodeRepository
	progressRepo           ports.UserProgressRepository
	fundActivityRepo       ports.FundActivityRepository
	fundLedgerRepo         ports.FundLedgerRepository
	marketListingRepo      ports.MarketplaceListingRepository
	marketPurchaseRepo     ports.MarketplacePurchaseRepository
	ticketProductRepo      ports.ServiceTicketProductRepository
	ticketPurchaseRepo     ports.ServiceTicketPurchaseRepository
	ticketScanLogRepo      ports.ServiceTicketScanLogRepository
	daoRepo                ports.DAOOrganizationRepository
	daoProposalRepo        ports.DAOProposalRepository
	daoVoteRepo            ports.DAOVoteRepository
	campaignRepo           ports.FundraisingCampaignRepository
	contributionRepo       ports.FundraisingContributionRepository
	evtRepo                ports.EventRepository
	ticketEvtRepo          ports.EventTicketRepository
	nftRepo                ports.NFTRepository
	kycSubmitRepo          ports.KYCSubmissionRepository
	activityRepo           ports.ActivityRepository
	activityRecordRepo     ports.ActivityRecordRepository
	activityClaimRepo      ports.ActivityClaimRepository
	enrollmentRepo         ports.ActivityEnrollmentRepository
	learningSubmissionRepo ports.LearningSubmissionRepository
	rewardPendingRepo      ports.RewardRepository
	rewardProcessedRepo    ports.RewardProcessedRepository
	notificationRepo       ports.NotificationRepository
}

func buildRepositories(mongoClient *mongodb.Client) repositories {
	return repositories{
		userRepo:               mongoadapters.NewUserRepository(mongoClient),
		sessionRepo:            mongoadapters.NewSessionRepository(mongoClient),
		attemptRepo:            mongoadapters.NewLoginAttemptRepository(mongoClient),
		auditRepo:              mongoadapters.NewAuditLogRepository(mongoClient),
		txRepo:                 mongoadapters.NewTransactionRepository(mongoClient),
		batchRepo:              mongoadapters.NewBatchRepository(mongoClient),
		taskRepo:               mongoadapters.NewTaskRepository(mongoClient),
		claimRepo:              mongoadapters.NewStudentClaimRepository(mongoClient),
		proofCodeRepo:          mongoadapters.NewProofCodeRepository(mongoClient),
		progressRepo:           mongoadapters.NewUserProgressRepository(mongoClient),
		fundActivityRepo:       mongoadapters.NewFundActivityRepository(mongoClient),
		fundLedgerRepo:         mongoadapters.NewFundLedgerRepository(mongoClient),
		marketListingRepo:      mongoadapters.NewMarketplaceListingRepository(mongoClient),
		marketPurchaseRepo:     mongoadapters.NewMarketplacePurchaseRepository(mongoClient),
		ticketProductRepo:      mongoadapters.NewServiceTicketProductRepository(mongoClient),
		ticketPurchaseRepo:     mongoadapters.NewServiceTicketPurchaseRepository(mongoClient),
		ticketScanLogRepo:      mongoadapters.NewServiceTicketScanLogRepository(mongoClient),
		daoRepo:                mongoadapters.NewDAOOrganizationRepository(mongoClient),
		daoProposalRepo:        mongoadapters.NewDAOProposalRepository(mongoClient),
		daoVoteRepo:            mongoadapters.NewDAOVoteRepository(mongoClient),
		campaignRepo:           mongoadapters.NewFundraisingCampaignRepository(mongoClient),
		contributionRepo:       mongoadapters.NewFundraisingContributionRepository(mongoClient),
		evtRepo:                mongoadapters.NewEventRepository(mongoClient),
		ticketEvtRepo:          mongoadapters.NewEventTicketRepository(mongoClient),
		nftRepo:                mongoadapters.NewNFTRepository(mongoClient),
		kycSubmitRepo:          mongoadapters.NewKYCSubmissionRepository(mongoClient),
		activityRepo:           mongoadapters.NewActivityRepository(mongoClient),
		activityRecordRepo:     mongoadapters.NewActivityRecordRepository(mongoClient),
		activityClaimRepo:      mongoadapters.NewActivityClaimRepository(mongoClient),
		enrollmentRepo:         mongoadapters.NewActivityEnrollmentRepository(mongoClient),
		learningSubmissionRepo: mongoadapters.NewLearningSubmissionRepository(mongoClient),
		rewardPendingRepo:      mongoadapters.NewRewardPendingRepository(mongoClient),
		rewardProcessedRepo:    mongoadapters.NewRewardProcessedRepository(mongoClient),
		notificationRepo:       mongoadapters.NewNotificationRepository(mongoClient),
	}
}

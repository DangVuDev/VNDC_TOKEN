// Package workers contains background jobs.
// CampaignWorker resolves expired fundraising campaigns by either distributing successful proceeds or refunding failed contributions.
//
// Business rules (UC18/UC19):
//   - If total_contributed >= goal_amount → SUCCEEDED → distribute funds to creator.
//   - Otherwise → FAILED → refund all PENDING contributions to contributors.
package workers

import (
	"context"
	"math/big"
	"time"

	"github.com/google/uuid"

	transactionapp "github.com/vndc/backend/internal/application/transaction"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

const campaignWorkerInterval = 5 * time.Minute

type transferSubmitter interface {
	SubmitTransfer(ctx context.Context, req *transactionapp.SubmitTransferRequest) (*domain.Transaction, error)
}

// CampaignWorker periodically resolves campaigns whose funding window has ended.
// It is responsible for the operational transition from campaign state to either payout or refund workflows.
type CampaignWorker struct {
	campaignRepo     ports.FundraisingCampaignRepository
	contributionRepo ports.FundraisingContributionRepository
	transferSvc      transferSubmitter
	log              logger.Logger
}

// NewCampaignWorker constructs the campaign-resolution worker with campaign, contribution, and transfer dependencies.
func NewCampaignWorker(
	campaignRepo ports.FundraisingCampaignRepository,
	contributionRepo ports.FundraisingContributionRepository,
	transferSvc transferSubmitter,
	log logger.Logger,
) *CampaignWorker {
	return &CampaignWorker{
		campaignRepo:     campaignRepo,
		contributionRepo: contributionRepo,
		transferSvc:      transferSvc,
		log:              log.Named("campaign_worker"),
	}
}

// Run starts the campaign-resolution loop and blocks until context cancellation.
// Every tick it scans for expired active campaigns and resolves them independently.
func (w *CampaignWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(campaignWorkerInterval)
	defer ticker.Stop()
	w.log.Info("campaign worker started")
	for {
		select {
		case <-ctx.Done():
			w.log.Info("campaign worker stopped")
			return
		case <-ticker.C:
			w.process(ctx)
		}
	}
}

// process loads expired active campaigns and resolves each one without letting one failure stop the rest.
func (w *CampaignWorker) process(ctx context.Context) {
	campaigns, err := w.campaignRepo.FindExpiredActive(ctx)
	if err != nil {
		w.log.Error("campaign worker: find expired campaigns", logger.Err(err))
		return
	}
	for _, c := range campaigns {
		if err := w.resolveCampaign(ctx, c); err != nil {
			w.log.Error("campaign worker: resolve campaign failed",
				logger.String("campaign_id", c.ID),
				logger.Err(err),
			)
		}
	}
}

// resolveCampaign determines whether the campaign succeeded or failed and then launches the appropriate financial follow-up flow.
// Success triggers creator distribution; failure marks pending contributions refunded and attempts one refund transfer per contribution.
func (w *CampaignWorker) resolveCampaign(ctx context.Context, c *domain.FundraisingCampaign) error {
	goal, _ := new(big.Int).SetString(c.GoalAmount, 10)
	total, _ := new(big.Int).SetString(c.TotalContributed, 10)

	now := time.Now().UTC()

	if total.Cmp(goal) >= 0 {
		// SUCCEEDED: distribute to creator
		c.Status = domain.CampaignStatusSucceeded
		c.DistributedAt = &now
		if err := w.campaignRepo.Update(ctx, c); err != nil {
			return err
		}

		// Record distribution transaction
		_, err := w.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
			FromWallet:  "platform_escrow",
			ToWallet:    c.CreatorWallet,
			Amount:      c.TotalContributed,
			Nonce:       uuid.NewString(),
			Deadline:    now.Add(30 * time.Minute).Unix(),
			Signature:   "system",
			Type:        "CAMPAIGN_DISTRIBUTION",
			ContextType: "campaign",
			ContextID:   c.ID,
		})
		if err != nil {
			w.log.Error("campaign worker: distribute funds failed",
				logger.String("campaign_id", c.ID),
				logger.Err(err),
			)
			// Not a fatal error — campaign is already marked SUCCEEDED
		}

		w.log.Info("campaign succeeded", logger.String("campaign_id", c.ID))
		return nil
	}

	// FAILED: refund all pending contributions
	c.Status = domain.CampaignStatusFailed
	c.RefundedAt = &now
	if err := w.campaignRepo.Update(ctx, c); err != nil {
		return err
	}

	pending, err := w.contributionRepo.FindPendingByCampaign(ctx, c.ID)
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeInternal, "find pending contributions", err)
	}

	for _, contrib := range pending {
		// Mark contribution as refunded
		if err := w.contributionRepo.UpdateStatus(ctx, contrib.ID, domain.ContributionStatusRefunded); err != nil {
			w.log.Error("campaign worker: mark contribution refunded",
				logger.String("contribution_id", contrib.ID),
				logger.Err(err),
			)
			continue
		}
		// Issue refund transfer
		_, txErr := w.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
			FromWallet:  "platform_escrow",
			ToWallet:    contrib.ContributorWallet,
			Amount:      contrib.Amount,
			Nonce:       uuid.NewString(),
			Deadline:    now.Add(30 * time.Minute).Unix(),
			Signature:   "system",
			Type:        "CAMPAIGN_REFUND",
			ContextType: "campaign",
			ContextID:   c.ID,
			ContextRef:  contrib.ID,
		})
		if txErr != nil {
			w.log.Error("campaign worker: refund transfer failed",
				logger.String("contribution_id", contrib.ID),
				logger.Err(txErr),
			)
		}
	}

	w.log.Info("campaign failed and refunded",
		logger.String("campaign_id", c.ID),
		logger.Int("refunded_count", len(pending)),
	)
	return nil
}

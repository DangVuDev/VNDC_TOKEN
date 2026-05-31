// Package campaign implements the crowdfunding campaign module (UC18/UC19).
// Campaigns have a goal amount, a deadline, and automatic refund when the goal is not met.
package campaign

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"

	transactionapp "github.com/vndc/backend/internal/application/transaction"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

const (
	maxGoalAmount          = "1000000000000000000000000" // 1 000 000 VNDC (18 decimals)
	maxContributionPerUser = "100000000000000000000000"  // 100 000 VNDC
	minDurationDays        = 1
	maxDurationDays        = 90
)

type transferSubmitter interface {
	SubmitTransfer(ctx context.Context, req *transactionapp.SubmitTransferRequest) (*domain.Transaction, error)
}

// Service orchestrates crowdfunding campaigns and contribution flows.
// It coordinates campaign lifecycle rules, balance reservation, and contribution persistence.
type Service struct {
	campaignRepo     ports.FundraisingCampaignRepository
	contributionRepo ports.FundraisingContributionRepository
	balanceCache     ports.BalanceCachePort
	transferSvc      transferSubmitter
	log              logger.Logger
}

// NewService constructs the campaign application service with repositories, balance cache, and transfer dependencies.
// This keeps campaign orchestration isolated from concrete infrastructure implementations.
func NewService(
	campaignRepo ports.FundraisingCampaignRepository,
	contributionRepo ports.FundraisingContributionRepository,
	balanceCache ports.BalanceCachePort,
	transferSvc transferSubmitter,
	log logger.Logger,
) *Service {
	return &Service{
		campaignRepo:     campaignRepo,
		contributionRepo: contributionRepo,
		balanceCache:     balanceCache,
		transferSvc:      transferSvc,
		log:              log.Named("campaign_service"),
	}
}

// CreateCampaign creates a new crowdfunding campaign with validated metadata, duration, and goal constraints.
// Role-based authorization is expected to be enforced before or around this service boundary.
func (s *Service) CreateCampaign(ctx context.Context, req *CreateCampaignRequest, creatorWallet string) (*domain.FundraisingCampaign, error) {
	creator := normalizeWallet(creatorWallet)
	if creator == "" {
		return nil, apperr.ErrForbidden
	}

	// Validate title & description lengths
	title := strings.TrimSpace(req.Title)
	desc := strings.TrimSpace(req.Description)
	if len(title) < 5 || len(title) > 200 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "title must be 5-200 characters")
	}
	if len(desc) < 20 || len(desc) > 1000 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "description must be 20-1000 characters")
	}

	// Validate goal amount
	goalWei, ok := new(big.Int).SetString(strings.TrimSpace(req.GoalAmount), 10)
	if !ok || goalWei.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "goal_amount must be a positive decimal string in wei")
	}
	maxGoal, _ := new(big.Int).SetString(maxGoalAmount, 10)
	if goalWei.Cmp(maxGoal) > 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "goal_amount exceeds maximum allowed (1 000 000 VNDC)")
	}

	// Validate duration
	if req.DurationDays < minDurationDays || req.DurationDays > maxDurationDays {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "duration_days must be between 1 and 90")
	}

	now := time.Now().UTC()
	deadline := now.Add(time.Duration(req.DurationDays) * 24 * time.Hour)

	campaign := &domain.FundraisingCampaign{
		BaseEntity:       domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		CreatorWallet:    creator,
		Title:            title,
		Description:      desc,
		GoalAmount:       goalWei.String(),
		TotalContributed: "0",
		Deadline:         deadline,
		Status:           domain.CampaignStatusActive,
	}

	if err := s.campaignRepo.Create(ctx, campaign); err != nil {
		return nil, err
	}
	return campaign, nil
}

// GetCampaign fetches a single campaign by ID.
// This is the primary detail lookup for campaign pages and contribution flows.
func (s *Service) GetCampaign(ctx context.Context, id string) (*domain.FundraisingCampaign, error) {
	return s.campaignRepo.FindByID(ctx, id)
}

// ListCampaigns returns a paginated list of campaigns with optional status filtering.
// It backs public campaign discovery and administrative campaign management views.
func (s *Service) ListCampaigns(ctx context.Context, filter *ListCampaignsQuery, pageReq pagination.Request) ([]*domain.FundraisingCampaign, int64, error) {
	opts := []database.QueryOption{
		database.WithPagination(pageReq.Page, pageReq.PageSize),
		database.WithSort("created_at", database.SortDesc),
	}
	if filter != nil && filter.Status != "" {
		opts = append(opts, database.WithEq("status", filter.Status))
	}
	return s.campaignRepo.Find(ctx, opts...)
}

// Contribute records a token contribution to an active campaign.
// It validates campaign state, reserves balance, submits the transfer, and updates campaign aggregates in one flow.
func (s *Service) Contribute(ctx context.Context, campaignID string, contributorWallet string, req *ContributeRequest) (*ContributeResponse, error) {
	contributor := normalizeWallet(contributorWallet)
	if contributor == "" {
		return nil, apperr.ErrForbidden
	}

	// Fetch and validate campaign
	campaign, err := s.campaignRepo.FindByID(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	if campaign.Status != domain.CampaignStatusActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "campaign is not accepting contributions")
	}
	if time.Now().UTC().After(campaign.Deadline) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "campaign deadline has passed")
	}

	// Validate contribution amount
	amountWei, ok := new(big.Int).SetString(strings.TrimSpace(req.Amount), 10)
	if !ok || amountWei.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "amount must be a positive decimal string in wei")
	}
	maxContrib, _ := new(big.Int).SetString(maxContributionPerUser, 10)
	if amountWei.Cmp(maxContrib) > 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "contribution exceeds per-user maximum (100 000 VNDC)")
	}

	// Check contributor balance (dual-layer: onChain + pending)
	if s.balanceCache != nil {
		ok, err := s.balanceCache.CheckAndReserve(ctx, contributor, amountWei.String())
		if err != nil || !ok {
			return nil, apperr.New(apperr.ErrCodeInsufficientBalance, "insufficient balance")
		}
	}

	// Submit the off-chain EIP-712 signed transfer to campaign creator
	_, txErr := s.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
		FromWallet:  contributor,
		ToWallet:    campaign.CreatorWallet,
		Amount:      amountWei.String(),
		Nonce:       req.Nonce,
		Deadline:    req.Deadline,
		Signature:   req.Signature,
		Type:        string(domain.TxTypeFundContribution),
		ContextType: "fundraising_campaign",
		ContextID:   campaign.ID,
	})
	if txErr != nil {
		// Rollback the reserved balance
		if s.balanceCache != nil {
			_ = s.balanceCache.Rollback(ctx, contributor, amountWei.String())
		}
		return nil, txErr
	}

	// Record the contribution
	now := time.Now().UTC()
	contribution := &domain.FundraisingContribution{
		BaseEntity:        domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		CampaignID:        campaign.ID,
		ContributorWallet: contributor,
		Amount:            amountWei.String(),
		Status:            domain.ContributionStatusPending,
	}
	if err := s.contributionRepo.Create(ctx, contribution); err != nil {
		return nil, err
	}

	// Update campaign total
	total, _ := new(big.Int).SetString(campaign.TotalContributed, 10)
	total.Add(total, amountWei)
	campaign.TotalContributed = total.String()

	// Check if goal reached
	goal, _ := new(big.Int).SetString(campaign.GoalAmount, 10)
	if total.Cmp(goal) >= 0 && campaign.Status == domain.CampaignStatusActive {
		campaign.Status = domain.CampaignStatusGoalReached
	}
	if err := s.campaignRepo.Update(ctx, campaign); err != nil {
		return nil, err
	}

	percent := percentageComplete(campaign.TotalContributed, campaign.GoalAmount)
	return &ContributeResponse{
		ContributionID:   contribution.ID,
		Amount:           contribution.Amount,
		TotalContributed: campaign.TotalContributed,
		GoalAmount:       campaign.GoalAmount,
		PercentComplete:  percent,
		Message:          "Contribution recorded successfully",
	}, nil
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

// normalizeWallet trims and canonicalizes the wallet string used by campaign flows, rejecting empty and zero-address values.
func normalizeWallet(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" || addr == "0x0000000000000000000000000000000000000000" {
		return ""
	}
	return strings.ToLower(addr)
}

// percentageComplete computes campaign completion percentage from decimal-string totals.
// It is used for response shaping and lightweight progress summaries.
func percentageComplete(totalContributed, goalAmount string) float64 {
	total, ok1 := new(big.Float).SetString(totalContributed)
	goal, ok2 := new(big.Float).SetString(goalAmount)
	if !ok1 || !ok2 || goal.Sign() == 0 {
		return 0
	}
	pct, _ := new(big.Float).Quo(total, goal).Float64()
	return pct * 100
}

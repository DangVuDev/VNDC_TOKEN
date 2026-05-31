package fundraising

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
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
	potStatusDraft     uint8 = 0
	potStatusActive    uint8 = 1
	potStatusClosed    uint8 = 2
	potStatusCancelled uint8 = 3
)

type transferSubmitter interface {
	SubmitTransfer(ctx context.Context, req *transactionapp.SubmitTransferRequest) (*domain.Transaction, error)
}

// Service orchestrates fundraising activities, fund-ledger updates, and contribution submission flows.
// It coordinates off-chain activity records with optional on-chain funding-pot actions and transfer submission.
type Service struct {
	activityRepo ports.FundActivityRepository
	ledgerRepo   ports.FundLedgerRepository
	funding      ports.FundingContractPort
	transferSvc  transferSubmitter
	log          logger.Logger
}

// NewService constructs the fundraising application service with repository, contract, and transfer dependencies.
// This keeps pot administration and contribution orchestration decoupled from concrete adapters.
func NewService(
	activityRepo ports.FundActivityRepository,
	ledgerRepo ports.FundLedgerRepository,
	funding ports.FundingContractPort,
	transferSvc transferSubmitter,
	log logger.Logger,
) *Service {
	return &Service{
		activityRepo: activityRepo,
		ledgerRepo:   ledgerRepo,
		funding:      funding,
		transferSvc:  transferSvc,
		log:          log.Named("fundraising_service"),
	}
}

// CreateActivity creates a fundraising activity off-chain and, when available, mirrors it to the funding contract as an on-chain pot.
// The method validates core configuration, normalizes governance roles, and rolls back the off-chain record if on-chain creation fails.
func (s *Service) CreateActivity(ctx context.Context, req *CreateFundActivityRequest, actorWallet string) (*domain.FundActivity, error) {
	ownerWallet := normalizeWallet(actorWallet)
	if ownerWallet == "" {
		return nil, apperr.ErrForbidden
	}
	deputies, err := sanitizeDeputies(req.DeputyWallets, ownerWallet)
	if err != nil {
		return nil, err
	}
	if _, err := parsePositiveAmount(req.TargetAmount); err != nil {
		return nil, err
	}
	if req.EndsAt != nil && req.StartsAt != nil && req.EndsAt.Before(*req.StartsAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ends_at must be after starts_at")
	}

	now := time.Now().UTC()
	imageURL := strings.TrimSpace(req.ImageURI)
	if imageURL == "" {
		imageURL = strings.TrimSpace(req.ImageURL)
	}
	status := domain.FundActivityActive
	if req.StartsAt != nil && req.StartsAt.After(now) {
		status = domain.FundActivityDraft
	}

	activity := &domain.FundActivity{
		BaseEntity:       domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Title:            strings.TrimSpace(req.Title),
		Description:      strings.TrimSpace(req.Description),
		ImageURI:         imageURL,
		ImageURL:         imageURL,
		Category:         strings.ToUpper(strings.TrimSpace(req.Category)),
		OwnerWallet:      ownerWallet,
		DeputyWallets:    deputies,
		Status:           status,
		Currency:         defaultCurrency(req.Currency),
		TargetAmount:     req.TargetAmount,
		TotalRaised:      "0",
		TotalSpent:       "0",
		AvailableBalance: "0",
		StartsAt:         req.StartsAt,
		EndsAt:           req.EndsAt,
	}
	if s.funding != nil {
		activity.ContractAddress = s.funding.Address()
	}
	activity.OnchainPotID = toOnchainPotID(activity.ID)

	if err := s.activityRepo.Create(ctx, activity); err != nil {
		return nil, err
	}

	if s.funding != nil {
		startsAt := int64(0)
		endsAt := int64(0)
		if req.StartsAt != nil {
			startsAt = req.StartsAt.Unix()
		}
		if req.EndsAt != nil {
			endsAt = req.EndsAt.Unix()
		}
		txHash, err := s.funding.CreatePot(
			ctx,
			activity.OnchainPotID,
			ownerWallet,
			activity.Category,
			activity.Title,
			activity.TargetAmount,
			activity.DeputyWallets,
			startsAt,
			endsAt,
		)
		if err != nil {
			_ = s.activityRepo.Delete(ctx, activity.ID)
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "create onchain funding pot failed", err)
		}
		activity.OnchainInitTxHash = txHash
		if err := s.activityRepo.Update(ctx, activity); err != nil {
			return nil, err
		}
	}
	return activity, nil
}

// ListActivities returns paginated fundraising activities, with optional owner/member scoping and list filters.
// It supports both public browsing and member-specific dashboards through one shared query path.
func (s *Service) ListActivities(ctx context.Context, actorWallet string, filter *ListFundActivitiesQuery, pageReq pagination.Request) ([]*domain.FundActivity, int64, error) {
	opts := buildActivityListOptions(filter, pageReq)
	if filter != nil && filter.Mine {
		wallet := normalizeWallet(actorWallet)
		if wallet == "" {
			return nil, 0, apperr.ErrForbidden
		}
		return s.activityRepo.FindByMember(ctx, wallet, opts...)
	}
	if filter != nil && filter.OwnerWallet != "" {
		wallet := normalizeWallet(filter.OwnerWallet)
		if wallet != "" {
			return s.activityRepo.FindByMember(ctx, wallet, opts...)
		}
	}
	return s.activityRepo.Find(ctx, opts...)
}

// GetActivity returns one fundraising activity by ID.
// This is the basic detail lookup for activity pages and contribution orchestration.
func (s *Service) GetActivity(ctx context.Context, id string) (*domain.FundActivity, error) {
	return s.activityRepo.FindByID(ctx, id)
}

// UpdateActivity mutates owner-controlled fundraising activity metadata and operational settings.
// It preserves financial consistency by preventing target values from falling below already allocated funds.
func (s *Service) UpdateActivity(ctx context.Context, id, actorWallet string, req *UpdateFundActivityRequest) (*domain.FundActivity, error) {
	activity, err := s.requireOwner(ctx, id, actorWallet)
	if err != nil {
		return nil, err
	}

	if req.Title != nil {
		activity.Title = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		activity.Description = strings.TrimSpace(*req.Description)
	}
	if req.ImageURI != nil {
		value := strings.TrimSpace(*req.ImageURI)
		activity.ImageURI = value
		activity.ImageURL = value
	}
	if req.ImageURL != nil {
		value := strings.TrimSpace(*req.ImageURL)
		activity.ImageURI = value
		activity.ImageURL = value
	}
	if req.Category != nil {
		activity.Category = strings.ToUpper(strings.TrimSpace(*req.Category))
	}
	if req.TargetAmount != nil {
		newTarget, err := parsePositiveAmount(*req.TargetAmount)
		if err != nil {
			return nil, err
		}
		available, _ := new(big.Int).SetString(activity.AvailableBalance, 10)
		spent, _ := new(big.Int).SetString(activity.TotalSpent, 10)
		minimumTarget := new(big.Int).Add(available, spent)
		if newTarget.Cmp(minimumTarget) < 0 {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "target_amount cannot be lower than already allocated funds")
		}
		activity.TargetAmount = *req.TargetAmount
	}
	if req.Currency != nil {
		activity.Currency = defaultCurrency(*req.Currency)
	}
	if req.StartsAt != nil {
		activity.StartsAt = req.StartsAt
	}
	if req.EndsAt != nil {
		activity.EndsAt = req.EndsAt
	}
	if activity.EndsAt != nil && activity.StartsAt != nil && activity.EndsAt.Before(*activity.StartsAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ends_at must be after starts_at")
	}
	if activity.Status == domain.FundActivityDraft && activity.StartsAt != nil && !activity.StartsAt.After(time.Now().UTC()) {
		activity.Status = domain.FundActivityActive
	}

	if err := s.activityRepo.Update(ctx, activity); err != nil {
		return nil, err
	}
	return activity, nil
}

// AddDeputy grants a wallet deputy access to a fundraising activity and mirrors the change on-chain when configured.
// Deputies are additional operators allowed to participate in activity administration.
func (s *Service) AddDeputy(ctx context.Context, id, actorWallet, deputyWallet string) (*domain.FundActivity, error) {
	activity, err := s.requireOwner(ctx, id, actorWallet)
	if err != nil {
		return nil, err
	}

	deputy := normalizeWallet(deputyWallet)
	if deputy == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid deputy wallet")
	}
	if deputy == activity.OwnerWallet {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "owner cannot be added as deputy")
	}
	for _, existing := range activity.DeputyWallets {
		if strings.EqualFold(existing, deputy) {
			return activity, nil
		}
	}

	if s.funding != nil && activity.OnchainPotID != "" {
		if _, err := s.funding.AddDeputy(ctx, activity.OnchainPotID, deputy); err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "add deputy on-chain failed", err)
		}
	}

	activity.DeputyWallets = append(activity.DeputyWallets, deputy)
	if err := s.activityRepo.Update(ctx, activity); err != nil {
		return nil, err
	}
	return activity, nil
}

// RemoveDeputy removes deputy access from a fundraising activity and attempts the matching on-chain update.
// The owner remains authoritative for deputy management in both storage layers.
func (s *Service) RemoveDeputy(ctx context.Context, id, actorWallet, deputyWallet string) (*domain.FundActivity, error) {
	activity, err := s.requireOwner(ctx, id, actorWallet)
	if err != nil {
		return nil, err
	}

	deputy := normalizeWallet(deputyWallet)
	if deputy == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid deputy wallet")
	}

	if s.funding != nil && activity.OnchainPotID != "" {
		if _, err := s.funding.RemoveDeputy(ctx, activity.OnchainPotID, deputy); err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "remove deputy on-chain failed", err)
		}
	}

	filtered := make([]string, 0, len(activity.DeputyWallets))
	for _, existing := range activity.DeputyWallets {
		if !strings.EqualFold(existing, deputy) {
			filtered = append(filtered, existing)
		}
	}
	activity.DeputyWallets = filtered
	if err := s.activityRepo.Update(ctx, activity); err != nil {
		return nil, err
	}
	return activity, nil
}

// CloseActivity marks a fundraising activity closed and, when applicable, closes the linked on-chain funding pot.
// Closed activities stop accepting normal fundraising actions until explicitly reopened.
func (s *Service) CloseActivity(ctx context.Context, id, actorWallet string) (*domain.FundActivity, error) {
	activity, err := s.requireOwner(ctx, id, actorWallet)
	if err != nil {
		return nil, err
	}
	if s.funding != nil && activity.OnchainPotID != "" {
		if _, err := s.funding.SetPotStatus(ctx, activity.OnchainPotID, potStatusClosed); err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "close pot on-chain failed", err)
		}
	}
	activity.Status = domain.FundActivityClosed
	if err := s.activityRepo.Update(ctx, activity); err != nil {
		return nil, err
	}
	return activity, nil
}

// ReopenActivity reactivates a closed fundraising activity unless it was fully cancelled.
// The method also restores the on-chain pot state when a funding contract adapter is configured.
func (s *Service) ReopenActivity(ctx context.Context, id, actorWallet string) (*domain.FundActivity, error) {
	activity, err := s.requireOwner(ctx, id, actorWallet)
	if err != nil {
		return nil, err
	}
	if activity.Status == domain.FundActivityCancelled {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "cancelled activity cannot be reopened")
	}
	if s.funding != nil && activity.OnchainPotID != "" {
		if _, err := s.funding.SetPotStatus(ctx, activity.OnchainPotID, potStatusActive); err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "reopen pot on-chain failed", err)
		}
	}
	activity.Status = domain.FundActivityActive
	if err := s.activityRepo.Update(ctx, activity); err != nil {
		return nil, err
	}
	return activity, nil
}

// RecordContribution creates a pending fund-ledger contribution entry and submits the corresponding payment transaction.
// It validates the fundraising window, ensures the pot is ready, and rolls back the ledger row if transfer submission fails.
func (s *Service) RecordContribution(ctx context.Context, id, actorWallet string, req *RecordContributionRequest) (*domain.FundLedgerEntry, error) {
	if s.transferSvc == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "transaction service is unavailable")
	}

	fromWallet := normalizeWallet(req.FromWallet)
	actor := normalizeWallet(actorWallet)
	if actor == "" || fromWallet == "" || !strings.EqualFold(actor, fromWallet) {
		return nil, apperr.ErrForbidden
	}

	amount, err := parsePositiveAmount(req.Amount)
	if err != nil {
		return nil, err
	}

	activity, err := s.activityRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if activity.ContractAddress == "" || activity.OnchainPotID == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity funding pot is not on-chain ready")
	}
	if activity.StartsAt != nil && activity.StartsAt.After(now) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity has not started yet")
	}
	if activity.EndsAt != nil && now.After(*activity.EndsAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity has ended")
	}
	if activity.Status != domain.FundActivityActive && activity.Status != domain.FundActivityDraft {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity is not accepting contributions")
	}

	if activity.Status == domain.FundActivityDraft && (activity.StartsAt == nil || !activity.StartsAt.After(now)) {
		activity.Status = domain.FundActivityActive
		if err := s.activityRepo.Update(ctx, activity); err != nil {
			return nil, err
		}
	}

	created := &domain.FundLedgerEntry{
		BaseEntity:         domain.BaseEntity{ID: uuid.NewString(), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		ActivityID:         activity.ID,
		EntryType:          domain.FundLedgerContribution,
		Status:             domain.FundLedgerPending,
		Amount:             amount.String(),
		ActorWallet:        actor,
		CounterpartyWallet: normalizeWallet(req.ContributorWallet),
		Note:               strings.TrimSpace(req.Note),
		Reference:          strings.TrimSpace(req.Reference),
		BalanceAfter:       activity.AvailableBalance,
	}

	if err := s.ledgerRepo.Create(ctx, created); err != nil {
		return nil, err
	}

	toWallet := activity.ContractAddress
	txRecord, transferErr := s.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
		FromWallet:  fromWallet,
		ToWallet:    toWallet,
		Amount:      amount.String(),
		Nonce:       req.Nonce,
		Deadline:    req.Deadline,
		Signature:   req.Signature,
		Type:        string(domain.TxTypeFundContribution),
		ContextType: "FUND_POT_CONTRIBUTION",
		ContextID:   activity.ID,
		ContextRef:  activity.OnchainPotID,
	})
	if transferErr != nil {
		_ = s.rollbackContribution(ctx, created.ID)
		return nil, transferErr
	}

	created.Status = domain.FundLedgerPending
	created.Reference = txRecord.ID
	created.UpdatedAt = time.Now().UTC()
	if err := s.ledgerRepo.Update(ctx, created); err != nil {
		return nil, err
	}
	return created, nil
}

// FinalizeContributionSettlement finalizes a pending contribution after settlement succeeds and updates related balances atomically.
// This keeps the activity aggregates and ledger entry status in sync with the external payment outcome.
func (s *Service) FinalizeContributionSettlement(ctx context.Context, activityID, txReference, batchTxHash string) error {
	if strings.TrimSpace(activityID) == "" || strings.TrimSpace(txReference) == "" {
		return apperr.New(apperr.ErrCodeBadRequest, "activity_id and tx_reference are required")
	}

	return s.activityRepo.WithTransaction(ctx, func(txCtx context.Context) error {
		activity, err := s.activityRepo.FindByID(txCtx, activityID)
		if err != nil {
			return err
		}
		ledger, err := s.ledgerRepo.FindPendingContributionByReference(txCtx, activityID, txReference)
		if err != nil {
			if apperr.IsNotFound(err) {
				return nil
			}
			return err
		}

		amount, err := parsePositiveAmount(ledger.Amount)
		if err != nil {
			return err
		}

		raised, _ := new(big.Int).SetString(activity.TotalRaised, 10)
		available, _ := new(big.Int).SetString(activity.AvailableBalance, 10)
		raised.Add(raised, amount)
		available.Add(available, amount)
		activity.TotalRaised = raised.String()
		activity.AvailableBalance = available.String()
		if activity.Status == domain.FundActivityDraft && (activity.StartsAt == nil || !activity.StartsAt.After(time.Now().UTC())) {
			activity.Status = domain.FundActivityActive
		}

		ledger.Status = domain.FundLedgerCompleted
		ledger.Reference = strings.TrimSpace(batchTxHash)
		ledger.BalanceAfter = activity.AvailableBalance
		ledger.UpdatedAt = time.Now().UTC()

		if err := s.ledgerRepo.Update(txCtx, ledger); err != nil {
			return err
		}
		return s.activityRepo.Update(txCtx, activity)
	})
}

func (s *Service) VoidContributionSettlement(ctx context.Context, activityID, txReference, reason string) error {
	if strings.TrimSpace(activityID) == "" || strings.TrimSpace(txReference) == "" {
		return apperr.New(apperr.ErrCodeBadRequest, "activity_id and tx_reference are required")
	}

	return s.activityRepo.WithTransaction(ctx, func(txCtx context.Context) error {
		ledger, err := s.ledgerRepo.FindPendingContributionByReference(txCtx, activityID, txReference)
		if err != nil {
			if apperr.IsNotFound(err) {
				return nil
			}
			return err
		}
		ledger.Status = domain.FundLedgerVoided
		if strings.TrimSpace(reason) != "" {
			if strings.TrimSpace(ledger.Note) == "" {
				ledger.Note = "[VOID] " + strings.TrimSpace(reason)
			} else {
				ledger.Note = strings.TrimSpace(ledger.Note) + " [VOID] " + strings.TrimSpace(reason)
			}
		}
		ledger.UpdatedAt = time.Now().UTC()
		return s.ledgerRepo.Update(txCtx, ledger)
	})
}

func (s *Service) RecordExpense(ctx context.Context, id, actorWallet string, req *RecordExpenseRequest) (*domain.FundLedgerEntry, error) {
	spender := normalizeWallet(actorWallet)
	if spender == "" {
		return nil, apperr.ErrForbidden
	}

	activity, err := s.activityRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !canSpend(activity, spender) {
		return nil, apperr.ErrForbidden
	}
	if activity.Status != domain.FundActivityActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity is not active")
	}

	amount, err := parsePositiveAmount(req.Amount)
	if err != nil {
		return nil, err
	}
	beneficiary := normalizeWallet(req.BeneficiaryWallet)
	if beneficiary == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid beneficiary wallet")
	}

	var onchainTx string
	if s.funding != nil && activity.OnchainPotID != "" {
		onchainTx, err = s.funding.Spend(ctx, activity.OnchainPotID, spender, beneficiary, req.Amount, strings.TrimSpace(req.Note))
		if err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "on-chain spend failed", err)
		}
	}

	var created *domain.FundLedgerEntry
	err = s.activityRepo.WithTransaction(ctx, func(txCtx context.Context) error {
		fresh, err := s.activityRepo.FindByID(txCtx, id)
		if err != nil {
			return err
		}
		available, _ := new(big.Int).SetString(fresh.AvailableBalance, 10)
		if available.Cmp(amount) < 0 {
			return apperr.New(apperr.ErrCodeBadRequest, "insufficient available balance")
		}
		spent, _ := new(big.Int).SetString(fresh.TotalSpent, 10)
		available.Sub(available, amount)
		spent.Add(spent, amount)
		fresh.AvailableBalance = available.String()
		fresh.TotalSpent = spent.String()

		entry := &domain.FundLedgerEntry{
			BaseEntity:         domain.BaseEntity{ID: uuid.NewString(), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
			ActivityID:         fresh.ID,
			EntryType:          domain.FundLedgerExpense,
			Status:             domain.FundLedgerCompleted,
			Amount:             req.Amount,
			ActorWallet:        spender,
			CounterpartyWallet: beneficiary,
			Note:               strings.TrimSpace(req.Note),
			Reference:          onchainTx,
			BalanceAfter:       fresh.AvailableBalance,
		}

		if err := s.ledgerRepo.Create(txCtx, entry); err != nil {
			return err
		}
		if err := s.activityRepo.Update(txCtx, fresh); err != nil {
			return err
		}
		created = entry
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (s *Service) ListLedger(ctx context.Context, activityID string, pageReq pagination.Request) ([]*domain.FundLedgerEntry, int64, error) {
	if _, err := s.activityRepo.FindByID(ctx, activityID); err != nil {
		return nil, 0, err
	}
	return s.ledgerRepo.FindByActivity(ctx, activityID,
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
	)
}

func (s *Service) GetSummary(ctx context.Context, activityID string) (*FundSummaryResponse, error) {
	activity, err := s.activityRepo.FindByID(ctx, activityID)
	if err != nil {
		return nil, err
	}
	contribCount, err := s.ledgerRepo.CountByActivityAndType(ctx, activityID, domain.FundLedgerContribution)
	if err != nil {
		return nil, err
	}
	expenseCount, err := s.ledgerRepo.CountByActivityAndType(ctx, activityID, domain.FundLedgerExpense)
	if err != nil {
		return nil, err
	}
	return &FundSummaryResponse{
		ActivityID:        activity.ID,
		Status:            string(activity.Status),
		Category:          activity.Category,
		TargetAmount:      activity.TargetAmount,
		Currency:          activity.Currency,
		TotalRaised:       activity.TotalRaised,
		TotalSpent:        activity.TotalSpent,
		AvailableBalance:  activity.AvailableBalance,
		ContributionCount: contribCount,
		ExpenseCount:      expenseCount,
	}, nil
}

func (s *Service) CreatePotOnChain(ctx context.Context, id, actorWallet string) (*FundContractActionResponse, error) {
	if s.funding == nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "funding contract adapter is unavailable")
	}
	activity, err := s.requireOwner(ctx, id, actorWallet)
	if err != nil {
		return nil, err
	}
	if activity.OnchainPotID == "" {
		activity.OnchainPotID = toOnchainPotID(activity.ID)
	}
	startsAt := int64(0)
	endsAt := int64(0)
	if activity.StartsAt != nil {
		startsAt = activity.StartsAt.Unix()
	}
	if activity.EndsAt != nil {
		endsAt = activity.EndsAt.Unix()
	}
	txHash, err := s.funding.CreatePot(
		ctx,
		activity.OnchainPotID,
		activity.OwnerWallet,
		activity.Category,
		activity.Title,
		activity.TargetAmount,
		activity.DeputyWallets,
		startsAt,
		endsAt,
	)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "create on-chain pot failed", err)
	}
	activity.ContractAddress = s.funding.Address()
	activity.OnchainInitTxHash = txHash
	if err := s.activityRepo.Update(ctx, activity); err != nil {
		return nil, err
	}
	return &FundContractActionResponse{
		Action:   "CREATE_POT",
		TxHash:   txHash,
		Activity: activity,
	}, nil
}

func (s *Service) SetContractStatus(ctx context.Context, id, actorWallet string, req *SetContractStatusRequest) (*FundContractActionResponse, error) {
	if s.funding == nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "funding contract adapter is unavailable")
	}
	activity, err := s.requireOwner(ctx, id, actorWallet)
	if err != nil {
		return nil, err
	}
	if activity.OnchainPotID == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity has no on-chain pot id")
	}
	statusCode, statusDomain, err := mapContractStatus(req.Status)
	if err != nil {
		return nil, err
	}
	txHash, err := s.funding.SetPotStatus(ctx, activity.OnchainPotID, statusCode)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "set on-chain pot status failed", err)
	}
	activity.Status = statusDomain
	if err := s.activityRepo.Update(ctx, activity); err != nil {
		return nil, err
	}
	return &FundContractActionResponse{
		Action:   "SET_STATUS",
		TxHash:   txHash,
		Activity: activity,
	}, nil
}

func (s *Service) RecordContractContribution(ctx context.Context, id, actorWallet string, req *ManualContractContributionRequest) (*FundContractActionResponse, error) {
	if s.funding == nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "funding contract adapter is unavailable")
	}
	actor := normalizeWallet(actorWallet)
	if actor == "" {
		return nil, apperr.ErrForbidden
	}
	activity, err := s.activityRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !canSpend(activity, actor) {
		return nil, apperr.ErrForbidden
	}
	if activity.OnchainPotID == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity has no on-chain pot id")
	}
	contributor := normalizeWallet(req.ContributorWallet)
	if contributor == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid contributor wallet")
	}
	amount, err := parsePositiveAmount(req.Amount)
	if err != nil {
		return nil, err
	}
	txHash, err := s.funding.RecordContribution(ctx, activity.OnchainPotID, contributor, req.Amount, strings.TrimSpace(req.TransferTxHash))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "record contribution on-chain failed", err)
	}

	var created *domain.FundLedgerEntry
	err = s.activityRepo.WithTransaction(ctx, func(txCtx context.Context) error {
		fresh, err := s.activityRepo.FindByID(txCtx, id)
		if err != nil {
			return err
		}
		raised, _ := new(big.Int).SetString(fresh.TotalRaised, 10)
		available, _ := new(big.Int).SetString(fresh.AvailableBalance, 10)
		raised.Add(raised, amount)
		available.Add(available, amount)
		fresh.TotalRaised = raised.String()
		fresh.AvailableBalance = available.String()

		note := strings.TrimSpace(req.Note)
		if note == "" {
			note = "Manual on-chain contribution"
		}
		if strings.TrimSpace(req.TransferTxHash) != "" {
			note += " | transfer_tx_hash=" + strings.TrimSpace(req.TransferTxHash)
		}
		entry := &domain.FundLedgerEntry{
			BaseEntity:         domain.BaseEntity{ID: uuid.NewString(), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
			ActivityID:         fresh.ID,
			EntryType:          domain.FundLedgerContribution,
			Status:             domain.FundLedgerCompleted,
			Amount:             req.Amount,
			ActorWallet:        actor,
			CounterpartyWallet: contributor,
			Note:               note,
			Reference:          firstNonEmpty(strings.TrimSpace(req.Reference), txHash),
			BalanceAfter:       fresh.AvailableBalance,
		}
		if err := s.ledgerRepo.Create(txCtx, entry); err != nil {
			return err
		}
		if err := s.activityRepo.Update(txCtx, fresh); err != nil {
			return err
		}
		activity = fresh
		created = entry
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &FundContractActionResponse{
		Action:   "RECORD_CONTRIBUTION",
		TxHash:   txHash,
		Activity: activity,
		Ledger:   created,
	}, nil
}

func (s *Service) SpendContractFunds(ctx context.Context, id, actorWallet string, req *ManualContractSpendRequest) (*FundContractActionResponse, error) {
	if s.funding == nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "funding contract adapter is unavailable")
	}
	actor := normalizeWallet(actorWallet)
	if actor == "" {
		return nil, apperr.ErrForbidden
	}
	activity, err := s.activityRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !canSpend(activity, actor) {
		return nil, apperr.ErrForbidden
	}
	if activity.OnchainPotID == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity has no on-chain pot id")
	}
	amount, err := parsePositiveAmount(req.Amount)
	if err != nil {
		return nil, err
	}
	beneficiary := normalizeWallet(req.BeneficiaryWallet)
	if beneficiary == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid beneficiary wallet")
	}
	txHash, err := s.funding.Spend(ctx, activity.OnchainPotID, actor, beneficiary, req.Amount, strings.TrimSpace(req.Note))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "spend on-chain failed", err)
	}

	var created *domain.FundLedgerEntry
	err = s.activityRepo.WithTransaction(ctx, func(txCtx context.Context) error {
		fresh, err := s.activityRepo.FindByID(txCtx, id)
		if err != nil {
			return err
		}
		available, _ := new(big.Int).SetString(fresh.AvailableBalance, 10)
		if available.Cmp(amount) < 0 {
			return apperr.New(apperr.ErrCodeBadRequest, "insufficient available balance")
		}
		spent, _ := new(big.Int).SetString(fresh.TotalSpent, 10)
		available.Sub(available, amount)
		spent.Add(spent, amount)
		fresh.AvailableBalance = available.String()
		fresh.TotalSpent = spent.String()

		entry := &domain.FundLedgerEntry{
			BaseEntity:         domain.BaseEntity{ID: uuid.NewString(), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
			ActivityID:         fresh.ID,
			EntryType:          domain.FundLedgerExpense,
			Status:             domain.FundLedgerCompleted,
			Amount:             req.Amount,
			ActorWallet:        actor,
			CounterpartyWallet: beneficiary,
			Note:               strings.TrimSpace(req.Note),
			Reference:          firstNonEmpty(strings.TrimSpace(req.Reference), txHash),
			BalanceAfter:       fresh.AvailableBalance,
		}
		if err := s.ledgerRepo.Create(txCtx, entry); err != nil {
			return err
		}
		if err := s.activityRepo.Update(txCtx, fresh); err != nil {
			return err
		}
		activity = fresh
		created = entry
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &FundContractActionResponse{
		Action:   "SPEND",
		TxHash:   txHash,
		Activity: activity,
		Ledger:   created,
	}, nil
}

func (s *Service) rollbackContribution(ctx context.Context, ledgerID string) error {
	return s.activityRepo.WithTransaction(ctx, func(txCtx context.Context) error {
		ledger, err := s.ledgerRepo.FindByID(txCtx, ledgerID)
		if err != nil {
			return err
		}

		ledger.Status = domain.FundLedgerVoided
		ledger.Note = strings.TrimSpace(ledger.Note + " [ROLLBACK: transfer queue failed]")

		if err := s.ledgerRepo.Update(txCtx, ledger); err != nil {
			return err
		}
		return nil
	})
}

func buildActivityListOptions(filter *ListFundActivitiesQuery, pageReq pagination.Request) []database.QueryOption {
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
	}
	if filter == nil {
		return opts
	}
	if filter.Category != "" {
		opts = append(opts, database.WithEq("category", strings.ToUpper(strings.TrimSpace(filter.Category))))
	}
	if filter.Status != "" {
		opts = append(opts, database.WithEq("status", strings.ToUpper(strings.TrimSpace(filter.Status))))
	}
	if filter.Search != "" {
		opts = append(opts, database.WithLike("title", strings.TrimSpace(filter.Search)))
	}
	return opts
}

func (s *Service) requireOwner(ctx context.Context, id, actorWallet string) (*domain.FundActivity, error) {
	activity, err := s.activityRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(activity.OwnerWallet, normalizeWallet(actorWallet)) {
		return nil, apperr.ErrForbidden
	}
	return activity, nil
}

func canSpend(activity *domain.FundActivity, actorWallet string) bool {
	if strings.EqualFold(activity.OwnerWallet, actorWallet) {
		return true
	}
	for _, deputy := range activity.DeputyWallets {
		if strings.EqualFold(deputy, actorWallet) {
			return true
		}
	}
	return false
}

func sanitizeDeputies(wallets []string, ownerWallet string) ([]string, error) {
	uniq := make([]string, 0, len(wallets))
	seen := map[string]struct{}{}
	for _, wallet := range wallets {
		normalized := normalizeWallet(wallet)
		if normalized == "" {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid deputy wallet")
		}
		if normalized == ownerWallet {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		uniq = append(uniq, normalized)
	}
	return uniq, nil
}

func parsePositiveAmount(raw string) (*big.Int, error) {
	amount, ok := new(big.Int).SetString(strings.TrimSpace(raw), 10)
	if !ok || amount.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "amount must be a positive integer string")
	}
	return amount, nil
}

func normalizeWallet(wallet string) string {
	wallet = strings.TrimSpace(wallet)
	if wallet == "" || !common.IsHexAddress(wallet) {
		return ""
	}
	return common.HexToAddress(wallet).Hex()
}

func defaultCurrency(currency string) string {
	currency = strings.TrimSpace(currency)
	if currency == "" {
		return "VNDC"
	}
	return strings.ToUpper(currency)
}

func mapContractStatus(raw string) (uint8, domain.FundActivityStatus, error) {
	status := strings.ToUpper(strings.TrimSpace(raw))
	switch status {
	case "DRAFT":
		return potStatusDraft, domain.FundActivityDraft, nil
	case "ACTIVE":
		return potStatusActive, domain.FundActivityActive, nil
	case "CLOSED":
		return potStatusClosed, domain.FundActivityClosed, nil
	case "CANCELLED":
		return potStatusCancelled, domain.FundActivityCancelled, nil
	default:
		return 0, "", apperr.New(apperr.ErrCodeBadRequest, "invalid status; expected DRAFT|ACTIVE|CLOSED|CANCELLED")
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func toOnchainPotID(activityID string) string {
	hash := crypto.Keccak256Hash([]byte(activityID))
	return hash.Hex()
}

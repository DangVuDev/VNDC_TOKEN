// Package admin — admin statistics aggregation service.
// Queries user and transaction repositories to compute platform-wide metrics.
package admin

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/timeutil"
)

// Service computes administrative dashboard metrics, review queues, and cross-module analytics snapshots.
// It aggregates data from multiple repositories so handlers can serve one coherent admin view without duplicating query logic.
type Service struct {
	userRepo        ports.UserRepository
	txRepo          ports.TransactionRepository
	kycSubmitRepo   ports.KYCSubmissionRepository
	marketRepo      ports.MarketplaceListingRepository
	daoRepo         ports.DAOOrganizationRepository
	daoProposalRepo ports.DAOProposalRepository
	campaignRepo    ports.FundraisingCampaignRepository
	ticketRepo      ports.ServiceTicketProductRepository
	taskRepo        ports.TaskRepository
	activityRepo    ports.ActivityRepository
	log             logger.Logger
}

// NewService constructs the admin application service with the repositories required for operational reporting.
// Each dependency is optional at runtime for some analytics branches, allowing partial modules to remain observable.
func NewService(
	userRepo ports.UserRepository,
	txRepo ports.TransactionRepository,
	kycSubmitRepo ports.KYCSubmissionRepository,
	marketRepo ports.MarketplaceListingRepository,
	daoRepo ports.DAOOrganizationRepository,
	daoProposalRepo ports.DAOProposalRepository,
	campaignRepo ports.FundraisingCampaignRepository,
	ticketRepo ports.ServiceTicketProductRepository,
	taskRepo ports.TaskRepository,
	activityRepo ports.ActivityRepository,
	log logger.Logger,
) *Service {
	return &Service{
		userRepo:        userRepo,
		txRepo:          txRepo,
		kycSubmitRepo:   kycSubmitRepo,
		marketRepo:      marketRepo,
		daoRepo:         daoRepo,
		daoProposalRepo: daoProposalRepo,
		campaignRepo:    campaignRepo,
		ticketRepo:      ticketRepo,
		taskRepo:        taskRepo,
		activityRepo:    activityRepo,
		log:             log.Named("admin_service"),
	}
}

// GetStats assembles the headline metrics shown on the admin dashboard.
// It focuses on actionable operational counters such as user distribution, KYC backlog, and transaction pipeline health.
func (s *Service) GetStats(ctx context.Context) (*AdminStatsResponse, error) {
	now := time.Now().UTC()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	startOfWeek := now.AddDate(0, 0, -7)

	// ── User counts ──────────────────────────────────────────────────────
	totalUsers, err := s.userRepo.Count(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count total users", err)
	}

	kycLevel0, err := s.userRepo.Count(ctx, database.WithEq("kyc_level", int(domain.KYCLevelNone)))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count kyc level 0", err)
	}

	kycLevel1, err := s.userRepo.Count(ctx, database.WithEq("kyc_level", int(domain.KYCLevelBasic)))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count kyc level 1", err)
	}

	kycLevel2, err := s.userRepo.Count(ctx, database.WithEq("kyc_level", int(domain.KYCLevelStandard)))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count kyc level 2", err)
	}

	activeToday, err := s.userRepo.Count(ctx, database.WithGte("last_login_at", startOfDay))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count active today", err)
	}

	// Count suspended + banned users (status IN [SUSPENDED, BANNED])
	// Using separate counts and summing since WithIn with []string works for bson.
	suspendedCount, err := s.userRepo.Count(ctx, database.WithEq("status", string(domain.UserStatusSuspended)))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count suspended users", err)
	}
	bannedCount, err := s.userRepo.Count(ctx, database.WithEq("status", string(domain.UserStatusBanned)))
	if err != nil {
		// If UserStatusBanned doesn't exist, ignore this count
		bannedCount = 0
	}

	newUsersThisWeek, err := s.userRepo.Count(ctx, database.WithGte("created_at", startOfWeek))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count new users this week", err)
	}

	// ── Transaction counts ───────────────────────────────────────────────
	pendingTxs, err := s.txRepo.CountByStatus(ctx, domain.TxStatusPending)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count pending txs", err)
	}

	processingTxs, err := s.txRepo.CountByStatus(ctx, domain.TxStatusProcessing)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count processing txs", err)
	}

	successTxs, err := s.txRepo.CountByStatus(ctx, domain.TxStatusSuccess)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count success txs", err)
	}

	failedTxs, err := s.txRepo.CountByStatus(ctx, domain.TxStatusFailed)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "count failed txs", err)
	}

	// ── KYC submission count ─────────────────────────────────────────────
	var pendingKYC int64
	if _, total2, err2 := s.kycSubmitRepo.FindByStatus(ctx, domain.KYCSubmissionPending); err2 == nil {
		pendingKYC = total2
	}

	return &AdminStatsResponse{
		TotalUsers:            totalUsers,
		KYCLevel0:             kycLevel0,
		KYCLevel1:             kycLevel1,
		KYCLevel2:             kycLevel2,
		ActiveToday:           activeToday,
		SuspendedUsers:        suspendedCount + bannedCount,
		NewUsersThisWeek:      newUsersThisWeek,
		PendingTxs:            pendingTxs,
		ProcessingTxs:         processingTxs,
		SuccessTxs:            successTxs,
		FailedTxs:             failedTxs,
		TotalTxs:              pendingTxs + processingTxs + successTxs + failedTxs,
		PendingKYCSubmissions: pendingKYC,
	}, nil
}

// ListPendingTransactions returns a paginated review queue composed of both pending and queued transactions.
// The service merges the two statuses and sorts them by creation time so operators can review them as one queue.
func (s *Service) ListPendingTransactions(ctx context.Context, page, pageSize int64) ([]*domain.Transaction, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	pendingTxs, err := s.txRepo.FindByStatus(ctx, domain.TxStatusPending, 1000)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "list pending transactions", err)
	}
	queuedTxs, err := s.txRepo.FindByStatus(ctx, domain.TxStatusQueued, 1000)
	if err != nil {
		return nil, 0, apperr.Wrap(apperr.ErrCodeDatabase, "list queued transactions", err)
	}

	all := make([]*domain.Transaction, 0, len(pendingTxs)+len(queuedTxs))
	all = append(all, pendingTxs...)
	all = append(all, queuedTxs...)
	sort.Slice(all, func(i, j int) bool {
		return all[i].CreatedAt.After(all[j].CreatedAt)
	})

	total := int64(len(all))
	start := (page - 1) * pageSize
	if start >= total {
		return []*domain.Transaction{}, total, nil
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return all[start:end], total, nil
}

// GetAnalytics builds a broader analytics snapshot grouped by major platform modules.
// Unlike GetStats, this method is shaped for reporting dashboards rather than only operational counters.
func (s *Service) GetAnalytics(ctx context.Context) (*AnalyticsResponse, error) {
	now := time.Now().UTC()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	startOfWeek := now.AddDate(0, 0, -7)

	// ── User counts ──────────────────────────────────────────────────────
	totalUsers, _ := s.userRepo.Count(ctx)
	kycLevel0, _ := s.userRepo.Count(ctx, database.WithEq("kyc_level", int(domain.KYCLevelNone)))
	kycLevel1, _ := s.userRepo.Count(ctx, database.WithEq("kyc_level", int(domain.KYCLevelBasic)))
	kycLevel2, _ := s.userRepo.Count(ctx, database.WithEq("kyc_level", int(domain.KYCLevelStandard)))
	activeToday, _ := s.userRepo.Count(ctx, database.WithGte("last_login_at", startOfDay))
	suspended, _ := s.userRepo.Count(ctx, database.WithEq("status", string(domain.UserStatusSuspended)))
	banned, _ := s.userRepo.Count(ctx, database.WithEq("status", string(domain.UserStatusBanned)))
	newThisWeek, _ := s.userRepo.Count(ctx, database.WithGte("created_at", startOfWeek))

	// ── Transaction counts ───────────────────────────────────────────────
	pendingTxs, _ := s.txRepo.CountByStatus(ctx, domain.TxStatusPending)
	processingTxs, _ := s.txRepo.CountByStatus(ctx, domain.TxStatusProcessing)
	successTxs, _ := s.txRepo.CountByStatus(ctx, domain.TxStatusSuccess)
	failedTxs, _ := s.txRepo.CountByStatus(ctx, domain.TxStatusFailed)

	// ── Marketplace counts ───────────────────────────────────────────────
	var totalListings, activeListings, soldListings int64
	if s.marketRepo != nil {
		_, totalListings, _ = s.marketRepo.Find(ctx)
		_, activeListings, _ = s.marketRepo.Find(ctx, database.WithEq("status", string(domain.MarketplaceListingActive)))
		_, soldListings, _ = s.marketRepo.Find(ctx, database.WithEq("status", string(domain.MarketplaceListingSold)))
	}

	// ── DAO counts ───────────────────────────────────────────────────────
	var totalDAOs, totalProposals, activeProposals int64
	if s.daoRepo != nil {
		_, totalDAOs, _ = s.daoRepo.Find(ctx)
	}
	if s.daoProposalRepo != nil {
		_, totalProposals, _ = s.daoProposalRepo.Find(ctx)
		_, activeProposals, _ = s.daoProposalRepo.Find(ctx, database.WithEq("status", "ACTIVE"))
	}

	// ── Fundraising campaign counts ───────────────────────────────────────
	var totalCampaigns, activeCampaigns int64
	if s.campaignRepo != nil {
		_, totalCampaigns, _ = s.campaignRepo.Find(ctx)
		_, activeCampaigns, _ = s.campaignRepo.Find(ctx, database.WithEq("status", string(domain.CampaignStatusActive)))
	}

	// ── Ticketing product counts ──────────────────────────────────────────
	var totalProducts, activeProducts int64
	if s.ticketRepo != nil {
		_, totalProducts, _ = s.ticketRepo.Find(ctx)
		_, activeProducts, _ = s.ticketRepo.Find(ctx, database.WithEq("status", string(domain.ServiceTicketProductActive)))
	}

	// ── Task counts ───────────────────────────────────────────────────────
	var totalTasks, activeTasks int64
	if s.taskRepo != nil {
		_, totalTasks, _ = s.taskRepo.FindAll(ctx)
		_, activeTasks, _ = s.taskRepo.FindByStatus(ctx, domain.TaskStatusActive)
	}

	// ── Activity counts ───────────────────────────────────────────────────
	var totalActivities int64
	if s.activityRepo != nil {
		_, totalActivities, _ = s.activityRepo.FindAll(ctx)
	}

	return &AnalyticsResponse{
		Users: UserAnalytics{
			Total:       totalUsers,
			KYCLevel0:   kycLevel0,
			KYCLevel1:   kycLevel1,
			KYCLevel2:   kycLevel2,
			ActiveToday: activeToday,
			Suspended:   suspended + banned,
			NewThisWeek: newThisWeek,
		},
		Transactions: TransactionAnalytics{
			Total:      pendingTxs + processingTxs + successTxs + failedTxs,
			Pending:    pendingTxs,
			Processing: processingTxs,
			Success:    successTxs,
			Failed:     failedTxs,
		},
		Marketplace: MarketplaceAnalytics{
			TotalListings:  totalListings,
			ActiveListings: activeListings,
			SoldListings:   soldListings,
		},
		DAO: DAOAnalytics{
			TotalDAOs:       totalDAOs,
			TotalProposals:  totalProposals,
			ActiveProposals: activeProposals,
		},
		Fundraising: FundraisingAnalytics{
			TotalCampaigns:  totalCampaigns,
			ActiveCampaigns: activeCampaigns,
		},
		Ticketing: TicketingAnalytics{
			TotalProducts:  totalProducts,
			ActiveProducts: activeProducts,
		},
		Tasks: TaskAnalytics{
			TotalTasks:  totalTasks,
			ActiveTasks: activeTasks,
		},
		Activities: ActivityAnalytics{
			TotalActivities: totalActivities,
		},
	}, nil
}

// ListUsers returns a paginated, filterable user list tailored for administrative review screens.
// It also projects internal user fields into response-friendly labels such as localized KYC status text.
func (s *Service) ListUsers(ctx context.Context, req *ListAdminUsersRequest) (*AdminUserListResponse, error) {
	page := req.Page
	pageSize := req.PageSize
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	opts := []database.QueryOption{
		database.WithPagination(page, pageSize),
		database.WithSort("created_at", database.SortDesc),
	}
	if req.Status != "" {
		opts = append(opts, database.WithEq("status", req.Status))
	}
	if req.KYCLevel != "" {
		lvlMap := map[string]int{"0": 0, "1": 1, "2": 2}
		if lvl, ok := lvlMap[req.KYCLevel]; ok {
			opts = append(opts, database.WithEq("kyc_level", lvl))
		}
	}

	users, total, err := s.userRepo.Find(ctx, opts...)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "list admin users", err)
	}

	items := make([]*AdminUserItem, 0, len(users))
	for _, u := range users {
		item := &AdminUserItem{
			ID:            u.ID,
			WalletAddress: u.WalletAddress,
			Username:      u.Username,
			Email:         u.Email,
			KYCLevel:      int(u.KYCLevel),
			Status:        string(u.Status),
			CreatedAt:     timeutil.FormatRFC3339UTC7(u.CreatedAt),
		}
		if u.KYCLevel == domain.KYCLevelNone {
			item.KYCStatus = "Chưa xác minh"
		} else if u.KYCLevel == domain.KYCLevelBasic {
			item.KYCStatus = "Cơ bản"
		} else {
			item.KYCStatus = "Tiêu chuẩn"
		}
		if u.LastLoginAt != nil {
			s := timeutil.FormatRFC3339UTC7(*u.LastLoginAt)
			item.LastLoginAt = &s
		}
		// Convert roles to string slice
		for _, r := range u.Roles {
			item.Roles = append(item.Roles, string(r))
		}
		items = append(items, item)
	}

	return &AdminUserListResponse{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// ApprovePendingTransaction normalizes a reviewable transaction back into the pending state for worker pickup.
// This is primarily useful when operators want to release a queued item into the settlement pipeline.
func (s *Service) ApprovePendingTransaction(ctx context.Context, txID string) (*domain.Transaction, error) {
	tx, err := s.txRepo.FindByID(ctx, txID)
	if err != nil {
		return nil, err
	}
	if tx == nil {
		return nil, apperr.ErrNotFound
	}

	if tx.Status != domain.TxStatusPending && tx.Status != domain.TxStatusQueued {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "only queued or pending transactions can be approved")
	}

	updates := map[string]any{
		"status":     domain.TxStatusPending,
		"last_error": "",
		"updated_at": time.Now().UTC(),
	}
	if err := s.txRepo.Update(ctx, tx.ID, updates); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "approve pending transaction", err)
	}

	return s.txRepo.FindByID(ctx, tx.ID)
}

// RejectPendingTransaction marks a queued or pending transaction as rolled back and stores the administrative reason.
// It closes the item out of the processing queue while preserving an auditable failure message for later inspection.
func (s *Service) RejectPendingTransaction(ctx context.Context, txID, reason string) (*domain.Transaction, error) {
	tx, err := s.txRepo.FindByID(ctx, txID)
	if err != nil {
		return nil, err
	}
	if tx == nil {
		return nil, apperr.ErrNotFound
	}

	if tx.Status != domain.TxStatusPending && tx.Status != domain.TxStatusQueued {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "only queued or pending transactions can be rejected")
	}

	msg := strings.TrimSpace(reason)
	if msg == "" {
		msg = "Rejected by admin"
	}
	updates := map[string]any{
		"status":     domain.TxStatusRolledBack,
		"last_error": msg,
		"updated_at": time.Now().UTC(),
	}
	if err := s.txRepo.Update(ctx, tx.ID, updates); err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeDatabase, "reject pending transaction", err)
	}

	return s.txRepo.FindByID(ctx, tx.ID)
}

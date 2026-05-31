// Package admin defines request and response DTOs for privileged administrative APIs.
// The types here shape dashboard metrics, analytics payloads, moderation queues, and admin-facing user-directory responses.
package admin

// AdminStatsResponse is the high-level operations snapshot used by the main admin dashboard.
// It groups headline user, KYC, and transaction counters into one compact response optimized for overview cards.
type AdminStatsResponse struct {
	// User metrics
	TotalUsers       int64 `json:"total_users"`
	KYCLevel0        int64 `json:"kyc_level0"`          // no KYC
	KYCLevel1        int64 `json:"kyc_level1"`          // basic (email + phone)
	KYCLevel2        int64 `json:"kyc_level2"`          // standard (gov ID)
	ActiveToday      int64 `json:"active_today"`        // logged in within last 24 h
	SuspendedUsers   int64 `json:"suspended_users"`     // status = SUSPENDED or BANNED
	NewUsersThisWeek int64 `json:"new_users_this_week"` // registered in last 7 days

	// Transaction metrics
	PendingTxs    int64 `json:"pending_txs"`
	ProcessingTxs int64 `json:"processing_txs"`
	SuccessTxs    int64 `json:"success_txs"`
	FailedTxs     int64 `json:"failed_txs"`
	TotalTxs      int64 `json:"total_txs"` // sum of all statuses

	// KYC submission metrics (pending Level 2 reviews)
	PendingKYCSubmissions int64 `json:"pending_kyc_submissions"`
}

// AnalyticsResponse provides a broader module-by-module analytics breakdown than AdminStatsResponse.
// It is intended for sectioned reporting screens where each subsystem gets its own aggregate block.
type AnalyticsResponse struct {
	Users        UserAnalytics        `json:"users"`
	Transactions TransactionAnalytics `json:"transactions"`
	Marketplace  MarketplaceAnalytics `json:"marketplace"`
	DAO          DAOAnalytics         `json:"dao"`
	Fundraising  FundraisingAnalytics `json:"fundraising"`
	Ticketing    TicketingAnalytics   `json:"ticketing"`
	Tasks        TaskAnalytics        `json:"tasks"`
	Activities   ActivityAnalytics    `json:"activities"`
}

// UserAnalytics groups account-lifecycle and KYC metrics for the user subsystem.
type UserAnalytics struct {
	Total       int64 `json:"total"`
	KYCLevel0   int64 `json:"kyc_level0"`
	KYCLevel1   int64 `json:"kyc_level1"`
	KYCLevel2   int64 `json:"kyc_level2"`
	ActiveToday int64 `json:"active_today"`
	Suspended   int64 `json:"suspended"`
	NewThisWeek int64 `json:"new_this_week"`
}

// TransactionAnalytics groups transfer-pipeline counts by status.
type TransactionAnalytics struct {
	Total      int64 `json:"total"`
	Pending    int64 `json:"pending"`
	Processing int64 `json:"processing"`
	Success    int64 `json:"success"`
	Failed     int64 `json:"failed"`
}

// MarketplaceAnalytics summarizes listing inventory and sales-state metrics for the marketplace module.
type MarketplaceAnalytics struct {
	TotalListings  int64 `json:"total_listings"`
	ActiveListings int64 `json:"active_listings"`
	SoldListings   int64 `json:"sold_listings"`
}

// DAOAnalytics summarizes DAO organizations, proposals, and voting activity across governance features.
type DAOAnalytics struct {
	TotalDAOs       int64 `json:"total_daos"`
	TotalProposals  int64 `json:"total_proposals"`
	ActiveProposals int64 `json:"active_proposals"`
	TotalVotes      int64 `json:"total_votes"`
}

// FundraisingAnalytics captures the campaign-level counts needed for fundraising overview reporting.
type FundraisingAnalytics struct {
	TotalCampaigns  int64 `json:"total_campaigns"`
	ActiveCampaigns int64 `json:"active_campaigns"`
}

// TicketingAnalytics summarizes supply-side ticketing activity for products and sales.
type TicketingAnalytics struct {
	TotalProducts  int64 `json:"total_products"`
	ActiveProducts int64 `json:"active_products"`
	TotalSold      int64 `json:"total_sold"`
}

// TaskAnalytics exposes simple task-module volume metrics for admin reporting.
type TaskAnalytics struct {
	TotalTasks  int64 `json:"total_tasks"`
	ActiveTasks int64 `json:"active_tasks"`
}

// ActivityAnalytics captures aggregate activity-module volume for education or engagement dashboards.
type ActivityAnalytics struct {
	TotalActivities int64 `json:"total_activities"`
}

// AdminUserItem is one row in the admin user-directory response.
// It contains the core identity, moderation, and access-control fields needed by operator-side account screens.
type AdminUserItem struct {
	ID            string   `json:"id"`
	WalletAddress string   `json:"wallet_address"`
	Username      string   `json:"username,omitempty"`
	Email         string   `json:"email,omitempty"`
	KYCLevel      int      `json:"kyc_level"`
	KYCStatus     string   `json:"kyc_status"`
	Status        string   `json:"status"`
	Roles         []string `json:"roles"`
	LastLoginAt   *string  `json:"last_login_at,omitempty"`
	CreatedAt     string   `json:"created_at"`
}

// AdminUserListResponse wraps a paginated admin user-directory result.
type AdminUserListResponse struct {
	Items    []*AdminUserItem `json:"items"`
	Total    int64            `json:"total"`
	Page     int64            `json:"page"`
	PageSize int64            `json:"page_size"`
}

// ListAdminUsersRequest carries the filter and pagination inputs accepted by the admin user-directory endpoint.
type ListAdminUsersRequest struct {
	Status   string `form:"status"`
	KYCLevel string `form:"kyc_level"`
	Search   string `form:"search"`
	Page     int64  `form:"page"      validate:"omitempty,min=1"`
	PageSize int64  `form:"page_size" validate:"omitempty,min=1,max=100"`
}

// PendingTransactionItem is one row in the admin pending-transaction review queue.
type PendingTransactionItem struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	FromWallet string `json:"from_wallet"`
	ToWallet   string `json:"to_wallet"`
	Amount     string `json:"amount"`
	Status     string `json:"status"`
	CreatedAt  string `json:"created_at"`
}

// PendingTxListResponse wraps a paginated moderation queue of unresolved transactions.
type PendingTxListResponse struct {
	Items    []*PendingTransactionItem `json:"items"`
	Total    int64                     `json:"total"`
	Page     int64                     `json:"page"`
	PageSize int64                     `json:"page_size"`
}

// ListPendingTxRequest carries paging controls for the pending-transaction moderation queue.
type ListPendingTxRequest struct {
	Page     int64 `form:"page"      validate:"omitempty,min=1"`
	PageSize int64 `form:"page_size" validate:"omitempty,min=1,max=100"`
}

// RejectPendingTxRequest carries the optional explanation recorded when an administrator rejects a transaction.
type RejectPendingTxRequest struct {
	Reason string `json:"reason" validate:"omitempty,max=256"`
}

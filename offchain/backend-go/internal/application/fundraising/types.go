package fundraising

import (
	"time"

	"github.com/vndc/backend/internal/domain"
)

// CreateFundActivityRequest creates a new fundraising activity.
type CreateFundActivityRequest struct {
	Title         string     `json:"title" binding:"required"`
	Description   string     `json:"description"`
	ImageURI      string     `json:"image_uri"`
	ImageURL      string     `json:"image_url"`
	Category      string     `json:"category" binding:"required"`
	TargetAmount  string     `json:"target_amount" binding:"required"`
	Currency      string     `json:"currency"`
	DeputyWallets []string   `json:"deputy_wallets"`
	StartsAt      *time.Time `json:"starts_at"`
	EndsAt        *time.Time `json:"ends_at"`
}

// UpdateFundActivityRequest updates mutable fundraising metadata.
type UpdateFundActivityRequest struct {
	Title        *string    `json:"title"`
	Description  *string    `json:"description"`
	ImageURI     *string    `json:"image_uri"`
	ImageURL     *string    `json:"image_url"`
	Category     *string    `json:"category"`
	TargetAmount *string    `json:"target_amount"`
	Currency     *string    `json:"currency"`
	StartsAt     *time.Time `json:"starts_at"`
	EndsAt       *time.Time `json:"ends_at"`
}

// AddDeputyRequest adds a deputy fund manager.
type AddDeputyRequest struct {
	Wallet string `json:"wallet" binding:"required"`
}

// RecordContributionRequest records incoming money into the fund.
type RecordContributionRequest struct {
	Amount            string `json:"amount" binding:"required"`
	FromWallet        string `json:"from_wallet" binding:"required"`
	Nonce             string `json:"nonce" binding:"required"`
	Deadline          int64  `json:"deadline" binding:"required"`
	Signature         string `json:"signature" binding:"required"`
	Note              string `json:"note"`
	Reference         string `json:"reference"`
	ContributorWallet string `json:"contributor_wallet"`
}

// RecordExpenseRequest records outgoing money from the fund.
type RecordExpenseRequest struct {
	Amount            string `json:"amount" binding:"required"`
	Note              string `json:"note" binding:"required"`
	Reference         string `json:"reference"`
	BeneficiaryWallet string `json:"beneficiary_wallet"`
}

// ListFundActivitiesQuery filters fundraising activities.
type ListFundActivitiesQuery struct {
	Category    string `form:"category"`
	Status      string `form:"status"`
	Search      string `form:"search"`
	Mine        bool   `form:"mine"`
	OwnerWallet string `form:"owner_wallet"`
}

// FundSummaryResponse returns standard fundraising KPIs.
type FundSummaryResponse struct {
	ActivityID        string `json:"activity_id"`
	Status            string `json:"status"`
	Category          string `json:"category"`
	TargetAmount      string `json:"target_amount"`
	Currency          string `json:"currency"`
	TotalRaised       string `json:"total_raised"`
	TotalSpent        string `json:"total_spent"`
	AvailableBalance  string `json:"available_balance"`
	ContributionCount int64  `json:"contribution_count"`
	ExpenseCount      int64  `json:"expense_count"`
}

// SetContractStatusRequest updates pot status directly on-chain.
type SetContractStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// ManualContractContributionRequest triggers direct on-chain recordContribution.
type ManualContractContributionRequest struct {
	ContributorWallet string `json:"contributor_wallet" binding:"required"`
	Amount            string `json:"amount" binding:"required"`
	TransferTxHash    string `json:"transfer_tx_hash" binding:"required"`
	Note              string `json:"note"`
	Reference         string `json:"reference"`
}

// ManualContractSpendRequest triggers direct on-chain spend.
type ManualContractSpendRequest struct {
	BeneficiaryWallet string `json:"beneficiary_wallet" binding:"required"`
	Amount            string `json:"amount" binding:"required"`
	Note              string `json:"note" binding:"required"`
	Reference         string `json:"reference"`
}

// FundContractActionResponse returns contract action metadata.
type FundContractActionResponse struct {
	Action   string                  `json:"action"`
	TxHash   string                  `json:"tx_hash"`
	Activity *domain.FundActivity    `json:"activity"`
	Ledger   *domain.FundLedgerEntry `json:"ledger,omitempty"`
}

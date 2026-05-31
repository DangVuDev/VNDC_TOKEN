package domain

import "time"

// FundActivityStatus is the lifecycle state of a fundraising activity.
type FundActivityStatus string

const (
	FundActivityDraft     FundActivityStatus = "DRAFT"
	FundActivityActive    FundActivityStatus = "ACTIVE"
	FundActivityClosed    FundActivityStatus = "CLOSED"
	FundActivityCancelled FundActivityStatus = "CANCELLED"
)

// FundLedgerEntryType classifies money movement inside a fund activity.
type FundLedgerEntryType string

const (
	FundLedgerContribution FundLedgerEntryType = "CONTRIBUTION"
	FundLedgerExpense      FundLedgerEntryType = "EXPENSE"
	FundLedgerAdjustment   FundLedgerEntryType = "ADJUSTMENT"
)

// FundLedgerEntryStatus tracks the lifecycle of a ledger item.
type FundLedgerEntryStatus string

const (
	FundLedgerPending   FundLedgerEntryStatus = "PENDING"
	FundLedgerCompleted FundLedgerEntryStatus = "COMPLETED"
	FundLedgerVoided    FundLedgerEntryStatus = "VOIDED"
)

// FundActivity stores a fundraising campaign and its aggregated balances.
type FundActivity struct {
	BaseEntity `bson:",inline"`

	Title             string             `bson:"title"              json:"title"`
	Description       string             `bson:"description"        json:"description"`
	ImageURI          string             `bson:"image_uri,omitempty" json:"image_uri,omitempty"`
	ImageURL          string             `bson:"image_url,omitempty" json:"image_url,omitempty"`
	Category          string             `bson:"category"           json:"category"`
	OwnerWallet       string             `bson:"owner_wallet"       json:"owner_wallet"`
	DeputyWallets     []string           `bson:"deputy_wallets"     json:"deputy_wallets"`
	Status            FundActivityStatus `bson:"status"             json:"status"`
	Currency          string             `bson:"currency"           json:"currency"`
	OnchainPotID      string             `bson:"onchain_pot_id"     json:"onchain_pot_id"`
	ContractAddress   string             `bson:"contract_address"   json:"contract_address"`
	OnchainInitTxHash string             `bson:"onchain_init_tx_hash,omitempty" json:"onchain_init_tx_hash,omitempty"`
	TargetAmount      string             `bson:"target_amount"      json:"target_amount"`
	TotalRaised       string             `bson:"total_raised"       json:"total_raised"`
	TotalSpent        string             `bson:"total_spent"        json:"total_spent"`
	AvailableBalance  string             `bson:"available_balance"  json:"available_balance"`
	StartsAt          *time.Time         `bson:"starts_at,omitempty" json:"starts_at,omitempty"`
	EndsAt            *time.Time         `bson:"ends_at,omitempty"   json:"ends_at,omitempty"`
}

// FundLedgerEntry is the immutable ledger for income and expenses.
type FundLedgerEntry struct {
	BaseEntity `bson:",inline"`

	ActivityID         string                `bson:"activity_id"          json:"activity_id"`
	EntryType          FundLedgerEntryType   `bson:"entry_type"           json:"entry_type"`
	Status             FundLedgerEntryStatus `bson:"status"               json:"status"`
	Amount             string                `bson:"amount"               json:"amount"`
	ActorWallet        string                `bson:"actor_wallet"         json:"actor_wallet"`
	CounterpartyWallet string                `bson:"counterparty_wallet,omitempty" json:"counterparty_wallet,omitempty"`
	Note               string                `bson:"note,omitempty"       json:"note,omitempty"`
	Reference          string                `bson:"reference,omitempty"  json:"reference,omitempty"`
	BalanceAfter       string                `bson:"balance_after"        json:"balance_after"`
}

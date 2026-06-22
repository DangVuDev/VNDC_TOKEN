// Package ports defines all interfaces (ports) in the hexagonal architecture.
// Adapters (MongoDB, Redis, Ethereum) implement these interfaces.
// The application layer only depends on these interfaces — never on concrete types.
package ports

import (
	"context"
	"time"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

// ─────────────────────────────────────────────
//  Repository ports
// ─────────────────────────────────────────────

// TransactionRepository defines persistence operations for transactions.
type TransactionRepository interface {
	database.Repository[domain.Transaction]

	// Domain-specific queries
	FindByStatus(ctx context.Context, status domain.TransactionStatus, limit int64) ([]*domain.Transaction, error)
	FindByWallet(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.Transaction, int64, error)
	FindPendingOlderThan(ctx context.Context, threshold time.Duration) ([]*domain.Transaction, error)
	CountByStatus(ctx context.Context, status domain.TransactionStatus) (int64, error)
	HasActiveNonce(ctx context.Context, wallet, nonce string) (bool, error)
	AssignBatch(ctx context.Context, txIDs []string, batchID string) error
}

// BatchRepository defines persistence for settlement batches.
type BatchRepository interface {
	database.Repository[domain.Batch]

	FindByStatus(ctx context.Context, status domain.BatchStatus) ([]*domain.Batch, error)
	FindByTxHash(ctx context.Context, txHash string) (*domain.Batch, error)
}

// UserRepository defines persistence operations for users.
type UserRepository interface {
	database.Repository[domain.User]

	FindByWallet(ctx context.Context, wallet string) (*domain.User, error)
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	FindByUsername(ctx context.Context, username string) (*domain.User, error)
	UpdateNonce(ctx context.Context, wallet, newNonce string) error
	UpdateLoginInfo(ctx context.Context, wallet, ip string, loginAt time.Time) error
	IncrementFailedAttempts(ctx context.Context, wallet string) (int, error)
	ResetFailedAttempts(ctx context.Context, wallet string) error
	LockAccount(ctx context.Context, wallet string, until time.Time) error
	UnlockAccount(ctx context.Context, wallet string) error
	// IncrementActivityPoints atomically adds delta to the user's activity_points field.
	IncrementActivityPoints(ctx context.Context, wallet string, delta int64) error
	// FindRanked returns users ordered by activity_points descending with pagination.
	FindRanked(ctx context.Context, page, limit int64) ([]*domain.User, int64, error)
}

// NotificationRepository defines persistence for system notifications.
type NotificationRepository interface {
	database.Repository[domain.SystemNotification]

	FindForUser(ctx context.Context, userID string, page, pageSize int64, includeExpired bool, notifType string) ([]*domain.SystemNotification, int64, error)
	FindForAdmin(ctx context.Context, page, pageSize int64, includeExpired bool, notifType string) ([]*domain.SystemNotification, int64, error)
}

// NFTRepository defines persistence operations for NFTs.
type NFTRepository interface {
	database.Repository[domain.NFT]

	FindByOwner(ctx context.Context, owner string, opts ...database.QueryOption) ([]*domain.NFT, int64, error)
	FindByTokenID(ctx context.Context, tokenID string) (*domain.NFT, error)
}

// ─────────────────────────────────────────────
//  Cache ports
// ─────────────────────────────────────────────

// BalanceCachePort defines the dual-layer balance cache operations.
type BalanceCachePort interface {
	Get(ctx context.Context, wallet string) (*BalanceSnapshot, error)
	Set(ctx context.Context, wallet string, snapshot *BalanceSnapshot) error
	CheckAndReserve(ctx context.Context, wallet, amountWei string) (bool, error)
	Rollback(ctx context.Context, wallet, amountWei string) error
	Invalidate(ctx context.Context, wallet string) error
}

// BalanceSnapshot is the cache-layer representation of a wallet's balance.
type BalanceSnapshot struct {
	OnChain   string    `json:"on_chain"`
	Pending   string    `json:"pending"`
	Available string    `json:"available"`
	SyncedAt  time.Time `json:"synced_at"`
}

// NonceCachePort manages wallet nonces in cache for replay prevention.
type NonceCachePort interface {
	Get(ctx context.Context, wallet string) (string, error)
	Increment(ctx context.Context, wallet string) (string, error)
	Invalidate(ctx context.Context, wallet string) error
}

// ─────────────────────────────────────────────
//  Blockchain ports
// ─────────────────────────────────────────────

// TokenContractPort defines on-chain interactions with the VNDCToken ERC-20 contract.
// All methods mirror the Solidity functions in VNDCToken.sol.
type TokenContractPort interface {
	// ── Read-only ──────────────────────────────────────────────────────────

	// BalanceOf returns the token balance for an address (wei, decimal string).
	BalanceOf(ctx context.Context, wallet string) (string, error)

	// TotalSupply returns the current total token supply (wei, decimal string).
	TotalSupply(ctx context.Context) (string, error)

	// Nonce returns the on-chain EIP-712 nonce for a wallet.
	Nonce(ctx context.Context, wallet string) (uint64, error)

	// Paused returns whether the contract is currently paused.
	Paused(ctx context.Context) (bool, error)

	// VestingInfo returns the active vesting schedule for a holder.
	// Returns (amount wei, releaseTime unix, error).
	VestingInfo(ctx context.Context, holder string) (amount string, releaseTime int64, err error)

	// ── Write — meta-transaction (relayer submits, user signs) ──────────────

	// MetaTransfer submits a single EIP-712 signed transferWithSignature call.
	MetaTransfer(ctx context.Context, call MetaTransferCall) (txHash string, err error)

	// BatchTransfer submits multiple EIP-712 signed transfers in one on-chain transaction.
	BatchTransfer(ctx context.Context, batchID string, transfers []TransferCall) (*BatchTransferResult, error)

	// ── Write — admin/relayer operations (relayer key signs on-chain tx) ────

	// Mint mints tokens to a recipient. Requires MINTER_ROLE on the relayer key.
	Mint(ctx context.Context, to string, amount string) (txHash string, err error)

	// VestTokens creates a vesting schedule for a holder. Requires DEFAULT_ADMIN_ROLE.
	VestTokens(ctx context.Context, holder string, amount string, releaseTime int64) (txHash string, err error)

	// ReleaseVested releases vested tokens after their lock period.
	ReleaseVested(ctx context.Context, holder string) (txHash string, err error)

	// Pause halts all token transfers. Requires PAUSER_ROLE.
	Pause(ctx context.Context) (txHash string, err error)

	// Unpause resumes token transfers. Requires PAUSER_ROLE.
	Unpause(ctx context.Context) (txHash string, err error)
}

// NFTContractPort defines on-chain interactions with the ERC1155 NFT contract.
type NFTContractPort interface {
	// BalanceOf returns the NFT balance for a token ID.
	BalanceOf(ctx context.Context, wallet, tokenID string) (string, error)

	// MintBatch mints NFTs for multiple recipients in one transaction.
	MintBatch(ctx context.Context, mints []MintCall) (txHash string, err error)

	// MetaMint submits a single signed meta-mint.
	MetaMint(ctx context.Context, call MetaMintCall) (txHash string, err error)
}

// ERC721CollectionPort defines owner-driven mint interactions with the ERC721 collection.
type ERC721CollectionPort interface {
	Address() string
	// Mint mints one ERC721 token to recipient with a token URI.
	// Returns minted token ID and transaction hash.
	Mint(ctx context.Context, to, tokenURI string) (tokenID, txHash string, err error)
	// Approve allows a spender contract to transfer a specific token owned by the relayer.
	Approve(ctx context.Context, spender, tokenID string) (txHash string, err error)
	// ApproveWithSignature relays an owner-signed ERC721 approval for gasless resale.
	ApproveWithSignature(ctx context.Context, owner, spender, tokenID string, deadline int64, signature []byte) (txHash string, err error)
}

// TaskManagerContractPort defines on-chain interactions with the TaskManager contract.
// The backend (owner key) is the sole caller of claimReward — students never interact
// directly. This port is consumed by the ClaimWorker to settle approved claims.
type TaskManagerContractPort interface {
	// ClaimReward submits a claimReward() transaction on behalf of a student.
	// taskId is the bytes32 hex string (0x-prefixed), nonce is a *big.Int string.
	// Returns the on-chain transaction hash.
	ClaimReward(ctx context.Context, taskId, student, rewardAmount, nonce string) (txHash string, err error)

	// RegisterTask registers a new task on-chain (admin flow).
	RegisterTask(ctx context.Context, taskId, rewardAmount string, maxSlots uint64) (txHash string, err error)

	// PoolBalance returns the current pool balance (wei string).
	PoolBalance(ctx context.Context) (string, error)

	// ActivityPoints returns the accumulated activity points for a student.
	ActivityPoints(ctx context.Context, student string) (uint64, error)
}

// FundingContractPort defines on-chain interactions with the FundingManager contract.
// The backend relayer is the only signer; actor wallets are passed for authorization checks.
type FundingContractPort interface {
	Address() string
	CreatePot(
		ctx context.Context,
		potID,
		owner,
		category,
		title,
		targetAmount string,
		deputies []string,
		startsAt,
		endsAt int64,
	) (txHash string, err error)
	AddDeputy(ctx context.Context, potID, deputy string) (txHash string, err error)
	RemoveDeputy(ctx context.Context, potID, deputy string) (txHash string, err error)
	SetPotStatus(ctx context.Context, potID string, status uint8) (txHash string, err error)
	RecordContribution(ctx context.Context, potID, contributor, amount, transferTxHash string) (txHash string, err error)
	Spend(ctx context.Context, potID, actor, beneficiary, amount, note string) (txHash string, err error)
}

// DAOContractPort defines on-chain interactions with DAOManager contract.
type DAOContractPort interface {
	Address() string
	CreateDAO(
		ctx context.Context,
		daoID,
		name,
		metadataURI,
		governanceToken string,
		quorumBps,
		votingDelay,
		votingPeriod,
		timelockDuration uint64,
	) (txHash string, err error)
	SetDAOActive(ctx context.Context, daoID string, active bool) (txHash string, err error)
	CreateProposal(
		ctx context.Context,
		proposalID,
		daoID,
		proposer,
		target,
		value,
		calldata,
		descriptionHash string,
	) (txHash string, err error)
	CastVote(ctx context.Context, proposalID, voter string, support uint8, weight string) (txHash string, err error)
	QueueProposal(ctx context.Context, proposalID string, totalVotingPower string) (txHash string, err error)
	ExecuteProposal(ctx context.Context, proposalID string) (txHash string, err error)
	CancelProposal(ctx context.Context, proposalID, reason string) (txHash string, err error)
}

// MarketplaceContractPort defines on-chain interactions with fixed-price NFT listings.
type MarketplaceContractPort interface {
	Address() string
	CreateListing(ctx context.Context, listingID, seller, nftContract, paymentToken, tokenID, amount, price string) (txHash string, err error)
	UpdateListingPrice(ctx context.Context, listingID, newPrice string) (txHash string, err error)
	CancelListing(ctx context.Context, listingID string) (txHash string, err error)
	FinalizeSale(ctx context.Context, listingID, purchaseID, buyer, paymentTxHash string) (txHash string, err error)
}

// ─────────────────────────────────────────────
//  Call structs (relayer payloads)
// ─────────────────────────────────────────────

// TransferCall is one unit of a batch token transfer.
type TransferCall struct {
	TxID      string
	From      string
	To        string
	Amount    string // wei
	Nonce     string
	Deadline  int64
	Signature []byte
}

// MetaTransferCall is a standalone meta-transaction.
type MetaTransferCall = TransferCall

// BatchTransferResult contains the mined batch transaction and per-item outcomes emitted by the token contract.
type BatchTransferResult struct {
	BatchID     string
	TxHash      string
	BlockNumber uint64
	GasUsed     uint64
	Items       []BatchTransferItemResult
}

// BatchTransferItemResult maps one on-chain batch item back to one off-chain transaction.
type BatchTransferItemResult struct {
	TxID      string
	Index     int
	Success   bool
	ErrorCode string
	Reason    string
}

// MintCall is one unit of a batch NFT mint.
type MintCall struct {
	To           string
	TokenID      string
	Amount       string
	MetadataHash [32]byte
	Nonce        string
	Deadline     int64
	Signature    []byte
}

// MetaMintCall is a standalone meta-mint.
type MetaMintCall = MintCall

// ─────────────────────────────────────────────
//  Event bus port (async domain events)
// ─────────────────────────────────────────────

// EventType categorizes domain events.
type EventType string

const (
	EventTransactionQueued  EventType = "transaction.queued"
	EventTransactionSettled EventType = "transaction.settled"
	EventTransactionFailed  EventType = "transaction.failed"
	EventBatchSubmitted     EventType = "batch.submitted"
	EventBatchConfirmed     EventType = "batch.confirmed"
	EventNFTMinted          EventType = "nft.minted"
)

// DomainEvent carries event metadata + payload.
type DomainEvent struct {
	Type       EventType   `json:"type"`
	Payload    interface{} `json:"payload"`
	OccurredAt time.Time   `json:"occurred_at"`
}

// EventPublisher publishes domain events.
type EventPublisher interface {
	Publish(ctx context.Context, event DomainEvent) error
}

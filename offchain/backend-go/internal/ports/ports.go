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
	UpdateNonce(ctx context.Context, wallet, newNonce string) error
	UpdateLoginInfo(ctx context.Context, wallet, ip string, loginAt time.Time) error
	IncrementFailedAttempts(ctx context.Context, wallet string) (int, error)
	ResetFailedAttempts(ctx context.Context, wallet string) error
	LockAccount(ctx context.Context, wallet string, until time.Time) error
	UnlockAccount(ctx context.Context, wallet string) error
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

// TokenContractPort defines on-chain interactions with the ERC20 token contract.
type TokenContractPort interface {
	// BalanceOf returns the token balance for an address (in wei).
	BalanceOf(ctx context.Context, wallet string) (string, error)

	// BatchTransfer submits a batch of token transfers on-chain.
	BatchTransfer(ctx context.Context, transfers []TransferCall) (txHash string, err error)

	// MetaTransfer submits a single signed meta-transfer.
	MetaTransfer(ctx context.Context, call MetaTransferCall) (txHash string, err error)
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

// ─────────────────────────────────────────────
//  Call structs (relayer payloads)
// ─────────────────────────────────────────────

// TransferCall is one unit of a batch token transfer.
type TransferCall struct {
	From      string
	To        string
	Amount    string // wei
	Nonce     string
	Deadline  int64
	Signature []byte
}

// MetaTransferCall is a standalone meta-transaction.
type MetaTransferCall = TransferCall

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

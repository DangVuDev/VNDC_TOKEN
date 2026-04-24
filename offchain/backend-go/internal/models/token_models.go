// Package models — swagger model definitions for the token module.
package models

// ─────────────────────────────────────────────
//  /tokens/balance/:wallet  — GET
// ─────────────────────────────────────────────

// BalanceData is the multi-layer balance for a wallet address.
type BalanceData struct {
	Wallet string `json:"wallet"    example:"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`
	// OnChain is the confirmed on-chain balance in wei (as decimal string).
	OnChain string `json:"on_chain"  example:"5000000000000000000000"`
	// Pending is the sum of outgoing wei reserved for queued transfers not yet settled.
	Pending string `json:"pending"   example:"1000000000000000000000"`
	// Available is OnChain minus Pending — the amount the user can spend right now.
	Available string `json:"available" example:"4000000000000000000000"`
	// SyncedAt is when the on-chain balance was last fetched (RFC3339).
	SyncedAt string `json:"synced_at" example:"2026-04-24T07:00:00Z"`
}

// BalanceResponse is the envelope for GET /tokens/balance/:wallet.
type BalanceResponse struct {
	Success bool         `json:"success" example:"true"`
	Data    BalanceData  `json:"data"`
	Meta    ResponseMeta `json:"meta"`
}

// ─────────────────────────────────────────────
//  /tokens/transfer  — POST
// ─────────────────────────────────────────────

// TransferRequest is the body for POST /tokens/transfer.
type TransferRequest struct {
	// FromWallet is the sender's checksummed Ethereum address (must match JWT).
	FromWallet string `json:"from_wallet" example:"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"`
	// ToWallet is the recipient's checksummed Ethereum address.
	ToWallet string `json:"to_wallet"   example:"0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"`
	// Amount is the transfer value in wei expressed as a decimal string (no floats).
	Amount string `json:"amount"      example:"1000000000000000000"`
	// Nonce is the EIP-712 nonce (decimal string). Must be unique per sender.
	Nonce string `json:"nonce"       example:"42"`
	// Deadline is a Unix timestamp after which the signed transfer is invalid.
	Deadline int64 `json:"deadline"    example:"1745481600"`
	// Signature is the 0x-prefixed 65-byte EIP-712 signature (132 hex chars + 0x prefix).
	Signature string `json:"signature"   example:"0x4a5b6c...130hexchars...ef01"`
}

// TransferResponse is the envelope for a successfully queued transfer.
type TransferResponse struct {
	Success bool            `json:"success" example:"true"`
	Data    TransactionInfo `json:"data"`
	Meta    ResponseMeta    `json:"meta"`
}

// ─────────────────────────────────────────────
//  /tokens/transactions  — GET (paginated)
// ─────────────────────────────────────────────

// TransactionListResponse is the paginated envelope for transaction listings.
type TransactionListResponse struct {
	Success    bool              `json:"success"    example:"true"`
	Data       []TransactionInfo `json:"data"`
	Pagination PaginationMeta    `json:"pagination"`
	Meta       ResponseMeta      `json:"meta"`
}

// ─────────────────────────────────────────────
//  /tokens/transactions/:id  — GET
// ─────────────────────────────────────────────

// TransactionResponse is the envelope for a single transaction.
type TransactionResponse struct {
	Success bool            `json:"success" example:"true"`
	Data    TransactionInfo `json:"data"`
	Meta    ResponseMeta    `json:"meta"`
}

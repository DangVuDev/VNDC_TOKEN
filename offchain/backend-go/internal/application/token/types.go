// Package token defines request and response DTOs for the token-facing application boundary.
// These types document the external API contract used by handlers and frontend clients without exposing internal persistence models.
package token

// ─────────────────────────────────────────────
//  Read responses
// ─────────────────────────────────────────────

// BalanceResponse is the normalized balance snapshot returned to clients for one wallet.
// It combines confirmed on-chain state with off-chain pending-outflow bookkeeping so UIs can show spendable balance safely.
type BalanceResponse struct {
	Wallet    string `json:"wallet"`
	OnChain   string `json:"on_chain"`  // confirmed on-chain balance (wei as decimal string)
	Pending   string `json:"pending"`   // pending outbound transfers not yet settled
	Available string `json:"available"` // spendable = on_chain - pending_outbound
	SyncedAt  string `json:"synced_at"` // last on-chain sync timestamp (RFC3339)
}

// ContractInfoResponse summarizes chain-level token contract metadata needed by explorer-style or administrative frontend views.
type ContractInfoResponse struct {
	TotalSupply string `json:"total_supply"` // wei decimal string
	MaxSupply   string `json:"max_supply"`   // constant: 1 000 000 000 * 1e18
	Paused      bool   `json:"paused"`
}

// NonceResponse returns the current on-chain nonce a client must embed into the next typed-data transfer payload.
type NonceResponse struct {
	Wallet string `json:"wallet"`
	Nonce  uint64 `json:"nonce"` // pass this verbatim in the typed-data message
}

// VestingInfoResponse describes the currently active vesting schedule, or a zeroed schedule when none exists.
type VestingInfoResponse struct {
	Holder      string `json:"holder"`
	Amount      string `json:"amount"`       // wei decimal string; "0" when no schedule
	ReleaseTime int64  `json:"release_time"` // Unix timestamp; 0 when no schedule
	IsLocked    bool   `json:"is_locked"`    // true when current time < release_time
}

// TxResponse is the minimal success payload for privileged contract-management operations that only need to return a chain transaction hash.
type TxResponse struct {
	TxHash string `json:"tx_hash"`
}

// ─────────────────────────────────────────────
//  Write requests
// ─────────────────────────────────────────────

// TransferRequest carries one signed off-chain transfer intent for relayed settlement.
// Validation tags ensure the transport layer rejects obviously malformed wallet addresses or signatures before service execution.
type TransferRequest struct {
	FromWallet string `json:"from_wallet" validate:"required,eth_addr"`
	ToWallet   string `json:"to_wallet"   validate:"required,eth_addr"`
	Amount     string `json:"amount"      validate:"required"`         // wei decimal string
	Nonce      string `json:"nonce"       validate:"required"`         // must match on-chain nonce
	Deadline   int64  `json:"deadline"    validate:"required,min=1"`   // Unix timestamp > now
	Signature  string `json:"signature"   validate:"required,len=132"` // 0x-prefixed 65-byte hex
}

// MintRequest asks the privileged token service to mint new VNDC to a recipient wallet.
// The actual role enforcement and supply-cap checks remain inside the service and contract layers.
type MintRequest struct {
	To     string `json:"to"     validate:"required,eth_addr"`
	Amount string `json:"amount" validate:"required"` // wei decimal string
}

// VestTokensRequest creates or attempts to create a vesting schedule for one holder.
// ReleaseTime is expressed as a Unix timestamp so the API stays transport-agnostic and easy for web clients to construct.
type VestTokensRequest struct {
	Holder      string `json:"holder"       validate:"required,eth_addr"`
	Amount      string `json:"amount"       validate:"required"`       // wei decimal string
	ReleaseTime int64  `json:"release_time" validate:"required,min=1"` // Unix timestamp > now
}

// ReleaseVestedRequest identifies the vesting holder whose matured tokens should be released.
type ReleaseVestedRequest struct {
	Holder string `json:"holder" validate:"required,eth_addr"`
}

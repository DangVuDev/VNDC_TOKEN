// Package token — request/response DTO types for the token module.
package token

// BalanceResponse is the API representation of a user's token balance.
type BalanceResponse struct {
	Wallet    string `json:"wallet"`
	OnChain   string `json:"on_chain"`  // confirmed on-chain balance (wei as decimal string)
	Pending   string `json:"pending"`   // pending inbound transfers not yet confirmed
	Available string `json:"available"` // spendable = on_chain - pending_outbound
	SyncedAt  string `json:"synced_at"` // last on-chain sync timestamp (RFC3339)
}

// TransferRequest carries a validated EIP-712 signed transfer instruction.
type TransferRequest struct {
	FromWallet string `json:"from_wallet" validate:"required,eth_addr"`
	ToWallet   string `json:"to_wallet"   validate:"required,eth_addr"`
	Amount     string `json:"amount"      validate:"required"`         // decimal string (no scientific notation)
	Nonce      string `json:"nonce"       validate:"required"`         // per-wallet transfer nonce (hex or decimal)
	Deadline   int64  `json:"deadline"    validate:"required,min=1"`   // Unix timestamp; must be > now
	Signature  string `json:"signature"   validate:"required,len=132"` // 0x-prefixed 65-byte EIP-712 signature
}

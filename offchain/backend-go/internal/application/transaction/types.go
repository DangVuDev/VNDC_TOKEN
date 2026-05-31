// Package transaction defines request and response DTOs for the transaction HTTP/API layer.
// These types shape transport-facing contracts for transfer submission, cancellation, and transaction statistics.
package transaction

// ─────────────────────────────────────────────
//  Inbound request types
// ─────────────────────────────────────────────

// SubmitTransferRequest is the transport payload used to submit one signed token transfer for validation and queueing.
// Public callers fill the core transfer fields, while internal modules may additionally set contextual metadata for downstream reconciliation.
type SubmitTransferRequest struct {
	FromWallet string `json:"from_wallet" binding:"required" validate:"required,eth_addr"`
	ToWallet   string `json:"to_wallet"   binding:"required" validate:"required,eth_addr"`
	// Amount in token wei (18 decimals). Must be a decimal integer string, e.g. "1000000000000000000".
	Amount   string `json:"amount"    binding:"required" validate:"required"`
	Nonce    string `json:"nonce"     binding:"required" validate:"required"`
	Deadline int64  `json:"deadline"  binding:"required" validate:"required,min=1"`
	// 0x-prefixed 65-byte ECDSA signature (130 hex chars + "0x" prefix = 132 chars total).
	Signature string `json:"signature" binding:"required" validate:"required"`

	// Optional internal context fields (used by other modules via service call, not public API).
	Type        string `json:"type,omitempty"`
	ContextType string `json:"context_type,omitempty"`
	ContextID   string `json:"context_id,omitempty"`
	ContextRef  string `json:"context_ref,omitempty"`
}

// CancelTransactionRequest carries the optional operator- or user-supplied explanation for cancelling a still-cancellable transaction.
type CancelTransactionRequest struct {
	Reason string `json:"reason" validate:"max=256"`
}

// ─────────────────────────────────────────────
//  Outbound response types
// ─────────────────────────────────────────────

// TransactionStatsResponse aggregates transaction counts by lifecycle state for dashboards and operational summaries.
type TransactionStatsResponse struct {
	Pending    int64 `json:"pending"`
	Processing int64 `json:"processing"`
	Success    int64 `json:"success"`
	Failed     int64 `json:"failed"`
}

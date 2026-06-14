// Package workers contains background workers for the VNDC backend.
// The BatchWorker polls pending off-chain transactions, groups them into
// settlement batches, and submits them to the on-chain token contract.
package workers

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/blockchain"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────

// BatchWorkerConfig controls the pacing, retry policy, and size of one settlement cycle.
// These settings tune the tradeoff between throughput, latency, and retry aggressiveness.
type BatchWorkerConfig struct {
	// How many pending transactions to pull per batch cycle.
	BatchSize int
	// How long to wait between batch polling cycles.
	TickInterval time.Duration
	// Maximum retries before marking a batch as failed.
	MaxRetries int
	// How long to wait before retrying a failed on-chain submission.
	RetryDelay time.Duration
}

// FundContributionSync abstracts the ledger-side follow-up that must occur after fundraising contribution settlement succeeds or fails.
// The worker depends on this tiny boundary to avoid hard coupling to the fundraising service implementation.
type FundContributionSync interface {
	FinalizeContributionSettlement(ctx context.Context, activityID, txReference, batchTxHash string) error
	VoidContributionSettlement(ctx context.Context, activityID, txReference, reason string) error
}

// DefaultBatchWorkerConfig returns development-friendly defaults for batch size, cadence, and retry behavior.
// These values are intentionally modest so local environments remain observable and predictable.
func DefaultBatchWorkerConfig() BatchWorkerConfig {
	return BatchWorkerConfig{
		BatchSize:    10,
		TickInterval: 10 * time.Second,
		MaxRetries:   3,
		RetryDelay:   5 * time.Second,
	}
}

// ─────────────────────────────────────────────
//  BatchWorker
// ─────────────────────────────────────────────

// BatchWorker drains pending off-chain transactions, groups them into a batch, submits them on-chain, and reconciles side effects.
// It is the core settlement orchestrator that ties transaction persistence to actual blockchain execution.
type BatchWorker struct {
	txRepo          ports.TransactionRepository
	batchRepo       ports.BatchRepository
	balance         ports.BalanceCachePort
	token           ports.TokenContractPort
	funding         ports.FundingContractPort
	market          ports.MarketplaceContractPort
	listings        ports.MarketplaceListingRepository
	purchases       ports.MarketplacePurchaseRepository
	ticketProducts  ports.ServiceTicketProductRepository
	ticketPurchases ports.ServiceTicketPurchaseRepository
	fundSync        FundContributionSync
	cfg             BatchWorkerConfig
	log             logger.Logger
	// triggerCh receives signals from the TokenTransferWorker to run an immediate batch.
	// A nil channel is safe — the select case simply never fires.
	triggerCh <-chan struct{}
}

// NewBatchWorker constructs a ready-to-run batch worker with all repositories and downstream contract integrations wired in.
// Optional collaborators allow the same worker to coordinate fundraising, marketplace, and ticketing side effects after settlement.
func NewBatchWorker(
	txRepo ports.TransactionRepository,
	batchRepo ports.BatchRepository,
	balance ports.BalanceCachePort,
	token ports.TokenContractPort,
	funding ports.FundingContractPort,
	market ports.MarketplaceContractPort,
	listings ports.MarketplaceListingRepository,
	purchases ports.MarketplacePurchaseRepository,
	ticketProducts ports.ServiceTicketProductRepository,
	ticketPurchases ports.ServiceTicketPurchaseRepository,
	fundSync FundContributionSync,
	cfg BatchWorkerConfig,
	log logger.Logger,
) *BatchWorker {
	return &BatchWorker{
		txRepo:          txRepo,
		batchRepo:       batchRepo,
		balance:         balance,
		token:           token,
		funding:         funding,
		market:          market,
		listings:        listings,
		purchases:       purchases,
		ticketProducts:  ticketProducts,
		ticketPurchases: ticketPurchases,
		fundSync:        fundSync,
		cfg:             cfg,
		log:             log.Named("batch_worker"),
	}
}

// SetTriggerChan connects an optional external wake-up signal, typically from the TokenTransferWorker.
// A nil channel disables event-driven wake-ups and leaves the worker in pure tick-based mode.
func (w *BatchWorker) SetTriggerChan(ch <-chan struct{}) {
	w.triggerCh = ch
}

// Run starts the batch-settlement loop and reacts to both periodic ticks and external trigger signals.
// The worker blocks until context cancellation and is expected to run as a long-lived background goroutine.
func (w *BatchWorker) Run(ctx context.Context) {
	w.log.Info("batch worker started",
		logger.Int64("batch_size", int64(w.cfg.BatchSize)),
		logger.String("tick_interval", w.cfg.TickInterval.String()),
	)

	ticker := time.NewTicker(w.cfg.TickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.log.Info("batch worker stopping")
			return
		case <-ticker.C:
			if err := w.processBatch(ctx); err != nil {
				w.log.Error("batch processing error", logger.Err(err))
			}
		case <-w.triggerCh: // fired by TokenTransferWorker; nil channel never fires
			w.log.Info("batch triggered by change stream")
			if err := w.processBatch(ctx); err != nil {
				w.log.Error("triggered batch processing error", logger.Err(err))
			}
		}
	}
}

// -----------------------------------------------------------------------------
// processBatch - one full settlement cycle
// -----------------------------------------------------------------------------

// processBatch performs one complete settlement attempt: fetch pending txs, build a batch, submit on-chain, and reconcile outcomes.
// This is the worker's core orchestration method and intentionally centralizes all cross-module post-settlement side effects.
func (w *BatchWorker) processBatch(ctx context.Context) error {
	// 1. Fetch pending transactions
	pendingTxs, err := w.txRepo.FindByStatus(ctx, domain.TxStatusPending, int64(w.cfg.BatchSize))
	if err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "fetch pending txs failed", err)
	}
	if len(pendingTxs) == 0 {
		return nil // nothing to do
	}

	w.log.Info("processing batch", logger.Int64("count", int64(len(pendingTxs))))

	// 2. Build Batch record
	batchID := uuid.NewString()
	txIDs := make([]string, 0, len(pendingTxs))
	validTxs := make([]*domain.Transaction, 0, len(pendingTxs))
	totalAmount := big.NewInt(0)
	transfers := make([]ports.TransferCall, 0, len(pendingTxs))

	for _, tx := range pendingTxs {
		// Convert hex signature to bytes
		sigBytes, err := blockchain.HexToBytes(tx.Signature)
		if err != nil {
			w.log.Error("invalid signature hex",
				logger.String("tx_id", tx.ID),
				logger.String("signature", tx.Signature),
				logger.Err(err),
			)
			w.handlePostFailure(ctx, tx, "malformed signature hex: "+err.Error())
			// Mark this transaction as failed and skip it
			_ = w.txRepo.Update(ctx, tx.ID, map[string]interface{}{
				"status":     domain.TxStatusFailed,
				"last_error": "malformed signature hex: " + err.Error(),
			})
			continue
		}

		txIDs = append(txIDs, tx.ID)
		validTxs = append(validTxs, tx)

		amt, ok := new(big.Int).SetString(tx.Amount, 10)
		if ok && amt.Sign() > 0 {
			totalAmount.Add(totalAmount, amt)
		}

		transfers = append(transfers, ports.TransferCall{
			TxID:      tx.ID,
			From:      tx.FromWallet,
			To:        tx.ToWallet,
			Amount:    tx.Amount,
			Nonce:     tx.Nonce,
			Deadline:  tx.Deadline,
			Signature: sigBytes,
		})
	}

	// If all transactions had invalid signatures, skip batch processing
	if len(txIDs) == 0 {
		w.log.Info("batch skipped: all transactions had invalid signatures")
		return nil
	}

	now := time.Now().UTC()
	batch := &domain.Batch{
		BaseEntity:     domain.BaseEntity{ID: batchID},
		Status:         domain.BatchStatusPending,
		TransactionIDs: txIDs,
		TotalAmount:    totalAmount.String(),
		SubmittedAt:    &now,
	}

	if err := w.batchRepo.Create(ctx, batch); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "create batch record failed", err)
	}

	// 3. Mark transactions as PROCESSING and link to batch
	if err := w.txRepo.AssignBatch(ctx, txIDs, batchID); err != nil {
		return apperr.Wrap(apperr.ErrCodeDatabase, "assign batch to txs failed", err)
	}

	// 4. Submit on-chain with retry
	result, err := w.submitWithRetry(ctx, batchID, transfers)
	if err != nil {
		w.log.Error("batch on-chain submission failed",
			logger.String("batch_id", batchID),
			logger.Err(err),
		)
		w.markBatchFailed(ctx, batchID, txIDs, err.Error())
		return nil // don't surface — already recorded
	}
	txHash := result.TxHash

	// 5. Update batch as CONFIRMED
	confirmed := time.Now().UTC()
	w.updateBatchConfirmed(ctx, batchID, txHash, confirmed)

	// 6. Mark transactions from per-item events & re-sync balance caches from chain.
	// Collect unique wallets that need a balance refresh.
	walletSet := make(map[string]struct{}, len(validTxs)*2)
	outcomes := resultItemsByTxID(result.Items)
	if len(outcomes) == 0 {
		// Compatibility guard: a correctly upgraded contract emits one item event
		// per transfer. If an older local contract is still deployed, keep the
		// old all-success behavior instead of leaving PROCESSING records stuck.
		for _, tx := range validTxs {
			outcomes[tx.ID] = ports.BatchTransferItemResult{TxID: tx.ID, Success: true}
		}
	}
	for _, tx := range validTxs {
		outcome, ok := outcomes[tx.ID]
		if !ok {
			outcome = ports.BatchTransferItemResult{
				TxID:      tx.ID,
				Success:   false,
				ErrorCode: "MISSING_EVENT",
				Reason:    "batch item event not found",
			}
		}
		if outcome.Success {
			w.updateTxSuccess(ctx, tx.ID, batchID, txHash, confirmed)
			w.handlePostSettlement(ctx, tx, txHash)
		} else {
			reason := strings.TrimSpace(outcome.Reason)
			if reason == "" {
				reason = outcome.ErrorCode
			}
			if reason == "" {
				reason = "batch item failed"
			}
			w.updateTxFailed(ctx, tx.ID, batchID, txHash, reason)
			w.handlePostFailure(ctx, tx, reason)
		}
		walletSet[tx.FromWallet] = struct{}{}
		walletSet[tx.ToWallet] = struct{}{}
	}

	// Invalidate and immediately re-populate the balance cache from chain.
	for wallet := range walletSet {
		_ = w.balance.Invalidate(ctx, wallet) // Delete the stale entry
		if balStr, err := w.token.BalanceOf(ctx, wallet); err == nil {
			balBig, _ := new(big.Int).SetString(balStr, 10)
			if balBig == nil {
				balBig = big.NewInt(0)
			}
			_ = w.balance.Set(ctx, wallet, &ports.BalanceSnapshot{
				OnChain:   balBig.String(),
				Pending:   "0",
				Available: balBig.String(),
				SyncedAt:  time.Now().UTC(),
			})
		}
	}

	w.log.Info("batch settled",
		logger.String("batch_id", batchID),
		logger.String("tx_hash", txHash),
		logger.Int64("count", int64(len(txIDs))),
	)
	return nil
}

// handlePostSettlement dispatches transaction-type-specific follow-up logic after a successful on-chain batch submission.
// Different business modules need different state reconciliation once payment is actually settled.
func (w *BatchWorker) handlePostSettlement(ctx context.Context, tx *domain.Transaction, batchTxHash string) {
	switch tx.Type {
	case domain.TxTypeFundContribution:
		w.handleFundingContribution(ctx, tx, batchTxHash)
	case domain.TxTypeMarketplaceBuy:
		w.handleMarketplacePurchase(ctx, tx, batchTxHash)
	case domain.TxTypeServiceTicketBuy:
		w.handleServiceTicketPurchase(ctx, tx, batchTxHash)
	}
}

// handlePostFailure dispatches compensating actions for business flows affected by settlement failure.
// This is where the worker unwinds module-specific state such as contribution ledgers or reserved ticket stock.
func (w *BatchWorker) handlePostFailure(ctx context.Context, tx *domain.Transaction, reason string) {
	switch tx.Type {
	case domain.TxTypeFundContribution:
		if w.fundSync != nil && tx.ContextID != "" {
			if err := w.fundSync.VoidContributionSettlement(ctx, tx.ContextID, tx.ID, reason); err != nil {
				w.log.Error("void funding contribution ledger failed", logger.String("tx_id", tx.ID), logger.String("activity_id", tx.ContextID), logger.Err(err))
			}
		}
	case domain.TxTypeServiceTicketBuy:
		w.handleServiceTicketFailure(ctx, tx, reason)
	}
}

// handleFundingContribution finalizes a fundraising contribution after the payment transaction has been settled on-chain.
// It coordinates contract recording and ledger finalization so fundraising totals remain consistent.
func (w *BatchWorker) handleFundingContribution(ctx context.Context, tx *domain.Transaction, batchTxHash string) {
	if w.funding == nil {
		return
	}
	if tx.ContextRef == "" {
		w.log.Warn("fund contribution tx missing context_ref", logger.String("tx_id", tx.ID))
		return
	}
	if _, err := w.funding.RecordContribution(ctx, tx.ContextRef, tx.FromWallet, tx.Amount, batchTxHash); err != nil {
		w.log.Error("record contribution on-chain failed",
			logger.String("tx_id", tx.ID),
			logger.String("pot_id", tx.ContextRef),
			logger.String("batch_tx_hash", batchTxHash),
			logger.Err(err),
		)
		_ = w.txRepo.Update(ctx, tx.ID, map[string]interface{}{
			"last_error": "funding recordContribution failed: " + err.Error(),
		})
		if w.fundSync != nil && tx.ContextID != "" {
			if voidErr := w.fundSync.VoidContributionSettlement(ctx, tx.ContextID, tx.ID, "funding recordContribution failed: "+err.Error()); voidErr != nil {
				w.log.Error("void funding contribution ledger failed", logger.String("tx_id", tx.ID), logger.String("activity_id", tx.ContextID), logger.Err(voidErr))
			}
		}
		return
	}

	if w.fundSync != nil && tx.ContextID != "" {
		if err := w.fundSync.FinalizeContributionSettlement(ctx, tx.ContextID, tx.ID, batchTxHash); err != nil {
			w.log.Error("finalize funding contribution ledger failed",
				logger.String("tx_id", tx.ID),
				logger.String("activity_id", tx.ContextID),
				logger.String("batch_tx_hash", batchTxHash),
				logger.Err(err),
			)
		}
	}
}

// handleMarketplacePurchase reconciles a marketplace purchase after payment settlement succeeds.
// Depending on listing type, it either advances off-chain order state or finalizes an NFT sale on-chain.
func (w *BatchWorker) handleMarketplacePurchase(ctx context.Context, tx *domain.Transaction, batchTxHash string) {
	if w.listings == nil || w.purchases == nil {
		return
	}

	purchaseID := tx.ContextID
	if purchaseID == "" {
		purchase, err := w.purchases.FindByPaymentTxID(ctx, tx.ID)
		if err != nil {
			w.log.Error("marketplace purchase lookup failed", logger.String("tx_id", tx.ID), logger.Err(err))
			return
		}
		purchaseID = purchase.ID
	}

	purchase, err := w.purchases.FindByID(ctx, purchaseID)
	if err != nil {
		w.log.Error("marketplace purchase not found", logger.String("purchase_id", purchaseID), logger.String("tx_id", tx.ID), logger.Err(err))
		return
	}
	if purchase.Status == domain.MarketplacePurchaseCompleted && purchase.FinalizeTxHash != "" {
		if purchase.PaymentTxHash == "" {
			purchase.PaymentTxHash = batchTxHash
			_ = w.purchases.Update(ctx, purchase)
		}
		return
	}
	listing, err := w.listings.FindByID(ctx, purchase.ListingID)
	if err != nil {
		w.log.Error("marketplace listing not found", logger.String("listing_id", purchase.ListingID), logger.String("tx_id", tx.ID), logger.Err(err))
		return
	}

	// Non-NFT products are off-chain only. Keep order in business workflow states.
	isNFTListing := strings.EqualFold(strings.TrimSpace(listing.Category), "nft")
	if !isNFTListing || w.market == nil || listing.OnchainListingID == "" || listing.EscrowTxHash == "" {
		purchase.PaymentTxHash = batchTxHash
		purchase.FailureReason = ""
		if purchase.Status == domain.MarketplacePurchasePendingPayment {
			purchase.Status = domain.MarketplacePurchasePendingCOD
		}
		if err := w.purchases.Update(ctx, purchase); err != nil {
			w.log.Error("update marketplace purchase payment tx failed", logger.String("purchase_id", purchase.ID), logger.Err(err))
		}
		return
	}

	finalizeTxHash, err := w.market.FinalizeSale(ctx, listing.OnchainListingID, purchase.OnchainPurchaseID, purchase.BuyerWallet, batchTxHash)
	if err != nil {
		purchase.Status = domain.MarketplacePurchaseFailed
		purchase.PaymentTxHash = batchTxHash
		purchase.FailureReason = err.Error()
		if updateErr := w.purchases.Update(ctx, purchase); updateErr != nil {
			w.log.Error("update failed marketplace purchase", logger.String("purchase_id", purchase.ID), logger.Err(updateErr))
		}
		listing.BuyerWallet = ""
		if updateErr := w.listings.Update(ctx, listing); updateErr != nil {
			w.log.Error("reset reserved marketplace listing buyer failed", logger.String("listing_id", listing.ID), logger.Err(updateErr))
		}
		_ = w.txRepo.Update(ctx, tx.ID, map[string]interface{}{
			"last_error": "marketplace finalizeSale failed: " + err.Error(),
		})
		w.log.Error("finalize marketplace sale failed",
			logger.String("tx_id", tx.ID),
			logger.String("listing_id", listing.ID),
			logger.String("purchase_id", purchase.ID),
			logger.Err(err),
		)
		return
	}

	now := time.Now().UTC()
	purchase.Status = domain.MarketplacePurchaseCompleted
	purchase.PaymentTxHash = batchTxHash
	purchase.FinalizeTxHash = finalizeTxHash
	purchase.FailureReason = ""
	if err := w.purchases.Update(ctx, purchase); err != nil {
		w.log.Error("update completed marketplace purchase failed", logger.String("purchase_id", purchase.ID), logger.Err(err))
	}

	listing.Status = domain.MarketplaceListingSold
	listing.BuyerWallet = purchase.BuyerWallet
	listing.FinalizeTxHash = finalizeTxHash
	listing.SoldAt = &now
	if err := w.listings.Update(ctx, listing); err != nil {
		w.log.Error("update sold marketplace listing failed", logger.String("listing_id", listing.ID), logger.Err(err))
	}
}

// handleServiceTicketPurchase finalizes a service-ticket purchase after payment clears.
// It converts reserved stock into sold stock and marks the purchase completed.
func (w *BatchWorker) handleServiceTicketPurchase(ctx context.Context, tx *domain.Transaction, batchTxHash string) {
	if w.ticketProducts == nil || w.ticketPurchases == nil {
		return
	}

	purchaseID := tx.ContextID
	if purchaseID == "" {
		purchase, err := w.ticketPurchases.FindByPaymentTxID(ctx, tx.ID)
		if err != nil {
			w.log.Error("service ticket purchase lookup failed", logger.String("tx_id", tx.ID), logger.Err(err))
			return
		}
		purchaseID = purchase.ID
	}

	purchase, err := w.ticketPurchases.FindByID(ctx, purchaseID)
	if err != nil {
		w.log.Error("service ticket purchase not found", logger.String("purchase_id", purchaseID), logger.String("tx_id", tx.ID), logger.Err(err))
		return
	}
	if purchase.Status == domain.ServiceTicketPurchaseCompleted {
		return
	}
	product, err := w.ticketProducts.FindByID(ctx, purchase.ProductID)
	if err != nil {
		w.log.Error("service ticket product not found", logger.String("product_id", purchase.ProductID), logger.String("tx_id", tx.ID), logger.Err(err))
		return
	}

	if product.StockMode == domain.ServiceTicketStockModeLimited {
		if product.ReservedStock >= purchase.Quantity {
			product.ReservedStock -= purchase.Quantity
		} else {
			product.ReservedStock = 0
		}
		product.AvailableStock = product.TotalStock - product.SoldStock - product.ReservedStock
		if product.AvailableStock < 0 {
			product.AvailableStock = 0
		}
	}
	product.SoldStock += purchase.Quantity
	if err := w.ticketProducts.Update(ctx, product); err != nil {
		w.log.Error("update service ticket product failed", logger.String("product_id", product.ID), logger.Err(err))
	}

	now := time.Now().UTC()
	purchase.Status = domain.ServiceTicketPurchaseCompleted
	purchase.PaymentTxHash = batchTxHash
	purchase.FailureReason = ""
	purchase.CompletedAt = &now
	if err := w.ticketPurchases.Update(ctx, purchase); err != nil {
		w.log.Error("update completed service ticket purchase failed", logger.String("purchase_id", purchase.ID), logger.Err(err))
	}
}

// handleServiceTicketFailure releases reserved ticket stock and marks the purchase failed when settlement does not complete.
// This compensating action prevents inventory from remaining stuck in a reserved state indefinitely.
func (w *BatchWorker) handleServiceTicketFailure(ctx context.Context, tx *domain.Transaction, reason string) {
	if w.ticketProducts == nil || w.ticketPurchases == nil {
		return
	}

	purchaseID := tx.ContextID
	if purchaseID == "" {
		purchase, err := w.ticketPurchases.FindByPaymentTxID(ctx, tx.ID)
		if err != nil {
			return
		}
		purchaseID = purchase.ID
	}
	purchase, err := w.ticketPurchases.FindByID(ctx, purchaseID)
	if err != nil {
		return
	}
	if purchase.Status == domain.ServiceTicketPurchaseCompleted || purchase.Status == domain.ServiceTicketPurchaseFailed {
		return
	}

	if product, err := w.ticketProducts.FindByID(ctx, purchase.ProductID); err == nil {
		if product.StockMode == domain.ServiceTicketStockModeLimited {
			if product.ReservedStock >= purchase.Quantity {
				product.ReservedStock -= purchase.Quantity
			} else {
				product.ReservedStock = 0
			}
			product.AvailableStock = product.TotalStock - product.SoldStock - product.ReservedStock
			if product.AvailableStock < 0 {
				product.AvailableStock = 0
			}
		}
		if updateErr := w.ticketProducts.Update(ctx, product); updateErr != nil {
			w.log.Error("release service ticket reservation failed", logger.String("product_id", product.ID), logger.Err(updateErr))
		}
	}

	purchase.Status = domain.ServiceTicketPurchaseFailed
	purchase.FailureReason = reason
	if err := w.ticketPurchases.Update(ctx, purchase); err != nil {
		w.log.Error("update failed service ticket purchase failed", logger.String("purchase_id", purchase.ID), logger.Err(err))
	}
}

// -----------------------------------------------------------------------------
// submitWithRetry - on-chain submission
// -----------------------------------------------------------------------------

// submitWithRetry executes the batch transfer on-chain with bounded retry attempts and delay.
// It isolates retry policy from the rest of processBatch so submission behavior is easier to reason about and tune.
func (w *BatchWorker) submitWithRetry(ctx context.Context, batchID string, transfers []ports.TransferCall) (*ports.BatchTransferResult, error) {
	var lastErr error
	for attempt := 1; attempt <= w.cfg.MaxRetries; attempt++ {
		result, err := w.token.BatchTransfer(ctx, batchID, transfers)
		if err == nil {
			return result, nil
		}
		lastErr = err
		w.log.Warn("batch submission attempt failed",
			logger.String("batch_id", batchID),
			logger.Int64("attempt", int64(attempt)),
			logger.Err(err),
		)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(w.cfg.RetryDelay):
		}
	}
	return nil, lastErr
}

// -----------------------------------------------------------------------------
// Status update helpers
// -----------------------------------------------------------------------------

// markBatchFailed marks the batch and all of its transactions as failed and invokes failure-side compensation hooks.
// It is the central rollback-style path when a batch cannot be submitted successfully.
func (w *BatchWorker) markBatchFailed(ctx context.Context, batchID string, txIDs []string, reason string) {
	// Update batch status
	if err := w.batchRepo.Update(ctx, batchID, map[string]interface{}{"status": domain.BatchStatusFailed, "last_error": reason}); err != nil {
		w.log.Error("update batch failed status error", logger.Err(err))
	}

	// Roll back each transaction to FAILED and release reserved balance
	for _, id := range txIDs {
		tx, err := w.txRepo.FindByID(ctx, id)
		if err == nil && tx != nil {
			w.handlePostFailure(ctx, tx, reason)
		}

		if err := w.txRepo.Update(ctx, id, map[string]interface{}{"status": domain.TxStatusFailed, "last_error": reason}); err != nil {
			w.log.Error("update tx failed status error", logger.String("tx_id", id), logger.Err(err))
		}
	}
}

// updateBatchConfirmed persists the final success status and chain transaction hash for a batch.
func (w *BatchWorker) updateBatchConfirmed(ctx context.Context, batchID, txHash string, confirmedAt time.Time) {
	if err := w.batchRepo.Update(ctx, batchID, map[string]interface{}{"status": domain.BatchStatusConfirmed, "tx_hash": txHash, "confirmed_at": confirmedAt}); err != nil {
		w.log.Error("update batch confirmed error", logger.Err(err))
	}
}

// updateTxSuccess persists success metadata for one transaction after batch confirmation.
func (w *BatchWorker) updateTxSuccess(ctx context.Context, txID, batchID, txHash string, settledAt time.Time) {
	if err := w.txRepo.Update(ctx, txID, map[string]interface{}{"status": domain.TxStatusSuccess, "batch_id": batchID, "tx_hash": txHash, "settled_at": settledAt}); err != nil {
		w.log.Error("update tx success error", logger.String("tx_id", txID), logger.Err(err))
	}
}

func (w *BatchWorker) updateTxFailed(ctx context.Context, txID, batchID, txHash, reason string) {
	if err := w.txRepo.Update(ctx, txID, map[string]interface{}{
		"status":     domain.TxStatusFailed,
		"batch_id":   batchID,
		"tx_hash":    txHash,
		"last_error": reason,
	}); err != nil {
		w.log.Error("update tx failed error", logger.String("tx_id", txID), logger.Err(err))
	}
}

func resultItemsByTxID(items []ports.BatchTransferItemResult) map[string]ports.BatchTransferItemResult {
	out := make(map[string]ports.BatchTransferItemResult, len(items))
	for _, item := range items {
		if item.TxID == "" {
			continue
		}
		out[item.TxID] = item
	}
	return out
}

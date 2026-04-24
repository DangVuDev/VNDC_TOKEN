// Package blockchain provides an Ethereum client abstraction.
// Wraps go-ethereum with retry, confirmation waiting, and structured error handling.
package blockchain

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"

	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  ClientConfig
// ─────────────────────────────────────────────

// ClientConfig holds Ethereum RPC settings.
type ClientConfig struct {
	RPCURL               string
	WSURL                string
	ChainID              int64
	ConfirmationBlocks   uint64
	ConfirmationInterval time.Duration
	MaxGasPriceGwei      int64
}

// ─────────────────────────────────────────────
//  Client
// ─────────────────────────────────────────────

// Client wraps go-ethereum ethclient with additional utilities.
type Client struct {
	eth     *ethclient.Client
	cfg     ClientConfig
	chainID *big.Int
	log     logger.Logger
}

// NewClient connects to an Ethereum RPC node and validates the chain ID.
func NewClient(ctx context.Context, cfg ClientConfig, log logger.Logger) (*Client, error) {
	eth, err := ethclient.DialContext(ctx, cfg.RPCURL)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "dial failed", err)
	}

	chainID, err := eth.ChainID(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "get chainID failed", err)
	}

	if cfg.ChainID != 0 && chainID.Int64() != cfg.ChainID {
		return nil, apperr.New(apperr.ErrCodeBlockchain,
			fmt.Sprintf("chain ID mismatch: expected %d, got %s", cfg.ChainID, chainID))
	}

	log.Info("blockchain client connected",
		logger.String("rpc", cfg.RPCURL),
		logger.String("chain_id", chainID.String()),
	)

	return &Client{
		eth:     eth,
		cfg:     cfg,
		chainID: chainID,
		log:     log.Named("blockchain"),
	}, nil
}

// Close disconnects the client.
func (c *Client) Close() { c.eth.Close() }

// Eth returns the underlying ethclient (for contract bindings).
func (c *Client) Eth() *ethclient.Client { return c.eth }

// ChainID returns the connected network's chain ID.
func (c *Client) ChainID() *big.Int { return c.chainID }

// Health checks RPC connectivity.
func (c *Client) Health(ctx context.Context) error {
	_, err := c.eth.BlockNumber(ctx)
	return err
}

// ── Query methods ─────────────────────────────

// BlockNumber returns the latest confirmed block number.
func (c *Client) BlockNumber(ctx context.Context) (uint64, error) {
	return c.eth.BlockNumber(ctx)
}

// BalanceAt returns the ETH balance at a block (nil = latest).
func (c *Client) BalanceAt(ctx context.Context, addr common.Address, block *big.Int) (*big.Int, error) {
	bal, err := c.eth.BalanceAt(ctx, addr, block)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "BalanceAt failed", err)
	}
	return bal, nil
}

// NonceAt returns the next nonce (transaction count) for an address.
func (c *Client) NonceAt(ctx context.Context, addr common.Address) (uint64, error) {
	nonce, err := c.eth.PendingNonceAt(ctx, addr)
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeBlockchain, "NonceAt failed", err)
	}
	return nonce, nil
}

// SuggestGasPrice returns the current suggested gas price.
func (c *Client) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	gp, err := c.eth.SuggestGasPrice(ctx)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "SuggestGasPrice failed", err)
	}
	return gp, nil
}

// EstimateGas estimates gas for a transaction.
func (c *Client) EstimateGas(ctx context.Context, msg ethereum.CallMsg) (uint64, error) {
	gas, err := c.eth.EstimateGas(ctx, msg)
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeBlockchain, "EstimateGas failed", err)
	}
	return gas, nil
}

// ── Send & Wait ───────────────────────────────

// SendRawTransaction broadcasts a signed transaction.
func (c *Client) SendRawTransaction(ctx context.Context, tx *types.Transaction) error {
	if err := c.eth.SendTransaction(ctx, tx); err != nil {
		return apperr.Wrap(apperr.ErrCodeBlockchain, "SendTransaction failed", err)
	}
	c.log.Info("transaction sent", logger.String("tx_hash", tx.Hash().Hex()))
	return nil
}

// WaitForReceipt polls for a receipt until ConfirmationBlocks are accumulated.
func (c *Client) WaitForReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error) {
	ticker := time.NewTicker(c.cfg.ConfirmationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
			receipt, err := c.eth.TransactionReceipt(ctx, txHash)
			if err != nil {
				continue // not yet mined
			}

			if receipt.Status == types.ReceiptStatusFailed {
				return receipt, apperr.New(apperr.ErrCodeContractRevert,
					fmt.Sprintf("transaction %s reverted", txHash.Hex()))
			}

			latest, err := c.eth.BlockNumber(ctx)
			if err != nil {
				continue
			}

			confirmations := latest - receipt.BlockNumber.Uint64()
			if confirmations >= c.cfg.ConfirmationBlocks {
				c.log.Info("transaction confirmed",
					logger.String("tx_hash", txHash.Hex()),
					logger.Int64("confirmations", int64(confirmations)),
				)
				return receipt, nil
			}
		}
	}
}

// TransactionReceipt returns the receipt without waiting for confirmations.
func (c *Client) TransactionReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error) {
	receipt, err := c.eth.TransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "TransactionReceipt failed", err)
	}
	return receipt, nil
}

// FilterLogs returns logs matching a filter query.
func (c *Client) FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error) {
	logs, err := c.eth.FilterLogs(ctx, q)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "FilterLogs failed", err)
	}
	return logs, nil
}

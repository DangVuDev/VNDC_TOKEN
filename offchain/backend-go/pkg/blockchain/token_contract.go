// Package blockchain — concrete adapter for the VNDCToken ERC-20 smart contract.
// Implements ports.TokenContractPort.
// Every public function in VNDCToken.sol is covered here.
package blockchain

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  VNDCToken ABI — mirrors VNDCToken.sol exactly
// ─────────────────────────────────────────────

// vndcTokenABI is the complete ABI for VNDCToken.sol.
// Covers every externally callable function the backend needs.
const vndcTokenABI = `[
  {
    "type": "constructor",
    "inputs": [{"internalType":"uint256","name":"initialSupply","type":"uint256"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [{"internalType":"string","name":"","type":"string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [{"internalType":"string","name":"","type":"string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [{"internalType":"uint8","name":"","type":"uint8"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_SUPPLY",
    "inputs": [],
    "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{"internalType":"address","name":"account","type":"address"}],
    "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {"internalType":"address","name":"to","type":"address"},
      {"internalType":"uint256","name":"value","type":"uint256"}
    ],
    "outputs": [{"internalType":"bool","name":"","type":"bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {"internalType":"address","name":"from","type":"address"},
      {"internalType":"address","name":"to","type":"address"},
      {"internalType":"uint256","name":"value","type":"uint256"}
    ],
    "outputs": [{"internalType":"bool","name":"","type":"bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {"internalType":"address","name":"owner","type":"address"},
      {"internalType":"address","name":"spender","type":"address"}
    ],
    "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {"internalType":"address","name":"spender","type":"address"},
      {"internalType":"uint256","name":"value","type":"uint256"}
    ],
    "outputs": [{"internalType":"bool","name":"","type":"bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "nonces",
    "inputs": [{"internalType":"address","name":"owner","type":"address"}],
    "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{"internalType":"bool","name":"","type":"bool"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vestingInfo",
    "inputs": [{"internalType":"address","name":"","type":"address"}],
    "outputs": [
      {"internalType":"uint256","name":"amount","type":"uint256"},
      {"internalType":"uint256","name":"releaseTime","type":"uint256"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MINTER_ROLE",
    "inputs": [],
    "outputs": [{"internalType":"bytes32","name":"","type":"bytes32"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PAUSER_ROLE",
    "inputs": [],
    "outputs": [{"internalType":"bytes32","name":"","type":"bytes32"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DEFAULT_ADMIN_ROLE",
    "inputs": [],
    "outputs": [{"internalType":"bytes32","name":"","type":"bytes32"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasRole",
    "inputs": [
      {"internalType":"bytes32","name":"role","type":"bytes32"},
      {"internalType":"address","name":"account","type":"address"}
    ],
    "outputs": [{"internalType":"bool","name":"","type":"bool"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantRole",
    "inputs": [
      {"internalType":"bytes32","name":"role","type":"bytes32"},
      {"internalType":"address","name":"account","type":"address"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeRole",
    "inputs": [
      {"internalType":"bytes32","name":"role","type":"bytes32"},
      {"internalType":"address","name":"account","type":"address"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      {"internalType":"address","name":"to","type":"address"},
      {"internalType":"uint256","name":"amount","type":"uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "burn",
    "inputs": [{"internalType":"uint256","name":"value","type":"uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vestTokens",
    "inputs": [
      {"internalType":"address","name":"holder","type":"address"},
      {"internalType":"uint256","name":"amount","type":"uint256"},
      {"internalType":"uint256","name":"releaseTime","type":"uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "releaseVested",
    "inputs": [{"internalType":"address","name":"holder","type":"address"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferWithSignature",
    "inputs": [
      {"internalType":"address","name":"from","type":"address"},
      {"internalType":"address","name":"to","type":"address"},
      {"internalType":"uint256","name":"amount","type":"uint256"},
      {"internalType":"uint256","name":"nonce","type":"uint256"},
      {"internalType":"uint256","name":"deadline","type":"uint256"},
      {"internalType":"bytes","name":"signature","type":"bytes"}
    ],
    "outputs": [{"internalType":"bool","name":"","type":"bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "batchTransferWithSignatureV2",
    "inputs": [
      {"internalType":"bytes32","name":"batchId","type":"bytes32"},
      {"components":[
        {"internalType":"bytes32","name":"txId","type":"bytes32"},
        {"internalType":"address","name":"from","type":"address"},
        {"internalType":"address","name":"to","type":"address"},
        {"internalType":"uint256","name":"amount","type":"uint256"},
        {"internalType":"uint256","name":"nonce","type":"uint256"},
        {"internalType":"uint256","name":"deadline","type":"uint256"},
        {"internalType":"bytes","name":"signature","type":"bytes"}
      ],"internalType":"struct VNDCToken.SignedTransfer[]","name":"transfers","type":"tuple[]"}
    ],
    "outputs": [
      {"internalType":"uint256","name":"successCount","type":"uint256"},
      {"internalType":"uint256","name":"failureCount","type":"uint256"}
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type":"event",
    "name":"MetaTransferItemResult",
    "inputs":[
      {"indexed":true,"internalType":"bytes32","name":"batchId","type":"bytes32"},
      {"indexed":true,"internalType":"bytes32","name":"txId","type":"bytes32"},
      {"indexed":true,"internalType":"uint256","name":"index","type":"uint256"},
      {"indexed":false,"internalType":"address","name":"from","type":"address"},
      {"indexed":false,"internalType":"address","name":"to","type":"address"},
      {"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},
      {"indexed":false,"internalType":"uint256","name":"nonce","type":"uint256"},
      {"indexed":false,"internalType":"bool","name":"success","type":"bool"},
      {"indexed":false,"internalType":"bytes32","name":"errorCode","type":"bytes32"},
      {"indexed":false,"internalType":"string","name":"reason","type":"string"}
    ],
    "anonymous":false
  }
]`

// ─────────────────────────────────────────────
//  TokenContractAdapter
// ─────────────────────────────────────────────

// TokenContractAdapter implements ports.TokenContractPort.
// It communicates with the deployed VNDCToken contract via go-ethereum ABI calls.
// The relayer key is used to sign and submit on-chain write transactions.
type TokenContractAdapter struct {
	eth          *ethclient.Client
	contractAddr common.Address
	relayerKey   *ecdsa.PrivateKey
	relayerAddr  common.Address
	chainID      *big.Int
	abi          abi.ABI
	log          logger.Logger
}

// NewTokenContractAdapter constructs a fully initialized TokenContractAdapter.
// relayerPrivKey is a 0x-prefixed hex private key string.
func NewTokenContractAdapter(
	ethClient *Client,
	contractAddress string,
	relayerPrivKey string,
	log logger.Logger,
) (ports.TokenContractPort, error) {
	parsedABI, err := abi.JSON(strings.NewReader(vndcTokenABI))
	if err != nil {
		return nil, fmt.Errorf("token_contract: parse ABI: %w", err)
	}

	privKeyHex := strings.TrimPrefix(relayerPrivKey, "0x")
	privateKey, err := crypto.HexToECDSA(privKeyHex)
	if err != nil {
		return nil, fmt.Errorf("token_contract: parse relayer key: %w", err)
	}

	pubKeyECDSA, ok := privateKey.Public().(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("token_contract: cast public key failed")
	}

	relayerAddr := crypto.PubkeyToAddress(*pubKeyECDSA)
	log.Info("VNDCToken adapter initialised",
		logger.String("contract", contractAddress),
		logger.String("relayer", relayerAddr.Hex()),
	)

	return &TokenContractAdapter{
		eth:          ethClient.Eth(),
		contractAddr: common.HexToAddress(contractAddress),
		relayerKey:   privateKey,
		relayerAddr:  relayerAddr,
		chainID:      ethClient.ChainID(),
		abi:          parsedABI,
		log:          log.Named("token_contract"),
	}, nil
}

// ─────────────────────────────────────────────
//  Read — BalanceOf
// ─────────────────────────────────────────────

// BalanceOf returns the token balance of wallet in wei (decimal string).
func (a *TokenContractAdapter) BalanceOf(ctx context.Context, wallet string) (string, error) {
	result, err := a.call(ctx, "balanceOf", common.HexToAddress(wallet))
	if err != nil {
		return "0", apperr.Wrap(apperr.ErrCodeBlockchain, "balanceOf call failed", err)
	}
	return bigIntResult(result, "balanceOf")
}

// ─────────────────────────────────────────────
//  Read — TotalSupply
// ─────────────────────────────────────────────

// TotalSupply returns the current total token supply in wei (decimal string).
func (a *TokenContractAdapter) TotalSupply(ctx context.Context) (string, error) {
	result, err := a.call(ctx, "totalSupply")
	if err != nil {
		return "0", apperr.Wrap(apperr.ErrCodeBlockchain, "totalSupply call failed", err)
	}
	return bigIntResult(result, "totalSupply")
}

// ─────────────────────────────────────────────
//  Read — Nonce
// ─────────────────────────────────────────────

// Nonce returns the current EIP-712 nonce for the given wallet.
// The frontend must pass this value verbatim in the typed-data message.
func (a *TokenContractAdapter) Nonce(ctx context.Context, wallet string) (uint64, error) {
	result, err := a.call(ctx, "nonces", common.HexToAddress(wallet))
	if err != nil {
		return 0, apperr.Wrap(apperr.ErrCodeBlockchain, "nonces call failed", err)
	}
	if len(result) == 0 {
		return 0, nil
	}
	n, ok := result[0].(*big.Int)
	if !ok {
		return 0, apperr.New(apperr.ErrCodeBlockchain, "nonces: unexpected return type")
	}
	return n.Uint64(), nil
}

// ─────────────────────────────────────────────
//  Read — Paused
// ─────────────────────────────────────────────

// Paused returns true when all token transfers are halted.
func (a *TokenContractAdapter) Paused(ctx context.Context) (bool, error) {
	result, err := a.call(ctx, "paused")
	if err != nil {
		return false, apperr.Wrap(apperr.ErrCodeBlockchain, "paused call failed", err)
	}
	if len(result) == 0 {
		return false, nil
	}
	paused, ok := result[0].(bool)
	if !ok {
		return false, apperr.New(apperr.ErrCodeBlockchain, "paused: unexpected return type")
	}
	return paused, nil
}

// ─────────────────────────────────────────────
//  Read — VestingInfo
// ─────────────────────────────────────────────

// VestingInfo returns the active vesting schedule for holder.
// Returns the vested amount (wei decimal string) and Unix release timestamp.
// Returns ("0", 0, nil) when no vesting schedule exists.
func (a *TokenContractAdapter) VestingInfo(ctx context.Context, holder string) (string, int64, error) {
	result, err := a.call(ctx, "vestingInfo", common.HexToAddress(holder))
	if err != nil {
		return "0", 0, apperr.Wrap(apperr.ErrCodeBlockchain, "vestingInfo call failed", err)
	}
	if len(result) < 2 {
		return "0", 0, nil
	}

	amount, ok1 := result[0].(*big.Int)
	releaseTime, ok2 := result[1].(*big.Int)
	if !ok1 || !ok2 {
		return "0", 0, apperr.New(apperr.ErrCodeBlockchain, "vestingInfo: unexpected return types")
	}

	return amount.String(), releaseTime.Int64(), nil
}

// ─────────────────────────────────────────────
//  Write — MetaTransfer (EIP-712 signed transfer)
// ─────────────────────────────────────────────

// MetaTransfer calls transferWithSignature on the contract.
// The user's EIP-712 signature authorises the transfer;
// the relayer key pays the gas and submits the transaction.
func (a *TokenContractAdapter) MetaTransfer(ctx context.Context, call ports.MetaTransferCall) (string, error) {
	from, to, amount, nonce, err := parseTransferParams(call.From, call.To, call.Amount, call.Nonce)
	if err != nil {
		return "", err
	}
	return a.sendTransferWithSignature(ctx, from, to, amount, nonce, call.Deadline, call.Signature)
}

// ─────────────────────────────────────────────
//  Write — BatchTransfer
// ─────────────────────────────────────────────

// BatchTransfer executes multiple meta-transfers in one contract call and returns per-item event outcomes.
func (a *TokenContractAdapter) BatchTransfer(ctx context.Context, batchID string, transfers []ports.TransferCall) (*ports.BatchTransferResult, error) {
	if len(transfers) == 0 {
		return &ports.BatchTransferResult{BatchID: batchID}, nil
	}

	batchIDBytes := bytes32FromString(batchID)
	txIDByHash := make(map[string]string, len(transfers))
	items := make([]signedTransferABI, 0, len(transfers))
	for i, t := range transfers {
		from, to, amount, nonce, err := parseTransferParams(t.From, t.To, t.Amount, t.Nonce)
		if err != nil {
			return nil, fmt.Errorf("transfer[%d]: %w", i, err)
		}
		txID := t.TxID
		if txID == "" {
			txID = fmt.Sprintf("%d", i)
		}
		txIDBytes := bytes32FromString(txID)
		txIDByHash[common.BytesToHash(txIDBytes[:]).Hex()] = txID
		items = append(items, signedTransferABI{
			TxId:      txIDBytes,
			From:      from,
			To:        to,
			Amount:    amount,
			Nonce:     nonce,
			Deadline:  big.NewInt(t.Deadline),
			Signature: t.Signature,
		})
	}

	callData, err := a.abi.Pack("batchTransferWithSignatureV2", batchIDBytes, items)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "pack batchTransferWithSignatureV2 failed", err)
	}
	txHash, receipt, err := a.sendTxWithReceipt(ctx, callData)
	if err != nil {
		return nil, err
	}
	result := &ports.BatchTransferResult{
		BatchID:     batchID,
		TxHash:      txHash,
		BlockNumber: receipt.BlockNumber.Uint64(),
		GasUsed:     receipt.GasUsed,
	}
	result.Items = a.parseBatchItemResults(receipt, txIDByHash)
	a.log.Info("batch transfer submitted",
		logger.String("batch_id", batchID),
		logger.String("tx_hash", txHash),
		logger.Int("items", len(transfers)),
		logger.Int("item_results", len(result.Items)),
	)
	return result, nil
}

// ─────────────────────────────────────────────
//  Write — Mint
// ─────────────────────────────────────────────

// Mint mints amount (wei, decimal string) tokens to the given address.
// The relayer key must hold MINTER_ROLE on the contract.
func (a *TokenContractAdapter) Mint(ctx context.Context, to string, amount string) (string, error) {
	toAddr := common.HexToAddress(to)
	amountBig, ok := new(big.Int).SetString(amount, 10)
	if !ok || amountBig.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "mint: invalid amount")
	}

	callData, err := a.abi.Pack("mint", toAddr, amountBig)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "mint: pack calldata failed", err)
	}

	txHash, err := a.sendTx(ctx, callData)
	if err != nil {
		return "", err
	}

	a.log.Info("mint submitted",
		logger.String("to", to),
		logger.String("amount", amount),
		logger.String("tx_hash", txHash),
	)
	return txHash, nil
}

// ─────────────────────────────────────────────
//  Write — VestTokens
// ─────────────────────────────────────────────

// VestTokens creates a vesting schedule for holder: amount (wei) locked until releaseTime.
// The relayer key must hold DEFAULT_ADMIN_ROLE on the contract.
// Reverts on-chain if holder already has an active vesting schedule.
func (a *TokenContractAdapter) VestTokens(ctx context.Context, holder string, amount string, releaseTime int64) (string, error) {
	holderAddr := common.HexToAddress(holder)
	amountBig, ok := new(big.Int).SetString(amount, 10)
	if !ok || amountBig.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "vestTokens: invalid amount")
	}

	callData, err := a.abi.Pack("vestTokens", holderAddr, amountBig, big.NewInt(releaseTime))
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "vestTokens: pack calldata failed", err)
	}

	txHash, err := a.sendTx(ctx, callData)
	if err != nil {
		return "", err
	}

	a.log.Info("vestTokens submitted",
		logger.String("holder", holder),
		logger.String("amount", amount),
		logger.Int64("release_time", releaseTime),
		logger.String("tx_hash", txHash),
	)
	return txHash, nil
}

// ─────────────────────────────────────────────
//  Write — ReleaseVested
// ─────────────────────────────────────────────

// ReleaseVested calls releaseVested(holder) on the contract.
// Reverts on-chain if no vesting schedule exists or the lock period has not expired.
func (a *TokenContractAdapter) ReleaseVested(ctx context.Context, holder string) (string, error) {
	callData, err := a.abi.Pack("releaseVested", common.HexToAddress(holder))
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "releaseVested: pack calldata failed", err)
	}

	txHash, err := a.sendTx(ctx, callData)
	if err != nil {
		return "", err
	}

	a.log.Info("releaseVested submitted",
		logger.String("holder", holder),
		logger.String("tx_hash", txHash),
	)
	return txHash, nil
}

// ─────────────────────────────────────────────
//  Write — Pause / Unpause
// ─────────────────────────────────────────────

// Pause calls pause() on the contract. Relayer key must hold PAUSER_ROLE.
func (a *TokenContractAdapter) Pause(ctx context.Context) (string, error) {
	callData, err := a.abi.Pack("pause")
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pause: pack calldata failed", err)
	}
	txHash, err := a.sendTx(ctx, callData)
	if err != nil {
		return "", err
	}
	a.log.Warn("contract paused", logger.String("tx_hash", txHash))
	return txHash, nil
}

// Unpause calls unpause() on the contract. Relayer key must hold PAUSER_ROLE.
func (a *TokenContractAdapter) Unpause(ctx context.Context) (string, error) {
	callData, err := a.abi.Pack("unpause")
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "unpause: pack calldata failed", err)
	}
	txHash, err := a.sendTx(ctx, callData)
	if err != nil {
		return "", err
	}
	a.log.Info("contract unpaused", logger.String("tx_hash", txHash))
	return txHash, nil
}

// ─────────────────────────────────────────────
//  Internal — shared helpers
// ─────────────────────────────────────────────

// call performs a read-only eth_call to the contract.
func (a *TokenContractAdapter) call(ctx context.Context, method string, args ...interface{}) ([]interface{}, error) {
	callData, err := a.abi.Pack(method, args...)
	if err != nil {
		return nil, fmt.Errorf("pack %s: %w", method, err)
	}

	raw, err := a.eth.CallContract(ctx, ethereum.CallMsg{
		To:   &a.contractAddr,
		Data: callData,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("eth_call %s: %w", method, err)
	}

	result, err := a.abi.Unpack(method, raw)
	if err != nil {
		return nil, fmt.Errorf("unpack %s: %w", method, err)
	}
	return result, nil
}

// sendTx builds, signs, submits, and waits for a write transaction using the relayer key.
func (a *TokenContractAdapter) sendTx(ctx context.Context, callData []byte) (string, error) {
	txHash, _, err := a.sendTxWithReceipt(ctx, callData)
	return txHash, err
}

// sendTxWithReceipt builds, signs, submits, and waits for a write transaction using the relayer key.
func (a *TokenContractAdapter) sendTxWithReceipt(ctx context.Context, callData []byte) (string, *types.Receipt, error) {
	relayerNonce, err := a.eth.PendingNonceAt(ctx, a.relayerAddr)
	if err != nil {
		return "", nil, apperr.Wrap(apperr.ErrCodeBlockchain, "get relayer nonce failed", err)
	}

	gasPrice, err := a.eth.SuggestGasPrice(ctx)
	if err != nil {
		return "", nil, apperr.Wrap(apperr.ErrCodeBlockchain, "get gas price failed", err)
	}

	gasLimit, err := a.eth.EstimateGas(ctx, ethereum.CallMsg{
		From: a.relayerAddr,
		To:   &a.contractAddr,
		Data: callData,
	})
	if err != nil {
		gasLimit = 150_000
		a.log.Warn("gas estimation failed, using fallback", logger.Err(err))
	}
	// Add 20 % buffer to avoid out-of-gas on edge cases
	gasLimit = gasLimit * 12 / 10

	tx := types.NewTransaction(
		relayerNonce,
		a.contractAddr,
		big.NewInt(0),
		gasLimit,
		gasPrice,
		callData,
	)

	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(a.chainID), a.relayerKey)
	if err != nil {
		return "", nil, apperr.Wrap(apperr.ErrCodeBlockchain, "sign tx failed", err)
	}

	if err := a.eth.SendTransaction(ctx, signedTx); err != nil {
		return "", nil, apperr.Wrap(apperr.ErrCodeBlockchain, "send tx failed", err)
	}

	txHash := signedTx.Hash().Hex()

	receipt, err := bind.WaitMined(ctx, a.eth, signedTx)
	if err != nil {
		return txHash, nil, apperr.Wrap(apperr.ErrCodeBlockchain, "wait for mining failed", err)
	}
	if receipt.Status == types.ReceiptStatusFailed {
		return txHash, receipt, apperr.New(apperr.ErrCodeBlockchain, "transaction reverted on-chain")
	}

	return txHash, receipt, nil
}

// sendTransferWithSignature packs and submits transferWithSignature(from,to,amount,nonce,deadline,sig).
func (a *TokenContractAdapter) sendTransferWithSignature(
	ctx context.Context,
	from, to common.Address,
	amount, nonce *big.Int,
	deadline int64,
	signature []byte,
) (string, error) {
	callData, err := a.abi.Pack(
		"transferWithSignature",
		from, to, amount, nonce, big.NewInt(deadline), signature,
	)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack transferWithSignature failed", err)
	}
	return a.sendTx(ctx, callData)
}

// bigIntResult extracts the first *big.Int from a call result and returns it as a decimal string.
func bigIntResult(result []interface{}, method string) (string, error) {
	if len(result) == 0 {
		return "0", nil
	}
	n, ok := result[0].(*big.Int)
	if !ok {
		return "0", apperr.New(apperr.ErrCodeBlockchain, method+": unexpected return type")
	}
	return n.String(), nil
}

// parseTransferParams validates and converts raw string params into typed values.
func parseTransferParams(from, to, amount, nonce string) (
	fromAddr common.Address,
	toAddr common.Address,
	amountBig *big.Int,
	nonceBig *big.Int,
	err error,
) {
	fromAddr = common.HexToAddress(from)
	toAddr = common.HexToAddress(to)

	amountBig = new(big.Int)
	if _, ok := amountBig.SetString(amount, 10); !ok || amountBig.Sign() <= 0 {
		err = apperr.New(apperr.ErrCodeBadRequest, "invalid transfer amount: "+amount)
		return
	}

	nonceBig = new(big.Int)
	if _, ok := nonceBig.SetString(nonce, 10); !ok {
		err = apperr.New(apperr.ErrCodeBadRequest, "invalid nonce: "+nonce)
		return
	}
	return
}

// Verify interface at compile-time.
var _ ports.TokenContractPort = (*TokenContractAdapter)(nil)

type signedTransferABI struct {
	TxId      [32]byte
	From      common.Address
	To        common.Address
	Amount    *big.Int
	Nonce     *big.Int
	Deadline  *big.Int
	Signature []byte
}

type batchItemResultLog struct {
	From      common.Address
	To        common.Address
	Amount    *big.Int
	Nonce     *big.Int
	Success   bool
	ErrorCode [32]byte
	Reason    string
}

func bytes32FromString(value string) [32]byte {
	return crypto.Keccak256Hash([]byte(value))
}

func (a *TokenContractAdapter) parseBatchItemResults(receipt *types.Receipt, txIDByHash map[string]string) []ports.BatchTransferItemResult {
	event, ok := a.abi.Events["MetaTransferItemResult"]
	if !ok || receipt == nil {
		return nil
	}
	results := make([]ports.BatchTransferItemResult, 0)
	for _, rawLog := range receipt.Logs {
		if rawLog.Address != a.contractAddr || len(rawLog.Topics) < 4 || rawLog.Topics[0] != event.ID {
			continue
		}
		var decoded batchItemResultLog
		if err := a.abi.UnpackIntoInterface(&decoded, "MetaTransferItemResult", rawLog.Data); err != nil {
			a.log.Warn("failed to unpack batch item event", logger.Err(err))
			continue
		}
		txIDHash := rawLog.Topics[2].Hex()
		txID := txIDByHash[txIDHash]
		if txID == "" {
			txID = txIDHash
		}
		index := new(big.Int).SetBytes(rawLog.Topics[3].Bytes()).Int64()
		results = append(results, ports.BatchTransferItemResult{
			TxID:      txID,
			Index:     int(index),
			Success:   decoded.Success,
			ErrorCode: bytes32String(decoded.ErrorCode),
			Reason:    decoded.Reason,
		})
	}
	return results
}

func bytes32String(value [32]byte) string {
	trimmed := strings.TrimRight(string(value[:]), "\x00")
	if trimmed != "" {
		return trimmed
	}
	return common.BytesToHash(value[:]).Hex()
}

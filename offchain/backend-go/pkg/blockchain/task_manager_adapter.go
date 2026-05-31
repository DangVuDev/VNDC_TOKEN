// Package blockchain — concrete adapter for the TaskManager smart contract.
// Implements ports.TaskManagerContractPort.
// The backend owner key signs and submits all write transactions.
// Students never interact with the contract directly.
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
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
)

// ─────────────────────────────────────────────
//  TaskManager ABI — minimal surface needed
// ─────────────────────────────────────────────

const taskManagerABI = `[
  {
    "type": "function",
		"name": "withdrawPool",
    "inputs": [
			{"internalType":"address","name":"to","type":"address"},
			{"internalType":"uint256","name":"amount","type":"uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "poolBalance",
    "inputs": [],
    "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability": "view"
	}
]`

// ─────────────────────────────────────────────
//  TaskManagerAdapter
// ─────────────────────────────────────────────

// TaskManagerAdapter implements ports.TaskManagerContractPort.
// The owner (backend) private key is used to sign and submit all write calls.
type TaskManagerAdapter struct {
	eth          *ethclient.Client
	contractAddr common.Address
	ownerKey     *ecdsa.PrivateKey
	ownerAddr    common.Address
	chainID      *big.Int
	abi          abi.ABI
	log          logger.Logger
}

// NewTaskManagerAdapter constructs a TaskManagerAdapter.
// ownerPrivKey is the backend's private key (must match contract owner).
func NewTaskManagerAdapter(
	ethClient *Client,
	contractAddress string,
	ownerPrivKey string,
	log logger.Logger,
) (*TaskManagerAdapter, error) {
	if contractAddress == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "task manager contract address required")
	}
	if ownerPrivKey == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "task manager owner private key required")
	}

	privKey, err := HexToPrivateKey(ownerPrivKey)
	if err != nil {
		return nil, fmt.Errorf("task manager adapter: %w", err)
	}

	parsedABI, err := abi.JSON(strings.NewReader(taskManagerABI))
	if err != nil {
		return nil, fmt.Errorf("task manager adapter: parse ABI: %w", err)
	}

	return &TaskManagerAdapter{
		eth:          ethClient.Eth(),
		contractAddr: common.HexToAddress(contractAddress),
		ownerKey:     privKey,
		ownerAddr:    AddressFromPrivateKey(privKey),
		chainID:      ethClient.ChainID(),
		abi:          parsedABI,
		log:          log.Named("task_manager_adapter"),
	}, nil
}

var _ ports.TaskManagerContractPort = (*TaskManagerAdapter)(nil)

// ─────────────────────────────────────────────
//  TaskManagerContractPort implementation
// ─────────────────────────────────────────────

// ClaimReward settles a reward by withdrawing from treasury to the student wallet.
// taskId and nonce are accepted for backward compatibility with existing worker API.
func (a *TaskManagerAdapter) ClaimReward(ctx context.Context, taskId, student, rewardAmount, nonce string) (string, error) {
	reward, ok := new(big.Int).SetString(rewardAmount, 10)
	if !ok || reward.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "ClaimReward: invalid rewardAmount")
	}
	if !common.IsHexAddress(student) {
		return "", apperr.New(apperr.ErrCodeBadRequest, "ClaimReward: invalid student address")
	}

	callData, err := a.abi.Pack("withdrawPool",
		common.HexToAddress(student),
		reward,
	)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack withdrawPool failed", err)
	}

	txHash, err := a.sendTx(ctx, callData)
	if err != nil {
		return "", err
	}

	a.log.Info("claimReward submitted",
		logger.String("task_id", taskId),
		logger.String("nonce", nonce),
		logger.String("student", student),
		logger.String("reward", rewardAmount),
		logger.String("tx_hash", txHash),
	)
	return txHash, nil
}

// RegisterTask is a no-op for the treasury-only TaskManager.
func (a *TaskManagerAdapter) RegisterTask(ctx context.Context, taskId, rewardAmount string, maxSlots uint64) (string, error) {
	a.log.Debug("registerTask ignored for treasury-only TaskManager",
		logger.String("task_id", taskId),
		logger.String("reward", rewardAmount),
		logger.Int64("max_slots", int64(maxSlots)),
	)
	return "", nil
}

// PoolBalance returns the current VNDC pool balance of the contract (wei string).
func (a *TaskManagerAdapter) PoolBalance(ctx context.Context) (string, error) {
	result, err := a.call(ctx, "poolBalance")
	if err != nil {
		return "0", err
	}
	if len(result) == 0 {
		return "0", nil
	}
	bal, ok := result[0].(*big.Int)
	if !ok {
		return "0", apperr.New(apperr.ErrCodeBlockchain, "poolBalance: unexpected type")
	}
	return bal.String(), nil
}

// ActivityPoints is not tracked on treasury-only TaskManager.
func (a *TaskManagerAdapter) ActivityPoints(ctx context.Context, student string) (uint64, error) {
	_ = ctx
	_ = student
	return 0, nil
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

func (a *TaskManagerAdapter) call(ctx context.Context, method string, args ...interface{}) ([]interface{}, error) {
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
	return a.abi.Unpack(method, raw)
}

// sendTx builds, signs, submits and waits for an owner-signed write transaction.
func (a *TaskManagerAdapter) sendTx(ctx context.Context, callData []byte) (string, error) {
	ownerNonce, err := a.eth.PendingNonceAt(ctx, a.ownerAddr)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "get owner nonce failed", err)
	}

	gasPrice, err := a.eth.SuggestGasPrice(ctx)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "suggest gas price failed", err)
	}

	gasLimit, err := a.eth.EstimateGas(ctx, ethereum.CallMsg{
		From: a.ownerAddr,
		To:   &a.contractAddr,
		Data: callData,
	})
	if err != nil {
		gasLimit = 200_000
		a.log.Warn("task manager gas estimation failed, using fallback 200k", logger.Err(err))
	}
	gasLimit = gasLimit * 12 / 10 // 20% buffer

	tx := types.NewTransaction(
		ownerNonce,
		a.contractAddr,
		big.NewInt(0),
		gasLimit,
		gasPrice,
		callData,
	)

	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(a.chainID), a.ownerKey)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "sign tx failed", err)
	}

	if err := a.eth.SendTransaction(ctx, signedTx); err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "send tx failed", err)
	}

	txHash := signedTx.Hash().Hex()

	receipt, err := bind.WaitMined(ctx, a.eth, signedTx)
	if err != nil {
		return txHash, apperr.Wrap(apperr.ErrCodeBlockchain, "wait for mining failed", err)
	}
	if receipt.Status == types.ReceiptStatusFailed {
		return txHash, apperr.New(apperr.ErrCodeBlockchain, "task manager transaction reverted on-chain")
	}

	return txHash, nil
}

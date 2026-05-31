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

const fundingManagerABI = `[
  {
    "type": "function",
    "name": "createPot",
    "inputs": [
      {"internalType":"bytes32","name":"potId","type":"bytes32"},
      {"internalType":"address","name":"owner","type":"address"},
      {"internalType":"uint256","name":"targetAmount","type":"uint256"},
      {"internalType":"string","name":"category","type":"string"},
      {"internalType":"string","name":"title","type":"string"},
      {"internalType":"address[]","name":"deputyList","type":"address[]"},
      {"internalType":"uint64","name":"startsAt","type":"uint64"},
      {"internalType":"uint64","name":"endsAt","type":"uint64"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "addDeputy",
    "inputs": [
      {"internalType":"bytes32","name":"potId","type":"bytes32"},
      {"internalType":"address","name":"deputy","type":"address"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removeDeputy",
    "inputs": [
      {"internalType":"bytes32","name":"potId","type":"bytes32"},
      {"internalType":"address","name":"deputy","type":"address"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPotStatus",
    "inputs": [
      {"internalType":"bytes32","name":"potId","type":"bytes32"},
      {"internalType":"uint8","name":"status","type":"uint8"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recordContribution",
    "inputs": [
      {"internalType":"bytes32","name":"potId","type":"bytes32"},
      {"internalType":"address","name":"contributor","type":"address"},
      {"internalType":"uint256","name":"amount","type":"uint256"},
      {"internalType":"bytes32","name":"transferTxHash","type":"bytes32"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "spend",
    "inputs": [
      {"internalType":"bytes32","name":"potId","type":"bytes32"},
      {"internalType":"address","name":"actor","type":"address"},
      {"internalType":"address","name":"beneficiary","type":"address"},
      {"internalType":"uint256","name":"amount","type":"uint256"},
      {"internalType":"string","name":"note","type":"string"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
]`

type FundingManagerAdapter struct {
	eth          *ethclient.Client
	contractAddr common.Address
	ownerKey     *ecdsa.PrivateKey
	ownerAddr    common.Address
	chainID      *big.Int
	abi          abi.ABI
	log          logger.Logger
}

func NewFundingManagerAdapter(
	ethClient *Client,
	contractAddress string,
	ownerPrivKey string,
	log logger.Logger,
) (*FundingManagerAdapter, error) {
	if contractAddress == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "funding manager contract address required")
	}
	if ownerPrivKey == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "funding manager owner private key required")
	}

	privKey, err := HexToPrivateKey(ownerPrivKey)
	if err != nil {
		return nil, fmt.Errorf("funding manager adapter: %w", err)
	}

	parsedABI, err := abi.JSON(strings.NewReader(fundingManagerABI))
	if err != nil {
		return nil, fmt.Errorf("funding manager adapter: parse ABI: %w", err)
	}

	return &FundingManagerAdapter{
		eth:          ethClient.Eth(),
		contractAddr: common.HexToAddress(contractAddress),
		ownerKey:     privKey,
		ownerAddr:    AddressFromPrivateKey(privKey),
		chainID:      ethClient.ChainID(),
		abi:          parsedABI,
		log:          log.Named("funding_manager_adapter"),
	}, nil
}

var _ ports.FundingContractPort = (*FundingManagerAdapter)(nil)

func (a *FundingManagerAdapter) Address() string {
	return a.contractAddr.Hex()
}

func (a *FundingManagerAdapter) CreatePot(
	ctx context.Context,
	potID,
	owner,
	category,
	title,
	targetAmount string,
	deputies []string,
	startsAt,
	endsAt int64,
) (string, error) {
	potID32, err := hexToBytes32(potID)
	if err != nil {
		return "", fmt.Errorf("CreatePot: invalid pot id: %w", err)
	}
	target, ok := new(big.Int).SetString(targetAmount, 10)
	if !ok || target.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "CreatePot: invalid targetAmount")
	}

	deputyAddrs := make([]common.Address, 0, len(deputies))
	for _, d := range deputies {
		deputyAddrs = append(deputyAddrs, common.HexToAddress(d))
	}

	callData, err := a.abi.Pack(
		"createPot",
		potID32,
		common.HexToAddress(owner),
		target,
		category,
		title,
		deputyAddrs,
		uint64(startsAt),
		uint64(endsAt),
	)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack createPot failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *FundingManagerAdapter) AddDeputy(ctx context.Context, potID, deputy string) (string, error) {
	potID32, err := hexToBytes32(potID)
	if err != nil {
		return "", fmt.Errorf("AddDeputy: invalid pot id: %w", err)
	}
	callData, err := a.abi.Pack("addDeputy", potID32, common.HexToAddress(deputy))
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack addDeputy failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *FundingManagerAdapter) RemoveDeputy(ctx context.Context, potID, deputy string) (string, error) {
	potID32, err := hexToBytes32(potID)
	if err != nil {
		return "", fmt.Errorf("RemoveDeputy: invalid pot id: %w", err)
	}
	callData, err := a.abi.Pack("removeDeputy", potID32, common.HexToAddress(deputy))
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack removeDeputy failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *FundingManagerAdapter) SetPotStatus(ctx context.Context, potID string, status uint8) (string, error) {
	potID32, err := hexToBytes32(potID)
	if err != nil {
		return "", fmt.Errorf("SetPotStatus: invalid pot id: %w", err)
	}
	callData, err := a.abi.Pack("setPotStatus", potID32, status)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack setPotStatus failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *FundingManagerAdapter) RecordContribution(ctx context.Context, potID, contributor, amount, transferTxHash string) (string, error) {
	potID32, err := hexToBytes32(potID)
	if err != nil {
		return "", fmt.Errorf("RecordContribution: invalid pot id: %w", err)
	}
	amountBig, ok := new(big.Int).SetString(amount, 10)
	if !ok || amountBig.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "RecordContribution: invalid amount")
	}
	txHash32, err := hexToBytes32(transferTxHash)
	if err != nil {
		return "", fmt.Errorf("RecordContribution: invalid transfer tx hash: %w", err)
	}
	callData, err := a.abi.Pack(
		"recordContribution",
		potID32,
		common.HexToAddress(contributor),
		amountBig,
		txHash32,
	)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack recordContribution failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *FundingManagerAdapter) Spend(ctx context.Context, potID, actor, beneficiary, amount, note string) (string, error) {
	potID32, err := hexToBytes32(potID)
	if err != nil {
		return "", fmt.Errorf("Spend: invalid pot id: %w", err)
	}
	amountBig, ok := new(big.Int).SetString(amount, 10)
	if !ok || amountBig.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "Spend: invalid amount")
	}
	callData, err := a.abi.Pack(
		"spend",
		potID32,
		common.HexToAddress(actor),
		common.HexToAddress(beneficiary),
		amountBig,
		note,
	)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack spend failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *FundingManagerAdapter) sendTx(ctx context.Context, callData []byte) (string, error) {
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
		gasLimit = 300_000
		a.log.Warn("funding manager gas estimation failed, using fallback 300k", logger.Err(err))
	}
	gasLimit = gasLimit * 12 / 10

	tx := types.NewTransaction(ownerNonce, a.contractAddr, big.NewInt(0), gasLimit, gasPrice, callData)
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
		return txHash, apperr.New(apperr.ErrCodeBlockchain, "funding transaction reverted on-chain")
	}
	return txHash, nil
}

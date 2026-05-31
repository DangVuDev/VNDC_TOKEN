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

const daoManagerABI = `[
  {"type":"function","name":"createDAO","inputs":[{"internalType":"bytes32","name":"daoId","type":"bytes32"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"metadataURI","type":"string"},{"internalType":"address","name":"governanceToken","type":"address"},{"internalType":"uint256","name":"quorumBps","type":"uint256"},{"internalType":"uint64","name":"votingDelay","type":"uint64"},{"internalType":"uint64","name":"votingPeriod","type":"uint64"},{"internalType":"uint64","name":"timelockDuration","type":"uint64"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"setDAOActive","inputs":[{"internalType":"bytes32","name":"daoId","type":"bytes32"},{"internalType":"bool","name":"active","type":"bool"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"createProposal","inputs":[{"internalType":"bytes32","name":"proposalId","type":"bytes32"},{"internalType":"bytes32","name":"daoId","type":"bytes32"},{"internalType":"address","name":"proposer","type":"address"},{"internalType":"address","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes32","name":"descriptionHash","type":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"castVote","inputs":[{"internalType":"bytes32","name":"proposalId","type":"bytes32"},{"internalType":"address","name":"voter","type":"address"},{"internalType":"uint8","name":"support","type":"uint8"},{"internalType":"uint256","name":"weight","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"queueProposal","inputs":[{"internalType":"bytes32","name":"proposalId","type":"bytes32"},{"internalType":"uint256","name":"totalVotingPower","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"executeProposal","inputs":[{"internalType":"bytes32","name":"proposalId","type":"bytes32"}],"outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"nonpayable"},
  {"type":"function","name":"cancelProposal","inputs":[{"internalType":"bytes32","name":"proposalId","type":"bytes32"},{"internalType":"string","name":"reason","type":"string"}],"outputs":[],"stateMutability":"nonpayable"}
]`

type DAOManagerAdapter struct {
	eth          *ethclient.Client
	contractAddr common.Address
	ownerKey     *ecdsa.PrivateKey
	ownerAddr    common.Address
	chainID      *big.Int
	abi          abi.ABI
	log          logger.Logger
}

func NewDAOManagerAdapter(
	ethClient *Client,
	contractAddress string,
	ownerPrivKey string,
	log logger.Logger,
) (*DAOManagerAdapter, error) {
	if contractAddress == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao manager contract address required")
	}
	if ownerPrivKey == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao manager owner private key required")
	}

	privKey, err := HexToPrivateKey(ownerPrivKey)
	if err != nil {
		return nil, fmt.Errorf("dao manager adapter: %w", err)
	}
	parsedABI, err := abi.JSON(strings.NewReader(daoManagerABI))
	if err != nil {
		return nil, fmt.Errorf("dao manager adapter: parse ABI: %w", err)
	}

	return &DAOManagerAdapter{
		eth:          ethClient.Eth(),
		contractAddr: common.HexToAddress(contractAddress),
		ownerKey:     privKey,
		ownerAddr:    AddressFromPrivateKey(privKey),
		chainID:      ethClient.ChainID(),
		abi:          parsedABI,
		log:          log.Named("dao_manager_adapter"),
	}, nil
}

var _ ports.DAOContractPort = (*DAOManagerAdapter)(nil)

func (a *DAOManagerAdapter) Address() string { return a.contractAddr.Hex() }

func (a *DAOManagerAdapter) CreateDAO(ctx context.Context, daoID, name, metadataURI, governanceToken string, quorumBps, votingDelay, votingPeriod, timelockDuration uint64) (string, error) {
	daoID32, err := hexToBytes32(daoID)
	if err != nil {
		return "", fmt.Errorf("CreateDAO: invalid dao id: %w", err)
	}
	callData, err := a.abi.Pack("createDAO", daoID32, name, metadataURI, common.HexToAddress(governanceToken), new(big.Int).SetUint64(quorumBps), votingDelay, votingPeriod, timelockDuration)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack createDAO failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *DAOManagerAdapter) SetDAOActive(ctx context.Context, daoID string, active bool) (string, error) {
	daoID32, err := hexToBytes32(daoID)
	if err != nil {
		return "", fmt.Errorf("SetDAOActive: invalid dao id: %w", err)
	}
	callData, err := a.abi.Pack("setDAOActive", daoID32, active)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack setDAOActive failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *DAOManagerAdapter) CreateProposal(ctx context.Context, proposalID, daoID, proposer, target, value, calldata, descriptionHash string) (string, error) {
	proposalID32, err := hexToBytes32(proposalID)
	if err != nil {
		return "", fmt.Errorf("CreateProposal: invalid proposal id: %w", err)
	}
	daoID32, err := hexToBytes32(daoID)
	if err != nil {
		return "", fmt.Errorf("CreateProposal: invalid dao id: %w", err)
	}
	valueBig, ok := new(big.Int).SetString(value, 10)
	if !ok || valueBig.Sign() < 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "CreateProposal: invalid value")
	}
	descHash32, err := hexToBytes32(descriptionHash)
	if err != nil {
		return "", fmt.Errorf("CreateProposal: invalid description hash: %w", err)
	}
	callBytes := common.FromHex(calldata)
	callData, err := a.abi.Pack("createProposal", proposalID32, daoID32, common.HexToAddress(proposer), common.HexToAddress(target), valueBig, callBytes, descHash32)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack createProposal failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *DAOManagerAdapter) CastVote(ctx context.Context, proposalID, voter string, support uint8, weight string) (string, error) {
	proposalID32, err := hexToBytes32(proposalID)
	if err != nil {
		return "", fmt.Errorf("CastVote: invalid proposal id: %w", err)
	}
	weightBig, ok := new(big.Int).SetString(weight, 10)
	if !ok || weightBig.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "CastVote: invalid weight")
	}
	callData, err := a.abi.Pack("castVote", proposalID32, common.HexToAddress(voter), support, weightBig)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack castVote failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *DAOManagerAdapter) QueueProposal(ctx context.Context, proposalID string, totalVotingPower string) (string, error) {
	proposalID32, err := hexToBytes32(proposalID)
	if err != nil {
		return "", fmt.Errorf("QueueProposal: invalid proposal id: %w", err)
	}
	votingPower, ok := new(big.Int).SetString(totalVotingPower, 10)
	if !ok || votingPower.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "QueueProposal: invalid total voting power")
	}
	callData, err := a.abi.Pack("queueProposal", proposalID32, votingPower)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack queueProposal failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *DAOManagerAdapter) ExecuteProposal(ctx context.Context, proposalID string) (string, error) {
	proposalID32, err := hexToBytes32(proposalID)
	if err != nil {
		return "", fmt.Errorf("ExecuteProposal: invalid proposal id: %w", err)
	}
	callData, err := a.abi.Pack("executeProposal", proposalID32)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack executeProposal failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *DAOManagerAdapter) CancelProposal(ctx context.Context, proposalID, reason string) (string, error) {
	proposalID32, err := hexToBytes32(proposalID)
	if err != nil {
		return "", fmt.Errorf("CancelProposal: invalid proposal id: %w", err)
	}
	callData, err := a.abi.Pack("cancelProposal", proposalID32, reason)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack cancelProposal failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *DAOManagerAdapter) sendTx(ctx context.Context, callData []byte) (string, error) {
	// Preflight simulation to surface clear revert reasons (e.g. voting not started, already voted).
	if _, err := a.eth.CallContract(ctx, ethereum.CallMsg{From: a.ownerAddr, To: &a.contractAddr, Data: callData}, nil); err != nil {
		reason := extractRevertReason(err)
		if reason != "" {
			return "", apperr.New(apperr.ErrCodeBlockchain, reason)
		}
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "transaction simulation failed", err)
	}

	nonce, err := a.eth.PendingNonceAt(ctx, a.ownerAddr)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "get owner nonce failed", err)
	}
	gasPrice, err := a.eth.SuggestGasPrice(ctx)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "suggest gas price failed", err)
	}
	gasLimit, err := a.eth.EstimateGas(ctx, ethereum.CallMsg{From: a.ownerAddr, To: &a.contractAddr, Data: callData})
	if err != nil {
		reason := extractRevertReason(err)
		if reason != "" {
			return "", apperr.New(apperr.ErrCodeBlockchain, reason)
		}
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "estimate gas failed", err)
	}
	gasLimit = gasLimit * 12 / 10

	tx := types.NewTransaction(nonce, a.contractAddr, big.NewInt(0), gasLimit, gasPrice, callData)
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
		return txHash, apperr.New(apperr.ErrCodeBlockchain, "dao transaction reverted on-chain")
	}
	return txHash, nil
}

func extractRevertReason(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	lower := strings.ToLower(msg)
	marker := "execution reverted"
	idx := strings.Index(lower, marker)
	if idx < 0 {
		return ""
	}
	reason := strings.TrimSpace(msg[idx+len(marker):])
	reason = strings.TrimPrefix(reason, ":")
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return "transaction reverted on-chain"
	}
	return reason
}

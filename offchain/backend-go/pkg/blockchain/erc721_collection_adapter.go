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

const erc721CollectionABI = `[
  {"type":"function","name":"mint","inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"tokenURI_","type":"string"}],"outputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"stateMutability":"nonpayable"},
	{"type":"function","name":"approve","inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"event","name":"NFTMinted","inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"string","name":"tokenURI","type":"string"}],"anonymous":false}
]`

type ERC721CollectionAdapter struct {
	eth          *ethclient.Client
	contractAddr common.Address
	ownerKey     *ecdsa.PrivateKey
	ownerAddr    common.Address
	chainID      *big.Int
	abi          abi.ABI
	mintedID     common.Hash
	log          logger.Logger
}

func NewERC721CollectionAdapter(
	ethClient *Client,
	contractAddress string,
	ownerPrivKey string,
	log logger.Logger,
) (*ERC721CollectionAdapter, error) {
	if contractAddress == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "erc721 collection contract address required")
	}
	if ownerPrivKey == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "erc721 collection owner private key required")
	}

	privKey, err := HexToPrivateKey(ownerPrivKey)
	if err != nil {
		return nil, fmt.Errorf("erc721 collection adapter: %w", err)
	}
	parsedABI, err := abi.JSON(strings.NewReader(erc721CollectionABI))
	if err != nil {
		return nil, fmt.Errorf("erc721 collection adapter: parse ABI: %w", err)
	}
	evt, ok := parsedABI.Events["NFTMinted"]
	if !ok {
		return nil, fmt.Errorf("erc721 collection adapter: NFTMinted event not found")
	}

	return &ERC721CollectionAdapter{
		eth:          ethClient.Eth(),
		contractAddr: common.HexToAddress(contractAddress),
		ownerKey:     privKey,
		ownerAddr:    AddressFromPrivateKey(privKey),
		chainID:      ethClient.ChainID(),
		abi:          parsedABI,
		mintedID:     evt.ID,
		log:          log.Named("erc721_collection_adapter"),
	}, nil
}

var _ ports.ERC721CollectionPort = (*ERC721CollectionAdapter)(nil)

func (a *ERC721CollectionAdapter) Address() string { return a.contractAddr.Hex() }

func (a *ERC721CollectionAdapter) Mint(ctx context.Context, to, tokenURI string) (string, string, error) {
	if !common.IsHexAddress(to) {
		return "", "", apperr.New(apperr.ErrCodeBadRequest, "Mint: invalid recipient")
	}
	if strings.TrimSpace(tokenURI) == "" {
		return "", "", apperr.New(apperr.ErrCodeBadRequest, "Mint: token URI is required")
	}

	callData, err := a.abi.Pack("mint", common.HexToAddress(to), tokenURI)
	if err != nil {
		return "", "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack mint failed", err)
	}
	txHash, receipt, err := a.sendTxWithReceipt(ctx, callData)
	if err != nil {
		return "", txHash, err
	}

	for _, lg := range receipt.Logs {
		if lg == nil || lg.Address != a.contractAddr || len(lg.Topics) < 3 || lg.Topics[0] != a.mintedID {
			continue
		}
		tokenID := new(big.Int).SetBytes(lg.Topics[2].Bytes())
		return tokenID.String(), txHash, nil
	}

	a.log.Warn("minted event not found in receipt", logger.String("tx_hash", txHash))
	return "", txHash, apperr.New(apperr.ErrCodeBlockchain, "mint succeeded but token id event not found")
}

func (a *ERC721CollectionAdapter) Approve(ctx context.Context, spender, tokenID string) (string, error) {
	if !common.IsHexAddress(spender) {
		return "", apperr.New(apperr.ErrCodeBadRequest, "Approve: invalid spender")
	}
	tokenIDBig, ok := new(big.Int).SetString(strings.TrimSpace(tokenID), 10)
	if !ok || tokenIDBig.Sign() < 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "Approve: invalid token id")
	}

	callData, err := a.abi.Pack("approve", common.HexToAddress(spender), tokenIDBig)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack approve failed", err)
	}
	txHash, _, err := a.sendTxWithReceipt(ctx, callData)
	if err != nil {
		return txHash, err
	}
	return txHash, nil
}

func (a *ERC721CollectionAdapter) sendTxWithReceipt(ctx context.Context, callData []byte) (string, *types.Receipt, error) {
	nonce, err := a.eth.PendingNonceAt(ctx, a.ownerAddr)
	if err != nil {
		return "", nil, apperr.Wrap(apperr.ErrCodeBlockchain, "get owner nonce failed", err)
	}
	gasPrice, err := a.eth.SuggestGasPrice(ctx)
	if err != nil {
		return "", nil, apperr.Wrap(apperr.ErrCodeBlockchain, "suggest gas price failed", err)
	}
	gasLimit, err := a.eth.EstimateGas(ctx, ethereum.CallMsg{From: a.ownerAddr, To: &a.contractAddr, Data: callData})
	if err != nil {
		gasLimit = 350_000
		a.log.Warn("erc721 mint gas estimation failed, using fallback 350k", logger.Err(err))
	}
	gasLimit = gasLimit * 12 / 10

	tx := types.NewTransaction(nonce, a.contractAddr, big.NewInt(0), gasLimit, gasPrice, callData)
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(a.chainID), a.ownerKey)
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
		return txHash, receipt, apperr.New(apperr.ErrCodeBlockchain, "erc721 mint transaction reverted on-chain")
	}
	return txHash, receipt, nil
}

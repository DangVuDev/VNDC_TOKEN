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

const marketplaceManagerABI = `[
	{"type":"function","name":"list","inputs":[{"internalType":"bytes32","name":"listingId","type":"bytes32"},{"internalType":"address","name":"seller","type":"address"},{"internalType":"address","name":"nftContract","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"paymentToken","type":"address"},{"internalType":"uint256","name":"price","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"updatePrice","inputs":[{"internalType":"bytes32","name":"listingId","type":"bytes32"},{"internalType":"uint256","name":"newPrice","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"cancel","inputs":[{"internalType":"bytes32","name":"listingId","type":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"buyFor","inputs":[{"internalType":"bytes32","name":"listingId","type":"bytes32"},{"internalType":"address","name":"buyer","type":"address"}],"outputs":[],"stateMutability":"nonpayable"}
]`

type MarketplaceManagerAdapter struct {
	eth          *ethclient.Client
	contractAddr common.Address
	ownerKey     *ecdsa.PrivateKey
	ownerAddr    common.Address
	chainID      *big.Int
	abi          abi.ABI
	log          logger.Logger
}

func NewMarketplaceManagerAdapter(
	ethClient *Client,
	contractAddress string,
	ownerPrivKey string,
	log logger.Logger,
) (*MarketplaceManagerAdapter, error) {
	if contractAddress == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "marketplace manager contract address required")
	}
	if ownerPrivKey == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "marketplace manager owner private key required")
	}

	privKey, err := HexToPrivateKey(ownerPrivKey)
	if err != nil {
		return nil, fmt.Errorf("marketplace manager adapter: %w", err)
	}
	parsedABI, err := abi.JSON(strings.NewReader(marketplaceManagerABI))
	if err != nil {
		return nil, fmt.Errorf("marketplace manager adapter: parse ABI: %w", err)
	}

	return &MarketplaceManagerAdapter{
		eth:          ethClient.Eth(),
		contractAddr: common.HexToAddress(contractAddress),
		ownerKey:     privKey,
		ownerAddr:    AddressFromPrivateKey(privKey),
		chainID:      ethClient.ChainID(),
		abi:          parsedABI,
		log:          log.Named("marketplace_manager_adapter"),
	}, nil
}

var _ ports.MarketplaceContractPort = (*MarketplaceManagerAdapter)(nil)

func (a *MarketplaceManagerAdapter) Address() string { return a.contractAddr.Hex() }

func (a *MarketplaceManagerAdapter) CreateListing(ctx context.Context, listingID, seller, nftContract, paymentToken, tokenID, amount, price string) (string, error) {
	_ = amount
	listingID32, err := hexToBytes32(listingID)
	if err != nil {
		return "", fmt.Errorf("CreateListing: invalid listing id: %w", err)
	}
	if !common.IsHexAddress(seller) {
		return "", apperr.New(apperr.ErrCodeBadRequest, "CreateListing: invalid seller")
	}
	tokenIDBig, ok := new(big.Int).SetString(tokenID, 10)
	if !ok || tokenIDBig.Sign() < 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "CreateListing: invalid token id")
	}
	priceBig, ok := new(big.Int).SetString(price, 10)
	if !ok || priceBig.Sign() < 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "CreateListing: invalid price")
	}
	callData, err := a.abi.Pack(
		"list",
		listingID32,
		common.HexToAddress(seller),
		common.HexToAddress(nftContract),
		tokenIDBig,
		common.HexToAddress(paymentToken),
		priceBig,
	)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack list failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *MarketplaceManagerAdapter) UpdateListingPrice(ctx context.Context, listingID, newPrice string) (string, error) {
	listingID32, err := hexToBytes32(listingID)
	if err != nil {
		return "", fmt.Errorf("UpdateListingPrice: invalid listing id: %w", err)
	}
	priceBig, ok := new(big.Int).SetString(newPrice, 10)
	if !ok || priceBig.Sign() <= 0 {
		return "", apperr.New(apperr.ErrCodeBadRequest, "UpdateListingPrice: invalid price")
	}
	callData, err := a.abi.Pack("updatePrice", listingID32, priceBig)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack updatePrice failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *MarketplaceManagerAdapter) CancelListing(ctx context.Context, listingID string) (string, error) {
	listingID32, err := hexToBytes32(listingID)
	if err != nil {
		return "", fmt.Errorf("CancelListing: invalid listing id: %w", err)
	}
	callData, err := a.abi.Pack("cancel", listingID32)
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack cancel failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *MarketplaceManagerAdapter) FinalizeSale(ctx context.Context, listingID, purchaseID, buyer, paymentTxHash string) (string, error) {
	_ = purchaseID
	_ = paymentTxHash
	listingID32, err := hexToBytes32(listingID)
	if err != nil {
		return "", fmt.Errorf("FinalizeSale: invalid listing id: %w", err)
	}
	callData, err := a.abi.Pack("buyFor", listingID32, common.HexToAddress(buyer))
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "pack buyFor failed", err)
	}
	return a.sendTx(ctx, callData)
}

func (a *MarketplaceManagerAdapter) sendTx(ctx context.Context, callData []byte) (string, error) {
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
		gasLimit = 350_000
		a.log.Warn("marketplace manager gas estimation failed, using fallback 350k", logger.Err(err))
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
		return txHash, apperr.New(apperr.ErrCodeBlockchain, "marketplace transaction reverted on-chain")
	}
	return txHash, nil
}

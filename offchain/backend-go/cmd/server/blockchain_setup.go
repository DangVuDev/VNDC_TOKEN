package main

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/config"
	"github.com/vndc/backend/pkg/logger"
)

func buildEIP712Domain(cfg *config.Config, chainID *big.Int) blockchain.Domain {
	domain := blockchain.Domain{
		Name:    "VNDC Token",
		Version: "1",
		ChainID: chainID,
	}
	if addr := cfg.Blockchain.TokenContractAddress; addr != "" {
		domain.VerifyingContract = common.HexToAddress(addr)
	}
	return domain
}

func initTokenContractAdapter(
	ethClient *blockchain.Client,
	cfg *config.Config,
	log logger.Logger,
) ports.TokenContractPort {
	adapter, err := blockchain.NewTokenContractAdapter(
		ethClient,
		cfg.Blockchain.TokenContractAddress,
		cfg.Blockchain.RelayerPrivateKey,
		log,
	)
	if err != nil {
		log.Warn("token contract adapter unavailable — settlement disabled", logger.Err(err))
		return nil
	}
	return adapter
}

func initMarketplaceAdapter(
	ethClient *blockchain.Client,
	cfg *config.Config,
	log logger.Logger,
) *blockchain.MarketplaceManagerAdapter {
	if cfg.Blockchain.MarketplaceManagerAddress == "" || cfg.Blockchain.MarketplaceManagerAddress == "0x0000000000000000000000000000000000000000" {
		log.Warn("marketplace manager adapter unavailable — marketplace_manager_address is not configured")
		return nil
	}
	adapter, err := blockchain.NewMarketplaceManagerAdapter(
		ethClient,
		cfg.Blockchain.MarketplaceManagerAddress,
		cfg.Blockchain.RelayerPrivateKey,
		log,
	)
	if err != nil {
		log.Warn("marketplace manager adapter unavailable — marketplace on-chain sync disabled", logger.Err(err))
		return nil
	}
	return adapter
}

func initERC721CollectionAdapter(
	ethClient *blockchain.Client,
	cfg *config.Config,
	log logger.Logger,
) ports.ERC721CollectionPort {
	if cfg.Blockchain.NFTContractAddress == "" || cfg.Blockchain.NFTContractAddress == "0x0000000000000000000000000000000000000000" {
		log.Warn("erc721 collection adapter unavailable — nft_contract_address is not configured")
		return nil
	}
	adapter, err := blockchain.NewERC721CollectionAdapter(
		ethClient,
		cfg.Blockchain.NFTContractAddress,
		cfg.Blockchain.RelayerPrivateKey,
		log,
	)
	if err != nil {
		log.Warn("erc721 collection adapter unavailable — nft mint disabled", logger.Err(err))
		return nil
	}
	return adapter
}

func initDAOAdapter(
	ethClient *blockchain.Client,
	cfg *config.Config,
	log logger.Logger,
) *blockchain.DAOManagerAdapter {
	if cfg.Blockchain.DAOManagerAddress == "" || cfg.Blockchain.DAOManagerAddress == "0x0000000000000000000000000000000000000000" {
		log.Warn("dao manager adapter unavailable — dao_manager_address is not configured")
		return nil
	}
	adapter, err := blockchain.NewDAOManagerAdapter(
		ethClient,
		cfg.Blockchain.DAOManagerAddress,
		cfg.Blockchain.RelayerPrivateKey,
		log,
	)
	if err != nil {
		log.Warn("dao manager adapter unavailable — dao on-chain sync disabled", logger.Err(err))
		return nil
	}
	return adapter
}

func initFundingAdapter(
	ethClient *blockchain.Client,
	cfg *config.Config,
	log logger.Logger,
) *blockchain.FundingManagerAdapter {
	if cfg.Blockchain.FundingManagerAddress == "" || cfg.Blockchain.FundingManagerAddress == "0x0000000000000000000000000000000000000000" {
		log.Warn("funding manager adapter unavailable — funding_manager_address is not configured")
		return nil
	}
	adapter, err := blockchain.NewFundingManagerAdapter(
		ethClient,
		cfg.Blockchain.FundingManagerAddress,
		cfg.Blockchain.RelayerPrivateKey,
		log,
	)
	if err != nil {
		log.Warn("funding manager adapter unavailable — funding on-chain sync disabled", logger.Err(err))
		return nil
	}
	return adapter
}

func initTaskSigner(
	cfg *config.Config,
	chainID *big.Int,
	log logger.Logger,
) *blockchain.TaskSigner {
	taskSignerDomain := blockchain.Domain{
		Name:    "TaskManager",
		Version: "1",
		ChainID: chainID,
	}
	if addr := cfg.Blockchain.TaskManagerAddress; addr != "" {
		taskSignerDomain.VerifyingContract = common.HexToAddress(addr)
	}
	signer, err := blockchain.NewTaskSigner(cfg.Blockchain.TaskManagerSignerPrivKey, taskSignerDomain)
	if err != nil {
		log.Warn("task signer unavailable — claims will be unsigned", logger.Err(err))
		return nil
	}
	return signer
}

func initTaskManagerAdapter(
	ethClient *blockchain.Client,
	cfg *config.Config,
	log logger.Logger,
) ports.TaskManagerContractPort {
	adapter, err := blockchain.NewTaskManagerAdapter(
		ethClient,
		cfg.Blockchain.TaskManagerAddress,
		cfg.Blockchain.RelayerPrivateKey,
		log,
	)
	if err != nil {
		log.Warn("task manager adapter unavailable — on-chain settlement disabled", logger.Err(err))
		return nil
	}
	return adapter
}

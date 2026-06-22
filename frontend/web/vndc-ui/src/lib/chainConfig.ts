const ENV = import.meta.env as unknown as Record<string, string | undefined>

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type ChainKey = 'local' | 'sepolia' | 'ethereum'

export type ContractAddressKey =
  | 'VNDCToken'
  | 'VNDCStaking'
  | 'VNDCTokenVesting'
  | 'TaskManager'
  | 'FundingManager'
  | 'DAOManager'
  | 'MarketplaceManager'
  | 'VNDCNFTCollection'
  | 'NFTMarketplace721'
  | 'VNDCERC1155Collection'

export type NativeCurrency = {
  name: string
  symbol: string
  decimals: number
}

export type ChainConfig = {
  key: ChainKey
  label: string
  shortLabel: string
  backendNetwork: string
  hardhatNetwork: string
  chainId: number
  chainIdHex: `0x${string}`
  rpcUrl: string
  explorerUrl?: string
  nativeCurrency: NativeCurrency
  contracts: Record<ContractAddressKey, string>
}

function envValue(keys: string[], fallback = '') {
  for (const key of keys) {
    const value = ENV[key]?.trim()
    if (value) return value
  }
  return fallback
}

function toHexChainId(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`
}

function normalizeChainKey(value: string | null | undefined): ChainKey | null {
  const key = value?.trim().toLowerCase()
  switch (key) {
    case 'local':
    case 'localhost':
    case 'hardhat':
      return 'local'
    case 'sepolia':
      return 'sepolia'
    case 'ethereum':
    case 'mainnet':
    case 'eth':
    case 'etherum':
      return 'ethereum'
    default:
      return null
  }
}

function defaultChainKey(): ChainKey {
  const fromName = normalizeChainKey(envValue(['VITE_ACTIVE_CHAIN', 'VITE_CHAIN_KEY', 'VITE_NETWORK']))
  if (fromName) return fromName

  const chainId = Number(envValue(['VITE_CHAIN_ID']))
  if (chainId === 1) return 'ethereum'
  if (chainId === 11155111) return 'sepolia'
  return 'local'
}

function contractAddress(keys: string[], fallback = '') {
  return envValue(keys, fallback)
}

const localContracts: Record<ContractAddressKey, string> = {
  VNDCToken: contractAddress(['VITE_LOCAL_TOKEN_CONTRACT_ADDRESS', 'VITE_TOKEN_CONTRACT_ADDRESS'], '0x21dF544947ba3E8b3c32561399E88B52Dc8b2823'),
  VNDCStaking: contractAddress(['VITE_LOCAL_STAKING_CONTRACT_ADDRESS', 'VITE_STAKING_CONTRACT_ADDRESS'], '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43'),
  VNDCTokenVesting: contractAddress(['VITE_LOCAL_VESTING_CONTRACT_ADDRESS', 'VITE_VESTING_CONTRACT_ADDRESS'], '0x2E2Ed0Cfd3AD2f1d34481277b3204d807Ca2F8c2'),
  TaskManager: contractAddress(['VITE_LOCAL_TASK_MANAGER_ADDRESS', 'VITE_TASK_MANAGER_ADDRESS'], '0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD'),
  FundingManager: contractAddress(['VITE_LOCAL_FUNDING_MANAGER_ADDRESS', 'VITE_FUNDING_MANAGER_ADDRESS'], '0x51A1ceB83B83F1985a81C295d1fF28Afef186E02'),
  DAOManager: contractAddress(['VITE_LOCAL_DAO_MANAGER_ADDRESS', 'VITE_DAO_MANAGER_ADDRESS'], '0x36b58F5C1969B7b6591D752ea6F5486D069010AB'),
  MarketplaceManager: contractAddress(['VITE_LOCAL_MARKETPLACE_MANAGER_ADDRESS', 'VITE_MARKETPLACE_MANAGER_ADDRESS'], '0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7'),
  VNDCNFTCollection: contractAddress(['VITE_LOCAL_NFT_CONTRACT_ADDRESS', 'VITE_NFT_CONTRACT_ADDRESS'], '0x202CCe504e04bEd6fC0521238dDf04Bc9E8E15aB'),
  NFTMarketplace721: contractAddress(['VITE_LOCAL_NFT_MARKETPLACE_721_ADDRESS', 'VITE_NFT_MARKETPLACE_721_ADDRESS'], '0xf4B146FbA71F41E0592668ffbF264F1D186b2Ca8'),
  VNDCERC1155Collection: contractAddress(['VITE_LOCAL_ERC1155_NFT_CONTRACT_ADDRESS', 'VITE_ERC1155_NFT_CONTRACT_ADDRESS'], '0x0355B7B8cb128fA5692729Ab3AAa199C1753f726'),
}

const sepoliaContracts: Record<ContractAddressKey, string> = {
  VNDCToken: contractAddress(['VITE_SEPOLIA_TOKEN_CONTRACT_ADDRESS'], '0x2c54Aeeafe488248aBAeBA32695bD21212216484'),
  VNDCStaking: contractAddress(['VITE_SEPOLIA_STAKING_CONTRACT_ADDRESS']),
  VNDCTokenVesting: contractAddress(['VITE_SEPOLIA_VESTING_CONTRACT_ADDRESS']),
  TaskManager: contractAddress(['VITE_SEPOLIA_TASK_MANAGER_ADDRESS']),
  FundingManager: contractAddress(['VITE_SEPOLIA_FUNDING_MANAGER_ADDRESS']),
  DAOManager: contractAddress(['VITE_SEPOLIA_DAO_MANAGER_ADDRESS']),
  MarketplaceManager: contractAddress(['VITE_SEPOLIA_MARKETPLACE_MANAGER_ADDRESS']),
  VNDCNFTCollection: contractAddress(['VITE_SEPOLIA_NFT_CONTRACT_ADDRESS']),
  NFTMarketplace721: contractAddress(['VITE_SEPOLIA_NFT_MARKETPLACE_721_ADDRESS']),
  VNDCERC1155Collection: contractAddress(['VITE_SEPOLIA_ERC1155_NFT_CONTRACT_ADDRESS']),
}

const ethereumContracts: Record<ContractAddressKey, string> = {
  VNDCToken: contractAddress(['VITE_ETHEREUM_TOKEN_CONTRACT_ADDRESS', 'VITE_MAINNET_TOKEN_CONTRACT_ADDRESS']),
  VNDCStaking: contractAddress(['VITE_ETHEREUM_STAKING_CONTRACT_ADDRESS', 'VITE_MAINNET_STAKING_CONTRACT_ADDRESS']),
  VNDCTokenVesting: contractAddress(['VITE_ETHEREUM_VESTING_CONTRACT_ADDRESS', 'VITE_MAINNET_VESTING_CONTRACT_ADDRESS']),
  TaskManager: contractAddress(['VITE_ETHEREUM_TASK_MANAGER_ADDRESS', 'VITE_MAINNET_TASK_MANAGER_ADDRESS']),
  FundingManager: contractAddress(['VITE_ETHEREUM_FUNDING_MANAGER_ADDRESS', 'VITE_MAINNET_FUNDING_MANAGER_ADDRESS']),
  DAOManager: contractAddress(['VITE_ETHEREUM_DAO_MANAGER_ADDRESS', 'VITE_MAINNET_DAO_MANAGER_ADDRESS']),
  MarketplaceManager: contractAddress(['VITE_ETHEREUM_MARKETPLACE_MANAGER_ADDRESS', 'VITE_MAINNET_MARKETPLACE_MANAGER_ADDRESS']),
  VNDCNFTCollection: contractAddress(['VITE_ETHEREUM_NFT_CONTRACT_ADDRESS', 'VITE_MAINNET_NFT_CONTRACT_ADDRESS']),
  NFTMarketplace721: contractAddress(['VITE_ETHEREUM_NFT_MARKETPLACE_721_ADDRESS', 'VITE_MAINNET_NFT_MARKETPLACE_721_ADDRESS']),
  VNDCERC1155Collection: contractAddress(['VITE_ETHEREUM_ERC1155_NFT_CONTRACT_ADDRESS', 'VITE_MAINNET_ERC1155_NFT_CONTRACT_ADDRESS']),
}

export const CHAIN_CONFIGS: Record<ChainKey, ChainConfig> = {
  local: {
    key: 'local',
    label: 'Local Hardhat',
    shortLabel: 'Local',
    backendNetwork: 'local',
    hardhatNetwork: 'localhost',
    chainId: 31337,
    chainIdHex: toHexChainId(31337),
    rpcUrl: envValue(['VITE_LOCAL_RPC_URL', 'VITE_RPC_URL'], 'http://127.0.0.1:8545'),
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contracts: localContracts,
  },
  sepolia: {
    key: 'sepolia',
    label: 'Sepolia Testnet',
    shortLabel: 'Sepolia',
    backendNetwork: 'sepolia',
    hardhatNetwork: 'sepolia',
    chainId: 11155111,
    chainIdHex: toHexChainId(11155111),
    rpcUrl: envValue(['VITE_SEPOLIA_RPC_URL'], 'https://ethereum-sepolia-rpc.publicnode.com'),
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    contracts: sepoliaContracts,
  },
  ethereum: {
    key: 'ethereum',
    label: 'Ethereum Mainnet',
    shortLabel: 'Ethereum',
    backendNetwork: 'ethereum',
    hardhatNetwork: 'mainnet',
    chainId: 1,
    chainIdHex: toHexChainId(1),
    rpcUrl: envValue(['VITE_ETHEREUM_RPC_URL', 'VITE_MAINNET_RPC_URL'], 'https://ethereum-rpc.publicnode.com'),
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contracts: ethereumContracts,
  },
}

export const SUPPORTED_CHAINS = Object.values(CHAIN_CONFIGS)

export function getActiveChainKey(): ChainKey {
  return defaultChainKey()
}

export function getChainConfig(chainKey: ChainKey): ChainConfig {
  return CHAIN_CONFIGS[chainKey]
}

export function getActiveChainConfig(): ChainConfig {
  return CHAIN_CONFIGS[getActiveChainKey()]
}

export function getChainConfigById(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.chainId === chainId)
}

export function isConfiguredAddress(address: string | null | undefined): address is string {
  if (!address) return false
  return /^0x[a-fA-F0-9]{40}$/.test(address) && address.toLowerCase() !== ZERO_ADDRESS
}

export function getContractAddress(key: ContractAddressKey, chain = getActiveChainConfig()) {
  return chain.contracts[key] ?? ''
}

export function getRequiredContractAddress(key: ContractAddressKey, label: string = key, chain = getActiveChainConfig()) {
  const address = getContractAddress(key, chain)
  if (!isConfiguredAddress(address)) {
    throw new Error(`${label} chưa được cấu hình trên ${chain.label}.`)
  }
  return address
}

export function getWalletChainParams(chain: ChainConfig): Record<string, unknown> {
  const params: Record<string, unknown> = {
    chainId: chain.chainIdHex,
    chainName: chain.label,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [chain.rpcUrl],
  }
  if (chain.explorerUrl) {
    params.blockExplorerUrls = [chain.explorerUrl]
  }
  return params
}

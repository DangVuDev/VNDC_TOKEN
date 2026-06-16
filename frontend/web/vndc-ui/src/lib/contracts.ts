/**
 * contracts.ts — Ethers.js v6 contract reader for the Admin ContractTab.
 *
 * All functions use a read-only JsonRpcProvider (no wallet needed).
 * Write operations go through existing backend admin REST endpoints.
 */

import { ethers, Contract, JsonRpcProvider } from 'ethers'
import { getActiveChainConfig, isConfiguredAddress } from './chainConfig'

// ─── Provider ────────────────────────────────────────────────────────────────

const ACTIVE_CHAIN = getActiveChainConfig()
const RPC_URL = ACTIVE_CHAIN.rpcUrl

function provider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL)
}

// ─── Deployed addresses (kept in sync with deployed-addresses.json) ──────────

function contractMeta<T extends string>(address: string, label: string, type: T) {
  return {
    address,
    label,
    type,
    deployed: isConfiguredAddress(address),
  }
}

export const CONTRACTS = {
  VNDCToken: contractMeta(ACTIVE_CHAIN.contracts.VNDCToken, 'VNDC Token', 'ERC20 + AccessControl + Pausable' as const),
  VNDCStaking: contractMeta(ACTIVE_CHAIN.contracts.VNDCStaking, 'VNDC Staking', 'AccessControl' as const),
  DAOManager: contractMeta(ACTIVE_CHAIN.contracts.DAOManager, 'DAO Manager', 'Ownable + Pausable' as const),
  MarketplaceManager: contractMeta(ACTIVE_CHAIN.contracts.MarketplaceManager, 'Marketplace Manager', 'Ownable + ReentrancyGuard' as const),
  FundingManager: contractMeta(ACTIVE_CHAIN.contracts.FundingManager, 'Funding Manager', 'Ownable + Pausable' as const),
  TaskManager: contractMeta(ACTIVE_CHAIN.contracts.TaskManager, 'Task Manager', 'Ownable + Pausable' as const),
  VNDCNFTCollection: contractMeta(ACTIVE_CHAIN.contracts.VNDCNFTCollection, 'NFT Collection', 'ERC721 + Ownable' as const),
} as const

export type ContractKey = keyof typeof CONTRACTS

// ─── ABIs (minimal — only what the admin dashboard reads) ───────────────────

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]

const PAUSABLE_ABI = [
  'function paused() view returns (bool)',
]

const OWNABLE_ABI = [
  'function owner() view returns (address)',
]

const ACCESS_CONTROL_ABI = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function getRoleAdmin(bytes32 role) view returns (bytes32)',
]

const VNDC_TOKEN_ABI = [
  ...ERC20_ABI,
  ...PAUSABLE_ABI,
  ...ACCESS_CONTROL_ABI,
  'function MAX_SUPPLY() view returns (uint256)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function PAUSER_ROLE() view returns (bytes32)',
  'function nonces(address) view returns (uint256)',
  'function vestingInfo(address) view returns (uint256 amount, uint256 releaseTime)',
]

const VNDC_STAKING_ABI = [
  ...PAUSABLE_ABI,
  ...ACCESS_CONTROL_ABI,
  'function vndc() view returns (address)',
  'function rewardRate() view returns (uint256)',
  'function minStakeAmount() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function totalRewardsDistributed() view returns (uint256)',
  'function ADMIN_ROLE() view returns (bytes32)',
  'function stakes(address) view returns (uint256 amount, uint256 startTime, uint256 duration, uint256 rewards, bool locked)',
]

const DAO_MANAGER_ABI = [
  ...OWNABLE_ABI,
  ...PAUSABLE_ABI,
  'function daos(bytes32) view returns (bytes32 id, string name, string metadataURI, address governanceToken, uint256 quorumBps, uint64 votingDelay, uint64 votingPeriod, uint64 timelockDuration, bool active, uint64 createdAt)',
  'function proposals(bytes32) view returns (bytes32 id, bytes32 daoId, address proposer, address target, uint256 value, bytes data, bytes32 descriptionHash, uint64 startTime, uint64 endTime, uint64 eta, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool queued, bool executed, bool cancelled)',
]

const MARKETPLACE_ABI = [
  ...OWNABLE_ABI,
  'function listings(bytes32) view returns (bytes32 id, address seller, address nftContract, uint256 tokenId, address paymentToken, uint256 price, bool active, uint64 createdAt)',
]

const FUNDING_ABI = [
  ...OWNABLE_ABI,
  ...PAUSABLE_ABI,
  'function token() view returns (address)',
  'function pots(bytes32) view returns (bytes32 id, string category, string title, address owner, uint256 targetAmount, uint256 totalContributed, uint256 totalSpent, uint256 availableBalance, uint8 status, uint64 createdAt, uint64 startsAt, uint64 endsAt)',
]

const TASK_MANAGER_ABI = [
  ...OWNABLE_ABI,
  ...PAUSABLE_ABI,
  'function vndc() view returns (address)',
  'function poolBalance() view returns (uint256)',
  'function tasks(bytes32) view returns (uint256 rewardAmount, uint256 maxSlots, uint256 claimedSlots, bool active)',
  'function activityPoints(address) view returns (uint256)',
]

const NFT_COLLECTION_ABI = [
  ...OWNABLE_ABI,
  'function balanceOf(address account) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
]

export const CONTRACT_ABIS: Record<ContractKey, string[]> = {
  VNDCToken: VNDC_TOKEN_ABI,
  VNDCStaking: VNDC_STAKING_ABI,
  DAOManager: DAO_MANAGER_ABI,
  MarketplaceManager: MARKETPLACE_ABI,
  FundingManager: FUNDING_ABI,
  TaskManager: TASK_MANAGER_ABI,
  VNDCNFTCollection: NFT_COLLECTION_ABI,
}

// ─── Role keccak256 constants (precomputed, same as Solidity) ────────────────

export const ROLES = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash, // 0x000...000
  MINTER_ROLE: ethers.id('MINTER_ROLE'),
  PAUSER_ROLE: ethers.id('PAUSER_ROLE'),
  ADMIN_ROLE: ethers.id('ADMIN_ROLE'),
  OPERATOR_ROLE: ethers.id('OPERATOR_ROLE'),
}

// ─── VNDCToken reader ─────────────────────────────────────────────────────────

export interface VNDCTokenState {
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  maxSupply: bigint
  paused: boolean
  minterRole: string
  pauserRole: string
  adminRole: string
}

export async function readVNDCToken(address: string): Promise<VNDCTokenState> {
  const c = new Contract(address, VNDC_TOKEN_ABI, provider())
  const [name, symbol, decimals, totalSupply, maxSupply, paused, minterRole, pauserRole, adminRole] = await Promise.all([
    c.name() as Promise<string>,
    c.symbol() as Promise<string>,
    c.decimals() as Promise<bigint>,
    c.totalSupply() as Promise<bigint>,
    c.MAX_SUPPLY() as Promise<bigint>,
    c.paused() as Promise<boolean>,
    c.MINTER_ROLE() as Promise<string>,
    c.PAUSER_ROLE() as Promise<string>,
    c.DEFAULT_ADMIN_ROLE() as Promise<string>,
  ])
  return { name, symbol, decimals: Number(decimals), totalSupply, maxSupply, paused, minterRole, pauserRole, adminRole }
}

export async function checkRole(address: string, role: string, account: string): Promise<boolean> {
  const c = new Contract(address, ACCESS_CONTROL_ABI, provider())
  return c.hasRole(role, account) as Promise<boolean>
}

export async function checkOwner(address: string): Promise<string> {
  const c = new Contract(address, OWNABLE_ABI, provider())
  return c.owner() as Promise<string>
}

export async function checkPaused(address: string): Promise<boolean> {
  const c = new Contract(address, PAUSABLE_ABI, provider())
  return c.paused() as Promise<boolean>
}

export async function readVestingInfo(tokenAddress: string, holder: string): Promise<{ amount: bigint; releaseTime: bigint }> {
  const c = new Contract(tokenAddress, VNDC_TOKEN_ABI, provider())
  const [amount, releaseTime] = await (c.vestingInfo(holder) as Promise<[bigint, bigint]>)
  return { amount, releaseTime }
}

export async function readStakingState(address: string) {
  const c = new Contract(address, VNDC_STAKING_ABI, provider())
  const [totalStaked, totalRewardsDistributed, rewardRate, minStakeAmount, paused, adminRole] = await Promise.all([
    c.totalStaked() as Promise<bigint>,
    c.totalRewardsDistributed() as Promise<bigint>,
    c.rewardRate() as Promise<bigint>,
    c.minStakeAmount() as Promise<bigint>,
    c.paused() as Promise<boolean>,
    c.ADMIN_ROLE() as Promise<string>,
  ])
  return { totalStaked, totalRewardsDistributed, rewardRate, minStakeAmount, paused, adminRole }
}

export async function readTaskManagerState(address: string) {
  const c = new Contract(address, TASK_MANAGER_ABI, provider())
  const [owner, poolBalance, paused] = await Promise.all([
    c.owner() as Promise<string>,
    c.poolBalance() as Promise<bigint>,
    c.paused() as Promise<boolean>,
  ])
  return { owner, poolBalance, paused }
}

export async function readFundingState(address: string) {
  const c = new Contract(address, FUNDING_ABI, provider())
  const [owner, paused, tokenAddr] = await Promise.all([
    c.owner() as Promise<string>,
    c.paused() as Promise<boolean>,
    c.token() as Promise<string>,
  ])
  return { owner, paused, tokenAddr }
}

// ─── Network helpers ──────────────────────────────────────────────────────────

export async function getNetworkInfo() {
  const p = provider()
  const [network, blockNumber] = await Promise.all([
    p.getNetwork(),
    p.getBlockNumber(),
  ])
  return {
    chainId: Number(network.chainId),
    name: network.name,
    blockNumber,
  }
}

export async function getBalance(address: string): Promise<bigint> {
  return provider().getBalance(address)
}

// ─── Wei formatter ────────────────────────────────────────────────────────────

export function formatVNDC(wei: bigint, decimals = 18): string {
  const whole = wei / BigInt(10 ** decimals)
  return whole.toLocaleString('vi-VN')
}

export function formatVNDCFull(wei: bigint, decimals = 18): string {
  return ethers.formatUnits(wei, decimals)
}

// ─── Contract Addresses Configuration ───
// Update these after deployment

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  contracts: ContractAddresses;
}

export interface ContractAddresses {
  vndc: string;
  registry: string;
  accessControl: string;
  credentialVerification: string;
  credentialNFT: string;
  academicReward: string;
  academicBadgeNFT: string;
  extracurricularReward: string;
  paymentProcessor: string;
  merchantRegistry: string;
  studentRecordManager: string;
  studentDAO: string;
  governanceToken: string;
  studentIDToken: string;
  certificationSystem: string;
  scholarshipManager: string;
  alumniRegistry: string;
  reputationBadge: string;
  jobBoard: string;
  internshipManager: string;
  researchPlatform: string;
  auditingSystem: string;
  analyticsDashboard: string;
  internalExchange: string;
}

const EMPTY_CONTRACTS: ContractAddresses = {
  vndc: '',
  registry: '',
  accessControl: '',
  credentialVerification: '',
  credentialNFT: '',
  academicReward: '',
  academicBadgeNFT: '',
  extracurricularReward: '',
  paymentProcessor: '',
  merchantRegistry: '',
  studentRecordManager: '',
  studentDAO: '',
  governanceToken: '',
  studentIDToken: '',
  certificationSystem: '',
  scholarshipManager: '',
  alumniRegistry: '',
  reputationBadge: '',
  jobBoard: '',
  internshipManager: '',
  researchPlatform: '',
  auditingSystem: '',
  analyticsDashboard: '',
  internalExchange: '',
};

export const NETWORKS: Record<number, NetworkConfig> = {
  31337: {
    chainId: 31337,
    name: 'Hardhat Local',
    rpcUrl: 'http://127.0.0.1:8545',
    explorer: '',
    contracts: { ...EMPTY_CONTRACTS },
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    contracts: { ...EMPTY_CONTRACTS },
  },
  137: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    contracts: { ...EMPTY_CONTRACTS },
  },
};

export const DEFAULT_CHAIN_ID = 31337;

export function getContractAddress(chainId: number, contract: keyof ContractAddresses): string {
  return NETWORKS[chainId]?.contracts[contract] ?? '';
}

export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return NETWORKS[chainId];
}

export const ROLES = {
  ADMIN: '0x' + 'a49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
  TEACHER: '0x' + '5e17fc5225d4a099df75359ce1f405503ca79498a8dc46a7d583235f0ce9c16e',
  STUDENT: '0x' + 'f36d2f2ef8e0b04b4ee2e3c7b4a2c8e953e1d13e3c3d2e8f0b4a5c6d7e8f9a0b',
  MERCHANT: '0x' + 'a0e2d9a0c5b4d3e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0',
  ISSUER: '0x' + 'b1f3e0a1d6c5e4f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
  MINTER: '0x' + 'c2a4f1b2e7d6f5a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.TEACHER]: 'Giảng viên',
  [ROLES.STUDENT]: 'Sinh viên',
  [ROLES.MERCHANT]: 'Merchant',
  [ROLES.ISSUER]: 'Issuer',
  [ROLES.MINTER]: 'Minter',
};

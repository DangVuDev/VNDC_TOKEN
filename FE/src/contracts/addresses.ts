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
    contracts: {
      vndc: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
      registry: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
      accessControl: '0x68B1D87F95878fE05B998F19b66F4baba5De1aed',
      credentialVerification: '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d',
      credentialNFT: '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
      academicReward: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
      academicBadgeNFT: '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
      extracurricularReward: '0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9',
      paymentProcessor: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      merchantRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      studentRecordManager: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      studentDAO: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      governanceToken: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      studentIDToken: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
      certificationSystem: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
      scholarshipManager: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
      alumniRegistry: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
      reputationBadge: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
      jobBoard: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
      internshipManager: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
      researchPlatform: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
      auditingSystem: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
      analyticsDashboard: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
      internalExchange: '',
    },
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

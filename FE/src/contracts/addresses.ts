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
  dataMigration: string;
  internalExchange: string;
  marketplace: string;
  stakingPool: string;
  fundraising: string;
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
  dataMigration: '',
  internalExchange: '',
  marketplace: '',
  stakingPool: '',
  fundraising: '',
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
      dataMigration: '',
      internalExchange: '',
      marketplace: '',
      stakingPool: '',
      fundraising: '',
    },
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://1rpc.io/sepolia',
    explorer: 'https://sepolia.etherscan.io',
    contracts: {
      vndc: '0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48',
      registry: '0x7d16b0e9dC98a976F008f5606eE26Bba50FDe2c1',
      accessControl: '0x69d2F6cD1B6a3E4A273C003DcFf0CDA0CEb1cE65',
      credentialVerification: '0x2F73B53C805A90C1BB407726c704637C5dC19284',
      credentialNFT: '0x706Ca9875Ca5bE5214413d1741c38976BBC38c71',
      academicReward: '0x59D093AF84dD99fe20817075C52527855b8dFB9b',
      academicBadgeNFT: '0x78d380eeBe479660b37e772Db0404bE62D200851',
      extracurricularReward: '0x2ec4Cf8Abfb952Eb3d5844C72925Ebe9FBa70B9e',
      paymentProcessor: '0xe5AA2b90aC87F4271982E26e3D8Be46014f6b30e',
      merchantRegistry: '0x3e33EFe8cBBb65561d1253FEC9295833cF5D714c',
      studentRecordManager: '0x319EE1f8094c9fa5E39cB0643A90aDAC18f37bE2',
      studentDAO: '0x5eCF36478E3989705972775E1A443F53c7c43532',
      governanceToken: '0x8d05155aA9bAeD9862e44fa5697612B9a21eD2A7',
      studentIDToken: '0xeeef6d62c071B31C02FA8234a704a3Db9341596F',
      certificationSystem: '0x5Ec6441A93ff6F505F779468F0bd12F79Ee03D40',
      scholarshipManager: '0x50Db8937caC9b1D254055438b398a409F9250E03',
      alumniRegistry: '0xC41EE8f2953d1c8aBa093a591857474a08716636',
      reputationBadge: '0x4C906f2bC9Cc6Fd0536DB3b6D9962C0819f79C4c',
      jobBoard: '0xfB0E0143Fc5b83b9809aCa6ae7eD040568d1e116',
      internshipManager: '0xf41DC2c98852144ec0D7EcEF74D4256BaDdF4460',
      researchPlatform: '0x6e2B4a19c44623b63379c35F1643fc076765f936',
      auditingSystem: '0x4AF9eAA67Dc5c5BC9B75f9F0e525aCcAE3A857f5',
      analyticsDashboard: '0xb32B60D65f20c24d2885FC472D57A4439c4b3061',
      dataMigration: '0x3d1AD1ebdac6a86C692865C6B5C274EdB57e9445',
      internalExchange: '',
      marketplace: '0x4E4721f966F454007127b7f4D049f22961D91596',
      stakingPool: '0xcbC39F0BF0585A11a86F3391d09D1F18f0b01F40',
      fundraising: '0x8413712C5C4EeC5a000DB328B50D1Bf738532fEC',
    },
  },
  137: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    contracts: { ...EMPTY_CONTRACTS },
  },
};

export const DEFAULT_CHAIN_ID = 11155111;

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

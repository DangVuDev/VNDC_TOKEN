import { useMemo } from 'react';
import { Contract, type InterfaceAbi } from 'ethers';
import { useWeb3 } from '@/contexts/Web3Context';
import { getContractAddress, type ContractAddresses } from '@/contracts/addresses';
import {
  VNDC_ABI, REGISTRY_ABI, ACCESS_CONTROL_ABI,
  CREDENTIAL_VERIFICATION_ABI, CREDENTIAL_NFT_ABI,
  ACADEMIC_REWARD_ABI, ACADEMIC_BADGE_NFT_ABI,
  PAYMENT_PROCESSOR_ABI, MERCHANT_REGISTRY_ABI,
  STUDENT_RECORD_MANAGER_ABI, STUDENT_DAO_ABI, GOVERNANCE_TOKEN_ABI,
  STUDENT_ID_ABI, SCHOLARSHIP_MANAGER_ABI, JOB_BOARD_ABI,
  EXTRACURRICULAR_REWARD_ABI, CERTIFICATION_SYSTEM_ABI,
  ALUMNI_REGISTRY_ABI, REPUTATION_BADGE_ABI,
  INTERNSHIP_MANAGER_ABI, RESEARCH_PLATFORM_ABI,
  AUDITING_SYSTEM_ABI, ANALYTICS_DASHBOARD_ABI,
  DATA_MIGRATION_ABI, INTERNAL_EXCHANGE_ABI,
  MARKETPLACE_ABI, STAKING_POOL_ABI,
  FUNDRAISING_ABI,
} from '@/contracts/abis';

/**
 * Generic hook to get a contract instance
 */
export function useContract(
  contractKey: keyof ContractAddresses,
  abi: InterfaceAbi
): Contract | null {
  const { signer, provider, chainId } = useWeb3();

  return useMemo(() => {
    if (!chainId) return null;
    const address = getContractAddress(chainId, contractKey);
    if (!address) return null;
    const signerOrProvider = signer || provider;
    if (!signerOrProvider) return null;
    try {
      return new Contract(address, abi, signerOrProvider);
    } catch {
      return null;
    }
  }, [signer, provider, chainId, contractKey, abi]);
}

// ─── Specific Contract Hooks ───

export function useVNDC() {
  return useContract('vndc', VNDC_ABI);
}

export function useRegistry() {
  return useContract('registry', REGISTRY_ABI);
}

export function useAccessControl() {
  return useContract('accessControl', ACCESS_CONTROL_ABI);
}

export function useCredentialVerification() {
  return useContract('credentialVerification', CREDENTIAL_VERIFICATION_ABI);
}

export function useCredentialNFT() {
  return useContract('credentialNFT', CREDENTIAL_NFT_ABI);
}

export function useAcademicReward() {
  return useContract('academicReward', ACADEMIC_REWARD_ABI);
}

export function useAcademicBadgeNFT() {
  return useContract('academicBadgeNFT', ACADEMIC_BADGE_NFT_ABI);
}

export function useExtracurricularReward() {
  return useContract('extracurricularReward', EXTRACURRICULAR_REWARD_ABI);
}

export function usePaymentProcessor() {
  return useContract('paymentProcessor', PAYMENT_PROCESSOR_ABI);
}

export function useMerchantRegistry() {
  return useContract('merchantRegistry', MERCHANT_REGISTRY_ABI);
}

export function useStudentRecordManager() {
  return useContract('studentRecordManager', STUDENT_RECORD_MANAGER_ABI);
}

export function useStudentDAO() {
  return useContract('studentDAO', STUDENT_DAO_ABI);
}

export function useGovernanceToken() {
  return useContract('governanceToken', GOVERNANCE_TOKEN_ABI);
}

export function useStudentID() {
  return useContract('studentIDToken', STUDENT_ID_ABI);
}

export function useCertificationSystem() {
  return useContract('certificationSystem', CERTIFICATION_SYSTEM_ABI);
}

export function useScholarshipManager() {
  return useContract('scholarshipManager', SCHOLARSHIP_MANAGER_ABI);
}

export function useAlumniRegistry() {
  return useContract('alumniRegistry', ALUMNI_REGISTRY_ABI);
}

export function useReputationBadge() {
  return useContract('reputationBadge', REPUTATION_BADGE_ABI);
}

export function useJobBoard() {
  return useContract('jobBoard', JOB_BOARD_ABI);
}

export function useInternshipManager() {
  return useContract('internshipManager', INTERNSHIP_MANAGER_ABI);
}

export function useResearchPlatform() {
  return useContract('researchPlatform', RESEARCH_PLATFORM_ABI);
}

export function useAuditingSystem() {
  return useContract('auditingSystem', AUDITING_SYSTEM_ABI);
}

export function useAnalyticsDashboard() {
  return useContract('analyticsDashboard', ANALYTICS_DASHBOARD_ABI);
}

export function useDataMigration() {
  return useContract('dataMigration', DATA_MIGRATION_ABI);
}

export function useInternalExchange() {
  return useContract('internalExchange', INTERNAL_EXCHANGE_ABI);
}

export function useMarketplace() {
  return useContract('marketplace', MARKETPLACE_ABI);
}

export function useStakingPool() {
  return useContract('stakingPool', STAKING_POOL_ABI);
}

export function useFundraising() {
  return useContract('fundraising', FUNDRAISING_ABI);
}

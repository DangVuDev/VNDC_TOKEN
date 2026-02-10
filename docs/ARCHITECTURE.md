# VNDC System - Architecture & Module Design

## Overview

VNDC là một hệ thống DApp phi tập trung cho môi trường đại học, xây dựng trên Ethereum/Polygon sử dụng Solidity smart contracts.

**Ngôn ngữ:** Solidity 0.8.24  
**Framework:** Hardhat + TypeChain + Ethers.js v6  
**Network:** Sepolia (testnet), Polygon/BSC (production)  
**Token Standard:** ERC-20 (VNDC), ERC-721 (Credentials), ERC-1155 (Badges)  

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│           VNDC Frontend (DApp - React)          │
├─────────────────────────────────────────────────┤
│  MetaMask Integration | Ethers.js | Web3.js    │
└──────────────┬──────────────────────────────────┘
               │ (Contract calls via ABI)
┌──────────────▼──────────────────────────────────┐
│        Blockchain (Sepolia/Polygon/BSC)        │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │  Core Layer (1-core-module)             │   │
│  │  • VNDC Token (ERC-20)                  │   │
│  │  • VNDCRegistry                         │   │
│  │  • AccessControl & Roles                │   │
│  └─────────────────────────────────────────┘   │
│                    ▲                             │
│  ┌─────────────────┼─────────────────────────┐  │
│  │                 │                         │  │
│  ▼                 ▼                         ▼  │
│┌────────────┐┌────────────┐┌──────────────┐  │
││ Credentials││  Rewards   ││   Payments   │  │
││  Module    ││  Module    ││   Module     │  │
│└────────────┘└────────────┘└──────────────┘  │
│┌────────────┐┌────────────┐┌──────────────┐  │
││  Records   ││Governance  ││Scholarships  │  │
││  Module    ││  Module    ││   Module     │  │
│└────────────┘└────────────┘└──────────────┘  │
│┌────────────┐┌────────────┐┌──────────────┐  │
││ Research   ││    IP      ││  Feedback    │  │
││  Module    ││Management  ││   Module     │  │
│└────────────┘└────────────┘└──────────────┘  │
│┌────────────┐┌────────────┐┌──────────────┐  │
││  Resource  ││  Lifelong  ││Collaboration│  │
││Booking Mod.││ Learning   ││   Module     │  │
│└────────────┘└────────────┘└──────────────┘  │
│┌────────────┐┌────────────┐┌──────────────┐  │
││Gamification││Student ID  ││ Crowdfunding │  │
││  Module    ││  Module    ││   Module     │  │
│└────────────┘└────────────┘└──────────────┘  │
│┌────────────────────────────────────────────┐ │
││         Staking Module (Future)            │ │
│└────────────────────────────────────────────┘ │
│                                              │
└──────────────────────────────────────────────┘
               │ (Events)
┌──────────────▼──────────────────────────────┐
│      Backend (Off-chain Indexer/APIs)       │
├──────────────────────────────────────────────┤
│  • The Graph (Subgraph)                      │
│  • IPFS (Metadata storage)                   │
│  • Database (User data, non-sensitive)       │
└──────────────────────────────────────────────┘
```

---

## Module Structure

Tất cả modules tuân theo pattern:

```
contracts/modules/{number}-{name}/
├── {ModuleName}.sol          # Main contract
├── I{ModuleName}.sol          # Interface
├── {ModuleName}NFT.sol        # NFT contract (nếu cần)
└── {ModuleName}Utils.sol      # Utilities (nếu cần)
```

---

## Module Execution Priority & Scoring

| # | Module | Tên File | Điểm /10 | Status | Dependency |
|---|--------|----------|---------|--------|------------|
| **1** | **Core** | `001-core` | 10.0 | FIRST | - |
| **2** | **Credentials** | `002-credentials` | 9.8 | SECOND | Core |
| **3** | **Rewards (Performance)** | `003-rewards-academic` | 9.3 | SECOND | Core |
| **4** | **Rewards (Extracurricular)** | `004-rewards-extracurricular` | 8.7 | SECOND | Core |
| **5** | **Payments** | `005-payments` | 9.0 | THIRD | Core |
| **6** | **Records Management** | `006-records` | 9.2 | THIRD | Core |
| **7** | **Governance & Voting** | `007-governance` | 9.1 | THIRD | Core |
| **8** | **Student ID Tokenization** | `008-student-id` | 8.3 | THIRD | Core |
| **9** | **Scholarships** | `009-scholarships` | 8.9 | FOURTH | Core |
| **10** | **Gamification** | `010-gamification` | 8.9 | FOURTH | Core, Rewards |
| **11** | **Feedback System** | `011-feedback` | 8.6 | FOURTH | Core |
| **12** | **Resource Booking** | `012-resource-booking` | 8.2 | FIFTH | Core |
| **13** | **Research Data Sharing** | `013-research` | 8.5 | FIFTH | Core |
| **14** | **IP Management** | `014-ip-management` | 8.4 | FIFTH | Core |
| **15** | **Lifelong Learning** | `015-lifelong-learning` | 8.7 | FIFTH | Core |
| **16** | **Collaboration Platform** | `016-collaboration` | 8.0 | SIXTH | Core |
| **17** | **Crowdfunding** | `017-crowdfunding` | 8.1 | SIXTH | Core |
| **18** | **Staking Pool** | `018-staking` | 7.5 | FUTURE | Core |
| **19** | **Open CourseWare** | `019-courseware` | 7.8 | FUTURE | Core |

---

## File Organization

```
contracts/
├── modules/
│   ├── 001-core/
│   │   ├── VNDC.sol                    # ERC-20 token
│   │   ├── VNDCRegistry.sol            # User registry
│   │   ├── IVNDCCore.sol               # Interfaces
│   │   └── AccessControl.sol           # Common roles
│   ├── 002-credentials/
│   │   ├── CredentialVerification.sol  # Main logic
│   │   ├── CredentialNFT.sol           # ERC-721 NFT
│   │   └── ICredentials.sol
│   ├── 003-rewards-academic/
│   │   ├── AcademicReward.sol
│   │   ├── AcademicRewardNFT.sol
│   │   └── IAcademicReward.sol
│   ├── 004-rewards-extracurricular/
│   │   ├── ExtraReward.sol
│   │   ├── ActivityBadge.sol           # ERC-1155
│   │   └── IExtraReward.sol
│   ├── 005-payments/
│   │   ├── PaymentProcessor.sol
│   │   ├── MerchantRegistry.sol
│   │   └── IPayment.sol
│   ├── 006-records/
│   │   ├── StudentRecordManager.sol
│   │   └── IStudentRecord.sol
│   ├── 007-governance/
│   │   ├── StudentDAO.sol              # Governor contract
│   │   ├── GovernanceToken.sol         # Vote token
│   │   └── IGovernance.sol
│   ├── 008-student-id/
│   │   ├── StudentIDCard.sol           # ERC-721 NFT
│   │   └── IStudentID.sol
│   ├── 009-scholarships/
│   │   ├── ScholarshipManager.sol
│   │   └── IScholarship.sol
│   ├── 010-gamification/
│   │   ├── GamificationEngine.sol
│   │   ├── QuestNFT.sol                # ERC-1155
│   │   └── IGamification.sol
│   ├── 011-feedback/
│   │   ├── FeedbackSystem.sol
│   │   └── IFeedback.sol
│   ├── 012-resource-booking/
│   │   ├── ResourceBooking.sol
│   │   └── IResourceBooking.sol
│   ├── 013-research/
│   │   ├── ResearchDataMarket.sol
│   │   └── IResearch.sol
│   ├── 014-ip-management/
│   │   ├── IPRegistry.sol
│   │   └── IIPManagement.sol
│   ├── 015-lifelong-learning/
│   │   ├── LearningRecordNFT.sol       # ERC-721
│   │   └── ILearningRecord.sol
│   ├── 016-collaboration/
│   │   ├── CollaborationPlatform.sol
│   │   └── ICollaboration.sol
│   ├── 017-crowdfunding/
│   │   ├── ProjectFunding.sol
│   │   └── IFunding.sol
│   ├── 018-staking/
│   │   ├── StakingPool.sol
│   │   └── IStaking.sol
│   └── interfaces/
│       └── IVNDCCore.sol               # Core interfaces (reusable)
│
├── test/
│   └── modules/
│       ├── core/
│       │   ├── vndc.test.ts
│       │   ├── registry.test.ts
│       │   └── access-control.test.ts
│       ├── credentials/
│       │   ├── credential-verification.test.ts
│       │   └── credential-nft.test.ts
│       └── ... (other modules)
│
├── deploy/
│   └── modules/
│       ├── 001_deploy_core.ts
│       ├── 002_deploy_credentials.ts
│       ├── 003_deploy_rewards_academic.ts
│       ├── 004_deploy_rewards_extracurricular.ts
│       ├── 005_deploy_payments.ts
│       ├── ... (other modules)
│       └── 999_verify_all.ts            # Final verification
│
└── scripts/
    └── modules/
        ├── core/
        │   ├── mint-tokens.ts
        │   └── setup-roles.ts
        ├── credentials/
        │   ├── issue-credential.ts
        │   └── verify-credential.ts
        ├── payments/
        │   ├── process-payment.ts
        │   └── register-merchant.ts
        └── ... (other modules)
```

---

## Development Phases

### Phase 1: Core Infrastructure (Week 1-2)
- ✅ VNDC Token (ERC-20)
- ✅ Registry System
- ✅ Access Control & Roles
- ✅ Events & Logging

### Phase 2: Essential Features (Week 3-4)
- Credentials (NFT verification)
- Rewards System (Academic + Extracurricular)
- Payment Processing
- Student Records

### Phase 3: Governance & Advanced (Week 5-6)
- Governance DAO
- Student ID NFT
- Scholarships Management
- Gamification Engine

### Phase 4: Extended Features (Week 7-8)
- Research Data Market
- IP Management
- Feedback System
- Resource Booking
- Lifelong Learning

### Phase 5: Future Enhancements
- Collaboration Platform
- Crowdfunding
- Staking Pools
- Open CourseWare

---

## Smart Contract Patterns & Standards

### ERC Standards Used
- **ERC-20:** VNDC Token + Governance Token
- **ERC-721:** Credentials, Student ID, Learning Records
- **ERC-1155:** Badges, Quests, Activity Rewards
- **ERC-2612:** Permit extension (gas optimization)

### Design Patterns
- **Proxy Pattern:** Upgradeable contracts using OpenZeppelin's UUPS
- **Access Control:** Role-based (Admin, Teacher, Student, Merchant)
- **Factory Pattern:** Creating instances (scholarships, projects, resources)
- **Event Logging:** All state changes emit events for indexing

### Security Considerations
- ✅ Reentrancy guards
- ✅ Input validation
- ✅ Pausable contracts
- ✅ Role-based access control
- ✅ Rate limiting on sensitive operations
- ✅ Oracle security (Chainlink for future phases)

---

## Deployment Strategy

### Environment Setup
```bash
# .env file
PRIVATE_KEY=0x...               # Deployer's private key
SEPOLIA_RPC_URL=https://...     # Network RPC
ETHERSCAN_API_KEY=...           # Contract verification
REPORT_GAS=true                 # Gas optimization
```

### Deployment Order (Sequential)
1. Deploy Core module first (VNDC, Registry, AccessControl)
2. Deploy dependent modules (Credentials, Rewards, etc.)
3. Initialize connections between modules
4. Verify all contracts on Etherscan
5. Run integration tests

### Network Configuration
- **Sepolia:** Testing & staging
- **Polygon Mumbai:** Staging before production
- **Polygon Amoy:** Final testnet before mainnet
- **Mainnet:** Production (after audit)

---

## Module Dependencies Graph

```
Core (001)
├── Credentials (002)
├── Academic Rewards (003)
├── Extra Rewards (004) → Credentials
├── Payments (005)
├── Records (006)
├── Governance (007)
├── Student ID (008)
├── Scholarships (009)
├── Gamification (010) → Rewards
├── Feedback (011)
├── Resource Booking (012)
├── Research (013)
├── IP Management (014)
├── Lifelong Learning (015) → Credentials
├── Collaboration (016)
├── Crowdfunding (017)
└── Staking (018)
```

---

## Testing Strategy

### Unit Tests
- Test individual contract functions
- Location: `test/modules/{module-name}/`

### Integration Tests
- Test inter-module interactions
- Location: `test/integration/`

### End-to-End Tests
- Full user scenarios
- Location: `test/e2e/`

### Test Coverage Goals
- Minimum: 80% line coverage
- Target: 95% for critical paths

---

## Monitoring & Events

All modules emit standardized events:

```solidity
event ModuleInitialized(address indexed module, uint256 timestamp);
event TokenMinted(address indexed to, uint256 amount);
event TokenBurned(address indexed from, uint256 amount);
event RoleGranted(bytes32 indexed role, address indexed account);
event RoleRevoked(bytes32 indexed role, address indexed account);
```

Events are indexed via **The Graph** subgraph for real-time data queries.

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Gas per transaction | < 200,000 | Optimized contracts |
| Contract size | < 24KB | EVM size limit |
| Deployment cost | < 0.5 ETH | Polygon mainnet |
| Tx confirmation | < 30 sec | Polygon speed |
| TPS capacity | 100+ | Per module |

---

## Version Control & Releases

- **Version Format:** `v1.0.0-{phase}.{module}`
- **Release Branches:** `release/phase-{n}`
- **Hotfixes:** `hotfix/module-{name}`
- **Semantic Versioning:** MAJOR.MINOR.PATCH

---

**Last Updated:** Feb 6, 2026  
**Status:** Architecture approved, ready for implementation

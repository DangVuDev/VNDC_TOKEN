# VNDC Implementation Plan

Kế hoạch triển khai chi tiết từng bước từ nay đến hoàn thiện.

---

## Timeline Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Week 1: Core Infrastructure                                 │
├──────────────────────────────────────────────────────────────┤
│ Mon-Tue: VNDC Token + Registry (M001)                       │
│ Wed-Thu: Access Control + Testing                           │
│ Fri:     Deployment testing on Sepolia                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Week 2-3: Essential Features                                │
├──────────────────────────────────────────────────────────────┤
│ Mon-Tue: Credentials (M002) - NFT issuance                 │
│ Wed-Thu: Academic Rewards (M003) - GPA-based rewards       │
│ Fri:     Extracurricular Rewards (M004)                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Week 4: Payment & Records                                   │
├──────────────────────────────────────────────────────────────┤
│ Mon-Tue: Payment Processor (M005) - Transaction handling    │
│ Wed-Thu: Student Records (M006) - Data management           │
│ Fri:     Integration testing                                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Week 5-6: Governance & Advanced                             │
├──────────────────────────────────────────────────────────────┤
│ Mon-Tue: Governance DAO (M007) - Voting system              │
│ Wed-Thu: Student ID NFT (M008) - Identity management        │
│ Fri:     Testing & documentation                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Week 7-8: Extended Features                                 │
├──────────────────────────────────────────────────────────────┤
│ Mon-Tue: Scholarships (M009) + Gamification (M010)          │
│ Wed-Thu: Feedback (M011) + Resource Booking (M012)          │
│ Fri:     Integration & final testing                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Week 9-10: Final Phase                                      │
├──────────────────────────────────────────────────────────────┤
│ Mon-Tue: Research (M013) + IP (M014) + Learning (M015)      │
│ Wed-Thu: Collaboration (M016) + Crowdfunding (M017)         │
│ Fri:     Full audit + optimization                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Week 11-12: Deployment Preparation                          │
├──────────────────────────────────────────────────────────────┤
│ Mon-Wed: Security audit (OpenZeppelin or MythX)             │
│ Thu:     Bug fixes & optimization                           │
│ Fri:     Mainnet deployment + monitoring                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Infrastructure (Days 1-5)

### Task 1.1: VNDC Token (ERC-20)

#### Deliverables
- [x] `contracts/modules/001-core/VNDC.sol`
- [x] `test/modules/core/vndc.test.ts`
- [x] `deploy/modules/001_deploy_core.ts`

#### Specifications
- Standard ERC-20 implementation
- ERC-2612 Permit extension (for gas optimization)
- Initial supply: 1,000,000,000 VNDC (18 decimals)
- Minting/burning capabilities
- Pausable contract
- Ownership transfer

#### Acceptance Criteria
- [ ] Token can be minted to address
- [ ] Token can be transferred
- [ ] Permit function works correctly
- [ ] Gas cost < 80,000 per transfer
- [ ] Total supply tracking works

---

### Task 1.2: VNDCRegistry

#### Deliverables
- [x] `contracts/modules/001-core/VNDCRegistry.sol`
- [x] `test/modules/core/registry.test.ts`

#### Specifications
- User registration system
- Profile management (name, role, metadata)
- Role assignments (ADMIN, TEACHER, STUDENT, MERCHANT)
- Profile lookup

#### Acceptance Criteria
- [ ] User can register themselves
- [ ] Admin can assign roles
- [ ] Profile data is immutable after registration
- [ ] Metadata stored on IPFS (optional)

---

### Task 1.3: AccessControl System

#### Deliverables
- [x] `contracts/modules/001-core/AccessControl.sol`
- [x] `contracts/modules/001-core/IVNDCCore.sol`

#### Specifications
- Role-based access control (RBAC)
- Roles: ADMIN, TEACHER, STUDENT, MERCHANT, ISSUER
- Permission checking decorators
- Event logging for all role changes

#### Acceptance Criteria
- [ ] Role assignment works correctly
- [ ] Only authorized users can perform actions
- [ ] Role revocation prevents access

---

### Task 1.4: Core Testing & Deployment

#### Deliverables
- [ ] Unit tests (100% coverage for core)
- [ ] Integration tests between VNDC, Registry, AccessControl
- [ ] Deployment script with verification
- [ ] Sepolia testnet deployment

#### Acceptance Criteria
- [ ] All tests pass
- [ ] Contracts deployed to Sepolia
- [ ] Contract code verified on Etherscan
- [ ] Gas reports generated

---

## Phase 2: Credentials & Rewards (Days 6-15)

### Task 2.1: Credential NFT System

#### Deliverables
- [ ] `contracts/modules/002-credentials/CredentialVerification.sol`
- [ ] `contracts/modules/002-credentials/CredentialNFT.sol`
- [ ] `test/modules/credentials/`
- [ ] `deploy/modules/002_deploy_credentials.ts`

#### Specifications
- Mint credentials as NFT (ERC-721)
- Credential metadata on IPFS
- Revocation mechanism
- Verification on-chain
- Compatible with OpenBadges standard

#### Acceptance Criteria
- [ ] Credentials can be issued to students
- [ ] NFT metadata correctly stored/retrieved
- [ ] Revocation removes from user's balance
- [ ] Verification function returns correct status

---

### Task 2.2: Academic Rewards

#### Deliverables
- [ ] `contracts/modules/003-rewards-academic/AcademicReward.sol`
- [ ] `contracts/modules/003-rewards-academic/AcademicBadgeNFT.sol`

#### Specifications
- Automatic reward distribution based on GPA
- Badge system (Bronze/Silver/Gold/Platinum)
- Threshold configuration
- Claim functionality

#### GPA Tiers
| GPA Range | Token Reward | Badge | Claim Period |
|-----------|-------------|-------|--------------|
| ≥ 3.8 | 100 VNDC | Platinum | Weekly |
| 3.5-3.79 | 50 VNDC | Gold | Weekly |
| 3.0-3.49 | 25 VNDC | Silver | Weekly |
| 2.5-2.99 | 10 VNDC | Bronze | Weekly |

#### Acceptance Criteria
- [ ] Rewards calculated correctly from GPA
- [ ] Badges minted as ERC-1155
- [ ] Claim mechanism prevents double-claim

---

### Task 2.3: Extracurricular Rewards

#### Deliverables
- [ ] `contracts/modules/004-rewards-extracurricular/ExtraReward.sol`
- [ ] `contracts/modules/004-rewards-extracurricular/ActivityBadge.sol`

#### Activity Types
| Activity | Token | Badge | Frequency |
|----------|-------|-------|-----------|
| Volunteer | 20 VNDC | Volunteer Badge | Per activity |
| Event | 10 VNDC | Event Badge | Per event |
| Club | 5 VNDC/month | Club Badge | Monthly |
| Competition | 50-100 | Trophy | Per competition |

#### Acceptance Criteria
- [ ] Activities can be registered and logged
- [ ] Students can claim rewards
- [ ] Badge metadata correctly generated

---

## Phase 3: Payments & Records (Days 16-20)

### Task 3.1: Payment Processor

#### Deliverables
- [ ] `contracts/modules/005-payments/PaymentProcessor.sol`
- [ ] `contracts/modules/005-payments/MerchantRegistry.sol`

#### Features
- Process VNDC transfers
- Merchant registration & withdrawal
- Transaction history
- Fee handling (if any)

#### Acceptance Criteria
- [ ] Payments processed to correct merchant
- [ ] Merchant withdrawal works
- [ ] Transaction log maintained
- [ ] Gas cost < 150,000 per payment

---

### Task 3.2: Student Records

#### Deliverables
- [ ] `contracts/modules/006-records/StudentRecordManager.sol`

#### Data Fields (Immutable after first set)
- Academic GPA
- Credits earned
- Major/Program
- Attendance %
- Disciplinary status
- Financial standing

#### Acceptance Criteria
- [ ] Records can be created and updated
- [ ] Authorized updaters only
- [ ] Audit trail via events

---

## Phase 4: Governance (Days 21-25)

### Task 4.1: StudentDAO & Governance

#### Deliverables
- [ ] `contracts/modules/007-governance/StudentDAO.sol`
- [ ] `contracts/modules/007-governance/GovernanceToken.sol`

#### Features
- OpenZeppelin Governor pattern
- Voting power = VNDC holdings
- Proposal creation by members
- Time-locked execution

#### Voting Scenarios
1. **Budget Allocation** - Allocate funds to departments
2. **Policy Changes** - Approve new regulations
3. **Event Selection** - Vote on event dates/venues
4. **Scholarship Distribution** - Approve scholarship recipients

#### Acceptance Criteria
- [ ] Proposal creation works
- [ ] Voting recorded correctly
- [ ] Execution only after voting ends
- [ ] Time-lock enforced

---

### Task 4.2: Student ID NFT

#### Deliverables
- [ ] `contracts/modules/008-student-id/StudentIDCard.sol`

#### Specifications
- ERC-721 NFT per student
- Unique ID per academic year
- Revocation capability
- Metadata tied to student profile

#### Acceptance Criteria
- [ ] ID NFT mints successfully
- [ ] Only one active ID per student
- [ ] ID can be verified

---

## Phase 5: Extended Features (Days 26-40)

### Task 5.1: Scholarships Management

#### Deliverables
- [ ] `contracts/modules/009-scholarships/ScholarshipManager.sol`

#### Scholarship Types
1. **Merit-based** - GPA threshold
2. **Need-based** - Financial criteria
3. **Activity-based** - Volunteer hours
4. **Research-focused** - Publication criteria

---

### Task 5.2: Gamification Engine

#### Deliverables
- [ ] `contracts/modules/010-gamification/GamificationEngine.sol`
- [ ] `contracts/modules/010-gamification/QuestNFT.sol`

#### Quest Types
- Daily quizzes (5 VNDC each)
- Homework completion (10 VNDC)
- Study streaks (1 VNDC per day)
- Leaderboard rankings (50-100 VNDC)

---

### Task 5.3: Other Modules

Similar structure for:
- 011: Feedback System
- 012: Resource Booking
- 013: Research Data Market
- 014: IP Management
- 015: Lifelong Learning
- 016: Collaboration Platform
- 017: Crowdfunding

---

## Phase 6: Testing & Audit (Days 41-50)

### Test Coverage Goals
- Line coverage: 95%+
- Branch coverage: 85%+
- Critical path: 100%

### Test Types

#### Unit Tests
- Each function tested in isolation
- Edge cases covered
- Error conditions tested

#### Integration Tests
- Module interactions
- Cross-module flows
- State consistency

#### End-to-End Tests
- Complete user journeys
- Multi-step transactions
- State verification

### Security Audit
- OpenZeppelin audit (Professional)
- Or MythX automated (Budget option)
- Issues triage & fix

---

## Phase 7: Deployment (Days 51-60)

### Deployment Stages

#### Stage 1: Local Testing
```bash
npx hardhat node
npx hardhat deploy --network localhost
npm run test
```

#### Stage 2: Sepolia Testnet
```bash
npx hardhat deploy --network sepolia
# Verify contracts
```

#### Stage 3: Polygon Mumbai (Staging)
```bash
npx hardhat deploy --network mumbai
# Full integration test
# User acceptance testing
```

#### Stage 4: Production (Polygon Mainnet)
```bash
npx hardhat deploy --network polygon
# Monitor for 24 hours
# Prepare migration plan
```

---

## File Creation Checklist

### Contracts
- [ ] contracts/modules/001-core/VNDC.sol
- [ ] contracts/modules/001-core/VNDCRegistry.sol
- [ ] contracts/modules/001-core/IVNDCCore.sol
- [ ] contracts/modules/001-core/AccessControl.sol
- [ ] contracts/modules/002-credentials/CredentialVerification.sol
- [ ] contracts/modules/002-credentials/CredentialNFT.sol
- [ ] contracts/modules/003-rewards-academic/AcademicReward.sol
- [ ] contracts/modules/003-rewards-academic/AcademicBadgeNFT.sol
- [ ] ... (continue for all modules)

### Tests
- [ ] test/modules/core/*.test.ts
- [ ] test/modules/credentials/*.test.ts
- [ ] test/integration/*.test.ts
- [ ] test/e2e/*.test.ts

### Deploy Scripts
- [ ] deploy/modules/001_deploy_core.ts
- [ ] deploy/modules/002_deploy_credentials.ts
- [ ] ... (one per module)

### Scripts
- [ ] scripts/modules/core/mint-tokens.ts
- [ ] scripts/modules/core/setup-roles.ts
- [ ] scripts/modules/credentials/issue-credential.ts
- [ ] ... (interaction scripts)

### Documentation
- [ ] docs/ARCHITECTURE.md ✓
- [ ] docs/MODULES.md ✓
- [ ] docs/IMPLEMENTATION_PLAN.md ✓
- [ ] docs/DEPLOYMENT_GUIDE.md (Todo)
- [ ] docs/API_REFERENCE.md (Todo)
- [ ] contracts/modules/{module}/README.md (for each module)

---

## Development Environment Setup

### Prerequisites
```bash
node --version      # v18+
npm --version       # v9+
```

### Installation
```bash
npm install --legacy-peer-deps
npm run compile
npm run test
```

### Hardhat Tasks
```bash
# List all tasks
npx hardhat

# Compile contracts
npm run compile

# Run tests
npm run test

# Deploy
npx hardhat deploy --network sepolia

# Verify
npx hardhat verify --network sepolia <ADDRESS> <ARGS>
```

---

## Risk Management

### High Risk Items
1. **Reentrancy attacks** → Use OpenZeppelin guards
2. **Integer overflow** → Solidity 0.8.24 automatic checks
3. **Role misconfiguration** → Extensive testing
4. **Oracle manipulation** → Use multiple sources (future)

### Medium Risk Items
1. **Gas cost explosion** → Regular gas audits
2. **Contract size limit** → Modularization
3. **Upgrade issues** → Proxy pattern testing

### Low Risk Items
1. **UI/UX issues** → User testing
2. **Documentation gaps** → Auto-generated from code

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test coverage | 95%+ | TBD |
| Gas per tx | < 200K | TBD |
| Contract size | < 24KB | TBD |
| Deployment cost | < 0.5 ETH | TBD |
| Security audit | Passed | TBD |
| User acceptance | 80%+ | TBD |

---

## Communication & Reporting

### Weekly Reports
- Completed tasks
- Blockers & resolutions
- Gas/cost updates
- Risk assessment

### Sprint Reviews
- Demo features
- Collect feedback
- Adjust timeline
- Update roadmap

---

**Document Version:** 1.0  
**Last Updated:** Feb 6, 2026  
**Next Review:** Feb 13, 2026

# VNDC Project - Project Structure & Quick Start

---

## 📁 Complete Folder Structure

```
d:\Blockchain\VNDC\
│
├── 📄 README.md                          # Project overview
├── 📄 Topic.md                           # Thesis topic & background
├── 📄 package.json                       # Dependencies
├── 📄 tsconfig.json                      # TypeScript config
├── 📄 hardhat.config.ts                  # Hardhat configuration
├── 📄 .env                               # Environment variables
│
├── 📁 contracts/
│   ├── 📁 modules/                       # ⭐ MAIN MODULE FOLDER
│   │   ├── 📁 001-core/                  # Core tokens & registry
│   │   │   ├── VNDC.sol                  # ERC-20 token
│   │   │   ├── VNDCRegistry.sol          # User registry
│   │   │   ├── IVNDCCore.sol             # Core interfaces
│   │   │   ├── AccessControl.sol         # Role management
│   │   │   └── README.md                 # Module documentation
│   │   │
│   │   ├── 📁 002-credentials/           # Credential NFT verification
│   │   │   ├── CredentialVerification.sol
│   │   │   ├── CredentialNFT.sol         # ERC-721
│   │   │   ├── ICredentials.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 003-rewards-academic/      # GPA-based rewards
│   │   │   ├── AcademicReward.sol
│   │   │   ├── AcademicBadgeNFT.sol      # ERC-1155
│   │   │   ├── IAcademicReward.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 004-rewards-extracurricular/  # Activity rewards
│   │   │   ├── ExtraReward.sol
│   │   │   ├── ActivityBadge.sol         # ERC-1155
│   │   │   ├── IExtraReward.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 005-payments/              # Payment processing
│   │   │   ├── PaymentProcessor.sol
│   │   │   ├── MerchantRegistry.sol
│   │   │   ├── IPayment.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 006-records/               # Student records
│   │   │   ├── StudentRecordManager.sol
│   │   │   ├── IStudentRecord.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 007-governance/            # DAO & voting
│   │   │   ├── StudentDAO.sol            # Governor pattern
│   │   │   ├── GovernanceToken.sol       # ERC-20 Votes
│   │   │   ├── IGovernance.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 008-student-id/            # ID card NFT
│   │   │   ├── StudentIDCard.sol         # ERC-721
│   │   │   ├── IStudentID.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 009-scholarships/          # Scholarship management
│   │   │   ├── ScholarshipManager.sol
│   │   │   ├── IScholarship.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 010-gamification/          # Quest & rewards
│   │   │   ├── GamificationEngine.sol
│   │   │   ├── QuestNFT.sol              # ERC-1155
│   │   │   ├── IGamification.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 011-feedback/              # Feedback system
│   │   │   ├── FeedbackSystem.sol
│   │   │   ├── IFeedback.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 012-resource-booking/      # Resource booking
│   │   │   ├── ResourceBooking.sol
│   │   │   ├── IResourceBooking.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 013-research/              # Research data market
│   │   │   ├── ResearchDataMarket.sol
│   │   │   ├── IResearch.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 014-ip-management/         # IP registry
│   │   │   ├── IPRegistry.sol
│   │   │   ├── IIPManagement.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 015-lifelong-learning/     # Learning records
│   │   │   ├── LearningRecord.sol
│   │   │   ├── LearningRecordNFT.sol     # ERC-721
│   │   │   ├── ILearningRecord.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 016-collaboration/         # Collaboration platform
│   │   │   ├── CollaborationPlatform.sol
│   │   │   ├── ICollaboration.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 017-crowdfunding/          # Project funding
│   │   │   ├── ProjectFunding.sol
│   │   │   ├── IFunding.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 018-staking/               # Staking pools (future)
│   │   │   ├── StakingPool.sol
│   │   │   ├── IStaking.sol
│   │   │   └── README.md
│   │   │
│   │   ├── 📁 interfaces/                # Common interfaces
│   │   │   └── IVNDCCore.sol
│   │   │
│   │   └── MODULE_TEMPLATE.md            # Template for all modules
│   │
│   ├── 📁 token/                         # Token contracts (legacy)
│   │   └── MockStablecoin.sol
│   │
│   └── 📁 (other legacy contracts)       # Move to modules if needed
│
├── 📁 deploy/
│   ├── 📁 modules/                       # ⭐ DEPLOYMENT SCRIPTS
│   │   ├── 001_deploy_core.ts
│   │   ├── 002_deploy_credentials.ts
│   │   ├── 003_deploy_rewards_academic.ts
│   │   ├── 004_deploy_rewards_extracurricular.ts
│   │   ├── 005_deploy_payments.ts
│   │   ├── 006_deploy_records.ts
│   │   ├── 007_deploy_governance.ts
│   │   ├── 008_deploy_student_id.ts
│   │   ├── 009_deploy_scholarships.ts
│   │   ├── 010_deploy_gamification.ts
│   │   ├── 011_deploy_feedback.ts
│   │   ├── 012_deploy_resource_booking.ts
│   │   ├── 013_deploy_research.ts
│   │   ├── 014_deploy_ip_management.ts
│   │   ├── 015_deploy_lifelong_learning.ts
│   │   ├── 016_deploy_collaboration.ts
│   │   ├── 017_deploy_crowdfunding.ts
│   │   ├── 018_deploy_staking.ts
│   │   └── 999_verify_all.ts             # Final verification
│   │
│   ├── (legacy deploy scripts)
│   └── README.md
│
├── 📁 test/
│   ├── 📁 modules/                       # ⭐ MODULE TESTS
│   │   ├── 📁 core/
│   │   │   ├── vndc.test.ts
│   │   │   ├── registry.test.ts
│   │   │   └── access-control.test.ts
│   │   │
│   │   ├── 📁 credentials/
│   │   │   ├── credential-verification.test.ts
│   │   │   └── credential-nft.test.ts
│   │   │
│   │   ├── 📁 rewards/
│   │   │   ├── academic-rewards.test.ts
│   │   │   └── extra-rewards.test.ts
│   │   │
│   │   ├── 📁 payments/
│   │   │   ├── payment-processor.test.ts
│   │   │   └── merchant.test.ts
│   │   │
│   │   ├── 📁 records/
│   │   │   └── student-records.test.ts
│   │   │
│   │   ├── 📁 governance/
│   │   │   ├── dao.test.ts
│   │   │   └── voting.test.ts
│   │   │
│   │   ├── 📁 integration/
│   │   │   ├── end-to-end.test.ts
│   │   │   ├── module-interaction.test.ts
│   │   │   └── multi-user-flow.test.ts
│   │   │
│   │   └── helpers/
│   │       ├── deploy-fixture.ts
│   │       └── constants.ts
│   │
│   ├── (legacy tests)
│   └── README.md
│
├── 📁 scripts/
│   ├── 📁 modules/                       # ⭐ INTERACTION SCRIPTS
│   │   ├── 📁 core/
│   │   │   ├── mint-tokens.ts
│   │   │   ├── setup-roles.ts
│   │   │   └── check-balances.ts
│   │   │
│   │   ├── 📁 credentials/
│   │   │   ├── issue-credential.ts
│   │   │   ├── verify-credential.ts
│   │   │   └── revoke-credential.ts
│   │   │
│   │   ├── 📁 payments/
│   │   │   ├── process-payment.ts
│   │   │   ├── register-merchant.ts
│   │   │   └── withdraw-funds.ts
│   │   │
│   │   └── (scripts for other modules)
│   │
│   ├── (legacy scripts)
│   └── README.md
│
├── 📁 docs/
│   ├── ARCHITECTURE.md                   # ✅ System architecture
│   ├── MODULES.md                        # ✅ Module specifications
│   ├── IMPLEMENTATION_PLAN.md            # ✅ Development timeline
│   ├── DEPLOYMENT_GUIDE.md               # ✅ Deployment instructions
│   ├── FOLDER_STRUCTURE.md               # This file
│   ├── API_REFERENCE.md                  # (TODO) Contract ABIs
│   ├── LOGIC_FUNCTION.md                 # (existing)
│   ├── PLAN.md                           # (existing)
│   └── USECASE.md                        # (existing)
│
├── 📁 typechain/                         # Auto-generated contract types
│   └── (generated from contracts)
│
├── 📁 artifacts/                         # Compiled contract artifacts
│   └── (generated during compilation)
│
├── 📁 deployments/                       # Deployment artifacts
│   ├── localhost/
│   ├── sepolia/
│   ├── mumbai/
│   └── polygon/
│
├── 📁 data/                              # Test data & fixtures
│   └── (optional)
│
├── 📁 FE/                                # Frontend (React DApp)
│   ├── src/
│   ├── public/
│   └── (React app structure)
│
└── 📁 node_modules/                      # Dependencies
```

---

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Install dependencies
npm install --legacy-peer-deps

# Configure environment (.env)
cp .env.example .env
# Edit .env with your keys
```

### 2. Compile Contracts

```bash
npm run compile
```

### 3. Run Tests

```bash
npm run test

# With specific module
npx hardhat test test/modules/core/

# With gas reporting
REPORT_GAS=true npm run test
```

### 4. Deploy Locally

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy
npx hardhat deploy --network localhost
```

### 5. Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

---

## 📋 Module Development Workflow

### For Each New Module:

1. **Create folder** in `contracts/modules/{NUMBER}-{name}/`
2. **Use template** from `MODULE_TEMPLATE.md`
3. **Write contract** following standards
4. **Write tests** in `test/modules/{name}/`
5. **Write deploy script** in `deploy/modules/{NUMBER}_deploy_{name}.ts`
6. **Add README.md** to module folder
7. **Update MODULES.md** with new module info

### Example: Adding Module 002-credentials

```bash
# 1. Contract already created
# 2. Add tests
touch test/modules/credentials/credential-nft.test.ts

# 3. Add deployment script
touch deploy/modules/002_deploy_credentials.ts

# 4. Add interactions script
touch scripts/modules/credentials/issue-credential.ts

# 5. Test
npx hardhat test test/modules/credentials/

# 6. Deploy
npx hardhat deploy --network localhost --tags 002
```

---

## 🎯 Key Files to Read First

1. **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Understand system design
2. **[MODULES.md](./docs/MODULES.md)** - Read module specifications
3. **[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)** - Development timeline
4. **[DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)** - Deployment process
5. **[Topic.md](./Topic.md)** - Original thesis requirements

---

## 🔧 Common Commands

```bash
# Compilation & Testing
npm run compile                    # Compile contracts
npm run test                       # Run all tests
npm run clean                      # Clean artifacts
npm run size                       # Contract sizes

# Deployment
npm run deploy:local:all          # Deploy to local
npm run deploy:local:mock         # Deploy only mock token
npm run deploy:local:factory      # Deploy factory

# Development
npx hardhat node                  # Start local node
npx hardhat hardhat               # Interactive console
npx hardhat accounts              # List accounts

# Verification
npx hardhat verify --network sepolia <ADDRESS>
```

---

## 📚 Module List & Priority

| # | Module | Status | Priority | Dependency |
|---|--------|--------|----------|------------|
| 001 | Core | 📅 TODO | 🔴 FIRST | - |
| 002 | Credentials | 📅 TODO | 🔴 SECOND | 001 |
| 003 | Academic Rewards | 📅 TODO | 🔴 SECOND | 001 |
| 004 | Extra Rewards | 📅 TODO | 🔴 SECOND | 001 |
| 005 | Payments | 📅 TODO | 🟠 THIRD | 001 |
| 006 | Records | 📅 TODO | 🟠 THIRD | 001 |
| 007 | Governance | 📅 TODO | 🟠 THIRD | 001 |
| 008 | Student ID | 📅 TODO | 🟠 THIRD | 001 |
| 009 | Scholarships | 📅 TODO | 🟡 FOURTH | 001 |
| 010 | Gamification | 📅 TODO | 🟡 FOURTH | 001, 003 |
| 011 | Feedback | 📅 TODO | 🟡 FOURTH | 001 |
| 012 | Resource Booking | 📅 TODO | 🟢 FIFTH | 001 |
| 013 | Research | 📅 TODO | 🟢 FIFTH | 001 |
| 014 | IP Management | 📅 TODO | 🟢 FIFTH | 001 |
| 015 | Lifelong Learning | 📅 TODO | 🟢 FIFTH | 001 |
| 016 | Collaboration | 📅 TODO | 🔵 SIXTH | 001 |
| 017 | Crowdfunding | 📅 TODO | 🔵 SIXTH | 001 |
| 018 | Staking | 📅 TODO | 🟣 FUTURE | 001 |

---

## 🧪 Test Coverage Goals

- **Unit Tests:** 100% for core functions
- **Integration Tests:** 80% for module interactions
- **E2E Tests:** Core user journeys
- **Overall Target:** 95%+ code coverage

---

## 🔒 Security Checklist

Before deploying each module:

- [ ] All tests passing
- [ ] Gas optimized (< target)
- [ ] Reentrancy guards in place
- [ ] Access control verified
- [ ] Input validation complete
- [ ] Error messages clear
- [ ] Events properly emitted
- [ ] Contract size < 24KB

---

## 📞 Support & Resources

### Documentation
- [Solidity Docs](https://docs.soliditylang.org/) - Smart contract language
- [Hardhat Docs](https://hardhat.org/) - Development framework
- [OpenZeppelin](https://docs.openzeppelin.com/contracts/) - Secure libraries
- [Ethers.js](https://docs.ethers.org/) - Blockchain interaction

### Tools
- [Remix IDE](https://remix.ethereum.org/) - Web-based editor
- [MythX](https://mythx.io/) - Security analysis
- [Etherscan](https://etherscan.io/) - Block explorer
- [Polygon Scan](https://polygonscan.com/) - Polygon explorer

---

## 📝 Notes

- All modules extend from Core (001)
- Use consistent naming conventions
- Follow OpenZeppelin patterns
- Document every public function
- Test thoroughly before deployment
- Monitor gas costs continuously

---

**Last Updated:** Feb 6, 2026  
**Status:** Structure Ready for Development  
**Next Steps:** Start with Module 001 (Core)

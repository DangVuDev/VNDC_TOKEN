# VNDC Module Implementation Guide

Hướng dẫn triển khai từng module một cách có hệ thống.

---

## Module Template Structure

Mỗi module PHẢI có cấu trúc này:

```
contracts/modules/{NUMBER}-{LOWER_CASE_NAME}/
├── {PascalCaseName}.sol              # Main contract
├── I{PascalCaseName}.sol              # Interface
├── {PascalCaseName}NFT.sol            # NFT contract (if needed)
├── {PascalCaseName}Utils.sol          # Utilities (if needed)
└── README.md                          # Module documentation
```

---

## Module 001: Core System

**Location:** `contracts/modules/001-core/`

### Components

| File | Purpose | Type | Standard |
|------|---------|------|----------|
| `VNDC.sol` | Main ERC-20 token | Smart Contract | ERC-20 + ERC-2612 |
| `VNDCRegistry.sol` | User registration & profiles | Smart Contract | Custom |
| `IVNDCCore.sol` | Core interfaces | Interface | Solidity |
| `AccessControl.sol` | Role-based access (reusable) | Library | Custom |

### Key Functions

**VNDC.sol**
```solidity
- mint(address to, uint256 amount) → onlyMinter
- burn(uint256 amount) → public
- permit(address owner, address spender, uint256 amount, ...) → external
- transfer(address to, uint256 amount) → external
- transferFrom(address from, address to, uint256 amount) → external
```

**VNDCRegistry.sol**
```solidity
- registerUser(string name, bytes32 role) → onlyAdmin
- updateProfile(string newName, string ipfsMetadata) → onlyUser
- getUserProfile(address user) → view
- grantRole(bytes32 role, address user) → onlyAdmin
- revokeRole(bytes32 role, address user) → onlyAdmin
```

### Deploy Script Template
```typescript
// deploy/modules/001_deploy_core.ts
export default async (hre: HardhatRuntimeEnvironmentExtended) => {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // Deploy VNDC
  const vndc = await deploy("VNDC", {
    from: deployer,
    args: ["Vietnam Digital Currency", "VNDC"],
    log: true,
  });
  
  // Deploy Registry
  const registry = await deploy("VNDCRegistry", {
    from: deployer,
    args: [vndc.address],
    log: true,
  });
  
  log("Core module deployed successfully!");
};
```

---

## Module 002: Credentials

**Location:** `contracts/modules/002-credentials/`

### Components

| File | Purpose | Type | Standard |
|------|---------|------|----------|
| `CredentialVerification.sol` | Credential logic | Smart Contract | Custom |
| `CredentialNFT.sol` | NFT representation | Smart Contract | ERC-721 |
| `ICredentials.sol` | Credential interfaces | Interface | Solidity |

### Key Functions

**CredentialVerification.sol**
```solidity
- issueCredential(address to, string name, string level) → onlyIssuer
- verifyCredential(uint256 tokenId) → view returns (bool valid, string name)
- revokeCredential(uint256 tokenId) → onlyIssuer
- getCredentialsByUser(address user) → view returns (uint256[] ids)
```

**CredentialNFT.sol (ERC-721)**
```solidity
- mint(address to, string uri) → onlyCredentialManager
- burn(uint256 tokenId) → onlyOwner
- tokenURI(uint256 tokenId) → view
```

### Flow
```
1. Admin issues credential via issueCredential()
2. CredentialNFT mints NFT to student
3. NFT metadata stored on IPFS
4. Student can share NFT or verify on-chain
5. Employer/University can verify instantly
```

---

## Module 003: Academic Rewards

**Location:** `contracts/modules/003-rewards-academic/`

### Components

| File | Purpose | Type | Standard |
|------|---------|------|----------|
| `AcademicReward.sol` | Reward logic | Smart Contract | Custom |
| `AcademicBadgeNFT.sol` | Badge NFT | Smart Contract | ERC-1155 |

### Key Functions

**AcademicReward.sol**
```solidity
- setGPAThreshold(uint256 minGPA, uint256 rewardAmount) → onlyAdmin
- rewardStudent(address student, uint256 gpa) → onlyTeacher
- claimReward(address student) → onlyStudent
- getStudentRewards(address student) → view
```

### Reward Logic
- GPA ≥ 3.8: 100 VNDC + Premium Badge
- GPA ≥ 3.5: 50 VNDC + Gold Badge
- GPA ≥ 3.0: 25 VNDC + Silver Badge
- Course completion: 10 VNDC

---

## Module 004: Extracurricular Rewards

**Location:** `contracts/modules/004-rewards-extracurricular/`

### Components

| File | Purpose | Type |
|------|---------|------|
| `ExtraReward.sol` | Activity reward logic | Smart Contract |
| `ActivityBadge.sol` | Activity badge (ERC-1155) | Smart Contract |

### Key Functions

**ExtraReward.sol**
```solidity
- registerActivity(string name, uint256 rewardAmount) → onlyAdmin
- logActivity(address student, uint256 activityId) → onlyIssuer
- claimActivityReward(uint256 activityId) → onlyStudent
- getActivities() → view
```

### Activity Types
- Volunteer work: 20 VNDC + Badge
- Event participation: 10 VNDC + Badge
- Club membership: 5 VNDC/month
- Competition: 50-100 VNDC based on rank

---

## Module 005: Payments

**Location:** `contracts/modules/005-payments/`

### Components

| File | Purpose | Type |
|------|---------|------|
| `PaymentProcessor.sol` | Payment handling | Smart Contract |
| `MerchantRegistry.sol` | Merchant management | Smart Contract |

### Key Functions

**PaymentProcessor.sol**
```solidity
- processPayment(address merchant, uint256 amount) → onlyStudent
- refundPayment(address student, uint256 amount) → onlyMerchant
- getTransaction(uint256 txId) → view
```

**MerchantRegistry.sol**
```solidity
- registerMerchant(string name, string metadataUri) → onlyAdmin
- withdrawFunds(uint256 amount) → onlyMerchant
- getMerchants() → view
```

### Use Cases
- Canteen payments
- Photocopy charges
- Event fees
- Facility usage
- Administrative fees

---

## Module 006: Records Management

**Location:** `contracts/modules/006-records/`

### Key Functions

**StudentRecordManager.sol**
```solidity
- updateRecord(address student, bytes32 key, string value) → onlyAuthorized
- getRecord(address student, bytes32 key) → view
- getFullRecord(address student) → view returns (bytes32[] keys, string[] values)
```

### Data Types
- Academic records (GPA, credits, major)
- Attendance records
- Financial records (tuition paid, scholarships)
- Disciplinary records

---

## Module 007: Governance (StudentDAO)

**Location:** `contracts/modules/007-governance/`

### Components

| File | Purpose | Type | Standard |
|------|---------|------|----------|
| `StudentDAO.sol` | DAO logic | Smart Contract | Governor pattern |
| `GovernanceToken.sol` | Vote token | Smart Contract | ERC-20 Votes |

### Key Functions

**StudentDAO.sol**
```solidity
- propose(string description, address[] targets, ...) → onlyMember
- vote(uint256 proposalId, uint8 support) → onlyMember
- execute(uint256 proposalId) → onlySuccessful
- getProposal(uint256 proposalId) → view
```

### Voting Scenarios
- Allocate funds to clubs
- Select event dates/venues
- Approve regulations changes
- Budget approval

---

## Module 008: Student ID Card

**Location:** `contracts/modules/008-student-id/`

### Components

| File | Purpose | Type | Standard |
|------|---------|------|----------|
| `StudentIDCard.sol` | ID NFT | Smart Contract | ERC-721 |

### Key Functions

**StudentIDCard.sol**
```solidity
- issueID(address student, string name, uint256 enrollmentYear) → onlyIssuers
- getIDMetadata(uint256 tokenId) → view
- revokeID(uint256 tokenId) → onlyAdmin
```

### Benefits
- Anti-fake verification
- Quick identity check via wallet
- Access control to resources
- Integration with campus systems

---

## Module 009: Scholarships

**Location:** `contracts/modules/009-scholarships/`

### Key Functions

**ScholarshipManager.sol**
```solidity
- createScholarship(string name, uint256 amount, address criteria) → onlyAdmin
- applyForScholarship(uint256 scholarshipId) → onlyStudent
- approveApplication(uint256 applicationId, bool approve) → onlyReviewer
- distributeScholarship(uint256 scholarshipId) → onlyAdmin
- getMyScholarships(address student) → view
```

### Scholarship Types
- Merit-based (GPA)
- Need-based (financial conditions)
- Activity-based (volunteering, sports)
- Research-focused

---

## Module 010: Gamification

**Location:** `contracts/modules/010-gamification/`

### Components

| File | Purpose | Type |
|------|---------|------|
| `GamificationEngine.sol` | Quest/achievement logic | Smart Contract |
| `QuestNFT.sol` | Quest badges (ERC-1155) | Smart Contract |

### Key Functions

**GamificationEngine.sol**
```solidity
- createQuest(string name, uint256 reward, uint256 difficulty) → onlyAdmin
- completeQuest(uint256 questId) → onlyStudent
- claimReward(uint256 questId) → onlyStudent
- getLeaderboard(uint256 limit) → view
```

### Quest Types
- Daily quizzes
- Homework submission
- Study streaks
- Community participation
- Skill building challenges

---

## Module 011: Feedback System

**Location:** `contracts/modules/011-feedback/`

### Key Functions

**FeedbackSystem.sol**
```solidity
- submitFeedback(address target, uint8 rating, string ipfsHash) → onlyStudent
- getFeedback(address target) → view returns (uint256[] ids)
- getFeedbackDetails(uint256 feedbackId) → view
- rewardFeedback(uint256 feedbackId, uint256 amount) → onlyAdmin
```

### Features
- Anonymous feedback on teachers
- Course evaluation
- Facility feedback
- Incentivized participation

---

## Module 012: Resource Booking

**Location:** `contracts/modules/012-resource-booking/`

### Key Functions

**ResourceBooking.sol**
```solidity
- registerResource(string name, uint256 hourlyRate) → onlyAdmin
- bookResource(uint256 resourceId, uint256 startTime, uint256 duration) → external
- confirmBooking(uint256 bookingId) → payable
- cancelBooking(uint256 bookingId) → onlyOwner
```

### Resources
- Classroom/lab rooms
- Sports facilities
- Equipment/tools
- Study spaces

---

## Module 013: Research Data Market

**Location:** `contracts/modules/013-research/`

### Key Functions

**ResearchDataMarket.sol**
```solidity
- uploadDataset(string title, string ipfsHash, uint256 accessPrice) → onlyResearchers
- purchaseAccess(uint256 datasetId) → payable
- getDataset(uint256 datasetId) → view
- getMyDatasets(address researcher) → view
```

---

## Module 014: IP Management

**Location:** `contracts/modules/014-ip-management/`

### Key Functions

**IPRegistry.sol**
```solidity
- registerIP(string title, string description, string ipfsHash) → onlyCreator
- assignRoyalty(uint256 ipId, address recipient, uint256 percentage) → onlyCreator
- claimRoyalty(uint256 ipId) → onlyRoyaltyRecipient
```

---

## Module 015: Lifelong Learning

**Location:** `contracts/modules/015-lifelong-learning/`

### Components

| File | Purpose | Type |
|------|---------|------|
| `LearningRecord.sol` | Learning tracking | Smart Contract |
| `LearningRecordNFT.sol` | NFT record (ERC-721) | Smart Contract |

### Key Functions

**LearningRecord.sol**
```solidity
- recordLearning(address student, string course, uint256 hours) → onlyTeacher
- issueLearningCertificate(address student, string course) → onlyIssuer
- getLearningHistory(address student) → view
```

---

## Module 016: Collaboration Platform

**Location:** `contracts/modules/016-collaboration/`

### Key Functions

**CollaborationPlatform.sol**
```solidity
- createProject(string name, address[] members) → onlyStudent
- shareKnowledge(uint256 projectId, string ipfsHash) → onlyMember
- contributeToProject(uint256 projectId, uint256 effort) → onlyMember
- distributeRewards(uint256 projectId) → onlyProjectLead
```

---

## Module 017: Crowdfunding

**Location:** `contracts/modules/017-crowdfunding/`

### Key Functions

**ProjectFunding.sol**
```solidity
- createProject(string name, uint256 goal, uint256 deadline) → onlyStudent
- donate(uint256 projectId) → payable
- claimFunds(uint256 projectId) → onlyProjectCreator
- refund(uint256 projectId) → onlyDonor
- getFundRaising(uint256 projectId) → view
```

---

## Module 018: Staking (Future)

**Location:** `contracts/modules/018-staking/`

### Key Functions

**StakingPool.sol**
```solidity
- stake(uint256 amount) → external
- unstake(uint256 amount) → external
- claimRewards() → external
- getStakeInfo(address user) → view
```

---

## Contract Inheritance Hierarchy

```solidity
// Level 0: Base
Ownable, ERC20, ERC721, ERC1155

// Level 1: Common
AccessControl (from OpenZeppelin)
VNDCCore (Custom base with VNDC integration)

// Level 2: Modules
CredentialNFT extends ERC721, VNDCCore
PaymentProcessor extends VNDCCore
StudentDAO extends Governor
... (other modules)
```

---

## Testing Pattern for Each Module

```typescript
// test/modules/{module-name}/{ModuleName}.test.ts
describe("ModuleName", () => {
  let contract: ModuleName;
  let owner: SignerWithAddress;
  let student: SignerWithAddress;
  
  beforeEach(async () => {
    [owner, student] = await ethers.getSigners();
    // Deploy module
  });
  
  describe("Deployment", () => {
    it("should deploy correctly", async () => {
      expect(contract.address).to.be.properAddress;
    });
  });
  
  describe("Core Functionality", () => {
    it("should [do something]", async () => {
      // Test
    });
  });
});
```

---

## Deployment Checklist

Before deploying each module:

- [ ] Contract code reviewed
- [ ] All functions tested (unit + integration)
- [ ] Gas optimization verified (< target)
- [ ] Access control checked (role assignments)
- [ ] Events properly emitted
- [ ] Error handling complete
- [ ] Documentation updated
- [ ] Etherscan verification prepared

---

## Quick Start Commands

```bash
# Compile
npm run compile

# Test
npm run test

# Deploy to local
npx hardhat deploy --network localhost

# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia <ADDRESS> <CONSTRUCTOR_ARGS>
```

---

**Version:** 1.0.0  
**Last Updated:** Feb 6, 2026

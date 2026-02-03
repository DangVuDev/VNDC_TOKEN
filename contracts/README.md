# Smart Contracts - Hướng Dẫn Triển Khai

## Tổng Quan

VNDC DApp sử dụng 5 smart contracts chính:

| Contract | Chức Năng | Loại | Kế Thừa |
|----------|----------|------|--------|
| **VNDC_Token** | ERC-20 Token chính | Fungible | ERC20, ERC20Burnable, ERC20Snapshot, Pausable |
| **VNDC_Credential** | NFT Credentials | NFT | ERC721, ERC721Enumerable, AccessControl, Pausable |
| **VNDC_Rewards** | Phân phối reward | Logic | AccessControl, Pausable, ReentrancyGuard |
| **VNDC_Payments** | Thanh toán & settlement | Logic | AccessControl, Pausable, ReentrancyGuard |
| **VNDC_Governance** | DAO voting | Governance | Governor, GovernorVotes, AccessControl |

---

## 1. VNDC_Token.sol

**File:** `contracts/VNDC_Token.sol`

### Chức Năng
- **Minting**: Tạo VNDC mới với giới hạn MAX_SUPPLY
- **Burning**: Xóa VNDC khỏi lưu thông
- **Snapshots**: Tạo snapshot để voting governance
- **Pausing**: Dừng/tiếp tục tất cả transfers

### Công Thức Khởi Tạo
```solidity
VNDC_Token token = new VNDC_Token(initialHolder);
```

### Các Hàm Chính

#### Minting
```solidity
// Mint đơn
function mint(
    address to,
    uint256 amount,
    string memory reason
) public onlyRole(MINTER_ROLE)

// Batch mint
function batchMint(
    address[] calldata recipients,
    uint256[] calldata amounts,
    string memory reason
) public onlyRole(MINTER_ROLE)
```

#### Burning
```solidity
function burn(uint256 amount, string memory reason) public

function burnFrom(
    address account,
    uint256 amount,
    string memory reason
) public
```

#### Snapshots (cho Governance)
```solidity
function snapshot() public returns (uint256 snapshotId)

function balanceOfAt(address account, uint256 snapshotId) public view returns (uint256)

function totalSupplyAt(uint256 snapshotId) public view returns (uint256)
```

### Cấu Hình Mặc Định
- **INITIAL_SUPPLY**: 1 tỷ VNDC (10^18)
- **MAX_SUPPLY**: 10 tỷ VNDC
- **Decimals**: 18
- **Roles**: MINTER_ROLE, PAUSER_ROLE, SNAPSHOT_ROLE

### Deployment
```bash
npx hardhat run scripts/deploy-token.js --network mumbai
```

---

## 2. VNDC_Credential.sol

**File:** `contracts/VNDC_Credential.sol`

### Chức Năng
- **Issue Credentials**: Phát hành diploma NFT cho sinh viên
- **Revoke**: Thu hồi credential khi phát hiện giả mạo
- **Soulbound**: Credentials không thể chuyển giao (non-transferable)
- **Verify**: Công khai xác minh credentials

### Công Thức Khởi Tạo
```solidity
VNDC_Credential cred = new VNDC_Credential();
```

### Các Hàm Chính

#### Issuing
```solidity
// Issue đơn
function issueCredential(
    address to,
    string memory uri
) public onlyRole(ISSUER_ROLE) returns (uint256 tokenId)

// Batch issue (gas-efficient)
function batchIssueCredentials(
    address[] calldata recipients,
    string[] calldata uris
) public onlyRole(ISSUER_ROLE) returns (uint256[] memory)
```

#### Revocation
```solidity
function revokeCredential(
    uint256 tokenId,
    string memory reason
) public onlyRole(REVOKER_ROLE)

function reinstateCredential(uint256 tokenId) public onlyRole(REVOKER_ROLE)
```

#### Verification
```solidity
function isCredentialValid(uint256 tokenId) public view returns (bool)

function getCredential(uint256 tokenId) public view returns (
    address holder,
    string memory uri,
    bool valid,
    bool revoked,
    address issuer,
    uint256 issuedBlock
)

function getCredentialsForHolder(address holder) public view returns (uint256[] memory)
```

### IPFS URI Format
```json
{
    "name": "Bachelor of Science in Computer Science",
    "description": "Diploma awarded to John Doe",
    "image": "ipfs://QmYourImageHash",
    "attributes": [
        {"trait_type": "University", "value": "MIT"},
        {"trait_type": "Field", "value": "Computer Science"},
        {"trait_type": "GPA", "value": "3.8"},
        {"trait_type": "Year", "value": "2024"}
    ]
}
```

### Deployment
```bash
npx hardhat run scripts/deploy-credential.js --network mumbai
```

---

## 3. VNDC_Rewards.sol

**File:** `contracts/VNDC_Rewards.sol`

### Chức Năng
- **Reward Rules**: Định nghĩa quy tắc phát thưởng
- **GPA-Based**: Tự động phát thưởng dựa trên GPA
- **Claim Management**: Sinh viên submit claims, admin approve
- **Batch Distribution**: Phân phối thưởng hàng loạt

### Công Thức Khởi Tạo
```solidity
VNDC_Rewards rewards = new VNDC_Rewards(vndcTokenAddress);
```

### Các Hàm Chính

#### Quản Lý Rule
```solidity
function createRewardRule(
    RewardType rewardType,
    string memory description,
    uint256 baseRewardAmount,
    uint256 minRequirement,
    uint256 maxRewardAmount
) public onlyRole(REWARD_ISSUER_ROLE) returns (uint256 ruleId)

function deactivateRewardRule(uint256 ruleId) public onlyRole(REWARD_ISSUER_ROLE)

function activateRewardRule(uint256 ruleId) public onlyRole(REWARD_ISSUER_ROLE)
```

#### Update GPA
```solidity
function updateStudentGPA(address student, uint256 gpa) public onlyRole(REWARD_ISSUER_ROLE)

// gpa = GPA * 1000 (e.g., 3800 = 3.8 GPA)

function batchUpdateGPA(
    address[] calldata students,
    uint256[] calldata gpas
) public onlyRole(REWARD_ISSUER_ROLE)
```

#### Claim Management
```solidity
// Sinh viên submit claim
function submitRewardClaim(
    uint256 ruleId,
    string memory evidence
) public returns (uint256 claimId)

// Admin approve
function approveRewardClaim(uint256 claimId) public onlyRole(CLAIM_MANAGER_ROLE)

// Admin reject
function rejectRewardClaim(
    uint256 claimId,
    string memory reason
) public onlyRole(CLAIM_MANAGER_ROLE)

// Sinh viên claim reward
function claimApprovedReward(uint256 claimId) public nonReentrant
```

#### Fund Pool
```solidity
function fundRewardPool(uint256 amount) public onlyRole(ADMIN_ROLE)

function withdrawFromRewardPool(uint256 amount) public onlyRole(ADMIN_ROLE)
```

### Reward Types
```solidity
enum RewardType {
    GPA_BASED,              // GPA >= 3.5
    COURSE_COMPLETION,      // Hoàn thành course
    PARTICIPATION,          // Tham gia events
    RESEARCH,              // Nghiên cứu
    EXTRACURRICULAR,       // Hoạt động ngoài khóa
    CUSTOM                 // Tùy chỉnh
}
```

### Deployment
```bash
npx hardhat run scripts/deploy-rewards.js --network mumbai
```

---

## 4. VNDC_Payments.sol

**File:** `contracts/VNDC_Payments.sol`

### Chức Năng
- **Tuition Payment**: Thanh toán học phí
- **Merchant Management**: Quản lý các merchant (trường học, dịch vụ)
- **Settlement**: Thanh toán cho merchant với batch processing
- **Refunds**: Hoàn tiền nếu cần

### Công Thức Khởi Tạo
```solidity
VNDC_Payments payments = new VNDC_Payments(vndcTokenAddress);
```

### Các Hàm Chính

#### Merchant Management
```solidity
function registerMerchant(
    address merchantAddress,
    string memory name,
    string memory bankAccount
) public onlyRole(ADMIN_ROLE)

function deactivateMerchant(address merchantAddress) public onlyRole(ADMIN_ROLE)

function activateMerchant(address merchantAddress) public onlyRole(ADMIN_ROLE)

function getMerchant(address merchantAddress) public view returns (Merchant memory)
```

#### Payment
```solidity
// Thanh toán đơn
function submitPayment(
    address merchant,
    uint256 amount,
    PaymentType paymentType,
    string memory description
) public returns (uint256 paymentId)

// Batch payment (tối ưu gas)
function batchSubmitPayments(
    address[] calldata merchants,
    uint256[] calldata amounts,
    PaymentType[] calldata paymentTypes,
    string[] calldata descriptions
) public returns (uint256[] memory)

// Hoàn tiền
function refundPayment(uint256 paymentId) public onlyRole(ADMIN_ROLE)
```

#### Settlement
```solidity
// Tạo batch để settlement
function createSettlementBatch(address merchant) public returns (uint256 batchId)

// Thực hiện settlement (chuyển VNDC cho merchant)
function settleBatch(uint256 batchId) public onlyRole(SETTLEMENT_ROLE)
```

### Payment Types
```solidity
enum PaymentType {
    TUITION,        // Học phí
    ACCOMMODATION,  // Ký túc xá
    MEAL_PLAN,      // Cơm ăn
    LIBRARY_FEE,    // Thư viện
    EXAMINATION_FEE,// Thi cử
    CAMPUS_SERVICE, // Dịch vụ campus
    OTHER
}
```

### Deployment
```bash
npx hardhat run scripts/deploy-payments.js --network mumbai
```

---

## 5. VNDC_Governance.sol

**File:** `contracts/VNDC_Governance.sol`

### Chức Năng
- **Proposals**: Tạo đề xuất cho hệ thống
- **Voting**: VNDC token holders bỏ phiếu
- **Execution**: Tự động thực hiện đề xuất khi được phê duyệt
- **Quorum**: Yêu cầu 4% VNDC holders để thông qua

### Công Thức Khởi Tạo
```solidity
VNDC_Governance dao = new VNDC_Governance(vndcTokenAddress);
```

### Cấu Hình Mặc Định
| Tham Số | Giá Trị | Mô Tả |
|---------|--------|-------|
| Voting Delay | 1 block | Voting bắt đầu sau 1 block |
| Voting Period | 50,400 blocks | ~1 tuần trên Polygon |
| Proposal Threshold | 1,000 VNDC | Tối thiểu để propose |
| Quorum | 4% | 4% voting power cần thiết |

### Các Hàm Chính

#### Proposals
```solidity
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
) public returns (uint256 proposalId)

function getProposalState(uint256 proposalId) public view returns (string memory)

function getProposalDetails(uint256 proposalId) public view returns (...)
```

#### Voting
```solidity
// Vote (0=Against, 1=For, 2=Abstain)
function castVote(uint256 proposalId, uint8 support) public returns (uint256)

function castVoteWithReason(
    uint256 proposalId,
    uint8 support,
    string calldata reason
) public returns (uint256)

function hasVoted(uint256 proposalId, address account) public view returns (bool)
```

#### Execution
```solidity
function queue(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) public returns (uint256)

function execute(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) public payable returns (uint256)
```

### Proposal Example
```javascript
// Proposal: Mint 100,000 VNDC cho top students
const targets = [vndcTokenAddress];
const values = [0];
const calldatas = [
    token.interface.encodeFunctionData('mint', [
        studentAddress,
        ethers.utils.parseEther('100000'),
        'Reward for excellent academic performance'
    ])
];
const description = "Mint 100,000 VNDC to top students in 2024";

const proposeTx = await governor.propose(targets, values, calldatas, description);
```

### Deployment
```bash
npx hardhat run scripts/deploy-governance.js --network mumbai
```

---

## Deployment Sequence

### 1. Deploy Token
```bash
PRIVATE_KEY=xxx npx hardhat run scripts/deploy/01-token.js --network mumbai
# Output: VNDC_Token deployed to: 0x...
```

### 2. Deploy Credentials
```bash
PRIVATE_KEY=xxx npx hardhat run scripts/deploy/02-credentials.js --network mumbai
# Output: VNDC_Credential deployed to: 0x...
```

### 3. Deploy Rewards
```bash
PRIVATE_KEY=xxx npx hardhat run scripts/deploy/03-rewards.js --network mumbai
# Requires: VNDC Token address from step 1
# Output: VNDC_Rewards deployed to: 0x...
```

### 4. Deploy Payments
```bash
PRIVATE_KEY=xxx npx hardhat run scripts/deploy/04-payments.js --network mumbai
# Requires: VNDC Token address from step 1
# Output: VNDC_Payments deployed to: 0x...
```

### 5. Deploy Governance
```bash
PRIVATE_KEY=xxx npx hardhat run scripts/deploy/05-governance.js --network mumbai
# Requires: VNDC Token address from step 1
# Output: VNDC_Governance deployed to: 0x...
```

### 6. Setup Roles
```bash
PRIVATE_KEY=xxx npx hardhat run scripts/setup/setup-roles.js --network mumbai
```

### 7. Verify Contracts
```bash
npx hardhat verify --network mumbai <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## Hardhat Configuration

### hardhat.config.js
```javascript
require("@openzeppelin/hardhat-upgrades");
require("@nomicfoundation/hardhat-verify");

module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        mumbai: {
            url: process.env.MUMBAI_RPC_URL,
            accounts: [process.env.PRIVATE_KEY]
        },
        polygon: {
            url: process.env.POLYGON_RPC_URL,
            accounts: [process.env.PRIVATE_KEY]
        }
    },
    etherscan: {
        apiKey: {
            polygonMumbai: process.env.ETHERSCAN_API_KEY,
            polygon: process.env.ETHERSCAN_API_KEY
        }
    }
};
```

---

## Testing

### Unit Tests (Mocha/Chai)
```bash
npx hardhat test
```

### Coverage
```bash
npx hardhat coverage
```

### Gas Report
```bash
REPORT_GAS=true npx hardhat test
```

---

## Security Considerations

### Access Control
- **ADMIN_ROLE**: Quản lý hệ thống
- **ISSUER_ROLE**: Phát hành credentials
- **MINTER_ROLE**: Tạo VNDC mới
- **PAUSER_ROLE**: Pause contracts
- **CLAIM_MANAGER_ROLE**: Approve/reject claims

### Reentrancy Protection
- Sử dụng OpenZeppelin's `ReentrancyGuard`
- Checks-Effects-Interactions pattern

### Pausable
- Tất cả contracts implement Pausable
- Admin có thể dừng operations trong trường hợp khẩn cấp

### Soulbound Tokens
- Credentials không thể transfer
- Chỉ có thể mint hoặc burn

---

## Mainnet Deployment Checklist

- [ ] Audit smart contracts
- [ ] Test coverage > 90%
- [ ] Gas optimization
- [ ] Verify all contracts
- [ ] Setup role distribution
- [ ] Fund reward pool
- [ ] Configure governance settings
- [ ] Deploy monitoring/alerts
- [ ] Documentation for admin
- [ ] Insurance/warrants setup

---

## Reference

- OpenZeppelin Docs: https://docs.openzeppelin.com
- Solidity: https://docs.soliditylang.org
- Hardhat: https://hardhat.org
- Polygon: https://polygon.technology

---

**Last Updated**: 2024
**Network**: Polygon Mumbai (Testnet) → Polygon (Mainnet)
**Version**: 1.0.0

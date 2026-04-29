# VNDC Token - Phase 3 Smart Contracts

## 📋 Overview

This is the smart contract implementation for VNDC Token features as part of Phase 3 of the VNDC ecosystem development. The project includes:

- **VNDCToken**: ERC20 token with advanced features (burnable, pausable, snapshots, token locking)
- **VNDCStaking**: Staking contract with tiered rewards and auto-compounding
- **VNDCTokenVesting**: Flexible token vesting with cliff periods and revocation

## 🏗️ Project Structure

```
onchain/
├── contracts/
│   ├── VNDCToken.sol          # Main ERC20 token contract
│   ├── VNDCStaking.sol        # Staking with reward distribution
│   └── VNDCTokenVesting.sol   # Token vesting schedules
├── test/
│   ├── VNDCToken.test.ts      # Token tests (30+ test cases)
│   └── VNDCStaking.test.ts    # Staking tests (25+ test cases)
├── scripts/
│   └── deploy.ts              # Deployment script
├── hardhat.config.ts          # Hardhat configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## 🚀 Quick Start

### Installation

```bash
cd onchain
npm install
```

### Environment Setup

Create a `.env` file based on `.env.example`:

```env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
REPORT_GAS=false
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm run test
npm run test:coverage
```

### Deploy

**Local Network:**
```bash
npm run node           # Terminal 1: Start local node
npm run deploy:localhost  # Terminal 2: Deploy
```

**Sepolia Testnet:**
```bash
npm run deploy:sepolia
```

## 📦 Smart Contracts

### VNDCToken

ERC20 token with enhanced features:

**Features:**
- Standard ERC20 transfers and approvals
- Token burning (holders can burn their own tokens)
- Snapshot capability for historical balance tracking
- Role-based access control (MINTER, PAUSER, SNAPSHOT_ROLE)
- Pausable for emergency situations
- Token locking with time-based release

**Key Functions:**
```solidity
// Minting
mint(address to, uint256 amount)

// Burning
burn(uint256 amount)
burnFrom(address account, uint256 amount)

// Snapshots
snapshot() returns (uint256 snapshotId)
balanceOfAt(address account, uint256 snapshotId) returns (uint256)

// Pausing
pause()
unpause()

// Token Locking
lockTokens(address holder, uint256 amount, uint256 releaseTime)
releaseLocked(address holder)
getLockedTokens(address holder) returns (uint256, uint256)
```

**Token Details:**
- Name: VNDC Token
- Symbol: VNDC
- Decimals: 18
- Max Supply: 1 billion tokens
- Initial Supply: Configurable during deployment

### VNDCStaking

Staking contract with tiered rewards:

**Features:**
- Flexible staking with different lock periods
- Multiplier-based rewards (3 months: 100%, 6 months: 120%, 12 months: 150%, 24 months: 200%)
- Auto-compounding rewards
- Emergency withdrawal with penalty
- Admin controls for rate adjustment

**Staking Tiers:**
| Duration | Multiplier | Annual Rewards |
|----------|-----------|-----------------|
| 3 months | 100% | 10% |
| 6 months | 120% | 12% |
| 12 months | 150% | 15% |
| 24 months | 200% | 20% |

**Key Functions:**
```solidity
// Staking
stake(uint256 amount, uint256 duration)
claimRewards()
unstake()
emergencyUnstake()

// View
calculatePendingRewards(address user) returns (uint256)
getStake(address user) returns (Stake)
getTimeToUnlock(address user) returns (uint256)

// Admin
setRewardRate(uint256 newRate)
setStakingMultiplier(uint256 duration, uint256 multiplier)
setMinStakeAmount(uint256 _minAmount)
```

### VNDCTokenVesting

Flexible token vesting with cliff periods:

**Features:**
- Custom vesting schedules per beneficiary
- Cliff period before vesting starts
- Linear vesting over time
- Revocable schedules
- Multiple beneficiaries

**Vesting Formula:**
```
Vested Amount = (Total Amount × Time Vested) / Vesting Duration
(only after cliff period ends)
```

**Key Functions:**
```solidity
// Vesting Management
createVestingSchedule(
    address beneficiary,
    uint256 amount,
    uint256 startTime,
    uint256 cliffDuration,
    uint256 vestingDuration,
    bool revocable
) returns (bytes32)

releaseVestedTokens(bytes32 scheduleId) returns (uint256)
revokeVestingSchedule(bytes32 scheduleId)

// View
calculateVestedAmount(bytes32 scheduleId) returns (uint256)
calculateReleasableAmount(bytes32 scheduleId) returns (uint256)
getVestingSchedule(bytes32 scheduleId) returns (VestingSchedule)
getUserVestingSchedules(address user) returns (bytes32[])
```

## 🧪 Testing

The project includes comprehensive test coverage:

**VNDCToken Tests (30+ cases):**
- Deployment and initialization
- Token transfers and balances
- Minting with access control
- Token burning
- Pausing functionality
- Snapshot creation and tracking
- Token locking and release
- Access control and role management

**VNDCStaking Tests (25+ cases):**
- Staking with different durations
- Reward calculation and multipliers
- Auto-compounding
- Emergency unstaking with penalties
- Admin functions
- View functions and time calculations

**Run Tests:**
```bash
npm run test              # Run all tests
npm run test:coverage     # Generate coverage report
```

## 📊 Contract Sizes

```bash
npm run compile

# View contract sizes
npx hardhat size-contracts
```

## 🔒 Security Features

- **Access Control**: Role-based permissions (MINTER, PAUSER, SNAPSHOT, ADMIN)
- **Reentrancy Guards**: On staking and vesting contracts
- **Safe Math**: Using Solidity 0.8.24 (no overflow/underflow)
- **Pausable**: Emergency pause mechanism
- **Token Locking**: Prevent unauthorized transfers
- **Time Locks**: Cliff periods in vesting

## 🌐 Network Deployment

### Supported Networks
- **Local**: http://127.0.0.1:8545
- **Sepolia Testnet**: https://ethereum-sepolia-rpc.publicnode.com
- **Custom RPC**: Configure in hardhat.config.ts

### Gas Optimization
- Optimized for 200 optimization runs
- Contract size monitoring enabled
- Gas reporting available

## 📋 Environment Variables

```env
# RPC Configuration
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Deployment Account (without 0x prefix)
PRIVATE_KEY=your_private_key

# Verification
ETHERSCAN_API_KEY=your_etherscan_key

# Gas Reporting
REPORT_GAS=true|false
```

## 🚀 Deployment Steps

1. **Compile Contracts**
   ```bash
   npm run compile
   ```

2. **Run Tests**
   ```bash
   npm run test
   ```

3. **Deploy**
   ```bash
   npm run deploy:sepolia
   ```

4. **Verify on Etherscan** (optional)
   ```bash
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

## 📝 Contract Addresses

After deployment, contract addresses will be saved in the deployment output. Key addresses:

- **VNDCToken**: Main ERC20 token
- **VNDCStaking**: Staking pool
- **VNDCTokenVesting**: Vesting contract

## 🔗 Integration

### Frontend Integration
Use the contract ABIs from `artifacts/contracts/`:

```typescript
import { VNDCToken__factory } from './typechain-types';

const token = VNDCToken__factory.connect(tokenAddress, signer);
const balance = await token.balanceOf(userAddress);
```

### Backend Integration
Deploy scripts available in `/scripts/deploy.ts` for automated deployment.

## 📚 Documentation

- [Solidity Docs](https://docs.soliditylang.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)

## 🔄 Upgrade Path

For future upgrades:
1. Use transparent proxy pattern (recommended)
2. Deploy new implementation contracts
3. Update proxy pointers
4. Maintain backward compatibility

## 📞 Support

For issues or questions:
1. Check existing test cases
2. Review contract comments
3. Check Hardhat documentation
4. Consult OpenZeppelin guides

## ⚖️ License

MIT License - See LICENSE file

## 🎯 Phase 3 Deliverables

✅ **Core Token (VNDCToken)**
- ERC20 standard implementation
- Advanced features (burn, pause, snapshot, lock)
- Role-based access control
- 30+ comprehensive tests

✅ **Staking System (VNDCStaking)**
- Tiered reward structure
- Auto-compounding
- Emergency withdrawal
- 25+ comprehensive tests

✅ **Vesting System (VNDCTokenVesting)**
- Flexible schedules
- Cliff periods
- Revocation capability
- Full test coverage

✅ **Deployment Infrastructure**
- Automated deployment scripts
- Multi-network support
- Verification ready
- Gas optimization

---

**Last Updated**: April 2026
**Status**: Ready for Testnet Deployment

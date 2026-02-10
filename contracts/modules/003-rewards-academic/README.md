# Module 003: Academic Rewards System

## Overview

Module 003 implements a comprehensive academic reward system that distributes VNDC tokens and ERC-1155 badges based on student GPA performance. The system incentivizes academic excellence through tiered rewards.

## Architecture

```
┌─────────────────────────────────────────────┐
│     Academic Reward System                  │
├─────────────────────────────────────────────┤
│                                             │
│  AcademicReward (Manager)                  │
│  ├─ Issuer Management (Teachers)           │
│  ├─ Reward Tier Configuration              │
│  ├─ Student Award Processing               │
│  └─ Reward Claiming                        │
│         │                                   │
│         ├─→ AcademicBadgeNFT (ERC-1155)    │
│         │   └─ Multiple badge types        │
│         │                                   │
│         ├─→ VNDC Token (Module 001)         │
│         │   └─ Token distribution          │
│         │                                   │
│         └─→ VNDC Registry (Module 001)      │
│             └─ Student verification        │
└─────────────────────────────────────────────┘
```

## Key Features

- **Tiered Reward System**: Premium, Gold, Silver, Bronze tiers based on GPA
- **Badge Minting**: ERC-1155 badges for achievements
- **VNDC Distribution**: Token rewards for high-performing students
- **Issuer Management**: Teacher/registrar authorization
- **Claim-Based Model**: Students claim their own rewards
- **Flexible Configuration**: Configurable GPA thresholds and reward amounts

## Contract Files

### AcademicBadgeNFT.sol (ERC-1155)
Semi-fungible token implementation for academic badges.

**Key Functions**:
- `createBadge(string uri)`: Create new badge type
- `mint(address to, uint256 badgeId, uint256 amount)`: Mint badges
- `burn(address account, uint256 badgeId, uint256 amount)`: Remove badges
- `hasBadge(address user, uint256 badgeId)`: Check badge ownership
- `getBalances(address account)`: Get user's badge portfolio

### AcademicReward.sol (Manager)
Central contract for reward management and distribution.

**Key Functions**:
- `setRewardTier(uint256 tierId, ...)`: Configure reward tier
- `awardStudent(address student, uint256 gpa)`: Issue reward to student
- `claimReward(uint256 rewardId)`: Student claims their reward
- `getStudentRewards(address student)`: Get student's reward history
- `addIssuer(address issuer)`: Authorize teacher/registrar

## Reward Tiers

| Tier | GPA Requirement | VNDC Amount | Badge |
|------|-----------------|-------------|-------|
| Premium | ≥3.80 | 100 VNDC | Premium Badge |
| Gold | ≥3.50 | 50 VNDC | Gold Badge |
| Silver | ≥3.00 | 25 VNDC | Silver Badge |
| Bronze | ≥2.00 | 10 VNDC | Bronze Badge |

## Deployment

### Prerequisite
Module 001 (Core System) must be deployed first.

### Deploy Module 003
```bash
npx hardhat deploy --network localhost --tags academic-rewards
```

### On Sepolia
```bash
npx hardhat deploy --network sepolia --tags academic-rewards
```

## Testing

```bash
npm run test -- test/modules/rewards/
```

## Usage Example

### As Teacher: Award Student
```typescript
const reward = await ethers.getContractAt("AcademicReward", "0x...");

// Award student with GPA 3.85 (385 × 100)
const tx = await reward.awardStudent("0xStudentAddress", 385);
const receipt = await tx.wait();
console.log("Reward ID:", receipt.events[0].args.rewardId);
```

### As Student: Claim Reward
```typescript
// Student claims their reward
const rewardId = 0; // From award transaction
await reward.connect(studentSigner).claimReward(rewardId);
// → Mints badge NFT and transfers VNDC
```

### Verify Achievement
```typescript
const badgeBalance = await badge.balanceOf(studentAddress, 0);
console.log("Premium badges owned:", badgeBalance);
```

## Integration

### With Module 004 (Extracurricular Rewards)
Combine academic and extracurricular achievements for holistic student profiles.

### With Module 005 (Payments)
Badge holders get discount on campus services.

### With Module 006 (Records)
Store reward history in permanent student record.

## Gas Efficiency

| Operation | Gas Cost |
|-----------|----------|
| Award Student | ~80,000 |
| Claim Reward | ~150,000 |
| Create Badge | ~50,000 |
| Set Tier | ~40,000 |

## Status

✅ **Implementation**: Complete  
✅ **Testing**: In Progress  
📅 **Deployment**: Ready for Sepolia  

---

**Module 003 - Academic Rewards System**  
February 2026

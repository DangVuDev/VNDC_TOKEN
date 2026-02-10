# Module Template: VNDC Module

Sử dụng template này cho tất cả các module. Chỉ cần điều chỉnh tên, mô tả, và chức năng.

---

## Module Structure

```
contracts/modules/{NUMBER}-{NAME}/
├── {ModuleName}.sol              # Main implementation
├── I{ModuleName}.sol              # Interface definition
├── {ModuleName}NFT.sol            # NFT contract (if needed)
├── {ModuleName}Utils.sol          # Utilities (if needed)
└── README.md                      # This file
```

---

## Module Information

| Property | Value |
|----------|-------|
| **Module Number** | XXX |
| **Module Name** | {ModuleName} |
| **Priority** | High/Medium/Low |
| **Dependencies** | Core (001), ... |
| **Key Functions** | N |
| **NFT Types** | ERC-20 / ERC-721 / ERC-1155 |
| **Deployment Cost** | ~X ETH (Sepolia) |
| **Gas per Tx** | ~X gas |

---

## Overview

Brief description of what this module does and why it's needed.

Example:
> This module manages academic rewards for students based on GPA performance. It automatically distributes VNDC tokens and mints achievement badges when students meet GPA thresholds.

---

## Contract Specification

### {ModuleName}.sol

**Purpose:** Main business logic for the module

**Key Functions:**

```solidity
/**
 * @notice Function description
 * @param param1 Description of param1
 * @return Return value description
 */
function functionName(address param1, uint256 param2) external onlyRole returns (bool);
```

**Events:**

```solidity
event EventName(address indexed account, uint256 amount, uint256 timestamp);
```

**Access Control:**

| Role | Functions | Notes |
|------|-----------|-------|
| ADMIN | setup, configure | Only owner |
| USER | claim, view | Public users |
| ISSUER | issue, mint | Authorized issuer |

---

### I{ModuleName}.sol

**Purpose:** Interface definition for external consumption

**Imports:**

```solidity
import {IVNDCCore} from "../interfaces/IVNDCCore.sol";
```

---

### {ModuleName}NFT.sol (if applicable)

**Purpose:** NFT smart contract for this module

**Standard:** ERC-721 / ERC-1155

**Key Details:**
- Metadata format
- Minting conditions
- Burning/revocation logic

---

## Usage Examples

### Scenario 1: Basic Operation

```typescript
import { ethers } from "hardhat";

const [owner, student, teacher] = await ethers.getSigners();

// Deploy
const Module = await ethers.getContractFactory("{ModuleName}");
const module = await Module.deploy(params);

// Use
const tx = await module.connect(student).functionName(...);
const receipt = await tx.wait();
```

### Scenario 2: Batch Operations

```typescript
const students = [addr1, addr2, addr3];
const amounts = [100, 200, 300];

for (let i = 0; i < students.length; i++) {
  await module.batchOperation(students[i], amounts[i]);
}
```

---

## Testing Strategy

### Unit Tests (`test/modules/{module}/`)

**File:** `{ModuleName}.test.ts`

```typescript
describe("{ModuleName}", () => {
  let module: {ModuleName};
  let owner: SignerWithAddress;
  let student: SignerWithAddress;

  beforeEach(async () => {
    [owner, student] = await ethers.getSigners();
    const {ModuleName} = await ethers.getContractFactory("{ModuleName}");
    module = await {ModuleName}.deploy();
  });

  describe("Deployment", () => {
    it("should deploy correctly", async () => {
      expect(module.address).to.be.properAddress;
    });
  });

  describe("Core Functions", () => {
    it("should perform expected function", async () => {
      const tx = await module.functionName(...);
      expect(tx).to.be.ok;
    });
  });

  describe("Access Control", () => {
    it("should revert if unauthorized", async () => {
      await expect(
        module.connect(student).restrictedFunction()
      ).to.be.revertedWith("Only ADMIN");
    });
  });
});
```

### Test Coverage
- ✅ Happy path (normal operation)
- ✅ Edge cases (boundary conditions)
- ✅ Error conditions (reverts)
- ✅ Access control (role checks)
- ✅ State changes (events)

---

## Deployment

### 1. Prepare Deployment Script

**File:** `deploy/modules/{NUMBER}_deploy_{name}.ts`

```typescript
import { HardhatRuntimeEnvironmentExtended } from "hardhat-deploy/types";

const func = async (hre: HardhatRuntimeEnvironmentExtended) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("Deploying {ModuleName}...");

  const module = await deploy("{ModuleName}", {
    from: deployer,
    args: [arg1, arg2],
    log: true,
    waitConfirmations: hre.network.config.confirmations || 1,
  });

  log("✅ {ModuleName} deployed at:", module.address);
};

func.tags = ["{ModuleName}", "{NUMBER}"];
func.dependencies = ["Core"]; // List dependencies

export default func;
```

### 2. Deploy Commands

```bash
# Local
npx hardhat deploy --network localhost --tags {NUMBER}

# Sepolia
npx hardhat deploy --network sepolia --tags {NUMBER}

# Polygon
npx hardhat deploy --network polygon --tags {NUMBER}
```

### 3. Post-Deployment Setup

```typescript
// scripts/modules/{name}/setup.ts
export async function setupModule(
  hre: HardhatRuntimeEnvironment,
  moduleAddress: string
) {
  const module = await ethers.getContractAt("{ModuleName}", moduleAddress);
  
  // Initialize parameters
  await module.initialize(...);
  
  // Grant roles
  await module.grantRole(ADMIN_ROLE, adminAddress);
  
  log("✅ Module setup complete");
}
```

---

## Integration Points

### With Core Module (VNDC)
- VNDC token transfers
- Role-based access control
- Event emission

### With Other Modules
- Module 1: {dependency description}
- Module 2: {dependency description}

### Data Flow

```
External Input
     ↓
{ModuleName} Contract
     ↓
VNDC Transfer / NFT Mint
     ↓
Event Emission
     ↓
Off-chain Indexing
```

---

## Security Considerations

### Reentrancy
- ✅ Protected with nonReentrant guard (if applicable)

### Access Control
- ✅ All restricted functions checked with onlyRole

### Input Validation
- ✅ All addresses checked for zero
- ✅ All amounts verified > 0
- ✅ All enum values checked

### Gas Optimizations
- ✅ Batch operations supported
- ✅ View functions used where possible
- ✅ Storage access minimized

---

## Events & Monitoring

### Events Emitted

```solidity
event {EventName}(
    address indexed account,
    uint256 indexed id,
    uint256 amount,
    uint256 timestamp
);
```

### Event Listening (Frontend)

```typescript
const filter = module.filters.{EventName}();
const events = await module.queryFilter(filter);

module.on("{EventName}", (account, id, amount, timestamp) => {
  console.log(`Event received: ${account} - ${amount}`);
});
```

---

## Performance Benchmarks

### Gas Usage
| Operation | Gas | Cost (Polygon) |
|-----------|-----|---|
| Function 1 | ~50,000 | $0.01 |
| Function 2 | ~100,000 | $0.02 |
| Batch Op | ~200,000 | $0.04 |

### Optimization Tips
- Use delegatecalls for library functions
- Cache storage variables
- Batch operations to reduce calls

---

## Error Messages

```solidity
error {ModuleName__NotAuthorized();
error {ModuleName__InvalidAmount();
error {ModuleName__AlreadyExists();
error {ModuleName__NotFound();
```

---

## Upgrade Path

### Current Version
- Version: 1.0.0
- Status: Stable

### Future Enhancements
- Feature 1: Description
- Feature 2: Description

### Upgrade Process
1. Deploy new implementation
2. Test thoroughly
3. Call `upgradeTo()` on proxy
4. Verify functionality

---

## Scripts for Interaction

### Mint/Issue

```bash
npx hardhat run scripts/modules/{name}/mint.ts --network sepolia
```

### Verify

```bash
npx hardhat run scripts/modules/{name}/verify.ts --network sepolia
```

### Manage

```bash
npx hardhat run scripts/modules/{name}/manage.ts --network sepolia
```

---

## FAQ

**Q: How do I deploy this module?**  
A: Follow the deployment section above. Dependencies must be deployed first.

**Q: What's the gas cost?**  
A: Usually $X on Polygon. See performance benchmarks.

**Q: Can this be upgraded?**  
A: Yes, if using UUPS proxy pattern.

**Q: What happens if function reverts?**  
A: State is rolled back. Check error messages for reason.

---

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System design
- [MODULES.md](../../MODULES.md) - All modules
- [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md) - Deployment help
- [Solidity Docs](https://docs.soliditylang.org/)
- [OpenZeppelin Docs](https://docs.openzeppelin.com/)

---

## Checklist

### Development
- [ ] Contract code written
- [ ] Interface defined
- [ ] Unit tests written
- [ ] Gas tested
- [ ] Documentation complete

### Deployment
- [ ] Local testing successful
- [ ] Sepolia testing successful
- [ ] Contract verified on Etherscan
- [ ] Roles granted
- [ ] Health check passed

### Post-Launch
- [ ] Monitoring active
- [ ] Events indexed
- [ ] User feedback collected
- [ ] Performance optimal

---

**Module Version:** 1.0.0  
**Created:** Feb 6, 2026  
**Status:** Template Ready

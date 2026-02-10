# VNDC Deployment Guide

Hướng dẫn triển khai hệ thống VNDC trên Blockchain.

---

## Pre-Deployment Checklist

### Environment Setup
```bash
# 1. Clone repository
git clone <repo-url>
cd VNDC

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Create .env file
cp .env.example .env

# 4. Configure environment variables
PRIVATE_KEY=0x...              # Your wallet private key
SEPOLIA_RPC_URL=https://...    # Sepolia RPC endpoint
ETHERSCAN_API_KEY=...          # For contract verification
REPORT_GAS=true                # Enable gas reporting
```

### Environment Variables

```env
# Deployment Keys
PRIVATE_KEY=0x1234...          # Deployer private key (KEEP SECRET!)

# Network RPC Endpoints
SEPOLIA_RPC_URL=https://1rpc.io/sepolia
POLYGON_RPC_URL=https://polygon-rpc.com
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
BSC_RPC_URL=https://bsc-dataseed.binance.org

# Verification
ETHERSCAN_API_KEY=...          # For Ethereum/Sepolia
POLYGONSCAN_API_KEY=...        # For Polygon
BSCSCAN_API_KEY=...            # For BSC

# Configuration
REPORT_GAS=true
COINMARKETCAP_API_KEY=...      # Optional: Gas price in USD
```

---

## Deployment Stages

### Stage 1: Local Testing

#### Start Local Node
```bash
# Terminal 1: Start Hardhat local network
npx hardhat node

# Terminal 2: Run tests
npm run test

# Terminal 3: Deploy to local
npx hardhat deploy --network localhost
```

#### Verification
```bash
# Check deployment artifacts
ls deployments/localhost/

# Verify contract state
npx hardhat run scripts/get-bank-info.ts --network localhost
```

---

### Stage 2: Sepolia Testnet

#### Prerequisites
- Sepolia ETH from faucet
- API keys configured in `.env`

#### Deployment

```bash
# 1. Clean previous artifacts
npm run clean

# 2. Compile contracts
npm run compile

# 3. Deploy to Sepolia
npx hardhat deploy --network sepolia

# 4. Verify contracts on Etherscan
npx hardhat run scripts/verify-all.ts --network sepolia
```

#### Gas Report
```bash
# View gas usage reports
cat hardhat-gas-reporter-output.json
```

#### Testing on Testnet
```bash
# Run integration tests on Sepolia
npx hardhat test test/integration/ --network sepolia

# Monitor contract interaction
npx hardhat run scripts/healthcheck.ts --network sepolia
```

---

### Stage 3: Polygon Mumbai (Staging)

#### Prerequisites
- MATIC from Mumbai faucet
- Polygonscan API key configured

#### Deployment
```bash
# Deploy to Mumbai
npx hardhat deploy --network mumbai

# Verify on Polygonscan
npx hardhat verify --list-networks mumbai

# Run user acceptance tests
npx hardhat test test/e2e/ --network mumbai
```

#### Monitoring
```bash
# Check contract events
npx hardhat run scripts/monitor-events.ts --network mumbai
```

---

### Stage 4: Polygon Mainnet (Production)

#### Pre-Deployment Audits
- [ ] Security audit completed
- [ ] Gas optimization approved
- [ ] All tests passing (95%+ coverage)
- [ ] Contract size verified
- [ ] Emergency pause mechanism tested

#### Final Checks
```bash
# 1. Dry run deployment
npx hardhat deploy --network polygon --dry-run

# 2. Verify contract size
npm run size

# 3. Final test
npm run test

# 4. Check gas estimates
npx hardhat task:estimate-gas --network polygon
```

#### Mainnet Deployment
```bash
# Deploy to polygon mainnet
npx hardhat deploy --network polygon

# Verify all contracts
npx hardhat verify --list-networks polygon
```

#### Post-Deployment
```bash
# 1. Monitor for 24 hours
npx hardhat run scripts/monitor-24h.ts --network polygon

# 2. Check contract state
npx hardhat run scripts/health-check.ts --network polygon

# 3. Enable emergency pause (if needed)
npx hardhat run scripts/pause-if-emergency.ts --network polygon
```

---

## Deployment Script Structure

### Example: Deploy Core Module

```typescript
// deploy/modules/001_deploy_core.ts

import { HardhatRuntimeEnvironmentExtended } from "hardhat-deploy/types";
import { verify } from "ethers-verify";

const func = async (hre: HardhatRuntimeEnvironmentExtended) => {
  const { deployments, ethers, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("Deploying VNDC Core Module...");

  // 1. Deploy VNDC Token
  const vndc = await deploy("VNDC", {
    from: deployer,
    args: ["Vietnam Digital Currency", "VNDC", ethers.parseEther("1000000000")],
    log: true,
    waitConfirmations: hre.network.config.confirmations || 1,
  });

  // 2. Deploy Registry
  const registry = await deploy("VNDCRegistry", {
    from: deployer,
    args: [vndc.address],
    log: true,
    waitConfirmations: hre.network.config.confirmations || 1,
  });

  // 3. Deploy AccessControl
  const accessControl = await deploy("AccessControl", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: hre.network.config.confirmations || 1,
  });

  log("✅ Core module deployed!");

  // 4. Verify on Etherscan (if not localhost)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    log("Verifying contracts on Etherscan...");
    
    await verify(hre, vndc.address, ["Vietnam Digital Currency", "VNDC", ethers.parseEther("1000000000")]);
    await verify(hre, registry.address, [vndc.address]);
    await verify(hre, accessControl.address, []);
  }

  log("🎉 Deployment complete!");
};

func.tags = ["Core", "001"];
func.dependencies = [];

export default func;
```

---

## Verification Process

### Etherscan Verification

```bash
# Verify single contract
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>

# Verify with constructor arguments
npx hardhat verify --network sepolia <ADDRESS> "arg1" "arg2"

# Verify with JSON file
npx hardhat verify --constructor-args args.js --network sepolia <ADDRESS>
```

### Constructor Arguments File

```typescript
// args.js
module.exports = [
  "Vietnam Digital Currency",  // name
  "VNDC",                       // symbol
  ethers.parseEther("1000000000") // initialSupply
];
```

---

## Post-Deployment Configuration

### 1. Grant Roles

```bash
# Grant MINTER role to reward contracts
npx hardhat run scripts/grant-roles.ts --network sepolia

# Grant ISSUER role to credential contract
npx hardhat run scripts/setup-credentials.ts --network sepolia
```

### 2. Initialize Parameters

```bash
# Set GPA thresholds for academic rewards
npx hardhat run scripts/setup-academic-rewards.ts --network sepolia

# Register initial merchants
npx hardhat run scripts/register-merchants.ts --network sepolia
```

### 3. Health Check

```bash
# Verify all contracts initialized correctly
npx hardhat run scripts/health-check.ts --network sepolia

# Check token balance
npx hardhat run scripts/check-balances.ts --network sepolia
```

---

## Rollback Plan

If deployment fails:

### Option 1: Revert to Last Working Version
```bash
# Restore from git
git checkout <last-working-commit>

# Clean and redeploy
npm run clean
npm run compile
npx hardhat deploy --network sepolia
```

### Option 2: Emergency Pause
```bash
# Pause all contracts temporarily
npx hardhat run scripts/emergency-pause.ts --network sepolia

# Fix issues offline
# Then resume
npx hardhat run scripts/emergency-resume.ts --network sepolia
```

### Option 3: Upgrade via Proxy
```bash
# Deploy new implementation
npx hardhat run scripts/upgrade-implementation.ts --network sepolia

# Test new implementation
npm run test

# If successful, keep new version
# If failed, rollback to old implementation
```

---

## Contract Upgrades

### Using UUPS Proxy Pattern

```bash
# Deploy upgradeable contract
npx hardhat run scripts/deploy-upgradeable.ts --network sepolia

# Later: Upgrade to new implementation
npx hardhat run scripts/upgrade-to-v2.ts --network sepolia

# Verify upgrade
npx hardhat run scripts/verify-upgrade.ts --network sepolia
```

---

## Gas Optimization

### Report Gas Usage
```bash
# Run tests with gas reporter
REPORT_GAS=true npm run test
```

### Optimize Contract Size
```bash
# Check current sizes
npm run size

# Enable optimizer settings (already in hardhat.config.ts)
# - viaIR: true (reduces ~30%)
# - metadata.bytecodeHash: "none" (reduces ~10%)
```

### Target Sizes
- VNDC: < 10KB
- Credentials: < 15KB
- Rewards: < 20KB
- Other modules: < 25KB

---

## Network Configuration

### Supported Networks

```typescript
networks: {
  sepolia: {
    url: "https://1rpc.io/sepolia",
    chainId: 11155111,
    gasPrice: "auto",
    confirmations: 3,
  },
  polygon: {
    url: "https://polygon-rpc.com",
    chainId: 137,
    gasPrice: "auto",
    confirmations: 5,
  },
  mumbai: {
    url: "https://rpc-mumbai.maticvigil.com",
    chainId: 80001,
    gasPrice: "auto",
    confirmations: 3,
  },
  bsc: {
    url: "https://bsc-dataseed.binance.org",
    chainId: 56,
    gasPrice: "auto",
    confirmations: 5,
  },
  localhost: {
    url: "http://127.0.0.1:8545",
  },
}
```

---

## Monitoring & Alerts

### Contract Health Check
```bash
# Daily health check
npx hardhat run scripts/daily-check.ts --network polygon

# Monitor transactions
npx hardhat run scripts/monitor-txs.ts --network polygon

# Check balances
npx hardhat run scripts/check-balances.ts --network polygon
```

### Event Monitoring
```bash
# Tail recent events
npx hardhat run scripts/tail-events.ts --network polygon --follow

# Analyze event patterns
npx hardhat run scripts/analyze-events.ts --network polygon
```

---

## Disaster Recovery

### Backup & Recovery Procedures

1. **Backup Contract State**
   ```bash
   npx hardhat run scripts/backup-state.ts --network polygon
   ```

2. **Export Deployment Info**
   ```bash
   cp deployments/polygon/* backup/deployments/
   ```

3. **Recovery Steps**
   ```bash
   # Restore from backup
   cp backup/deployments/* deployments/polygon/
   
   # Reconnect with new RPC if needed
   npx hardhat deploy --network polygon --reset
   ```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Out of gas** | Increase gas limit in hardhat.config.ts |
| **Contract too large** | Split into libraries or separate contracts |
| **Verification fails** | Check constructor arguments format |
| **Nonce issues** | Clear cache and retry |
| **RPC errors** | Switch to different RPC endpoint |

### Debug Commands
```bash
# Get account nonce
npx hardhat run scripts/get-nonce.ts --network sepolia

# Estimate gas for transaction
npx hardhat run scripts/estimate-gas.ts --network sepolia

# Decode revert reason
npx hardhat run scripts/decode-revert.ts --network sepolia
```

---

## Deployment Checklist

### Before Deployment
- [ ] All tests passing
- [ ] Gas optimization completed
- [ ] Security audit passed
- [ ] Contract verification prepared
- [ ] Roles & permissions configured
- [ ] Emergency pause tested

### During Deployment
- [ ] Monitor deployment progress
- [ ] Verify contract creation
- [ ] Check initial state
- [ ] Log all transaction hashes

### After Deployment
- [ ] Verify contract bytecode
- [ ] Initialize parameters
- [ ] Grant initial roles
- [ ] Run health checks
- [ ] Monitor for 24 hours
- [ ] Document deployment details

---

## Support & Reference

### Useful Commands
```bash
# List all deployed contracts
npx hardhat deployments --network sepolia

# Get contract ABI
npm run abi

# Export deployment JSON
npx hardhat run scripts/export-deployments.ts --network sepolia

# Generate subgraph (for indexing)
npm run generate-subgraph
```

### Documentation Files
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [MODULES.md](./MODULES.md) - Module specifications
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Development plan

### External Resources
- [Hardhat Docs](https://hardhat.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Ethers.js](https://docs.ethers.org/)
- [Solidity Docs](https://docs.soliditylang.org/)

---

**Version:** 1.0.0  
**Last Updated:** Feb 6, 2026  
**Status:** Ready for deployment

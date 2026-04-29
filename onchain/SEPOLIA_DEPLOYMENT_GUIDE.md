# Sepolia Testnet Deployment Guide

## Prerequisites

Before deploying to Sepolia testnet, ensure you have:

1. **Sepolia Testnet ETH**: Get testnet ETH from a faucet
   - https://sepoliafaucet.com/
   - https://www.alchemy.com/faucets/ethereum

2. **Environment Setup**: Configure `.env` file with your credentials
   ```bash
   # .env file configuration
   SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
   PRIVATE_KEY=your_private_key_here  # WITHOUT 0x prefix or with 0x prefix
   ETHERSCAN_API_KEY=your_etherscan_key  # Optional, for contract verification
   ```

3. **Dependencies**: Install all npm packages
   ```bash
   npm install
   ```

## Step-by-Step Deployment

### 1. Verify Compilation
First, ensure all contracts compile without errors:
```bash
npm run compile
```

Expected output:
- All 3 contracts compile successfully
- TypeChain generates 60 typings
- Contract sizes displayed

### 2. Run Full Test Suite
Verify all tests pass on local environment:
```bash
npm run test
```

Expected result: **78/78 tests passing**

### 3. Deploy to Sepolia Testnet
Execute the deployment script:
```bash
npm run deploy:sepolia
```

### 4. Verify Deployment

The script will output:
- VNDCToken contract address
- VNDCStaking contract address
- VNDCTokenVesting contract address
- Deployer account address
- Full configuration JSON

Example output:
```
🚀 Starting VNDC Token deployment...

📝 Deploying contracts with account: 0x...
💰 Account balance: X.XX ETH

📦 Deploying VNDCToken...
✅ VNDCToken deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   Initial Supply: 100000000.0 VNDC

📦 Deploying VNDCStaking...
✅ VNDCStaking deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   Reward Rate: 10% APY
   Min Stake Amount: 100.0 VNDC

📦 Deploying VNDCTokenVesting...
✅ VNDCTokenVesting deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

## Verify Contracts on Etherscan (Optional)

To verify contracts on Etherscan for transparency:

1. **Set ETHERSCAN_API_KEY** in `.env`

2. **Verify VNDCToken**:
```bash
npx hardhat verify --network sepolia <TOKEN_ADDRESS> <INITIAL_SUPPLY>
```

3. **Verify VNDCStaking**:
```bash
npx hardhat verify --network sepolia <STAKING_ADDRESS> <TOKEN_ADDRESS>
```

4. **Verify VNDCTokenVesting**:
```bash
npx hardhat verify --network sepolia <VESTING_ADDRESS> <TOKEN_ADDRESS>
```

## Interact with Deployed Contracts

### Using Ethers.js Script

Create `scripts/interact.ts`:
```typescript
import { ethers } from "hardhat";

async function main() {
  // Replace with your deployed addresses
  const TOKEN_ADDRESS = "0x...";
  const STAKING_ADDRESS = "0x...";
  const VESTING_ADDRESS = "0x...";

  const token = await ethers.getContractAt("VNDCToken", TOKEN_ADDRESS);
  const staking = await ethers.getContractAt("VNDCStaking", STAKING_ADDRESS);
  const vesting = await ethers.getContractAt("VNDCTokenVesting", VESTING_ADDRESS);

  // Check token balance
  const [deployer] = await ethers.getSigners();
  const balance = await token.balanceOf(deployer.address);
  console.log("Token Balance:", ethers.formatEther(balance), "VNDC");

  // Check total staked
  const totalStaked = await staking.totalStaked();
  console.log("Total Staked:", ethers.formatEther(totalStaked), "VNDC");

  // Check vesting schedules count
  const schedulesCount = await vesting.getVestingSchedulesCount();
  console.log("Total Vesting Schedules:", schedulesCount);
}

main().catch(console.error);
```

Run with:
```bash
npx hardhat run scripts/interact.ts --network sepolia
```

### Using Etherscan

1. Navigate to the contract address on Etherscan Sepolia
2. Go to "Read Contract" tab
3. Connect your Web3 wallet
4. Call read functions directly from the interface

### Using Command Line

Query contract state:
```bash
cast call <ADDRESS> "balanceOf(address)" <USER_ADDRESS> --rpc-url <RPC_URL>
```

## Save Deployment Addresses

After successful deployment, save the addresses for future reference:

Create `deployments/sepolia-addresses.json`:
```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "deploymentDate": "2026-04-29",
  "deployer": "0x...",
  "contracts": {
    "VNDCToken": "0x...",
    "VNDCStaking": "0x...",
    "VNDCTokenVesting": "0x..."
  }
}
```

## Troubleshooting

### "Cannot connect to the network"
- Verify SEPOLIA_RPC_URL is correct and accessible
- Check internet connection
- Try using a different RPC provider

### "Insufficient funds for gas"
- Ensure account has Sepolia ETH
- Get more from faucet: https://sepoliafaucet.com/

### "Private key invalid"
- Verify PRIVATE_KEY format in .env
- Remove spaces and ensure no typos
- Can use with or without 0x prefix

### "Contract already deployed"
- Different address = different chain/network
- Check hardhat.config.ts for network settings

## Next Steps After Deployment

1. **Monitor Contract Activity**
   - Check Etherscan for transactions
   - Monitor gas usage

2. **Create Frontend Integration**
   - Use ABI files from `artifacts/`
   - Use TypeChain types from `typechain-types/`
   - Implement Web3 UI

3. **Security Audit**
   - Consider professional security audit
   - Engage with auditing firms

4. **Plan Mainnet Launch**
   - After successful Sepolia testing
   - Deploy to Ethereum mainnet using same procedure

## Useful Commands Reference

```bash
# Compile contracts
npm run compile

# Run all tests
npm run test

# Generate test coverage report
npm run test:coverage

# Deploy to local Hardhat node
npm run deploy:localhost

# Deploy to Sepolia testnet
npm run deploy:sepolia

# Start local Hardhat node
npm run node

# Clean build artifacts
npm run clean

# Verify contract on Etherscan
npx hardhat verify --network sepolia <ADDRESS> <CONSTRUCTOR_ARGS>
```

## Support & Documentation

- Hardhat Docs: https://hardhat.org/docs
- OpenZeppelin Docs: https://docs.openzeppelin.com/contracts/5.x/
- Ethers.js Docs: https://docs.ethers.org/v6/
- Sepolia Faucet: https://sepoliafaucet.com/
- Etherscan Sepolia: https://sepolia.etherscan.io/

---

**Created**: 2026-04-29
**Target Network**: Sepolia Testnet (Chain ID: 11155111)
**Contract Count**: 3 (VNDCToken, VNDCStaking, VNDCTokenVesting)

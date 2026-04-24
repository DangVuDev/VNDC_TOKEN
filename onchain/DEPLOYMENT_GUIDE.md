# 📦 On-Chain Setup & Deployment Guide

## Prerequisites

```bash
# Node.js 16+
node --version

# Install dependencies
cd onchain
npm install
```

## Configuration

### hardhat.config.ts

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY!],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
```

### .env.example

```bash
# RPC Provider
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
# or
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Account to deploy from
PRIVATE_KEY=0x...

# Etherscan API Key (for contract verification)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

## Compilation

```bash
# Compile all contracts
npx hardhat compile

# Clean build
npx hardhat clean
npx hardhat compile
```

## Testing

### Run Tests
```bash
# All tests
npm run test

# Specific test file
npx hardhat test test/VNDCToken.test.ts

# With coverage
npm run test:coverage

# Gas report
REPORT_GAS=true npm run test
```

## Deployment Steps

### 1. Local Testing (Hardhat Network)
```bash
# Terminal 1: Start local network
npx hardhat node

# Terminal 2: Deploy to localhost
npx hardhat run deploy/001_deploy_token.ts --network localhost

# Terminal 3: Run tests
npm run test
```

### 2. Deploy to Sepolia

```bash
# Step 1: Ensure you have testnet ETH
# Get from: https://www.alchemy.com/faucets/ethereum-sepolia

# Step 2: Create .env with PRIVATE_KEY
cp .env.example .env
# Edit .env with your private key

# Step 3: Deploy token
npx hardhat run deploy/001_deploy_token.ts --network sepolia

# Output will show:
# ✓ Token deployed to: 0x...
# ✓ Set contract address in backend .env

# Step 4: Deploy NFT contract
npx hardhat run deploy/002_deploy_nft.ts --network sepolia

# Output will show:
# ✓ NFT deployed to: 0x...
```

### 3. Verify Contracts on Etherscan

```bash
# Verify VNDC Token
npx hardhat verify \
  --network sepolia \
  0xTOKEN_ADDRESS  # Replace with actual address

# Verify NFT Contract
npx hardhat verify \
  --network sepolia \
  0xNFT_ADDRESS
```

## After Deployment

### 1. Get Contract Addresses
```bash
# Output from deployment script shows addresses
# Copy to backend .env:
# - VNDC_TOKEN_ADDRESS=0x...
# - VNDC_NFT_ADDRESS=0x...
```

### 2. Set Relayer Authorization
```javascript
// In Sepolia network
// 1. Go to Etherscan: https://sepolia.etherscan.io
// 2. Search for token contract
// 3. Use Write Contract section

// Call setRelayer(0xRELAYER_ADDRESS)
// Requires contract owner account
```

### 3. Mint Initial Supply (Optional)
```javascript
// Call mint(recipientAddress, amount)
// Owner only

// Example: Mint 1,000,000 tokens
// amount = 1000000n * 10n**18n  // BigInt format
```

## Contract Interaction

### Read From Contract
```bash
npx hardhat run scripts/read-balance.ts --network sepolia
```

### Write to Contract
```bash
npx hardhat run scripts/mint-tokens.ts --network sepolia
```

## Troubleshooting

### "Insufficient funds for gas"
- Get testnet ETH from Sepolia faucet
- Check account balance: `npx hardhat run scripts/check-balance.ts --network sepolia`

### "Contract already deployed"
- Check existing address on Etherscan
- Or deploy with different constructor args

### "Signature validation failed"
- Ensure private key is correct in .env
- Try with test account first

### "Contract verification failed"
- Verify contract source matches deployed bytecode
- Try again after block confirmation
- Check Etherscan API key is valid

## Gas Estimation

```bash
# Estimate gas for deployment
npx hardhat run deploy/001_deploy_token.ts --network sepolia --estimate-gas

# Check gas prices
npx hardhat run scripts/estimate-gas.ts --network sepolia
```

## Monitoring

### Check Deployment Tx
```bash
# Go to Sepolia Etherscan
# https://sepolia.etherscan.io/tx/0xTX_HASH

# Look for "Status: Success"
# Then search for contract address to verify
```

### Check Contract State
```bash
npx hardhat run scripts/check-contract.ts --network sepolia
```

## Upgrading Contracts

⚠️ Warning: ERC20 contracts cannot be upgraded without UUPS proxy.

For production:
1. Deploy with UUPS Proxy (OpenZeppelin)
2. New implementation can be deployed
3. Proxy can be upgraded to new implementation

See [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)

## Security Before Production

- [ ] Contracts audited by security firm
- [ ] All tests passing
- [ ] No console.log() in production code
- [ ] Private key never committed to git
- [ ] Contract verified on Etherscan
- [ ] Owner address is secure multisig
- [ ] Initialization is done (setRelayer, etc.)

## Useful Commands

```bash
# Clean everything
npm run clean

# Compile only
npm run compile

# Run linter
npm run lint

# Format code
npm run format

# Check types
npx tsc --noEmit

# Get accounts
npx hardhat accounts

# Get block number
npx hardhat run scripts/get-block.ts --network sepolia
```

---

**Next**: Backend setup and integration

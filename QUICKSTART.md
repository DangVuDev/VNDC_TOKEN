# QUICK START GUIDE - VNDC DApp

## 🚀 Bắt Đầu Nhanh (5 Phút)

### 1. Chuẩn Bị

```bash
# Clone repository
git clone <repo>
cd d:\Blockchain\VNDC

# Cài đặt dependencies
npm install

# Copy environment file
copy .env.example .env
```

### 2. Setup .env

Mở `.env` và cấu hình:

```env
# Chọn network
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
PRIVATE_KEY=your_private_key_here (testnet only!)
```

### 3. Deploy Contracts

```bash
# Deploy to Mumbai Testnet
npx hardhat run scripts/deploy.js --network mumbai

# Output:
# ✅ VNDC_Token deployed to: 0x...
# ✅ VNDC_Credential deployed to: 0x...
# ...
```

### 4. Setup Roles

```bash
npx hardhat run scripts/setup-roles.js --network mumbai
```

✅ **Xong! Contracts đã sẵn sàng.**

---

## 📚 Tài Liệu Chi Tiết

### Cho Developer

| Tài Liệu | Mục Đích | Thời Gian |
|----------|---------|----------|
| [contracts/README.md](README.md) | Hướng dẫn chi tiết contracts | 30 phút |
| [apps/01-credential-verification/README.md](../apps/01-credential-verification/README.md) | App #1: Xác thực Diploma | 60 phút |

### Cho PM/Architect

| Tài Liệu | Mục Đích | Thời Gian |
|----------|---------|----------|
| [OVERVIEW.md](../OVERVIEW.md) | System overview | 20 phút |
| [VNDC-DApp-Development-Specification.md](../VNDC-DApp-Development-Specification.md) | Complete spec | 90 phút |

### Cho Thesis Defense

| Tài Liệu | Slides |
|----------|--------|
| [OVERVIEW.md](../OVERVIEW.md) | 1-10 |
| [contracts/README.md](README.md) | 11-20 |
| [apps/01-credential-verification/README.md](../apps/01-credential-verification/README.md) | 21-40 |

---

## 🔧 Các Lệnh Thường Dùng

```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Check gas usage
npm run test:gas

# Code coverage
npm run coverage

# Deploy to testnet
npm run deploy:mumbai

# Deploy to mainnet
npm run deploy:polygon

# Verify contract on PolygonScan
npx hardhat verify --network mumbai 0xAddress arg1 arg2...
```

---

## 📋 Project Structure

```
d:\Blockchain\VNDC\
├── contracts/
│   ├── VNDC_Token.sol           # ERC-20 Token
│   ├── VNDC_Credential.sol       # ERC-721 Credentials
│   ├── VNDC_Rewards.sol          # Reward Distribution
│   ├── VNDC_Payments.sol         # Payment System
│   ├── VNDC_Governance.sol       # DAO Voting
│   └── README.md                 # Contract Guide
│
├── scripts/
│   ├── deploy.js                 # Main deployment
│   └── setup-roles.js            # Role setup
│
├── test/                         # Test files (coming)
├── artifacts/                    # Compiled contracts
├── hardhat.config.js             # Hardhat configuration
├── package.json                  # Dependencies
└── .env                          # Environment variables
```

---

## 🌐 Supported Networks

| Network | Chain ID | Status | Usage |
|---------|----------|--------|-------|
| **Polygon Mumbai** | 80001 | ✅ Active | Development/Testing |
| **Polygon** | 137 | ✅ Ready | Mainnet (Production) |
| **Sepolia** | 11155111 | ✅ Ready | Ethereum Testnet |
| **BSC** | 56 | ✅ Ready | Binance Smart Chain |

---

## ⚙️ Configuration

### Network Configuration

**Mumbai Testnet** (Default):
```javascript
{
  url: "https://rpc-mumbai.maticvigil.com",
  chainId: 80001,
  gasPrice: 35000000000 // 35 Gwei
}
```

**Polygon Mainnet**:
```javascript
{
  url: "https://polygon-rpc.com",
  chainId: 137,
  gasPrice: "auto"
}
```

### Gas Settings

```javascript
// In hardhat.config.js
solidity: {
  settings: {
    optimizer: {
      enabled: true,
      runs: 200  // Balance between size and performance
    }
  }
}
```

---

## 📝 Smart Contracts Overview

### 1️⃣ VNDC_Token (ERC-20)
- **Purpose**: Base currency for ecosystem
- **Supply**: 1B initial, 10B max
- **Features**: Minting, Burning, Snapshots, Pausing
- **Gas**: ~150k deployment

### 2️⃣ VNDC_Credential (ERC-721)
- **Purpose**: NFT diplomas/credentials
- **Type**: Soulbound (non-transferable)
- **Features**: Issue, Revoke, Verify, Metadata
- **Gas**: ~200k deployment

### 3️⃣ VNDC_Rewards
- **Purpose**: Automated reward distribution
- **Features**: Rules, GPA-based, Claim management
- **Gas**: ~180k deployment

### 4️⃣ VNDC_Payments
- **Purpose**: Tuition & payment settlement
- **Features**: Merchants, Batching, Settlement
- **Gas**: ~220k deployment

### 5️⃣ VNDC_Governance
- **Purpose**: DAO voting with token weighting
- **Features**: Proposals, Voting, Execution
- **Gas**: ~300k deployment

---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test
```bash
npx hardhat test test/VNDC_Token.test.js
```

### With Gas Report
```bash
REPORT_GAS=true npm test
```

### Code Coverage
```bash
npm run coverage
```

Expected coverage: >90%

---

## ✅ Pre-Deployment Checklist

- [ ] All tests passing (npm test)
- [ ] Code coverage >90%
- [ ] Gas optimization reviewed
- [ ] .env configured correctly
- [ ] Private key is for testnet only
- [ ] Contracts compiled (npm run compile)
- [ ] RPC endpoint responding

---

## 🚨 Troubleshooting

### Problem: "Contract not found"
```bash
# Solution: Compile first
npm run compile
```

### Problem: "Insufficient funds"
```bash
# Solution: Get testnet MATIC from faucet
# Polygon Mumbai Faucet: https://faucet.polygon.technology/
```

### Problem: "Network error"
```bash
# Solution: Check RPC URL and internet connection
npx hardhat test --network hardhat
```

### Problem: "Gas limit exceeded"
```bash
# Solution: Reduce batch size or optimize contract
# Batch size max: 100 in batchIssueCredentials, etc.
```

---

## 📚 Learning Resources

- **OpenZeppelin Docs**: https://docs.openzeppelin.com
- **Solidity Docs**: https://docs.soliditylang.org
- **Hardhat Guide**: https://hardhat.org/docs
- **Polygon Docs**: https://polygon.technology/developers
- **ERC Standards**:
  - ERC-20: https://eips.ethereum.org/EIPS/eip-20
  - ERC-721: https://eips.ethereum.org/EIPS/eip-721
  - ERC-1155: https://eips.ethereum.org/EIPS/eip-1155

---

## 🔐 Security Best Practices

1. **Never commit .env with real private keys**
   - Use .env.example as template
   - Add .env to .gitignore

2. **Use testnet keys only for development**
   - Keep mainnet keys in hardware wallet
   - Never paste private keys

3. **Verify contracts on PolygonScan**
   ```bash
   npx hardhat verify --network polygon 0xAddress
   ```

4. **Test thoroughly before mainnet**
   - Deploy to testnet first
   - Run full test suite
   - Get security audit for mainnet

---

## 📊 Deployment Checklist

### Before Deployment
- [ ] Test all functions
- [ ] Review contract code
- [ ] Check gas prices
- [ ] Verify network is correct
- [ ] Backup private key

### During Deployment
- [ ] Monitor transaction status
- [ ] Record contract addresses
- [ ] Save deployment file

### After Deployment
- [ ] Verify contracts on explorer
- [ ] Setup roles
- [ ] Fund reward pool
- [ ] Test deployed contracts

---

## 💾 Saving Deployment Addresses

Deployment script automatically saves addresses to:
```
deployments/{network}.json
```

Example:
```json
{
  "VNDC_Token": "0x...",
  "VNDC_Credential": "0x...",
  "VNDC_Rewards": "0x...",
  "VNDC_Payments": "0x...",
  "VNDC_Governance": "0x..."
}
```

---

## 🎯 Next Steps

1. ✅ Setup & Deploy Contracts
2. 📝 Implement Backend APIs
3. 🎨 Build Frontend UI
4. 🧪 Full Integration Testing
5. 📊 Deploy to Mainnet

---

## 📞 Support

For questions:
1. Check [contracts/README.md](README.md)
2. Review [OVERVIEW.md](../OVERVIEW.md)
3. Study [apps/01-credential-verification/README.md](../apps/01-credential-verification/README.md)

---

**Happy Coding! 🚀**

Last Updated: 2024
Version: 1.0.0

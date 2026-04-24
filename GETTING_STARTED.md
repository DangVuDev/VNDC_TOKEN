# VNDC Project - Quick Start Guide

## 🚀 What You Have

A completely restructured VNDC project with:

```
✅ Organized Documentation (docs/)
   - System architecture & design
   - API specifications
   - Authentication & security guides
   - Module documentation

✅ On-Chain Layer (onchain/)
   - Smart contract templates
   - Test structure
   - Deployment scripts

✅ Off-Chain Layer (offchain/)
   - Golang backend structure
   - MongoDB schema definitions
   - Configuration templates

✅ Infrastructure
   - Docker Compose for local development
   - Environment file templates
   - Implementation roadmap
```

## 📖 Where to Start

### 1️⃣ Read the Architecture (5 min)
```bash
cd d:\Blockchain\VNDC
cat README.md
cat docs/architecture/SYSTEM_ARCHITECTURE.md
```

### 2️⃣ Understand the Key Concept (5 min)
```bash
cat docs/architecture/DUAL_LAYER_BALANCE.md
```

### 3️⃣ Check Quick Reference (2 min)
```bash
cat QUICK_REFERENCE.md
```

### 4️⃣ Choose Your Path

#### Path A: Build Smart Contracts First
```bash
cd onchain
cat DEPLOYMENT_GUIDE.md
# Follow: Prerequisites → Configuration → Testing → Deployment
```

#### Path B: Build Backend First
```bash
cd offchain/backend-go
cat SETUP_GUIDE.md
# Follow: Prerequisites → Project Setup → Running
```

## 🛠️ Quick Setup (Local Development)

### Option 1: Docker Compose (Recommended)
```bash
cd d:\Blockchain\VNDC

# Start all services
docker-compose up -d

# Check services
docker-compose ps

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

### Option 2: Manual Setup

#### Setup MongoDB
```bash
# Install MongoDB
# https://docs.mongodb.com/manual/installation/

# Start MongoDB
mongod

# Initialize database
mongo vndc_db < offchain/backend-mongodb/migrations/001_init_collections.js
```

#### Setup Redis
```bash
# Install Redis
# https://redis.io/download

# Start Redis
redis-server
```

#### Setup Blockchain
```bash
cd onchain
npm install

# Start local Hardhat node
npx hardhat node
```

#### Setup Backend
```bash
cd offchain/backend-go
cp .env.example .env
# Edit .env with your values
go run cmd/main.go
```

## 📡 Testing the Setup

### 1. Check Backend Health
```bash
curl http://localhost:8080/health
```

### 2. Get User Nonce
```bash
curl http://localhost:8080/api/v1/nonce/0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb
```

### 3. Check Balance
```bash
curl http://localhost:8080/api/v1/balance/0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb
```

## 📚 Documentation Structure

| File | Purpose | Read Time |
|------|---------|-----------|
| README.md | Project overview | 2 min |
| PROJECT_STRUCTURE.md | Directory guide | 3 min |
| docs/architecture/SYSTEM_ARCHITECTURE.md | How system works | 10 min |
| docs/architecture/DUAL_LAYER_BALANCE.md | Balance logic | 8 min |
| docs/auth/AUTH_SYSTEM.md | EIP-712 signing | 10 min |
| docs/api/API_SPECIFICATION.md | All API endpoints | 8 min |
| docs/security/SECURITY.md | Best practices | 10 min |
| docs/modules/TOKEN_MODULE.md | Token contract | 5 min |
| docs/modules/NFT_MODULE.md | NFT contract | 5 min |
| QUICK_REFERENCE.md | Command reference | 3 min |
| IMPLEMENTATION_ROADMAP.md | Development plan | 5 min |

## 🎯 Implementation Phase

### Phase 1: Setup Foundation
- [ ] Clone repo (✅ Done)
- [ ] Read architecture documentation
- [ ] Setup local environment (Docker or manual)
- [ ] Verify all services running

### Phase 2: Smart Contracts
- [ ] Implement VNDCToken.sol (ERC20 + EIP-712)
- [ ] Implement VNDCNFTs.sol (ERC1155)
- [ ] Write unit tests
- [ ] Deploy to Sepolia testnet

### Phase 3: Backend API
- [ ] Implement transaction handler
- [ ] Implement balance service
- [ ] Implement signature verification
- [ ] Implement workers (batch, sync)
- [ ] Write tests

### Phase 4: Integration & Testing
- [ ] End-to-end testing
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization

### Phase 5: Production
- [ ] Deploy to staging
- [ ] Final testing
- [ ] Deploy to production
- [ ] Monitor

## 🔗 Key Modules

### On-Chain (Token & NFT)
- Only 2 modules for blockchain:
  1. **Token (ERC20)**: VNDC Token with meta-transaction support
  2. **NFT (ERC1155)**: Certificates, badges, achievements

### Off-Chain (Golang Backend)
- **Transaction Handler**: Receive & validate transfers
- **Transaction Service**: Queue & manage transactions
- **Balance Service**: Track on-chain & pending amounts
- **Batch Worker**: Collect & settle batches
- **Sync Worker**: Sync balance from blockchain

### Cache & Database
- **Redis**: Fast cache for balance, nonce
- **MongoDB**: Persistent storage for transactions, batches

## 💡 Key Concepts

### 1. Dual-Layer Balance
```
On-chain = Real balance on blockchain
Pending = Transactions waiting to settle
Available = On-chain - Pending (can transact)
```

### 2. EIP-712 Signatures
```
User signs offline → Relayer holds signature
Relayer batches signatures → Submits to Smart Contract
Smart Contract verifies signature → Executes transfer
```

### 3. Atomic Operations
```
Redis Lua scripts = No race conditions
Check-and-update in single operation
Prevents double spending
```

## 🚨 Before You Code

### ✅ Checklist
- [ ] Understand SYSTEM_ARCHITECTURE.md
- [ ] Understand DUAL_LAYER_BALANCE.md
- [ ] Understand QUICK_REFERENCE.md
- [ ] Environment set up (Docker or local)
- [ ] All services running & healthy
- [ ] Databases initialized

### 📌 Important
- **Never commit .env files** with real private keys
- **Use test accounts** for development
- **Follow the roadmap** phases in order
- **Write tests** alongside implementation
- **Review security.md** before production

## 🆘 Troubleshooting

### "MongoDB Connection Error"
```bash
# Check MongoDB is running
mongo --version

# Start MongoDB
mongod

# Check connection
mongosh localhost:27017
```

### "Redis Connection Error"
```bash
# Check Redis is running
redis-cli ping

# Should output: PONG

# Start Redis
redis-server
```

### "Backend Health Check Failed"
```bash
# Check logs
docker-compose logs backend

# Or if running locally
go run cmd/main.go  # Check output
```

## 📞 Quick Links

- 📖 [Hardhat Documentation](https://hardhat.org/)
- 🔐 [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- 💾 [MongoDB Go Driver](https://pkg.go.dev/go.mongodb.org/mongo-driver)
- 🚀 [Gin Web Framework](https://gin-gonic.com/)
- 🔧 [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

## 🎓 Next Steps

1. **Read**: SYSTEM_ARCHITECTURE.md (understand the big picture)
2. **Read**: DUAL_LAYER_BALANCE.md (understand the core logic)
3. **Setup**: Local environment
4. **Code**: Follow IMPLEMENTATION_ROADMAP.md

---

**Version**: 1.0
**Last Updated**: 2024-01-02
**Status**: ✅ Ready for Development

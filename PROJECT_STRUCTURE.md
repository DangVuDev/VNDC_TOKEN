# 📋 Project Structure Overview

## Directory Layout

```
VNDC/
│
├── README.md                              # Project overview
│
├── docs/                                  # 📚 DOCUMENTATION
│   ├── README.md                          # Navigation guide
│   ├── architecture/
│   │   ├── SYSTEM_ARCHITECTURE.md        # High-level system design
│   │   └── DUAL_LAYER_BALANCE.md         # Balance logic explanation
│   ├── auth/
│   │   └── AUTH_SYSTEM.md                # EIP-712 authentication
│   ├── security/
│   │   └── SECURITY.md                   # Security best practices
│   ├── api/
│   │   └── API_SPECIFICATION.md          # API endpoints & examples
│   └── modules/
│       ├── TOKEN_MODULE.md               # VNDC ERC20 token
│       └── NFT_MODULE.md                 # NFT (ERC1155)
│
├── onchain/                              # ⛓️ BLOCKCHAIN LAYER
│   ├── README.md
│   ├── hardhat.config.ts                 # Hardhat configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── contracts/
│   │   ├── token/
│   │   │   └── VNDCToken.sol            # ERC20 Token contract
│   │   └── nft/
│   │       └── VNDCNFTs.sol             # ERC1155 NFT contract
│   ├── test/
│   │   ├── VNDCToken.test.ts            # Token tests
│   │   └── VNDCNFTs.test.ts             # NFT tests
│   └── deploy/
│       ├── 001_deploy_token.ts          # Token deployment
│       └── 002_deploy_nft.ts            # NFT deployment
│
└── offchain/                             # 🖥️ BACKEND LAYER
    │
    ├── backend-go/                       # Golang Relayer Backend
    │   ├── README.md
    │   ├── go.mod
    │   ├── go.sum
    │   ├── .env.example
    │   │
    │   ├── cmd/
    │   │   └── main.go                  # Entry point
    │   │
    │   ├── internal/
    │   │   ├── handlers/
    │   │   │   ├── transfer.go          # POST /api/v1/transfer
    │   │   │   ├── balance.go           # GET /api/v1/balance/:wallet
    │   │   │   ├── history.go           # GET /api/v1/history
    │   │   │   ├── batch.go             # GET /api/v1/batch/:id
    │   │   │   └── nonce.go             # GET /api/v1/nonce/:wallet
    │   │   │
    │   │   ├── services/
    │   │   │   ├── transaction_service.go   # Transaction logic
    │   │   │   ├── balance_service.go      # Balance management
    │   │   │   ├── signature_service.go    # EIP-712 verification
    │   │   │   └── nft_service.go          # NFT operations
    │   │   │
    │   │   ├── models/
    │   │   │   ├── transaction.go       # Transaction struct
    │   │   │   ├── batch.go             # Batch struct
    │   │   │   ├── user.go              # User struct
    │   │   │   └── nft.go               # NFT struct
    │   │   │
    │   │   ├── workers/
    │   │   │   ├── batch_worker.go      # Batch settlement worker
    │   │   │   ├── sync_worker.go       # Balance sync worker
    │   │   │   └── monitor_worker.go    # Health monitoring
    │   │   │
    │   │   ├── database/
    │   │   │   └── mongodb.go           # MongoDB client & setup
    │   │   │
    │   │   ├── cache/
    │   │   │   └── redis.go             # Redis client & operations
    │   │   │
    │   │   └── blockchain/
    │   │       └── contract_client.go   # Contract interaction
    │   │
    │   ├── config/
    │   │   └── config.go                # Configuration management
    │   │
    │   └── tests/
    │       ├── transaction_test.go      # Unit tests
    │       ├── balance_test.go
    │       └── integration_test.go      # Integration tests
    │
    └── backend-mongodb/                  # MongoDB Configuration
        ├── MONGODB_SETUP.md             # Setup & schema
        ├── schemas/
        │   ├── transactions_queue.js    # Collection schemas
        │   ├── batches.js
        │   ├── users_balance.js
        │   └── nfts.js
        └── migrations/
            ├── 001_init_collections.js
            └── 002_create_indexes.js

```

## File Purpose Guide

### Documentation (docs/)
- **SYSTEM_ARCHITECTURE.md**: Entire system design, 3 layers, data flow
- **DUAL_LAYER_BALANCE.md**: Understanding balance calculation & race conditions
- **AUTH_SYSTEM.md**: How EIP-712 signing & verification works
- **SECURITY.md**: Security best practices for contract & backend
- **API_SPECIFICATION.md**: All API endpoints with examples
- **TOKEN_MODULE.md**: VNDC token implementation details
- **NFT_MODULE.md**: NFT contract & integration

### Smart Contracts (onchain/)
- **VNDCToken.sol**: ERC20 token with EIP-712 support
- **VNDCNFTs.sol**: ERC1155 contract for certificates & badges
- **Tests**: Unit tests for all contracts
- **Deployment**: Scripts to deploy to different networks

### Backend Services (offchain/backend-go/)
- **handlers/**: HTTP request handlers (REST endpoints)
- **services/**: Business logic (transaction validation, balance management)
- **models/**: Data structures (mirrors MongoDB docs + smart contract data)
- **workers/**: Background jobs (batch settlement, balance sync)
- **database/**: MongoDB connection & queries
- **cache/**: Redis operations (balance cache, nonce tracking)
- **blockchain/**: Interaction with smart contracts

### Database (offchain/backend-mongodb/)
- **schemas/**: MongoDB collection definitions & validations
- **migrations/**: Database initialization scripts

## Key Design Principles

1. **Separation of Concerns**
   - On-chain = immutable ledger
   - Off-chain = fast processing
   - Cache = availability

2. **Dual Balance**
   - On-chain = source of truth
   - Pending = transactions in queue
   - Available = can transact now

3. **Atomic Operations**
   - Redis Lua scripts = atomic check-and-update
   - Batching = minimize blockchain calls
   - Nonce = prevent replay attacks

4. **Error Handling**
   - Smart contract revert = rollback Redis
   - MongoDB transaction = consistency
   - Retry logic = resilience

## Development Workflow

### 1. Smart Contracts
```bash
cd onchain
npm install
npm run compile
npm run test
npm run deploy:sepolia
```

### 2. Backend Setup
```bash
cd offchain/backend-go
go mod download
cp .env.example .env
# Edit .env with your secrets
```

### 3. Database Setup
```bash
cd offchain/backend-mongodb
# Follow MONGODB_SETUP.md
# Run migrations
# Seed test data
```

### 4. Start Services
```bash
# Terminal 1: Backend
cd offchain/backend-go
go run cmd/main.go

# Terminal 2: Tests
go test ./...

# Terminal 3: Monitor
tail -f logs/app.log
```

## Environment Variables

**onchain/.env**:
```
PRIVATE_KEY=0x...              # Deployer account
SEPOLIA_RPC_URL=https://...    # RPC endpoint
ETHERSCAN_API_KEY=...          # For verification
```

**offchain/backend-go/.env**:
```
PORT=8080
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
CONTRACT_ADDRESS=0x...         # VNDC Token address
RELAYER_ADDRESS=0x...          # Relayer wallet
RELAYER_PRIVATE_KEY=0x...      # For settlement txs
ETH_RPC_URL=https://...
CHAIN_ID=11155111              # Sepolia
```

---

**Next Step**: Choose which component to start with (Smart Contracts or Backend)

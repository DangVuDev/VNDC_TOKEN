# 🖥️ Backend (Golang) Setup Guide

## Prerequisites

### Install Go 1.20+
```bash
# Check version
go version  # Should be 1.20 or higher

# Download from: https://golang.org/dl/
```

### Install Dependencies
```bash
# MongoDB
# Local: https://docs.mongodb.com/manual/installation/
# Cloud: https://www.mongodb.com/cloud/atlas

# Redis
# Local: https://redis.io/download
# Cloud: https://redis.com/cloud/

# Or use Docker
docker-compose up -d  # See docker-compose.yml
```

## Project Setup

### 1. Initialize Go Module
```bash
cd offchain/backend-go

# Initialize if not exists
go mod init github.com/your-org/vndc-backend

# Download dependencies
go mod download
go mod tidy
```

### 2. Create .env File
```bash
cp .env.example .env

# Edit .env with your configuration
# See .env.example for all options
```

### 3. Project Structure
```
backend-go/
├── cmd/
│   └── main.go                    # Entry point
├── internal/
│   ├── handlers/                  # HTTP handlers
│   ├── services/                  # Business logic
│   ├── models/                    # Data structures
│   ├── workers/                   # Background jobs
│   ├── database/                  # MongoDB
│   ├── cache/                     # Redis
│   └── blockchain/                # Contract interaction
├── config/
│   └── config.go                  # Configuration
├── tests/
│   ├── unit_test.go
│   └── integration_test.go
├── go.mod
├── go.sum
├── .env.example
└── Dockerfile
```

## Development Setup

### 1. Install Go Tools
```bash
# Linter
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Testing
go install gotest.tools/gotestsum@latest

# Build tools
go install golang.org/x/tools/cmd/goimports@latest
```

### 2. VSCode Extensions (Recommended)
- Go (golang.go)
- REST Client
- MongoDB for VS Code

### 3. Create .vscode/launch.json
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Connect to Program",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${workspaceFolder}/offchain/backend-go/cmd/main.go",
      "env": {},
      "args": []
    }
  ]
}
```

## Running the Backend

### Option 1: Direct Run
```bash
cd offchain/backend-go

# Run
go run cmd/main.go

# Output should show:
# ✓ Connecting to MongoDB...
# ✓ Connecting to Redis...
# ✓ Starting HTTP server on :8080
# ✓ Starting batch worker...
# ✓ Starting balance sync worker...
```

### Option 2: Build & Run
```bash
# Build
go build -o vndc-backend cmd/main.go

# Run
./vndc-backend

# Or
make run
```

### Option 3: Docker
```bash
# Build image
docker build -t vndc-backend .

# Run container
docker run \
  --env-file .env \
  --network vndc-network \
  -p 8080:8080 \
  vndc-backend

# Or use docker-compose
docker-compose up vndc-backend
```

## Testing

### Unit Tests
```bash
# Run all tests
go test ./...

# Verbose
go test -v ./...

# Specific package
go test ./internal/services -v

# With coverage
go test -cover ./...

# Coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Integration Tests
```bash
# Run with real MongoDB & Redis
go test -v ./tests/integration -tags=integration
```

### Load Testing
```bash
# Use tools like:
# - ab (Apache Bench)
# - wrk
# - hey

# Example
hey -n 1000 -c 100 http://localhost:8080/api/v1/balance/0x...
```

## Configuration

### .env File
```bash
# Server
PORT=8080
ENV=development  # development | staging | production

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=vndc_db
MONGODB_USER=vndc_app
MONGODB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Smart Contract
CONTRACT_ADDRESS=0x...
CONTRACT_ABI_PATH=./abi/VNDCToken.json

# Blockchain
ETH_RPC_URL=https://sepolia.infura.io/v3/KEY
CHAIN_ID=11155111

# Relayer
RELAYER_ADDRESS=0x...
RELAYER_PRIVATE_KEY=0x...

# Logging
LOG_LEVEL=info          # debug | info | warn | error
LOG_FILE=./logs/app.log

# Batch Settings
BATCH_TIMEOUT=300s      # 5 minutes
BATCH_SIZE=10           # Transactions per batch

# Sync Settings
SYNC_INTERVAL=600s      # 10 minutes

# Rate Limiting
RATE_LIMIT=100          # Requests per minute per user
```

## Directory Descriptions

### cmd/
- **main.go**: Entry point, initializes server and workers

### internal/handlers/
- **transfer.go**: POST /api/v1/transfer
- **balance.go**: GET /api/v1/balance/:wallet
- **history.go**: GET /api/v1/history
- **batch.go**: GET /api/v1/batch/:id
- **nonce.go**: GET /api/v1/nonce/:wallet

### internal/services/
- **transaction_service.go**: Queue & validate transactions
- **balance_service.go**: Calculate available balance
- **signature_service.go**: Verify EIP-712 signatures
- **nft_service.go**: Mint & manage NFTs

### internal/models/
- Data structures for database & API

### internal/workers/
- **batch_worker.go**: Collect & settle batches
- **sync_worker.go**: Sync balance from blockchain
- **monitor_worker.go**: Health checks & alerts

### internal/database/
- MongoDB connection & queries

### internal/cache/
- Redis operations (balance cache, nonce tracking)

### internal/blockchain/
- Contract interaction via ethers.go or go-ethereum

## Building for Production

```bash
# Build optimized binary
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags="-w -s" \
  -o vndc-backend \
  cmd/main.go

# Check binary size
ls -lh vndc-backend

# Expected: ~20-30MB
```

## Deployment

### Linux/Ubuntu
```bash
# Create systemd service
sudo nano /etc/systemd/system/vndc-backend.service

# Add:
[Unit]
Description=VNDC Backend
After=network.target

[Service]
Type=simple
User=vndc
ExecStart=/path/to/vndc-backend
Restart=on-failure
Environment="PATH=/usr/local/go/bin"

[Install]
WantedBy=multi-user.target

# Enable & start
sudo systemctl enable vndc-backend
sudo systemctl start vndc-backend

# Monitor
sudo systemctl status vndc-backend
sudo journalctl -u vndc-backend -f
```

### Docker Compose
```yaml
# See docker-compose.yml in root
docker-compose up -d vndc-backend

# View logs
docker-compose logs -f vndc-backend

# Stop
docker-compose down
```

## Debugging

### Enable Debug Logging
```go
// In config.go
LOG_LEVEL=debug

// Or set at runtime
export LOG_LEVEL=debug
go run cmd/main.go
```

### Pprof Profiling
```go
// Add to main.go
import _ "net/http/pprof"

go func() {
  log.Println(http.ListenAndServe("localhost:6060", nil))
}()
```

Then:
```bash
# Check CPU profile
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Check memory
go tool pprof http://localhost:6060/debug/pprof/heap

# View all profiles
curl http://localhost:6060/debug/pprof/
```

### Common Issues

**"Connection refused" (MongoDB)**
- Check MongoDB is running: `mongosh`
- Check MONGODB_URI in .env
- Check database credentials

**"Connection refused" (Redis)**
- Check Redis is running: `redis-cli ping`
- Check REDIS_URL in .env

**"Invalid signature"**
- Check EIP-712 domain matches contract
- Check signature format (0x + 130 chars)

**"Slow queries"**
- Check MongoDB indexes: `db.transactions_queue.getIndexes()`
- Enable query logging: `LOG_LEVEL=debug`

## Monitoring & Observability

### Metrics (Optional: Prometheus)
```go
import "github.com/prometheus/client_golang/prometheus"

// Track key metrics:
// - Transaction count per second
// - Batch settlement success rate
// - Average transaction latency
// - Balance sync frequency
```

### Logging (Recommended: Structured)
```go
import "go.uber.org/zap"

logger, _ := zap.NewProduction()
logger.Info("Transaction received", zap.String("from", from), zap.String("amount", amount))
```

### Health Check Endpoint
```bash
GET /health

Response: { "status": "healthy", "uptime": 3600 }
```

---

**Next**: Start the backend and test with curl commands

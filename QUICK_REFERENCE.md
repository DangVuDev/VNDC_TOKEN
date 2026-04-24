# 🚀 Quick Reference Guide

## Core Concepts

### 1. Triple Balance System
```
On-chain Balance (100 VNDC)
    ↓
Minus Pending (30 VNDC)
    ↓
= Available (70 VNDC)

Rule: Can only transfer if Amount ≤ Available
```

### 2. Transaction Lifecycle
```
1. PENDING    → User submits signature
2. PROCESSING → Batch worker picks it up
3. SUCCESS    → Smart contract confirms
   OR
   FAILED     → Contract reverted, rollback Redis
```

### 3. Nonce Protection
```
Each user has a nonce counter
├─ Prevents replay attacks
├─ Ensures order of transactions
└─ Incremented after each success
```

## Common Tasks

### Deploy to Sepolia
```bash
cd onchain
npx hardhat run deploy/001_deploy_token.ts --network sepolia
```

### Check User Balance
```bash
curl http://localhost:8080/api/v1/balance/0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb
```

### Submit Transfer
```bash
curl -X POST http://localhost:8080/api/v1/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x742d...",
    "to": "0x8ba1...",
    "amount": "1000000000000000000",
    "signature": "0x...",
    "nonce": 5
  }'
```

### Monitor Pending Transactions
```bash
# In MongoDB
db.transactions_queue.find({ status: "PENDING" }).pretty()

# Count by status
db.transactions_queue.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])
```

### Sync Balance from Blockchain
```bash
curl -X POST http://localhost:8080/api/v1/admin/sync-balance \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"wallet": "0x..."}'
```

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| INVALID_SIGNATURE | Signature doesn't match | Check EIP-712 domain & types |
| INSUFFICIENT_BALANCE | Available balance too low | Wait for pending txs to settle |
| INVALID_NONCE | Nonce is wrong | Get latest nonce from /api/v1/nonce/:wallet |
| WALLET_NOT_FOUND | Address not in system | Create account first |
| RATE_LIMIT | Too many requests | Wait or upgrade limits |

## Performance Tuning

### Batch Timing
```go
// Current: 5 minutes or 10 transactions
// Adjust in workers/batch_worker.go
const (
  BATCH_TIMEOUT = 5 * time.Minute
  BATCH_SIZE    = 10  // Increase for higher throughput
)
```

### Redis Optimization
```go
// Connection pool
redis.Options{
  PoolSize: 100,  // Default, increase if needed
  MaxRetries: 3,
}
```

### MongoDB Indexing
```javascript
// For high-volume queries, ensure indexes exist
db.transactions_queue.getIndexes()

// Create if missing
db.transactions_queue.createIndex({ status: 1, created_at: -1 })
```

## Testing

### Unit Tests
```bash
cd offchain/backend-go
go test ./internal/services -v
go test ./internal/handlers -v
```

### Integration Tests
```bash
go test ./tests/integration -v
```

### Contract Tests
```bash
cd onchain
npm run test
npm run test:gas  # Check gas usage
```

## Monitoring Checklist

- [ ] Backend logs show no errors
- [ ] Batch worker runs every 5 minutes
- [ ] On-chain balance syncs every 10 minutes
- [ ] No transactions stuck in PENDING > 30 min
- [ ] Redis and MongoDB connectivity stable
- [ ] API response time < 500ms
- [ ] Block confirmations >= 12 for settlement

## Debugging Tips

### Backend logs
```bash
tail -f logs/app.log | grep -i error
```

### Check Redis cache
```bash
redis-cli
> KEYS balance:*
> GET balance:0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb
```

### Monitor batch processing
```bash
watch -n 1 'curl -s http://localhost:8080/api/v1/history | jq ".transactions | length"'
```

### Verify contract state
```bash
npx hardhat run scripts/verify-contract.ts --network sepolia
```

## Security Checklist

- [ ] Relayer private key in .env (not in code)
- [ ] MongoDB user has limited permissions
- [ ] Redis requires password
- [ ] HTTPS enabled in production
- [ ] Rate limiting active
- [ ] Admin endpoints protected with JWT
- [ ] Contract verified on Etherscan
- [ ] No console.log() in production code

## Useful Links

- [Hardhat Docs](https://hardhat.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Solidity EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [MongoDB Go Driver](https://pkg.go.dev/go.mongodb.org/mongo-driver)
- [Redis Go Client](https://pkg.go.dev/github.com/redis/go-redis)
- [Gin Web Framework](https://gin-gonic.com/)

---

**Quick Start**: Read README.md → SYSTEM_ARCHITECTURE.md → Deploy contract → Start backend

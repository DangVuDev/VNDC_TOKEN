# 🔒 Security Guidelines & Best Practices

## 1. Smart Contract Security

### A. Reentrancy Prevention
```solidity
// ❌ WRONG - Vulnerable to reentrancy
function withdraw(uint amount) public {
  require(balances[msg.sender] >= amount);
  (bool success, ) = msg.sender.call{value: amount}("");
  require(success);
  balances[msg.sender] -= amount;  // ← Updated AFTER transfer
}

// ✅ CORRECT - Checks-Effects-Interactions pattern
function withdraw(uint amount) public {
  require(balances[msg.sender] >= amount);
  balances[msg.sender] -= amount;  // ← Update FIRST
  (bool success, ) = msg.sender.call{value: amount}("");
  require(success);
}
```

### B. Integer Overflow/Underflow
```solidity
// ✅ Use Solidity 0.8.0+ (automatic overflow checks)
pragma solidity ^0.8.0;

// Or use SafeMath
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
using SafeMath for uint256;

uint256 result = a.add(b);  // Reverts if overflow
```

### C. Access Control
```solidity
// ✅ Restrict sensitive functions
modifier onlyRelayer() {
  require(msg.sender == authorizedRelayer, "Unauthorized");
  _;
}

function batchTransfer(...) external onlyRelayer {
  // Only relayer can call
}
```

### D. Signature Validation
```solidity
// ✅ Verify signature before execution
require(
  recover(hash, signature) == from,
  "Invalid signature"
);
```

## 2. Backend Security (Golang)

### A. Input Validation
```go
// ✅ Validate all inputs
func ValidateTransfer(req TransferRequest) error {
  if req.From == "" || !isValidAddress(req.From) {
    return fmt.Errorf("invalid from address")
  }
  
  if req.Amount.Cmp(big.NewInt(0)) <= 0 {
    return fmt.Errorf("amount must be positive")
  }
  
  if len(req.Signature) != 130 {  // 65 bytes * 2 hex
    return fmt.Errorf("invalid signature length")
  }
  
  return nil
}
```

### B. SQL/NoSQL Injection Prevention
```go
// ❌ WRONG
filter := bson.M{"from": userInput}  // ← User can inject operators

// ✅ CORRECT - Use parameterized queries
opts := options.Find().SetFilter(bson.M{
  "from": userInput,  // Treated as literal value
})
```

### C. Rate Limiting
```go
// ✅ Implement rate limiting
import "github.com/gin-contrib/ratelimit"

store := ratelimit.InMemoryStore(&rate.Limit{
  r: rate.Inf,  // No limit initially
  b: 100,       // Burst: 100 requests
})

r.Use(ratelimit.Middleware(store))
```

### D. Environment Variables
```go
// ❌ WRONG - Hardcoded secrets
const RelayerPrivateKey = "0x..."

// ✅ CORRECT - Use .env
import "github.com/joho/godotenv"

func init() {
  godotenv.Load()
  privateKey := os.Getenv("RELAYER_PRIVATE_KEY")
}
```

## 3. Database Security (MongoDB)

### A. Authentication & Authorization
```bash
# ✅ Enable authentication
mongo --username admin --password <password> --authenticationDatabase admin

# ✅ Create application user with limited privileges
db.createUser({
  user: "vndc_app",
  pwd: "<strong_password>",
  roles: [
    { role: "readWrite", db: "vndc_db" }
  ]
})
```

### B. Encryption
```go
// ✅ Enable TLS for MongoDB connection
mongoClient, _ := mongo.Connect(ctx, options.Client().
  ApplyURI("mongodb+srv://vndc_app:pwd@cluster.mongodb.net/vndc_db?tls=true&tlsCAFile=path/to/ca.pem"),
)
```

### C. Index Management
```javascript
// ✅ Create indexes for security & performance
db.transactions_queue.createIndex({ "from_address": 1, "nonce": 1 }, { unique: true })
db.transactions_queue.createIndex({ "status": 1, "created_at": -1 })
db.transactions_queue.createIndex({ "batch_id": 1 })
```

## 4. API Security

### A. CORS Configuration
```go
// ✅ Restrict CORS
config := cors.Config{
  AllowOrigins: []string{
    "https://app.vndc.io",
    "https://admin.vndc.io",
  },
  AllowMethods: []string{"GET", "POST"},
  AllowHeaders: []string{"Authorization", "Content-Type"},
}
r.Use(cors.New(config))
```

### B. HTTPS Only
```go
// ✅ Redirect HTTP to HTTPS
r.Use(func(c *gin.Context) {
  if c.Request.Header.Get("X-Forwarded-Proto") != "https" {
    c.Redirect(http.StatusMovedPermanently, "https://"+c.Request.Host+c.Request.RequestURI)
    c.Abort()
    return
  }
  c.Next()
})
```

### C. API Key & JWT
```go
// ✅ Validate JWT token
middleware := middleware.JwtAuthz()
protected := r.Group("/api/v1/admin")
protected.Use(middleware)
{
  protected.POST("/sync-balance", handler.SyncBalance)
}
```

## 5. Signature Security

### A. Signature Verification
```go
// ✅ Proper ECDSA recovery
func VerifySignature(hash [32]byte, sig []byte, expectedAddr common.Address) bool {
  // sig = r (32) + s (32) + v (1)
  if len(sig) != 65 {
    return false
  }
  
  // Convert v (0/1) to (27/28)
  if sig[64] < 27 {
    sig[64] += 27
  }
  
  pubkey, err := crypto.SigToPub(hash[:], sig)
  if err != nil {
    return false
  }
  
  recovered := crypto.PubkeyToAddress(*pubkey)
  return recovered == expectedAddr
}
```

### B. Nonce Tracking
```go
// ✅ Prevent nonce reuse
func CheckNonce(wallet string, nonce uint64) bool {
  storedNonce := redis.Get("nonce:" + wallet)
  
  if nonce <= storedNonce {
    return false  // Old nonce, reject
  }
  
  redis.Set("nonce:"+wallet, nonce)
  return true
}
```

## 6. Infrastructure Security

### A. Firewall & Network
```
✅ Production Setup:
  ├─ API Server: Behind reverse proxy (nginx)
  ├─ Database: Private network (no public access)
  ├─ Redis: Private network (firewall rules)
  ├─ Blockchain RPC: Private endpoint or rate-limited public
  └─ Logging: Separate secure server
```

### B. Monitoring & Logging
```go
// ✅ Log security events
func LogSecurityEvent(eventType, wallet, detail string) {
  logger.Warnf("SECURITY_EVENT: type=%s wallet=%s detail=%s timestamp=%s",
    eventType, wallet, detail, time.Now().ISO8601())
}

// Example events:
LogSecurityEvent("INVALID_SIGNATURE", wallet, "Failed ECDSA verify")
LogSecurityEvent("REPLAY_ATTACK", wallet, "Duplicate signature")
LogSecurityEvent("RATE_LIMIT", wallet, "Exceeded requests/min")
```

### C. Alerting
```
⚠️ Alert on:
  - Multiple failed signature verifications
  - Unusual batch sizes
  - Blockchain reorg detected
  - Database connectivity loss
  - High pending queue size (bottle-neck)
  - Failed rollback attempts
```

## 7. Compliance Checklist

### Code Review
- [ ] ✅ All access control checks in place
- [ ] ✅ No hardcoded secrets or private keys
- [ ] ✅ Input validation on all endpoints
- [ ] ✅ Error messages don't leak sensitive info
- [ ] ✅ Audit logging for sensitive operations

### Deployment
- [ ] ✅ Use HTTPS (TLS 1.2+)
- [ ] ✅ MongoDB password complexity >= 20 chars
- [ ] ✅ Redis password set & network isolated
- [ ] ✅ Relayer private key encrypted at rest
- [ ] ✅ Regular security patches applied

### Testing
- [ ] ✅ Unit tests for validation functions
- [ ] ✅ Fuzzing tests for input handling
- [ ] ✅ Integration tests with real database
- [ ] ✅ Load tests for rate limiting
- [ ] ✅ Security audit by 3rd party

## 8. Incident Response

### If Signature is Compromised:
1. ❌ Stop Relayer immediately
2. ✅ Identify affected transactions
3. ✅ Rollback pending transactions
4. ✅ Generate new Relayer key
5. ✅ Investigate root cause
6. ✅ Re-deploy with fix
7. ✅ Notify users

### If Database is Breached:
1. ❌ Stop all services
2. ✅ Take database offline
3. ✅ Notify users affected
4. ✅ Forensic analysis
5. ✅ Restore from clean backup
6. ✅ Change all credentials
7. ✅ Re-deploy with security patches

---

**Remember**: Security is an ongoing process, not a one-time task. Regular audits and updates are essential.

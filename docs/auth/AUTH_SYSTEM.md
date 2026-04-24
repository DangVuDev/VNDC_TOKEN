# 🔐 Authentication System - EIP-712 Meta-Transaction

## 1. Overview

VNDC sử dụng **EIP-712 Typed Data Signing** để:
- ✅ User ký giao dịch **offline** (không cần gas)
- ✅ Relayer lưu trữ signature và batch giao dịch
- ✅ Ngăn chặn **Replay Attack** bằng nonce
- ✅ Hỗ trợ **delegated transactions** (Relayer pay gas)

## 2. EIP-712 Domain Separator

**Định nghĩa**: Để tránh ký nhầm, mỗi domain (chain, contract) có một unique separator

```solidity
// Domain Separator (trong Smart Contract)
bytes32 domainSeparator = keccak256(abi.encode(
  keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
  keccak256(bytes("VNDC Token")),
  keccak256(bytes("1")),
  block.chainid,
  address(this)  // Contract address
));
```

**JavaScript**:
```javascript
const domain = {
  name: "VNDC Token",
  version: "1",
  chainId: 11155111,  // Sepolia
  verifyingContract: "0x..." // Token contract address
};
```

## 3. EIP-712 Types

**Định nghĩa cấu trúc dữ liệu để ký**:

```solidity
// Solidity struct
struct TransferData {
  address from;
  address to;
  uint256 amount;
  uint256 nonce;
}

// Type hash (Solidity)
bytes32 public constant TRANSFER_TYPEHASH = 
  keccak256("TransferData(address from,address to,uint256 amount,uint256 nonce)");
```

**JavaScript**:
```javascript
const types = {
  TransferData: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" }
  ]
};
```

## 4. Signing Process (Client-side)

### Step 1: Lấy nonce từ backend
```javascript
const response = await fetch('http://localhost:8080/api/v1/nonce/0x...');
const { nonce } = await response.json();
```

### Step 2: Chuẩn bị dữ liệu
```javascript
const transferData = {
  from: "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
  to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  amount: ethers.parseEther("1"),  // 1 VNDC
  nonce: nonce
};
```

### Step 3: Ký bằng ethers.js
```javascript
import { ethers } from 'ethers';

const signer = provider.getSigner();
const signature = await signer._signTypedData(
  domain,
  types,
  transferData
);

// signature = "0x..." (65 bytes)
```

### Step 4: Gửi signature & dữ liệu lên backend
```javascript
const result = await fetch('http://localhost:8080/api/v1/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: transferData.from,
    to: transferData.to,
    amount: transferData.amount.toString(),
    signature,
    nonce
  })
});
```

## 5. Verification Process (Backend)

### Step 1: Extract signature components
```go
// Go: Verify EIP-712 signature
// signature = r (32) + s (32) + v (1) = 65 bytes

type TransferData struct {
  From   common.Address
  To     common.Address
  Amount *big.Int
  Nonce  *big.Int
}

// Struct hash (keccak256 of encoded struct)
structHash := crypto.Keccak256Hash(
  abi.encodePacked(
    TRANSFER_TYPEHASH,
    from, to, amount, nonce,
  ),
)
```

### Step 2: Construct digest
```go
// Digest = keccak256("\x19\x01" + domainSeparator + structHash)
digest := crypto.Keccak256Hash(
  []byte("\x19\x01"),
  domainSeparator[:],
  structHash[:],
)
```

### Step 3: Recover signer
```go
// Extract r, s, v from signature
r := new(big.Int).SetBytes(signature[:32])
s := new(big.Int).SetBytes(signature[32:64])
v := signature[64]

// Recover public key
pubkey, _ := crypto.SigToPub(digest[:], append(signature[:64], byte(v)+27))

// Get address
recovered := crypto.PubkeyToAddress(*pubkey)

// Verify
require(recovered == from, "Invalid signature")
```

## 6. Nonce Management

### Purpose:
- ✅ Ngăn **Replay Attack** (submit giao dịch 2 lần)
- ✅ Theo dõi **transaction sequence**
- ✅ Chống **out-of-order processing**

### Flow:
```
User A:
  Tx1: nonce=5 ✅ Process, update nonce=6
  Tx2: nonce=6 ✅ Process, update nonce=7
  Tx3: nonce=5 ❌ REJECT (< current nonce)
  Tx4: nonce=8 ❌ REJECT (> current nonce, pending=6,7)

Rule: submitted_nonce >= current_nonce
```

### Redis storage:
```
Key: nonce:{wallet_address}
Value: "7"  (current nonce)
```

### Update logic:
```go
func IncrementNonce(wallet string) {
  redis.Incr("nonce:" + wallet)
}

// After transaction success
redis.Incr("nonce:" + from_address)
```

## 7. Replay Attack Prevention

### Problem:
```
Attacker lấy valid signature từ User A:
  Tx: from=A, to=B, amount=100, nonce=5, sig=0x...

Attacker có thể:
  1. Submit lại ngay lập tức (offline relayer) → 2 transfers
  2. Submit trên khác chain (different domain) → 2 transfers
  3. Submit sau khi nonce reset → 2 transfers
```

### Solution:

#### 1. Nonce Check (Per user, per chain):
```go
// Check nonce
storedNonce := redis.Get("nonce:" + from)
require(submitted_nonce > stored_nonce, "Invalid nonce")
```

#### 2. Domain Separator (Per chain, per contract):
```javascript
// Domain includes chainId
const domain = {
  chainId: 11155111,  // ← Prevents cross-chain replay
  verifyingContract: "0x..."
};
```

#### 3. Hash check (Prevent double submission):
```go
// Store hash of submitted signature
txHash := crypto.Keccak256Hash(signature)
exists := redis.Get("submitted_sig:" + txHash)
require(exists == nil, "Signature already submitted")

// Mark as submitted
redis.Set("submitted_sig:" + txHash, time.Now(), 24*time.Hour)
```

## 8. Code Example - Complete Flow

### Frontend (ethers.js):
```typescript
import { ethers } from 'ethers';

const domain = {
  name: "VNDC Token",
  version: "1",
  chainId: 11155111,
  verifyingContract: "0x1234567890123456789012345678901234567890"
};

const types = {
  TransferData: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" }
  ]
};

async function transfer(
  provider: ethers.Provider,
  from: string,
  to: string,
  amount: string
) {
  const signer = provider.getSigner();
  
  // 1. Get nonce
  const nonceRes = await fetch(`http://localhost:8080/api/v1/nonce/${from}`);
  const { nonce } = await nonceRes.json();
  
  // 2. Prepare data
  const value = {
    from,
    to,
    amount: ethers.parseEther(amount),
    nonce: BigInt(nonce)
  };
  
  // 3. Sign
  const signature = await signer._signTypedData(domain, types, value);
  
  // 4. Submit
  const result = await fetch('http://localhost:8080/api/v1/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      amount: value.amount.toString(),
      signature,
      nonce
    })
  });
  
  return result.json();
}
```

### Backend (Go):
```go
import "github.com/ethereum/go-ethereum/crypto"

type TransferRequest struct {
  From      string `json:"from"`
  To        string `json:"to"`
  Amount    string `json:"amount"`
  Signature string `json:"signature"`
  Nonce     uint64 `json:"nonce"`
}

func (h *Handler) Transfer(c *gin.Context) {
  var req TransferRequest
  c.BindJSON(&req)
  
  // 1. Verify signature
  signer, err := recoverSigner(req)
  if err != nil || signer != req.From {
    c.JSON(400, gin.H{"error": "Invalid signature"})
    return
  }
  
  // 2. Check nonce
  storedNonce, _ := h.redis.Get(ctx, "nonce:"+req.From).Int64()
  if req.Nonce <= uint64(storedNonce) {
    c.JSON(400, gin.H{"error": "Invalid nonce"})
    return
  }
  
  // 3. Check balance
  available, _ := h.cache.GetAvailableBalance(req.From)
  if available < req.Amount {
    c.JSON(422, gin.H{"error": "Insufficient balance"})
    return
  }
  
  // 4. Queue transaction
  h.db.InsertTransaction(req)
  h.redis.Incr(ctx, "nonce:"+req.From)
  
  c.JSON(200, gin.H{"success": true})
}
```

## 9. Security Checklist

- [ ] ✅ Validate domain separator matches contract
- [ ] ✅ Check nonce > stored nonce
- [ ] ✅ Verify signature with ECDSA.recover()
- [ ] ✅ Prevent signature resubmission (hash tracking)
- [ ] ✅ Rate limit per wallet
- [ ] ✅ Log failed signature attempts
- [ ] ✅ Use HTTPS for production
- [ ] ✅ Store sensitive config in .env
- [ ] ✅ Implement signature expiry (if needed)

---

**Kết luận**: EIP-712 cho phép user ký offline, Relayer batch & settle on-chain, tạo ra hệ thống giao dịch vừa nhanh vừa an toàn.

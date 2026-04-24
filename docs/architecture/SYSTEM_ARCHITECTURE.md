# 🏗️ Kiến trúc Hệ thống VNDC Hybrid

## 1. Overview (Tổng quan)

Hệ thống VNDC bao gồm 3 thành phần chính:

```
┌─────────────┐
│  Mobile App │ (User - EIP-712 Signer)
└──────┬──────┘
       │ POST /api/v1/transfer
       │ (signature + nonce)
       ▼
┌─────────────────────────────┐
│  Golang Relayer Backend     │ (Off-chain)
│  - Transaction Handler      │
│  - Balance Cache (Redis)    │
│  - MongoDB Queue            │
└──────┬──────────────────────┘
       │
       ├─► Redis (Virtual Balance Cache)
       │
       ├─► MongoDB (Transaction Queue)
       │
       └─► Batch Worker (Timer: 5min/10 txs)
           │
           ▼
       ┌──────────────────┐
       │  Smart Contract  │ (On-chain)
       │  multiTransfer() │
       │  (ERC20 Token)   │
       └──────────────────┘
```

## 2. System Components (Thành phần hệ thống)

### A. Frontend (Mobile App)
- **Chức năng**: Tạo giao dịch & ký offline
- **Công nghệ**: EIP-712 Signing (ethers.js)
- **Dữ liệu gửi**: 
  ```json
  {
    "from": "0x...",
    "to": "0x...",
    "amount": "1000000000000000000",
    "signature": "0x...",
    "nonce": 1
  }
  ```

### B. Golang Relayer (Off-chain Backend)
**Vai trò**: Nhận giao dịch, quản lý hàng đợi, định kỳ settlement

**Modules**:
1. **HTTP Handler** (`/internal/handlers`)
   - POST /api/v1/transfer - Nhận giao dịch
   - GET /api/v1/balance/:wallet - Kiểm tra số dư
   - GET /api/v1/history - Lịch sử giao dịch

2. **Transaction Service** (`/internal/services`)
   - ValidateTransaction() - Kiểm tra signature & nonce
   - CheckAvailableBalance() - Kiểm tra Redis cache
   - QueueTransaction() - Lưu vào MongoDB

3. **Balance Cache Service** (`/internal/services`)
   - Đọc on-chain balance từ Smart Contract
   - Quản lý pending amount trong Redis
   - Tính toán available balance

4. **Batch Worker** (`/internal/workers`)
   - Ticker: Chạy mỗi 5 phút hoặc 10 giao dịch
   - Lấy PENDING transactions từ MongoDB
   - Gọi Smart Contract multiTransfer()
   - Update status SUCCESS/FAILED

### C. MongoDB (NoSQL Database)
**Collections**:
```
transactions_queue {
  _id: ObjectId,
  from_address: "0x...",
  to_address: "0x...",
  amount: "1000000000000000000",
  signature: "0x...",
  nonce: 1,
  status: "PENDING|PROCESSING|SUCCESS|FAILED",
  batch_id: ObjectId,
  created_at: ISODate,
  processed_at: ISODate
}

batches {
  _id: ObjectId,
  batch_number: 1,
  total_amount: BigInt,
  transaction_ids: [ObjectId],
  batch_hash: "0x...",
  contract_receipt: {...},
  status: "CREATED|SUBMITTED|CONFIRMED|FAILED",
  submitted_at: ISODate,
  confirmed_at: ISODate
}

users_balance {
  _id: ObjectId,
  wallet_address: "0x...",
  on_chain_balance: BigInt,
  last_synced: ISODate
}
```

### D. Redis (Cache Layer)
**Key-Value Store**:
```
balance:{wallet_address} = {
  "on_chain": 100000000000000000,  // BigInt
  "pending": 20000000000000000,    // Tổng pending
  "available": 80000000000000000,  // = on_chain - pending
  "last_updated": 1704067200
}

nonce:{wallet_address} = 5  // Nonce hiện tại
```

### E. Smart Contract (Solidity)
**VNDC Token Contract**:
```solidity
interface IVNDCToken {
  // Chuyển khoản bình thường
  function transfer(address to, uint256 amount) external;
  
  // Batch transfer từ Relayer
  function multiTransfer(
    address[] calldata recipients,
    uint256[] calldata amounts,
    bytes[] calldata signatures
  ) external;
  
  // Xác thực EIP-712 signature
  function recoverSigner(bytes32 hash, bytes calldata sig) external pure;
}
```

## 3. Data Flow (Luồng dữ liệu)

### Scenario 1: User Transfer
```
1. User tạo giao dịch offline
   └─ Ký bằng EIP-712 với Domain Separator & Type Hash

2. Gửi POST /api/v1/transfer
   ├─ Golang Handler nhận request
   ├─ ValidateTransaction() kiểm tra signature
   ├─ CheckAvailableBalance() từ Redis
   └─ QueueTransaction() lưu vào MongoDB

3. Cập nhật Redis Balance
   ├─ pending += amount
   ├─ available = on_chain - pending
   └─ Return response { available, pending, ... }

4. Batch Worker (Mỗi 5 phút)
   ├─ Lấy 10+ PENDING từ MongoDB
   ├─ Gom: addresses[], amounts[], signatures[]
   ├─ Gọi Smart Contract multiTransfer()
   ├─ Update status → PROCESSING
   └─ Nếu thành công → SUCCESS
      Nếu thất bại → FAILED + Rollback Redis

5. Sync Balance từ Blockchain
   ├─ Mỗi 10 phút: call balanceOf() từ Smart Contract
   ├─ Update Redis balance:{wallet_address}
   └─ Cập nhật on_chain value
```

## 4. Dual-Layer Balance Logic

### Quy tắc tính toán:
```
On-chain Balance (L₁) = Số dư thực tế trên Smart Contract
Pending Amount (L₂)   = Tổng giao dịch trong PENDING + PROCESSING
Available Balance     = L₁ - L₂

Điều kiện: Mọi giao dịch mới chỉ được phép nếu:
Request_Amount <= Available_Balance
```

### Ví dụ:
```
User A: On-chain = 100 VNDC
        Pending = 30 VNDC (3 giao dịch chờ)
        Available = 70 VNDC
        
Request: Transfer 50 VNDC
├─ Check: 50 <= 70? ✅ YES
├─ Update Redis: pending = 80, available = 20
├─ Queue giao dịch
└─ Return { available: 20, pending: 80, on_chain: 100 }

Request 2: Transfer 25 VNDC
├─ Check: 25 <= 20? ❌ NO → REJECT (Insufficient balance)
└─ Return error: "Available balance too low"
```

## 5. Race Condition Prevention

### Problem:
```
Simultaneous requests từ User A:
  Req1: Transfer 50 (Available = 70) → PASS
  Req2: Transfer 30 (Available = 70) → PASS (WRONG!)
  Total = 80 > 70 VNDC → Double Spending!
```

### Solution:
```
Redis: Atomic operations (SET, INCR, DECR)
MongoDB: Transaction isolation với replica set
Lock: Distributed lock bằng Redis nếu cần
```

## 6. Error Handling & Rollback

### Case 1: Batch Settlement Thất bại
```
1. Worker submit 10 transactions → Smart Contract
2. Contract revert → FAILED
3. Redis Rollback:
   pending -= (tổng amount)
   available += (tổng amount)
4. MongoDB: Update status → FAILED
5. Retry mechanism: Đưa lại vào PENDING queue
```

### Case 2: Blockchain Fork/Reorg
```
1. Smart Contract event xác nhận batch
2. Kiểm tra block confirmation (12+ blocks)
3. Nếu reorg: Check lại on_chain balance
4. Cập nhật Redis = Smart Contract state
```

## 7. Security Considerations

### Signature Validation:
```solidity
// EIP-712 domain separator
bytes32 domainSeparator = keccak256(
  abi.encode(
    keccak256("EIP712Domain(...)"),
    chainId,
    address(this)
  )
);

// Verify signature
address signer = ECDSA.recover(
  keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)),
  signature
);
require(signer == from, "Invalid signature");
```

### Nonce Management:
```
Mỗi user có nonce counter
├─ User nonce phải > server nonce
├─ Ngăn chặn Replay Attack
└─ Update nonce sau khi transaction success
```

### Contract Authorization:
```solidity
modifier onlyRelayer() {
  require(msg.sender == authorizedRelayer, "Unauthorized");
  _;
}
```

---

**Kết luận**: Kiến trúc này kết hợp sức mạnh của Off-chain (nhanh, rẻ) và On-chain (an toàn, trong suốt) để tạo hệ thống giao dịch hiệu quả.

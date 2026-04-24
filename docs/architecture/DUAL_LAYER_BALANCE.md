# 📊 Dual-Layer Balance Logic

## Tổng quan

Hệ thống VNDC sử dụng logic "Số dư 2 lớp" để:
1. ✅ Ngăn chặn **Double Spending** (chi tiêu 2 lần)
2. ✅ Hỗ trợ **Off-chain transactions** (nhanh, rẻ)
3. ✅ Duy trì **Consistency** giữa Off-chain & On-chain

## 3 Thành phần Balance

### 1. On-chain Balance (Lớp 1)
```
Định nghĩa: Số dư thực tế trên Smart Contract
Cập nhật: Chỉ khi Smart Contract multiTransfer() execute
Lưu trữ: Blockchain (immutable)
Ký hiệu: B_onchain

Cách lấy:
  B_onchain = balanceOf(user_address, token_contract)
```

### 2. Pending Amount (Lớp 2)
```
Định nghĩa: Tổng tiền nằm trong hàng đợi chờ settle
Cập nhật: Thêm khi user submit giao dịch, bớt khi batch success/fail
Lưu trữ: Redis + MongoDB
Ký hiệu: P_pending

Cách tính:
  P_pending = ∑(amount) từ tất cả transactions có status IN (PENDING, PROCESSING)
  
Ví dụ:
  Tx1: 10 VNDC (PENDING)
  Tx2: 5 VNDC (PENDING)
  Tx3: 3 VNDC (PROCESSING)
  └─ P_pending = 10 + 5 + 3 = 18 VNDC
```

### 3. Available Balance (Tính toán)
```
Định nghĩa: Số tiền có thể giao dịch ngay
Cách tính:
  B_available = B_onchain - P_pending
  
Điều kiện giao dịch:
  Request_Amount <= B_available
```

## Ví dụ Thực tế

### Scenario: User A làm 3 giao dịch liên tiếp

```
Initial State:
  On-chain: 100 VNDC
  Pending: 0 VNDC
  Available: 100 VNDC

─────────────────────────────────────

Giao dịch 1: Transfer 30 VNDC
  ├─ Check: 30 <= 100? ✅ YES
  ├─ Insert DB: status = PENDING
  ├─ Update Redis:
  │   pending = 0 + 30 = 30
  │   available = 100 - 30 = 70
  └─ Response: { on_chain: 100, pending: 30, available: 70 }

After Tx1:
  On-chain: 100 VNDC (không thay đổi)
  Pending: 30 VNDC
  Available: 70 VNDC

─────────────────────────────────────

Giao dịch 2: Transfer 40 VNDC
  ├─ Check: 40 <= 70? ✅ YES
  ├─ Insert DB: status = PENDING
  ├─ Update Redis:
  │   pending = 30 + 40 = 70
  │   available = 100 - 70 = 30
  └─ Response: { on_chain: 100, pending: 70, available: 30 }

After Tx2:
  On-chain: 100 VNDC
  Pending: 70 VNDC
  Available: 30 VNDC

─────────────────────────────────────

Giao dịch 3: Transfer 35 VNDC
  ├─ Check: 35 <= 30? ❌ NO
  ├─ REJECT - Insufficient balance
  └─ Response: { error: "Available balance too low" }

After Tx3 (Rejected):
  On-chain: 100 VNDC
  Pending: 70 VNDC
  Available: 30 VNDC

─────────────────────────────────────

Batch Settlement (5 phút sau):
  ├─ Worker lấy: Tx1, Tx2 (total 70 VNDC)
  ├─ Call Smart Contract multiTransfer()
  ├─ ✅ Success: Transfer 70 VNDC
  │   on_chain = 100 - 70 = 30 VNDC (trên blockchain)
  ├─ Update DB: status = SUCCESS
  ├─ Update Redis:
  │   on_chain = 30
  │   pending = 0
  │   available = 30
  └─ Notification: Tx1, Tx2 confirmed

Final State:
  On-chain: 30 VNDC (giảm sau settlement)
  Pending: 0 VNDC
  Available: 30 VNDC
```

## Race Condition Prevention

### Problem (Nếu không có lock):
```
Scenario: 2 requests đồng thời từ User A

Initial: B_onchain = 100, P_pending = 0, B_available = 100

Request 1 (Req1):  Request 2 (Req2):
  Check: 50 <= 100   Check: 50 <= 100
  ✅ PASS           ✅ PASS (WRONG!)
  pending += 50     pending += 50
  
Result: P_pending = 100 (should be 100, but both allowed!)
        Total actual = 100 VNDC → DOUBLE SPENDING ❌
```

### Solution: Redis Atomic Operations
```go
// Pseudo code - Golang

func CheckAndUpdate(userId, amount) bool {
  // SCRIPT (Lua): Atomic check-and-update trong Redis
  script := `
    local available = redis.call('GET', KEYS[1])
    if tonumber(available) >= tonumber(ARGV[1]) then
      redis.call('DECRBY', KEYS[1], ARGV[1])
      redis.call('INCRBY', KEYS[2], ARGV[1])
      return 1
    else
      return 0
    end
  `
  
  result := redis.Eval(
    script,
    []string{"available:" + userId, "pending:" + userId},
    []string{amount}
  )
  
  return result == 1
}
```

**Giải thích**:
- Redis EVAL là **atomic** (không bị interrupt)
- Một request sẽ lock, request khác chờ
- Kết quả: Chỉ 1 request thành công, request 2 bị reject

## Rollback Mechanism

### Case: Smart Contract Batch Settlement Failed

```
Scenario: 10 transactions đang PROCESSING, Smart Contract revert

Before Rollback:
  On-chain: 100 VNDC
  Pending: 50 VNDC (10 txs)
  Available: 50 VNDC

Worker nhận failed event:
  ├─ Lấy batch_id từ Smart Contract logs
  ├─ Lấy tất cả txs của batch từ MongoDB
  ├─ Tính total amount = 50 VNDC
  ├─ Update Redis:
  │   pending = 50 - 50 = 0
  │   available = 100 - 0 = 100
  ├─ Update MongoDB: status = FAILED
  └─ Đưa lại vào queue cho lần retry

After Rollback:
  On-chain: 100 VNDC
  Pending: 0 VNDC
  Available: 100 VNDC
  (Back to initial state)
```

## Database Schema

### MongoDB: transactions_queue
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
  "to_address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  "amount": "1000000000000000000",  // 1 VNDC
  "signature": "0x...",
  "nonce": 5,
  "status": "PENDING",  // PENDING | PROCESSING | SUCCESS | FAILED
  "batch_id": ObjectId("507f1f77bcf86cd799439012"),
  "created_at": ISODate("2024-01-02T12:00:00Z"),
  "processed_at": ISODate("2024-01-02T12:05:00Z")
}
```

### Redis: balance:{wallet_address}
```json
{
  "on_chain": "100000000000000000",    // 100 VNDC (wei)
  "pending": "30000000000000000",      // 30 VNDC (wei)
  "available": "70000000000000000",    // 70 VNDC (wei)
  "last_updated": "1704067200"
}

// Nonce tracking
nonce:{wallet_address} = "5"
```

## API Response Format

### GET /api/v1/balance/:wallet
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
  "on_chain_balance": "100000000000000000",
  "pending_amount": "30000000000000000",
  "available_balance": "70000000000000000",
  "last_updated": "2024-01-02T12:05:30Z",
  "pending_transactions": [
    {
      "id": "507f1f77bcf86cd799439011",
      "amount": "10000000000000000",
      "to": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      "status": "PENDING"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "amount": "20000000000000000",
      "to": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      "status": "PROCESSING"
    }
  ]
}
```

## Best Practices

1. ✅ **Always check available_balance trước khi submit**
   - Giảm reject rate
   - Cải thiện UX

2. ✅ **Implement retry logic cho failed batches**
   - Exponential backoff
   - Max retry = 3

3. ✅ **Sync on_chain balance từ blockchain mỗi 10 phút**
   - Chống fork/reorg
   - Đảm bảo consistency

4. ✅ **Use nonce để ngăn replay attack**
   - User nonce tăng sau mỗi success
   - Server kiểm tra nonce >= stored_nonce

5. ✅ **Monitor pending_amount metrics**
   - Alert nếu pending > threshold
   - Indicator của bottle-neck

---

**Kết luận**: Dual-Layer Balance là nền tảng của VNDC system, cho phép off-chain transactions nhanh chóng mà vẫn đảm bảo an toàn & consistency.

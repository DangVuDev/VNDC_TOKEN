# 🎯 Token Reward System - Tự động chuyển thưởng

## Tổng quan Hệ thống

Hệ thống này **tự động chuyển thưởng token** cho người dùng khi hoàn thành hoạt động học tập. Server theo dõi thay đổi trong database, xử lý thưởng chờ xác nhận, và chuyển token về địa chỉ ví của người dùng.

### Kiến trúc

```
Activity Completion (Learn/Task)
         ↓
   Create RewardPending
         ↓
RewardProcessingWorker (theo dõi)
         ↓
   Create Transaction
         ↓
RewardSettlementWorker (theo dõi giao dịch)
         ↓
   Move to RewardProcessed
         ↓
Complete ✓
```

## Collections MongoDB

### 1. `reward_pending` - Thưởng chờ xử lý
```json
{
  "_id": "reward_xxxx",
  "student_wallet": "0xa61edfed2ade39a71589442c0d43ab0d0730ff41",
  "reward_amount": "50000000000000000000000",  // Wei (string)
  "reward_points": 50000,                      // Points (for display)
  "reward_source": "ACTIVITY_COMPLETION",      // ACTIVITY_COMPLETION | ACTIVITY_CLAIM | MANUAL_GRANT | BOUNTY | REFERRAL
  "status": "PENDING",                         // PENDING | QUEUED | PROCESSING | PROCESSED | FAILED | CANCELLED
  "activity_record_id": "record_xxxx",         // Link to activity
  "transaction_id": "tx_xxxx",                 // Created after processing
  "processed_at": "2026-05-20T10:30:00Z",
  "retry_count": 0,
  "last_error": "",
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T10:00:00Z"
}
```

### 2. `reward_processed` - Thưởng đã xử lý (Audit)
```json
{
  "_id": "processed_xxxx",
  "student_wallet": "0xa61edfed2ade39a71589442c0d43ab0d0730ff41",
  "reward_amount": "50000000000000000000000",
  "reward_points": 50000,
  "reward_source": "ACTIVITY_COMPLETION",
  "transaction_id": "tx_xxxx",
  "tx_hash": "0xabcd...",
  "block_number": 12345,
  "original_reward_id": "reward_xxxx",        // Link to pending
  "is_successful": true,
  "processed_at": "2026-05-20T10:30:00Z",
  "settled_at": "2026-05-20T10:31:00Z",
  "final_error": "",
  "created_at": "2026-05-20T10:30:00Z"
}
```

## Thành phần chính

### 1. Domain Entities (`internal/domain/activity.go`)
- **RewardPending**: Thưởng chờ xử lý
- **RewardProcessed**: Lịch sử thưởng đã xử lý

### 2. Repository Interfaces (`internal/ports/activity.go`)
- **RewardRepository**: CRUD + Query pending/failed rewards
- **RewardProcessedRepository**: Archive & audit trail

### 3. MongoDB Adapters (`internal/adapters/mongodb/reward_repos.go`)
- **RewardPendingRepository**: Lưu trữ thưởng chờ
- **RewardProcessedRepository**: Lưu trữ lịch sử

### 4. Service Layer (`internal/application/task/reward_service.go`)
```go
// Tạo thưởng chờ từ hoàn thành hoạt động
reward, err := rewardSvc.CreatePendingReward(ctx, recordID, wallet, points, source)

// Xử lý batch thưởng
rewards, err := rewardSvc.ProcessPendingRewards(ctx, limit)

// Chuyển sang processed sau khi giao dịch settled
err := rewardSvc.MoveRewardToProcessed(ctx, rewardID, txID, isSuccess, errorMsg)

// Lấy lịch sử thưởng của user
history, err := rewardSvc.GetUserRewardHistory(ctx, wallet)
```

### 5. Workers (`internal/workers/reward_worker.go`)

#### RewardProcessingWorker
- **Chạy mỗi 15 giây**
- Tìm kiếm `reward_pending` collection
- Tìm rewards có status = PENDING hoặc QUEUED
- Tạo Transaction cho mỗi reward
- Cập nhật status → PROCESSING → QUEUED

```go
worker := workers.NewRewardProcessingWorker(
  rewardPendingRepo,
  rewardProcessedRepo,
  txRepo,
  log,
)
worker.Start()
```

#### RewardSettlementWorker
- **Chạy mỗi 30 giây**
- Kiểm tra Transaction của các rewards QUEUED
- Khi transaction terminal (SUCCESS/FAILED):
  - Tạo record trong `reward_processed`
  - Cập nhật `reward_pending` → PROCESSED
  - Lưu tx_hash, block_number, status

```go
worker := workers.NewRewardSettlementWorker(
  rewardPendingRepo,
  rewardProcessedRepo,
  txRepo,
  log,
)
worker.Start()
```

## Luồng xử lý chi tiết

### Bước 1: Hoàn thành hoạt động học tập
```
User completes activity → Activity submitted/evaluated
```

### Bước 2: Tạo Reward Pending
```go
// Từ ActivityRecordService hoặc LearningSubmissionService
reward, err := rewardSvc.CreatePendingReward(
  ctx,
  activityRecordID,     // Link to activity
  studentWallet,        // 0xa61ed...
  50000,                // Points
  RewardSourceActivityCompletion,
)
// Tạo document trong reward_pending collection
// status: PENDING
```

### Bước 3: RewardProcessingWorker xử lý
```
Tick every 15s:
  1. Query reward_pending with status IN (PENDING, QUEUED) LIMIT 20
  2. For each reward:
     a. Update status → PROCESSING
     b. Calculate amount = points * rewardRate (default 1 point = 0.00001 token)
     c. Create Transaction:
        - from: relayer wallet
        - to: student wallet
        - amount: reward in wei
        - type: TOKEN_TRANSFER
        - context: ACTIVITY_REWARD
     d. Update reward:
        - transaction_id = created tx ID
        - status → QUEUED
        - processed_at = now
  3. Log batch complete
```

### Bước 4: Transaction Settlement (Batch Worker)
```
Batch worker (separate): 
  - Collect multiple rewards' transactions
  - Group into batch (up to 10 per batch)
  - Submit batch to blockchain via relayer
  - Wait for blockchain confirmation
```

### Bước 5: RewardSettlementWorker theo dõi
```
Tick every 30s:
  1. Query reward_pending with status = QUEUED
  2. For each reward, fetch linked transaction:
     a. If TX status = SUCCESS:
        ✓ Create reward_processed record
        ✓ Copy all fields + tx_hash + block_number
        ✓ Update reward_pending.status → PROCESSED
     b. If TX status = FAILED:
        ✗ Create reward_processed record (is_successful=false)
        ✗ Save error message
        ✗ Update reward_pending.status → PROCESSED
  3. Log settlements
```

### Bước 6: Audit & History
```
reward_processed collection chứa:
- Complete reward information
- Transaction details (hash, block, etc)
- Outcome (success/failure)
- Timestamps for audit trail
```

## Cấu hình

### Trong config.yaml
```yaml
blockchain:
  # Tỷ giá thưởng: Wei per point (mặc định 1 point = 0.00001 token)
  # 1 token = 1e18 wei → 1 point = 1e16 wei
  token_reward_rate: "10000000000000000"  # 1e16
  
  relayer_address: "0x6727d6B62C430E273ce666AEF9580085ae5E9cd5"
```

### Trong code (main.go)
```go
// Reward rate mặc định: 1 point = 0.00001 tokens (1e16 wei)
rewardRateWeiPerPoint := big.NewInt(1e16)

// Có thể override từ config
if cfg.Blockchain.TokenRewardRate != "" {
  rate, ok := new(big.Int).SetString(cfg.Blockchain.TokenRewardRate, 10)
  if ok {
    rewardRateWeiPerPoint = rate
  }
}

rewardSvc := taskapp.NewRewardService(
  rewardPendingRepo,
  rewardProcessedRepo,
  activityRecordRepo,
  txSvc,                      // Transaction service
  userRepo,
  log,
  cfg.Blockchain.RelayerAddress,
  rewardRateWeiPerPoint,
)
```

## API Endpoints (Cần thêm)

```go
// Lấy lịch sử thưởng của người dùng
GET /v1/rewards/history
Response: {
  "wallet": "0xa61ed...",
  "pending_rewards": [...],
  "processed_rewards": [...],
  "pending_points": 1000,
  "processed_points": 5000,
  "total_points": 6000
}

// Quản lý thưởng (Admin)
POST /v1/admin/rewards/manual
Body: {
  "wallet": "0xa61ed...",
  "points": 100,
  "reason": "Bonus for attendance"
}

GET /v1/admin/rewards/pending
GET /v1/admin/rewards/processed
```

## Tối ưu hóa

### 1. Indexing MongoDB
```javascript
// reward_pending
db.reward_pending.createIndex({"status": 1, "created_at": 1})
db.reward_pending.createIndex({"student_wallet": 1})
db.reward_pending.createIndex({"transaction_id": 1})

// reward_processed
db.reward_processed.createIndex({"student_wallet": 1, "processed_at": -1})
db.reward_processed.createIndex({"transaction_id": 1})
db.reward_processed.createIndex({"is_successful": 1})
```

### 2. Worker Tuning
```go
// Để xử lý nhanh hơn:
// RewardProcessingWorker: batch_size=50, tick=10s
// RewardSettlementWorker: tick=20s

// Để tiết kiệm resource:
// RewardProcessingWorker: batch_size=10, tick=30s
// RewardSettlementWorker: tick=60s
```

### 3. Querying
```
Pending rewards → PENDING status
Failed retries → status=FAILED, retry_count < 5, next_retry_at <= now
User history → Query reward_processed with student_wallet, sort by -processed_at
```

## Monitoring & Logging

### Logs
```
[INFO] reward_service: created pending reward (reward_id=xxx, points=50000)
[INFO] reward_worker: processing pending rewards (count=5)
[INFO] reward_worker: processed reward (reward_id=xxx, tx_id=yyy)
[INFO] reward_settlement_worker: reward settled (reward_id=xxx, tx_hash=0xabc...)
[ERROR] reward_worker: failed to process reward (reward_id=xxx, error=...)
```

### Metrics cần theo dõi
- Pending rewards count
- Rewards processed/hour
- Settlement success rate
- Failed rewards (retry)
- Average processing time

## Lỗi có thể xảy ra & Cách xử lý

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-----------|----------|
| Transaction creation failed | Relayer hết ETH | Kiểm tra balanceofs relayer, fund nếu cần |
| No documents in reward_pending | Chưa có reward | Check activity completion logic |
| Invalid wallet address | Format sai | Validate & checksum before creating |
| Settlement timeout | Blockchain chậm | Tăng settlement check interval |
| Retry exhausted | 5 lần retry thất bại | Xem lỗi cuối cùng, fix rồi tạo reward mới |

## Tiếp theo

1. **Tạo API Handlers** → `internal/application/task/reward_handler.go`
2. **Tích hợp Activity Completion** → Khi activity hoàn thành → `CreatePendingReward()`
3. **UI Frontend** → Display rewards history, pending status
4. **Admin Dashboard** → Monitor rewards, manual grant
5. **Tests** → Unit tests cho reward service & workers

---

**Tạo bởi:** Token Reward System  
**Cập nhật:** 2026-05-20  
**Version:** 1.0.0

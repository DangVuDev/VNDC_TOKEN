# 📡 API Specification - VNDC Backend

## Base URL
```
Development: http://localhost:8080/api/v1
Production: https://api.vndc.io/api/v1
```

## Authentication
Tất cả endpoints (trừ public ones) cần header:
```http
Authorization: Bearer {jwt_token}
```

---

## Endpoints

### 1. Transfer (Meta-Transaction)

#### POST /transfer
**Description**: Tạo giao dịch bằng EIP-712 signature

**Request**:
```json
{
  "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
  "to": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  "amount": "1000000000000000000",  // 1 VNDC (wei)
  "signature": "0x...",
  "nonce": 5
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "transaction_id": "507f1f77bcf86cd799439011",
  "status": "PENDING",
  "on_chain_balance": "100000000000000000",
  "pending_amount": "30000000000000000",
  "available_balance": "70000000000000000"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid signature
- `422 Unprocessable Entity`: Insufficient available balance
- `429 Too Many Requests`: Rate limit exceeded

---

### 2. Get Balance

#### GET /balance/:wallet

**Description**: Lấy thông tin số dư & pending transactions

**Response** (200 OK):
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
  "on_chain_balance": "100000000000000000",
  "pending_amount": "30000000000000000",
  "available_balance": "70000000000000000",
  "last_synced": "2024-01-02T12:05:30Z",
  "pending_transactions": [
    {
      "id": "507f1f77bcf86cd799439011",
      "to": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      "amount": "10000000000000000",
      "status": "PENDING",
      "created_at": "2024-01-02T12:00:00Z"
    }
  ]
}
```

---

### 3. Transaction History

#### GET /history?page=1&limit=20&status=SUCCESS

**Parameters**:
- `page` (integer, optional): Trang số (default: 1)
- `limit` (integer, optional): Số record/trang (default: 20)
- `status` (string, optional): PENDING|PROCESSING|SUCCESS|FAILED
- `from_date` (ISO 8601, optional): Filter từ ngày
- `to_date` (ISO 8601, optional): Filter đến ngày

**Response** (200 OK):
```json
{
  "success": true,
  "total": 150,
  "page": 1,
  "limit": 20,
  "transactions": [
    {
      "id": "507f1f77bcf86cd799439011",
      "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
      "to": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
      "amount": "1000000000000000000",
      "status": "SUCCESS",
      "batch_id": "507f1f77bcf86cd799439012",
      "tx_hash": "0x...",
      "created_at": "2024-01-02T12:00:00Z",
      "processed_at": "2024-01-02T12:05:30Z"
    }
  ]
}
```

---

### 4. Batch Status

#### GET /batch/:batch_id

**Response** (200 OK):
```json
{
  "batch_id": "507f1f77bcf86cd799439012",
  "batch_number": 42,
  "status": "CONFIRMED",
  "total_transactions": 10,
  "total_amount": "10000000000000000",
  "transactions": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439013"
  ],
  "blockchain": {
    "tx_hash": "0x...",
    "block_number": 12345,
    "confirmations": 15,
    "gas_used": "250000"
  },
  "submitted_at": "2024-01-02T12:05:00Z",
  "confirmed_at": "2024-01-02T12:06:30Z"
}
```

---

### 5. Nonce

#### GET /nonce/:wallet

**Description**: Lấy nonce hiện tại (để sign giao dịch)

**Response** (200 OK):
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
  "nonce": 5,
  "next_nonce": 6
}
```

---

### 6. Sync Balance (Internal)

#### POST /admin/sync-balance

**Authentication**: Admin token required

**Request**:
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb"
}
```

**Response** (200 OK):
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
  "on_chain_balance": "100000000000000000",
  "synced_at": "2024-01-02T12:10:00Z"
}
```

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Available balance is too low",
    "details": {
      "required": "50000000000000000",
      "available": "30000000000000000"
    }
  }
}
```

### Common Error Codes:
| Code | HTTP | Meaning |
|------|------|---------|
| INVALID_SIGNATURE | 400 | Chữ ký không hợp lệ |
| INSUFFICIENT_BALANCE | 422 | Không đủ số dư khả dụng |
| INVALID_NONCE | 400 | Nonce không đúng |
| WALLET_NOT_FOUND | 404 | Không tìm thấy ví |
| RATE_LIMIT | 429 | Vượt quá giới hạn request |
| INTERNAL_ERROR | 500 | Lỗi server |

---

## Rate Limiting

```
Per user: 100 requests/minute
Per IP: 1000 requests/minute

Header response:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1704067260
```

---

## Webhook (Events)

### Transaction Status Change
```
POST {webhook_url}
Content-Type: application/json

{
  "event": "transaction.status_changed",
  "timestamp": "2024-01-02T12:05:30Z",
  "data": {
    "transaction_id": "507f1f77bcf86cd799439011",
    "previous_status": "PENDING",
    "new_status": "SUCCESS",
    "batch_id": "507f1f77bcf86cd799439012",
    "tx_hash": "0x..."
  }
}
```

### Batch Confirmation
```
POST {webhook_url}
Content-Type: application/json

{
  "event": "batch.confirmed",
  "timestamp": "2024-01-02T12:06:30Z",
  "data": {
    "batch_id": "507f1f77bcf86cd799439012",
    "batch_number": 42,
    "total_transactions": 10,
    "tx_hash": "0x...",
    "block_number": 12345
  }
}
```

---

## SDK Usage (JavaScript/TypeScript)

```typescript
import { VNDCClient } from '@vndc/sdk';

const client = new VNDCClient({
  baseUrl: 'http://localhost:8080/api/v1',
  chainId: 11155111  // Sepolia
});

// Get nonce
const nonce = await client.getNonce(userAddress);

// Sign transaction (using ethers.js)
import { ethers } from 'ethers';
const signature = await signer._signTypedData(
  domain,
  types,
  {
    from: userAddress,
    to: recipientAddress,
    amount: ethers.parseEther('1'),
    nonce: nonce
  }
);

// Submit transfer
const result = await client.transfer({
  from: userAddress,
  to: recipientAddress,
  amount: ethers.parseEther('1'),
  signature,
  nonce
});

// Check balance
const balance = await client.getBalance(userAddress);
console.log('Available:', balance.available_balance);
```

---

## Testing

### cURL Examples

**Transfer**:
```bash
curl -X POST http://localhost:8080/api/v1/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb",
    "to": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    "amount": "1000000000000000000",
    "signature": "0x...",
    "nonce": 5
  }'
```

**Get Balance**:
```bash
curl -X GET "http://localhost:8080/api/v1/balance/0x742d35Cc6634C0532925a3b844Bc9e7595f1bEb"
```

---

## Implementation Checklist

- [ ] HTTP server (Gin framework)
- [ ] Request validation
- [ ] MongoDB integration
- [ ] Redis cache
- [ ] EIP-712 signature verification
- [ ] Error handling & logging
- [ ] Rate limiting middleware
- [ ] Webhook system
- [ ] API documentation (Swagger)
- [ ] Unit tests
- [ ] Integration tests


# VNDC Hybrid System - Refactored (Off-chain & On-chain)

## 📋 Giới thiệu
Hệ thống VNDC kết hợp Off-chain (Backend Golang + MongoDB) và On-chain (Solidity Smart Contracts) để xử lý:
- **Token VNDC**: ERC20 token cho hệ thống điểm tích lũy
- **NFT**: Chứng chỉ, Huy hiệu, và các tài sản số khác

## 🏗️ Cấu trúc Project

```
VNDC/
├── docs/                           # 📚 Tài liệu hệ thống
│   ├── architecture/               # Thiết kế kiến trúc
│   ├── modules/                    # Hướng dẫn từng module
│   ├── auth/                       # Xác thực & EIP-712
│   ├── security/                   # Bảo mật & Kiểm soát
│   └── api/                        # API Documentation
├── onchain/                        # ⛓️ Smart Contracts (Solidity)
│   ├── contracts/                  # Solidity contracts
│   │   ├── token/                  # VNDC Token (ERC20)
│   │   └── nft/                    # NFT Contracts (ERC721/1155)
│   ├── test/                       # Unit tests
│   └── deploy/                     # Deployment scripts
└── offchain/                       # 🖥️ Backend Services
    ├── backend-go/                 # Golang Backend
    │   ├── cmd/                    # Entry points
    │   ├── internal/
    │   │   ├── handlers/           # HTTP handlers
    │   │   ├── services/           # Business logic
    │   │   ├── models/             # Data structures
    │   │   └── workers/            # Background workers
    │   └── config/                 # Configuration
    └── backend-mongodb/            # MongoDB Configuration
        ├── schemas/                # Collection schemas
        └── migrations/             # Database migrations
```

## 🚀 Các Module Chính

### On-chain Modules:
1. **001-Token**: VNDC ERC20 Token
2. **002-NFT**: NFT Management (ERC721/1155)

### Off-chain Services:
1. **Auth Service**: Xác thực & EIP-712 Meta-Transaction
2. **Transaction Service**: Quản lý hàng đợi giao dịch
3. **Batch Worker**: Gom giao dịch theo batch
4. **Balance Cache**: Redis cache cho số dư ảo

## 🔑 Tính năng Chính

### 1. Dual-Layer Balance (Số dư 2 lớp)
- **On-chain Balance**: Số dư thực tế trên Smart Contract
- **Pending Amount**: Tổng giao dịch chờ settlement
- **Available Balance**: Available = On-chain - Pending

### 2. Meta-Transaction via EIP-712
- User ký giao dịch offline (không cần gas)
- Relayer lưu trữ & batch giao dịch
- Worker settle batch lên blockchain định kỳ

### 3. Batching & Settlement
- Mỗi 5 phút hoặc khi 10+ giao dịch: tạo batch
- Smart Contract multiTransfer() xác thực & thực thi
- Rollback Redis balance nếu giao dịch thất bại

## 📖 Tài liệu Chi tiết
- [SYSTEM_ARCHITECTURE.md](./docs/architecture/SYSTEM_ARCHITECTURE.md) - Kiến trúc chi tiết
- [DUAL_LAYER_BALANCE.md](./docs/architecture/DUAL_LAYER_BALANCE.md) - Logic số dư 2 lớp
- [API_SPECIFICATION.md](./docs/api/API_SPECIFICATION.md) - API endpoints
- [SECURITY.md](./docs/security/SECURITY.md) - Bảo mật & Best Practices
- [AUTH_SYSTEM.md](./docs/auth/AUTH_SYSTEM.md) - EIP-712 & Meta-Transaction

## ⚙️ Cài đặt

### On-chain (Hardhat)
```bash
cd onchain
npm install
npm run compile
npm run test
npm run deploy:sepolia
```

### Off-chain (Golang)
```bash
cd offchain/backend-go
go mod download
go run cmd/main.go
```

### MongoDB
```bash
cd offchain/backend-mongodb
# Chạy migrations
# mongodb://localhost:27017/vndc_db
```

## 📞 Hỗ trợ
Xem tài liệu trong thư mục `docs/` để biết chi tiết.

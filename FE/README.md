# VNDC Campus — Frontend

Giao diện web cho hệ thống **Vietnamese Digital Campus Coin** — nền tảng quản lý đại học phi tập trung trên blockchain.

## Tech Stack

- **Vite** + **TypeScript** + **React 18**
- **Tailwind CSS** — Dark theme, responsive (desktop + mobile)
- **ethers.js v6** — Kết nối MetaMask, tương tác smart contract
- **React Router v6** — Client-side routing
- **Recharts** — Biểu đồ analytics
- **Lucide React** — Icon system
- **React Query** — Server state management
- **Framer Motion** — Animations

## Cài đặt

```bash
cd FE
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`

## Cấu trúc thư mục

```
FE/
├── src/
│   ├── components/
│   │   ├── layout/          # Layout, Sidebar, Header, MobileNav
│   │   └── ui/              # PageHeader, StatCard, Tabs, Modal, DataTable, EmptyState
│   ├── config/
│   │   └── navigation.ts    # Menu navigation config
│   ├── contexts/
│   │   └── Web3Context.tsx   # MetaMask wallet provider
│   ├── lib/
│   │   ├── contracts.ts      # Contract addresses (cập nhật sau deploy)
│   │   └── utils.ts          # Utility functions
│   ├── pages/                # 20 pages cho tất cả 18 modules + Dashboard + Settings
│   ├── App.tsx               # Router setup
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind + custom styles
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

## Modules (18 modules)

| # | Module | Page | Mô tả |
|---|--------|------|--------|
| — | Dashboard | `/` | Tổng quan hệ thống |
| 001 | Core Token | `/token` | VNDC ERC-20 token |
| 002 | Credentials | `/credentials` | Bằng cấp NFT (ERC-721) |
| 003 | Academic Rewards | `/academic-rewards` | Thưởng GPA + Badge (ERC-1155) |
| 004 | Extracurricular | `/extracurricular` | Hoạt động ngoại khóa |
| 005 | Payments | `/payments` | Thanh toán SafeERC20 |
| 006 | Records | `/records` | Hồ sơ học tập + GPA |
| 007 | Governance | `/governance` | DAO voting + ERC20Votes |
| 008 | Student ID | `/student-id` | Thẻ sinh viên NFT |
| 009 | Certification | `/certification` | Chứng chỉ batch ERC-1155 |
| 010 | Scholarship | `/scholarship` | Quản lý học bổng |
| 011 | Alumni | `/alumni` | Cựu sinh viên |
| 012 | Reputation | `/reputation` | Điểm danh tiếng + huy hiệu |
| 013 | Job Board | `/job-board` | Việc làm + skill matching |
| 014 | Internship | `/internship` | Quản lý thực tập |
| 015 | Research | `/research` | Nghiên cứu + xuất bản |
| 016 | Auditing | `/auditing` | Kiểm toán smart contract |
| 017 | Integration | `/integration` | Migration dữ liệu legacy |
| 018 | Analytics | `/analytics` | Phân tích + báo cáo |
| — | Settings | `/settings` | Cấu hình ví & mạng |

## Kết nối Smart Contract

Sau khi deploy smart contract, cập nhật địa chỉ trong `src/lib/contracts.ts`:

```typescript
export const CONTRACT_ADDRESSES = {
  VNDC: { 11155111: '0x...', 137: '0x...' },
  // ... các contract khác
};
```

## Responsive

- **Desktop**: Sidebar cố định bên trái, có thể thu gọn
- **Mobile**: Sidebar kiểu drawer, hamburger menu, layout tối ưu cho mobile

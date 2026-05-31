# Kế Hoạch Triển Khai Module Auth — Frontend VNDC

> **Ngày lập:** 14/05/2026  
> **Stack:** React 19 + TypeScript + Vite + Ant Design 5 + React Router v6  
> **Backend:** Go (Gin) — `offchain/backend-go/internal/application/auth/`

---

## 1. Phân Tích Backend API

### 1.1 Toàn Bộ Endpoint Auth

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `GET` | `/v1/auth/challenge` | ❌ | Lấy nonce + SIWE message để ký |
| `POST` | `/v1/auth/login` | ❌ | Đăng nhập với SIWE signature |
| `POST` | `/v1/auth/2fa/complete` | ❌ | Hoàn tất đăng nhập khi 2FA bật |
| `POST` | `/v1/auth/refresh` | ❌ | Rotate JWT token pair |
| `POST` | `/v1/auth/logout` | ✅ JWT | Đăng xuất session hiện tại |
| `POST` | `/v1/auth/logout-all` | ✅ JWT | Đăng xuất tất cả session |
| `GET` | `/v1/auth/sessions` | ✅ JWT | Xem danh sách session đang hoạt động |
| `DELETE` | `/v1/auth/sessions/:id` | ✅ JWT | Thu hồi session cụ thể |
| `POST` | `/v1/auth/2fa/setup` | ✅ JWT | Tạo TOTP secret + backup codes |
| `POST` | `/v1/auth/2fa/enable` | ✅ JWT | Kích hoạt 2FA (xác nhận bằng TOTP code) |
| `POST` | `/v1/auth/2fa/disable` | ✅ JWT | Tắt 2FA |

### 1.2 Request/Response Types Chi Tiết

#### GET /auth/challenge
```
Query: ?wallet=0x...
Response: {
  message: string,   // EIP-191 SIWE message đã format sẵn để ký
  nonce: string,     // random nonce (5 min TTL)
  expires_at: string // ISO 8601
}
```

#### POST /auth/login
```
Body: {
  wallet: string,      // eth address (required)
  signature: string,   // 0x-prefixed hex (required)
  message: string,     // SIWE message đã ký (required)
  device_name?: string,
  device_os?: string
}
Response (success): {
  access_token: string,
  refresh_token: string,
  expires_at: string,   // access token expiry
  token_type: "Bearer",
  user: { id, wallet_address, status, roles, two_factor_enabled, ... }
}
Response (2FA required): {
  requires_2fa: true,
  temp_token: string,
  message: string
}
```

#### POST /auth/2fa/complete
```
Body: {
  temp_token: string,  // từ login response
  code: string,        // 6-digit TOTP hoặc 8-char backup code
  device_name?: string,
  device_os?: string
}
Response: TokenPair (giống login success)
```

#### POST /auth/refresh
```
Body: { refresh_token: string }
Response: TokenPair (giống login success)
```

#### POST /auth/logout / logout-all
```
Body: {} (empty — thông tin lấy từ JWT claims)
Response: 204 No Content
```

#### GET /auth/sessions
```
Response: { success: true, data: Session[] }
Session: {
  id, user_id, wallet_address,
  device_id, device_name, device_os, user_agent, ip_address, geo_country,
  issued_at, expires_at, last_used_at, revoked_at, revoke_reason,
  roles
}
```

#### DELETE /auth/sessions/:id
```
Response: 204 No Content
```

#### POST /auth/2fa/setup
```
Response: {
  secret: string,        // base32 TOTP secret
  otp_auth_uri: string,  // otpauth:// URI cho QR code
  backup_codes: string[] // 8 mã backup (chỉ hiển thị một lần!)
}
```

#### POST /auth/2fa/enable
```
Body: { code: string }  // 6-digit TOTP từ authenticator app
Response: { success: true, message: "2FA enabled successfully" }
```

#### POST /auth/2fa/disable
```
Body: { code: string }  // TOTP hoặc backup code
Response: { success: true, message: "2FA disabled successfully" }
```

### 1.3 Security Properties Quan Trọng

- **SIWE / EIP-191**: Backend dùng `personal_sign`, không phải `eth_sign`
- **Token TTL**: Access 15 phút, Refresh 7 ngày
- **Refresh rotation**: Mỗi lần refresh tạo token mới, token cũ bị invalidate ngay
- **Brute-force**: 5 thất bại → khóa tài khoản 30 phút
- **Rate limiting**: Strict limit trên `/challenge`, `/login`, `/2fa/complete`
- **Challenge TTL**: 5 phút — phải login ngay sau khi lấy challenge
- **Nonce replay**: Nonce bị xóa ngay sau khi verify thành công

---

## 2. Phân Tích Frontend Hiện Tại

### 2.1 Những Gì Đã Có

#### `src/hooks/useAuth.ts` ✅ Đã đủ về logic
```
exports:
- useWallet()       → connect/disconnect wallet
- useAuth()         → toàn bộ auth state + actions
- AuthUser type
- AuthTokens type
- Session type
- LoginResult type
```

**useAuth() trả về:**
| Property/Method | Kiểu | Mô tả |
|----------------|------|-------|
| `isLoggedIn` | boolean | Có token hay không |
| `user` | AuthUser \| null | Thông tin user từ JWT |
| `tokens` | AuthTokens \| null | Token pair |
| `loading` | boolean | Đang xử lý API |
| `twoFaRequired` | boolean | Đang ở bước 2FA |
| `tempToken` | string \| null | Token tạm thời cho 2FA |
| `sessions` | Session[] | Danh sách session |
| `getChallenge(wallet)` | → Promise\<string\> | Trả về SIWE message |
| `login(addr, msg, sig)` | → Promise\<LoginResult\> | SIWE login |
| `complete2FA(code)` | → Promise\<AuthTokens\> | Hoàn tất 2FA |
| `refresh()` | → Promise\<AuthTokens\> | Rotate token |
| `logout()` | → Promise | Đăng xuất |
| `logoutAll()` | → Promise | Đăng xuất tất cả |
| `fetchSessions()` | → Promise\<Session[]\> | Lấy danh sách session |
| `revokeSession(id)` | → Promise | Thu hồi session |
| `setup2FA()` | → Promise | Lấy TOTP secret |
| `enable2FA(code)` | → Promise | Kích hoạt 2FA |
| `disable2FA(code)` | → Promise | Tắt 2FA |

#### `src/pages/LoginPage.tsx` ⚠️ Cơ bản nhưng thiếu nhiều
- Có: connect wallet → get challenge → sign → login flow
- **Thiếu:**
  - 2FA completion step (khi `requires_2fa: true`)
  - Hiển thị 2FA input (TOTP code)
  - Xử lý `twoFaRequired` state
  - Auto-refresh token
  - Loading states cho từng bước rõ ràng hơn
  - Error phân loại (network / wallet / auth)

#### `src/App.tsx` ✅ Đã có router + layout

### 2.2 Những Gì Còn Thiếu

| Component / Feature | Priority | Status |
|--------------------|----------|--------|
| 2FA TOTP input trong login flow | 🔴 Critical | ❌ Missing |
| Auto-refresh token trước khi hết hạn | 🔴 Critical | ❌ Missing |
| Profile/Security Settings page | 🟡 High | ❌ Missing |
| Session management UI | 🟡 High | ❌ Missing |
| 2FA Setup wizard (QR code) | 🟡 High | ❌ Missing |
| Wallet change detection | 🟡 High | ❌ Missing |
| Loading skeleton cho auth states | 🟢 Medium | ❌ Missing |
| Token expiry countdown | 🟢 Medium | ❌ Missing |
| "Remember this device" flow | 🟢 Medium | ❌ Missing |

---

## 3. Kế Hoạch Triển Khai

### Phase 1: Sửa LoginPage — Hỗ Trợ 2FA Flow

**File:** `src/pages/LoginPage.tsx`

**Mô tả:**  
Hiện tại LoginPage bỏ qua trường hợp `requires_2fa: true`. Cần thêm step thứ 4 (Nhập TOTP) và xử lý `complete2FA`.

**UI Flow mới (4 steps):**
```
Step 0: Connect Wallet
  ↓ MetaMask kết nối
Step 1: Sign Message  
  ↓ personal_sign
Step 2: Đang xác thực (loading)
  ↓ POST /auth/login
  Case A: 2FA OFF → Step 4 (Done)
  Case B: 2FA ON  → Step 3
Step 3: Nhập TOTP Code
  ↓ POST /auth/2fa/complete
Step 4: Done ✓
```

**State mới cần thêm:**
```typescript
const [requires2FA, setRequires2FA] = useState(false)
const [totp2FAInput, setTotp2FAInput] = useState('')
const [submitting2FA, setSubmitting2FA] = useState(false)
```

**Xử lý 2FA:**
```typescript
// Sau khi onLogin trả về requires_2fa: true
if ('requires_2fa' in result && result.requires_2fa) {
  setRequires2FA(true)
  setStep(3) // bước nhập TOTP
} else {
  setStep(4) // done
}
```

---

### Phase 2: Auto-Refresh Token

**File mới:** `src/hooks/useTokenRefresh.ts`

**Mô tả:**  
Access token hết hạn sau 15 phút. Cần tự động refresh 2 phút trước khi hết hạn để UX liền mạch.

**Logic:**
```typescript
// Tính thời gian refresh = expires_at - 2 phút
// setInterval hoặc setTimeout để gọi auth.refresh()
// Nếu refresh thất bại → logout tự động
```

**Implementation Plan:**
```typescript
export function useTokenRefresh(tokens: AuthTokens | null, onRefresh: () => void, onExpired: () => void) {
  useEffect(() => {
    if (!tokens) return
    const expiresAt = new Date(tokens.expires_at).getTime()
    const refreshAt = expiresAt - 2 * 60 * 1000 // 2 phút trước
    const delay = refreshAt - Date.now()
    if (delay <= 0) {
      onExpired()
      return
    }
    const timer = setTimeout(onRefresh, delay)
    return () => clearTimeout(timer)
  }, [tokens?.expires_at])
}
```

**Tích hợp vào App.tsx:**
```typescript
// Trong ProtectedApp component
useTokenRefresh(auth.tokens, auth.refresh, auth.logout)
```

---

### Phase 3: Profile & Security Settings Page

**File mới:** `src/pages/ProfilePage.tsx`

**Sections:**
1. **Thông tin tài khoản** — wallet address, user ID, roles, status, created_at
2. **Quản lý phiên đăng nhập** — danh sách session, thu hồi từng session
3. **Bảo mật 2FA** — toggle 2FA, setup wizard, backup codes
4. **Đăng xuất** — logout / logout-all

#### 3.1 Sub-component: SessionsTable

```typescript
// Hiển thị bảng session với cột:
// Device, IP, Địa điểm, Bắt đầu, Lần cuối, Trạng thái, Action
// Action: Thu hồi (với confirm dialog)
// Highlight session hiện tại (theo device_id hoặc thời gian)
```

#### 3.2 Sub-component: TwoFAManager

**State machine:**
```
[2FA DISABLED]
  → Nhấn "Bật 2FA"
  → POST /auth/2fa/setup
  → Hiển thị QR code (antd QRCode với otp_auth_uri)
  → Hiển thị secret (copy button)
  → Hiển thị backup codes (download button)
  → Input TOTP code để confirm
  → POST /auth/2fa/enable
  → [2FA ENABLED]

[2FA ENABLED]
  → Nhấn "Tắt 2FA"
  → Modal confirm + input TOTP code
  → POST /auth/2fa/disable
  → [2FA DISABLED]
```

---

### Phase 4: Wallet Change Detection

**Mô tả:**  
MetaMask có thể thay đổi account mà không cần reload. Cần detect và logout khi wallet thay đổi.

**Implementation:**
```typescript
// Trong src/hooks/useWalletEvents.ts
useEffect(() => {
  if (!window.ethereum) return
  
  const handleAccountsChanged = (accounts: string[]) => {
    const newAddr = accounts[0]
    if (!newAddr || newAddr.toLowerCase() !== currentAddr?.toLowerCase()) {
      onWalletChanged() // → logout
    }
  }
  
  window.ethereum.on('accountsChanged', handleAccountsChanged)
  window.ethereum.on('chainChanged', () => window.location.reload())
  
  return () => {
    window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
    window.ethereum.removeListener('chainChanged', () => {})
  }
}, [currentAddr])
```

---

### Phase 5: AuthContext — Global State Management

**Mô tả:**  
Hiện tại `useAuth()` được gọi trực tiếp trong từng component. Với auto-refresh và wallet events, cần một AuthContext để tránh multiple instances của hook.

**File mới:** `src/context/AuthContext.tsx`

```typescript
const AuthContext = createContext<ReturnType<typeof useAuth> | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const wallet = useWallet()
  
  // Wallet change detection
  useWalletEvents(wallet.address, auth.logout)
  
  // Auto token refresh
  useTokenRefresh(auth.tokens, auth.refresh, auth.logout)
  
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
```

---

## 4. File Structure Sau Khi Triển Khai

```
src/
├── context/
│   └── AuthContext.tsx          [NEW] Global auth provider
├── hooks/
│   ├── useAuth.ts               [EXISTING] ✅ Đã đủ
│   ├── useTokenRefresh.ts       [NEW] Auto-refresh logic
│   └── useWalletEvents.ts       [NEW] MetaMask event listeners
├── pages/
│   ├── LoginPage.tsx            [UPDATE] + 2FA step
│   └── ProfilePage.tsx          [NEW] Profile + security settings
├── components/
│   └── auth/
│       ├── TwoFASetupModal.tsx  [NEW] TOTP QR + enable flow
│       ├── SessionsTable.tsx    [NEW] Active sessions management
│       └── BackupCodesDisplay.tsx [NEW] Show + download backup codes
└── App.tsx                      [UPDATE] Bọc trong AuthProvider
```

---

## 5. Thứ Tự Triển Khai (Implementation Order)

### Sprint 1 — Critical Path
1. `LoginPage.tsx` — Thêm 2FA step (**ảnh hưởng đến login flow**)
2. `useTokenRefresh.ts` — Auto-refresh (**bảo mật, UX**)
3. `AuthContext.tsx` — Centralize state (**prerequisite cho các feature sau**)

### Sprint 2 — Profile & Sessions
4. `SessionsTable.tsx` — UI bảng session
5. `TwoFASetupModal.tsx` — 2FA wizard
6. `BackupCodesDisplay.tsx` — Backup codes
7. `ProfilePage.tsx` — Lắp ghép các component trên
8. Thêm route `/profile` vào App.tsx + AppLayout

### Sprint 3 — Polish
9. `useWalletEvents.ts` — Wallet change detection
10. Loading skeletons cho auth states
11. Error boundary cho auth failures

---

## 6. Chi Tiết UI/UX

### 6.1 LoginPage — 2FA Step UI

```
┌─────────────────────────────────┐
│  🔐 Xác thực 2 bước            │
│                                 │
│  Mở ứng dụng Authenticator và  │
│  nhập mã 6 chữ số.             │
│                                 │
│  ┌─────────────────────────┐   │
│  │  _ _ _ _ _ _            │   │  ← OTP Input (auto-focus, auto-submit)
│  └─────────────────────────┘   │
│                                 │
│  [Xác nhận]                    │
│                                 │
│  Hoặc dùng mã backup 8 ký tự  │
└─────────────────────────────────┘
```

### 6.2 ProfilePage Layout

```
┌──────────────────────────────────────────┐
│  Profile & Security Settings             │
├──────────────┬───────────────────────────┤
│  Tabs:       │                           │
│  👤 Thông tin│  Content area             │
│  🔑 2FA     │                           │
│  📱 Sessions │                           │
│  🚪 Logout  │                           │
└──────────────┴───────────────────────────┘
```

### 6.3 2FA Setup Modal Wireframe

```
Step 1: Scan QR
┌────────────────────────────────┐
│  Cài đặt 2FA                   │
│  ───────────────────────────── │
│  1. Quét QR code này:          │
│  ┌──────────┐                  │
│  │  [QR]   │                  │
│  └──────────┘                  │
│  Hoặc nhập thủ công:           │
│  JBSWY3DPEHPK3PXP [Copy]      │
│                    [Tiếp theo] │
└────────────────────────────────┘

Step 2: Backup Codes
┌────────────────────────────────┐
│  ⚠️ Lưu mã khôi phục           │
│  Các mã này chỉ hiển thị một lần│
│  ┌────────────────────────┐    │
│  │ ABCD-1234  EFGH-5678  │    │
│  │ IJKL-9012  MNOP-3456  │    │
│  │ ...8 codes...          │    │
│  └────────────────────────┘    │
│  [📋 Copy tất cả]              │
│  [⬇️ Tải về file .txt]         │
│                    [Tiếp theo] │
└────────────────────────────────┘

Step 3: Xác nhận TOTP
┌────────────────────────────────┐
│  Nhập mã từ ứng dụng để xác nhận│
│  ┌─────────────────┐           │
│  │  _ _ _ _ _ _   │           │
│  └─────────────────┘           │
│  [Kích hoạt 2FA]               │
└────────────────────────────────┘
```

### 6.4 Sessions Table

```
┌──────────┬───────────┬──────────────┬─────────────┬──────────┐
│ Thiết bị │ IP        │ Bắt đầu      │ Lần cuối    │ Thao tác │
├──────────┼───────────┼──────────────┼─────────────┼──────────┤
│ Chrome / │ 192.168.  │ 14/05 10:00  │ Vừa xong    │ [Hiện tại│
│ Windows  │ 1.10      │              │             │  session]│
├──────────┼───────────┼──────────────┼─────────────┼──────────┤
│ Firefox /│ 10.0.0.5  │ 13/05 08:30  │ 14/05 09:00 │ [Thu hồi]│
│ macOS    │           │              │             │          │
└──────────┴───────────┴──────────────┴─────────────┴──────────┘
```

---

## 7. API Service Functions (Đã có trong useAuth.ts)

Tất cả API calls cho auth đã được implement trong `useAuth.ts`. Không cần thêm vào `lib/services.ts`. Sử dụng trực tiếp từ `useAuthContext()`:

```typescript
// Trong ProfilePage hoặc component con
const auth = useAuthContext()

// Quản lý session
await auth.fetchSessions()
await auth.revokeSession(id)

// 2FA
const { secret, otp_auth_uri, backup_codes } = await auth.setup2FA()
await auth.enable2FA(totpCode)
await auth.disable2FA(code)

// Đăng xuất
await auth.logout()
await auth.logoutAll()
```

---

## 8. Type Definitions Cần Bổ Sung

```typescript
// Bổ sung vào useAuth.ts hoặc types/auth.ts
export type Setup2FAResponse = {
  secret: string
  otp_auth_uri: string
  backup_codes: string[]
}

export type ChallengeResponse = {
  message: string
  nonce: string
  expires_at: string
}

// Session đã có nhưng cần bổ sung geo_country
export type Session = {
  id: string
  user_id: string
  wallet_address: string
  device_id?: string
  device_name?: string
  device_os?: string
  user_agent?: string
  ip_address?: string
  geo_country?: string
  issued_at: string
  expires_at: string
  last_used_at?: string
  revoked_at?: string
  roles: string[]
}
```

---

## 9. Checklist Triển Khai

### Sprint 1
- [ ] Cập nhật `LoginPage.tsx` — thêm 2FA step (TOTP input)
- [ ] Tạo `src/hooks/useTokenRefresh.ts`
- [ ] Tạo `src/context/AuthContext.tsx`
- [ ] Cập nhật `src/App.tsx` — bọc trong `AuthProvider`
- [ ] Test flow: login → 2FA → dashboard
- [ ] Test flow: token hết hạn → auto-refresh → tiếp tục dùng

### Sprint 2
- [ ] Tạo `src/components/auth/SessionsTable.tsx`
- [ ] Tạo `src/components/auth/TwoFASetupModal.tsx`
- [ ] Tạo `src/components/auth/BackupCodesDisplay.tsx`
- [ ] Tạo `src/pages/ProfilePage.tsx`
- [ ] Thêm route `/profile` vào `App.tsx`
- [ ] Thêm link "Profile" vào `AppLayout.tsx` header dropdown
- [ ] Test: xem session, thu hồi session
- [ ] Test: bật 2FA → QR scan → nhập TOTP → verify
- [ ] Test: tắt 2FA bằng TOTP code

### Sprint 3
- [ ] Tạo `src/hooks/useWalletEvents.ts`
- [ ] Tích hợp wallet change detection vào `AuthContext`
- [ ] Test: đổi account MetaMask → auto logout
- [ ] Test: đổi chain MetaMask → reload

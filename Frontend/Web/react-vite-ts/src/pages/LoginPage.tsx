import { useRef, useState } from 'react'
import {
  Button, Card, Typography, Space, Alert, Steps,
  Input, Form,
} from 'antd'
import {
  WalletOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  LockOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { switchChain } from '../lib/wallet'
import type { AuthUser, AuthTokens } from '../hooks/useAuth'

const { Title, Text } = Typography

type LoginResult = AuthTokens | { requires_2fa: true; temp_token: string; message?: string }

interface LoginPageProps {
  onGetChallenge: (addr: string) => Promise<{ message: string; nonce: string }>
  onLogin: (addr: string, msg: string, sig: string) => Promise<LoginResult>
  onComplete2FA?: (code: string) => Promise<AuthTokens>
  onSuccess?: (user: AuthUser) => void
}

const STEP_ITEMS = [
  { title: 'Kết nối',   description: 'Mở MetaMask' },
  { title: 'Ký tên',    description: 'Xác thực danh tính' },
  { title: '2FA',       description: 'Bảo mật 2 lớp' },
  { title: 'Vào cổng', description: 'Thành công' },
]

export function LoginPage({ onGetChallenge, onLogin, onComplete2FA, onSuccess }: LoginPageProps) {
  const [step, setStep]               = useState<0 | 1 | 2 | 3 | 4>(0)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [totpCode, setTotpCode]       = useState('')
  const [submitting2FA, setSubmitting2FA] = useState(false)
  const [useBackup, setUseBackup]     = useState(false)
  const totpRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTotpChange(val: string) {
    const clean = val.replace(/\D/g, '').slice(0, 6)
    setTotpCode(clean)
    if (clean.length === 6 && !useBackup) {
      if (totpRef.current) clearTimeout(totpRef.current)
      totpRef.current = setTimeout(() => handle2FA(clean), 300)
    }
  }

  async function handleConnect() {
    setError(null)
    setLoading(true)
    try {
      if (!window.ethereum) {
        setError('MetaMask or Ethereum wallet not found. Please install MetaMask.')
        return
      }
      const chainId = Number((import.meta as unknown as { env: Record<string, string> }).env?.VITE_CHAIN_ID ?? 31337)
      await switchChain(chainId, window.ethereum)
      const accounts = await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })
      const address = accounts?.[0]
      if (!address) throw new Error('No account selected')
      setStep(1)
      const { message } = await onGetChallenge(address)
      const sig = await window.ethereum.request<string>({
        method: 'personal_sign',
        params: [message, address],
      })
      if (!sig) throw new Error('User rejected signing')
      setStep(2)
      const result = await onLogin(address, message, sig)
      if ('requires_2fa' in result && result.requires_2fa) {
        setStep(3)
        return
      }
      setStep(4)
      if ('user' in result && result.user && onSuccess) {
        onSuccess(result.user as AuthUser)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'An error occurred. Please try again.'
      if (typeof msg === 'string' && (msg.includes('User rejected') || msg.includes('user rejected'))) {
        setError('You rejected the signing request. Please try again and approve.')
      } else {
        setError(msg)
      }
      setStep(0)
    } finally {
      setLoading(false)
    }
  }

  async function handle2FA(code?: string) {
    const codeToUse = code ?? totpCode
    if (!codeToUse) return
    if (!onComplete2FA) {
      return
    }
    setError(null)
    setSubmitting2FA(true)
    try {
      const result = await onComplete2FA(codeToUse)
      setStep(4)
      if (result.user && onSuccess) {
        onSuccess(result.user as AuthUser)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid verification code'
      setError(msg)
      setTotpCode('')
    } finally {
      setSubmitting2FA(false)
    }
  }

  const stepsCurrentIndex = step === 0 ? -1 : step === 1 ? 0 : step === 2 ? 1 : step === 3 ? 2 : 3

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(150deg, #1A1744 0%, #312E81 40%, #3730A3 65%, #1E1B4B 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decorative rings */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        border: '1px solid rgba(165,180,252,0.08)', top: -150, right: -150,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        border: '1px solid rgba(165,180,252,0.06)', bottom: -100, left: -100,
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>

        {/* -- Crest header ----------------------- */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <svg width={72} height={80} viewBox="0 0 40 44" fill="none" style={{ display: 'block', margin: '0 auto 12px' }}>
            <path d="M20 2L4 9V22C4 31.5 11.5 39 20 42C28.5 39 36 31.5 36 22V9L20 2Z"
              fill="url(#login-cg)" stroke="#818CF8" strokeWidth="0.8" />
            <text x="12" y="28" fontFamily="Georgia, serif" fontSize="17" fontWeight="700" fill="#FFFFFF">V</text>
            <circle cx="14" cy="9" r="1.3" fill="#FCD34D" />
            <circle cx="20" cy="7" r="1.3" fill="#FCD34D" />
            <circle cx="26" cy="9" r="1.3" fill="#FCD34D" />
            <defs>
              <linearGradient id="login-cg" x1="4" y1="2" x2="36" y2="42" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4338CA" />
                <stop offset="1" stopColor="#1A1744" />
              </linearGradient>
            </defs>
          </svg>
          <Title level={2} style={{
            margin: 0, color: '#FFFFFF',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700, letterSpacing: -0.5,
          }}>
            VNDC Education
          </Title>
          <Text style={{ color: '#A5B4FC', fontSize: 13, marginTop: 4, display: 'block' }}>
            Blockchain Learning Platform &middot; Dân chủ &amp; Minh bạch
          </Text>
        </div>

        {/* -- Main card -------------------------- */}
        <Card
          style={{
            borderRadius: 18,
            border: '1px solid rgba(165,180,252,0.15)',
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
          }}
          styles={{ body: { padding: 32 } }}
        >
          <Space direction="vertical" size={22} style={{ width: '100%' }}>

            {/* Section title */}
            <div style={{ borderBottom: '2px solid #EEF2FF', paddingBottom: 16 }}>
              {step !== 3 ? (
                <>
                  <Title level={4} style={{ margin: 0, marginBottom: 4, color: '#1A1744', fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {step === 4 ? 'Chào mừng trở lại!' : 'Cổng đăng nhập'}
                  </Title>
                  <Text style={{ color: '#6B7280', fontSize: 13 }}>
                    {step === 4
                      ? 'Đăng nhập thành công. Đang tải dữ liệu...'
                      : 'Xác thực bằng Sign-In With Ethereum (SIWE)'}
                  </Text>
                </>
              ) : (
                <>
                  <Title level={4} style={{ margin: 0, marginBottom: 4, color: '#1A1744', fontFamily: "'Playfair Display', Georgia, serif" }}>
                    <LockOutlined style={{ marginRight: 8, color: '#4338CA' }} />
                    Xác thực 2 bước
                  </Title>
                  <Text style={{ color: '#6B7280', fontSize: 13 }}>
                    {useBackup
                      ? 'Nhập mã backup 8 ký tự đã lưu khi cài đặt'
                      : 'Nhập mã 6 chữ số từ ứng dụng Authenticator'}
                  </Text>
                </>
              )}
            </div>

            {/* Steps progress */}
            {step > 0 && (
              <Steps
                size="small"
                current={stepsCurrentIndex}
                status={step === 4 ? 'finish' : 'process'}
                items={STEP_ITEMS.map((s, i) => ({
                  title: s.title,
                  description: s.description,
                  icon: stepsCurrentIndex > i ? <CheckCircleOutlined style={{ color: '#059669' }} /> : undefined,
                }))}
              />
            )}

            {/* Error */}
            {error && (
              <Alert
                type="error"
                message={error}
                closable
                onClose={() => setError(null)}
                style={{ borderRadius: 8 }}
              />
            )}

            {/* 2FA Input */}
            {step === 3 ? (
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Form onFinish={() => handle2FA()} layout="vertical">
                  <Form.Item style={{ marginBottom: 10 }}>
                    <Input
                      size="large"
                      prefix={<KeyOutlined style={{ color: '#9CA3AF' }} />}
                      value={totpCode}
                      onChange={(e) => {
                        if (useBackup) setTotpCode(e.target.value.slice(0, 8))
                        else handleTotpChange(e.target.value)
                      }}
                      placeholder={useBackup ? 'Mã backup (8 ký tự)' : 'Mã TOTP (6 chữ số)'}
                      maxLength={useBackup ? 8 : 6}
                      style={{ fontSize: 20, letterSpacing: useBackup ? 2 : 8, textAlign: 'center', borderRadius: 10 }}
                      autoFocus
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    size="large"
                    block
                    loading={submitting2FA}
                    htmlType="submit"
                    style={{
                      height: 50, borderRadius: 10, fontSize: 15, fontWeight: 600,
                      background: 'linear-gradient(135deg, #4338CA, #6366F1)',
                      border: 'none',
                    }}
                  >
                    Xác nhận mã
                  </Button>
                </Form>
                <Button
                  type="link" size="small" block
                  onClick={() => { setUseBackup((b) => !b); setTotpCode(''); setError(null) }}
                  style={{ color: '#6B7280', fontSize: 13 }}
                >
                  {useBackup ? 'Dùng mã TOTP từ ứng dụng' : 'Dùng mã backup thay thế'}
                </Button>
              </Space>
            ) : (
              /* Connect Button */
              <Button
                type="primary"
                size="large"
                block
                loading={loading}
                icon={step === 4 ? <CheckCircleOutlined /> : <WalletOutlined />}
                onClick={handleConnect}
                disabled={step === 4}
                style={{
                  height: 52,
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  background: step === 4
                    ? 'linear-gradient(135deg, #059669, #34D399)'
                    : 'linear-gradient(135deg, #4338CA, #6366F1)',
                  border: 'none',
                  boxShadow: step === 4
                    ? '0 4px 16px rgba(5,150,105,0.35)'
                    : '0 4px 16px rgba(67,56,202,0.35)',
                  transition: 'all 0.2s ease',
                }}
              >
                {step === 0 && 'Kết nối ví MetaMask'}
                {step === 1 && 'Đang ký xác thực...'}
                {step === 2 && 'Đang xác minh...'}
                {step === 4 && 'Đăng nhập thành công!'}
              </Button>
            )}

            {/* Security features - only on idle */}
            {step === 0 && (
              <div style={{
                background: '#F8F7FF',
                borderRadius: 10,
                padding: '14px 16px',
                border: '1px solid #E0E7FF',
              }}>
                <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 10 }}>
                  Tính năng bảo mật
                </Text>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {[
                    { icon: <SafetyCertificateOutlined style={{ color: '#4338CA' }} />, text: 'Không lưu private key \u00B7 Ký trực tiếp trên ví' },
                    { icon: <ThunderboltOutlined      style={{ color: '#D97706' }} />, text: 'JWT session ngắn hạn, tự động refresh' },
                    { icon: <CheckCircleOutlined       style={{ color: '#059669' }} />, text: 'Chuẩn EIP-4361 (SIWE) được kiểm định' },
                  ].map((f, i) => (
                    <Space key={i} size={10}>
                      {f.icon}
                      <Text style={{ fontSize: 12.5, color: '#4B5563' }}>{f.text}</Text>
                    </Space>
                  ))}
                </Space>
              </div>
            )}

          </Space>
        </Card>

        <Text style={{ display: 'block', textAlign: 'center', marginTop: 20, fontSize: 12, color: 'rgba(165,180,252,0.7)' }}>
          &copy; 2026 VNDC Blockchain Education Platform &middot; EIP-4361 SIWE
        </Text>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  Typography,
  Space,
  Alert,
  Steps,
  Input,
  Form,
} from 'antd'
import {
  WalletOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  LockOutlined,
  KeyOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import { switchChain } from '../lib/wallet'
import type { AuthUser, AuthTokens } from '../hooks/useAuth'
import vndcLogo from '../../public/logo.png'

const { Title, Text } = Typography

type LoginResult = AuthTokens | { requires_2fa: true; temp_token: string; message?: string }

interface LoginPageProps {
  onGetChallenge: (addr: string) => Promise<{ message: string; nonce: string }>
  onLogin: (addr: string, msg: string, sig: string) => Promise<LoginResult>
  onComplete2FA?: (code: string) => Promise<AuthTokens>
  onSuccess?: (user: AuthUser) => void
}

const STEP_ITEMS = [
  { title: 'Kết nối', description: 'Mở ví' },
  { title: 'Ký tên', description: 'SIWE' },
  { title: '2FA', description: 'Xác thực' },
  { title: 'Vào app', description: 'Sẵn sàng' },
]

export function LoginPage({ onGetChallenge, onLogin, onComplete2FA, onSuccess }: LoginPageProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [submitting2FA, setSubmitting2FA] = useState(false)
  const [useBackup, setUseBackup] = useState(false)
  const totpRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (totpRef.current) clearTimeout(totpRef.current)
    }
  }, [])

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
        setError('Không tìm thấy ví Ethereum. Vui lòng cài MetaMask rồi thử lại.')
        return
      }
      const chainId = Number((import.meta as unknown as { env: Record<string, string> }).env?.VITE_CHAIN_ID ?? 31337)
      await switchChain(chainId, window.ethereum)
      const accounts = await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })
      const address = accounts?.[0]
      if (!address) throw new Error('Bạn chưa chọn tài khoản ví.')
      setStep(1)
      const { message } = await onGetChallenge(address)
      const sig = await window.ethereum.request<string>({
        method: 'personal_sign',
        params: [message, address],
      })
      if (!sig) throw new Error('Bạn đã hủy yêu cầu ký.')
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
      const msg = e instanceof Error ? e.message : 'Không thể đăng nhập. Vui lòng thử lại.'
      if (msg.toLowerCase().includes('user rejected')) {
        setError('Bạn đã từ chối yêu cầu ký trên ví. Hãy thử lại và xác nhận chữ ký.')
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
    if (!codeToUse || !onComplete2FA) return
    setError(null)
    setSubmitting2FA(true)
    try {
      const result = await onComplete2FA(codeToUse)
      setStep(4)
      if (result.user && onSuccess) {
        onSuccess(result.user as AuthUser)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Mã xác thực không hợp lệ.'
      setError(msg)
      setTotpCode('')
    } finally {
      setSubmitting2FA(false)
    }
  }

  const stepsCurrentIndex = step === 0 ? -1 : step === 1 ? 0 : step === 2 ? 1 : step === 3 ? 2 : 3

  return (
    <main className="login-screen">
      <section className="login-shell" aria-label="Đăng nhập VNDC">
        <aside className="login-brand-panel">
          <div>
            <span className="vndc-mark vndc-mark-lg">
              <img src={vndcLogo} alt="VNDC Logo" style={{ width: 48, height: 48 }} />
            </span>
            {/* <h1 className="login-brand-heading">VNDC Education</h1> */}
            {/* <p className="login-brand-copy">
              Nền tảng học tập, hoạt động cộng đồng và giao dịch token vận hành trên local chain minh bạch.
            </p>

            <ul className="login-proof-list">
              <li className="login-proof-item">
                <span className="login-proof-icon"><SafetyCertificateOutlined /></span>
                <span>Không lưu private key. Người dùng ký trực tiếp trên ví.</span>
              </li>
              <li className="login-proof-item">
                <span className="login-proof-icon"><AuditOutlined /></span>
                <span>Đăng nhập theo chuẩn Sign-In With Ethereum.</span>
              </li>
              <li className="login-proof-item">
                <span className="login-proof-icon"><ThunderboltOutlined /></span>
                <span>Session ngắn hạn, tự refresh và hỗ trợ xác thực hai lớp.</span>
              </li>
            </ul> */}
          </div>

          <div className="login-brand-footer">
            Chain ID 31337 / EIP-4361 SIWE
          </div>
        </aside>

        <div className="login-card-panel">
          <Card className="login-card" styles={{ body: { padding: 0 } }}>
            <Space direction="vertical" size={22} style={{ width: '100%' }}>
              <div>
                {step !== 3 ? (
                  <>
                    <Title level={3} className="login-section-title">
                      {step === 4 ? 'Đăng nhập thành công' : 'Đăng nhập bằng ví'}
                    </Title>
                    <Text className="login-section-copy">
                      {step === 4
                        ? 'Đang tải dữ liệu tài khoản và quyền truy cập.'
                        : 'Kết nối MetaMask, ký challenge SIWE và vào hệ thống.'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Title level={3} className="login-section-title">
                      <LockOutlined style={{ marginRight: 8, color: 'var(--accent)' }} />
                      Xác thực hai lớp
                    </Title>
                    <Text className="login-section-copy">
                      {useBackup
                        ? 'Nhập mã backup 8 ký tự bạn đã lưu khi cài đặt.'
                        : 'Nhập mã 6 chữ số từ ứng dụng Authenticator.'}
                    </Text>
                  </>
                )}
              </div>

              {step > 0 && (
                <Steps
                  size="small"
                  current={stepsCurrentIndex}
                  status={step === 4 ? 'finish' : 'process'}
                  items={STEP_ITEMS.map((s, i) => ({
                    title: s.title,
                    description: s.description,
                    icon: stepsCurrentIndex > i ? <CheckCircleOutlined style={{ color: 'var(--success)' }} /> : undefined,
                  }))}
                />
              )}

              {error && (
                <Alert
                  type="error"
                  message={error}
                  closable
                  onClose={() => setError(null)}
                />
              )}

              {step === 3 ? (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Form onFinish={() => handle2FA()} layout="vertical">
                    <Form.Item style={{ marginBottom: 10 }}>
                      <Input
                        size="large"
                        prefix={<KeyOutlined style={{ color: '#64748B' }} />}
                        value={totpCode}
                        onChange={(e) => {
                          if (useBackup) setTotpCode(e.target.value.slice(0, 8))
                          else handleTotpChange(e.target.value)
                        }}
                        placeholder={useBackup ? 'Mã backup' : 'Mã TOTP'}
                        maxLength={useBackup ? 8 : 6}
                        style={{ fontSize: 20, letterSpacing: useBackup ? 2 : 8, textAlign: 'center' }}
                        autoFocus
                      />
                    </Form.Item>
                    <Button
                      type="primary"
                      size="large"
                      block
                      loading={submitting2FA}
                      htmlType="submit"
                    >
                      Xác nhận mã
                    </Button>
                  </Form>
                  <Button
                    type="link"
                    size="small"
                    block
                    onClick={() => { setUseBackup((b) => !b); setTotpCode(''); setError(null) }}
                  >
                    {useBackup ? 'Dùng mã TOTP từ ứng dụng' : 'Dùng mã backup thay thế'}
                  </Button>
                </Space>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={loading}
                  icon={step === 4 ? <CheckCircleOutlined /> : <WalletOutlined />}
                  onClick={handleConnect}
                  disabled={step === 4}
                >
                  {step === 0 && 'Kết nối ví MetaMask'}
                  {step === 1 && 'Đang chờ chữ ký'}
                  {step === 2 && 'Đang xác minh'}
                  {step === 4 && 'Đăng nhập thành công'}
                </Button>
              )}

              {step === 0 && (
                <Alert
                  type="info"
                  showIcon
                  message="Bảo mật ví"
                  description="VNDC chỉ yêu cầu chữ ký xác thực. Không có yêu cầu chuyển token hoặc cấp quyền chi tiêu khi đăng nhập."
                />
              )}
            </Space>
          </Card>
        </div>
      </section>
    </main>
  )
}

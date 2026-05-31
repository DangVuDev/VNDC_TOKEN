import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Row, Col, Card, Typography, Space, Button, Tag, Alert, Avatar,
  Input, InputNumber, Spin, Tooltip, message as antMessage,
  Segmented, Descriptions, Modal, Empty, Table,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  WalletOutlined, SendOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CopyOutlined, SyncOutlined, InfoCircleOutlined, QrcodeOutlined,
  UserOutlined, EditOutlined, CheckCircleOutlined, WarningOutlined,
  CloseCircleOutlined, DownloadOutlined, ReloadOutlined,
  SafetyCertificateOutlined, HistoryOutlined,
  SwapOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import jsQR from 'jsqr'
import {
  getBalance, getTransactions, transferToken, getNonce, toWei,
  lookupUserByUsername, lookupUserByWallet,
  type BalanceResponse, type Transaction, type PublicUserInfo,
} from '../lib/services'
import { signTypedData, buildTransferTypedData, switchChain } from '../lib/wallet'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text } = Typography

// ─── CSS animations ────────────────────────────────────────────────────────────
const PAGE_STYLES = `
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.7; }
    100% { transform: scale(2.4); opacity: 0;   }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0);     }
  }
  @keyframes pendingBlink {
    0%, 100% { opacity: 1;    }
    50%       { opacity: 0.3; }
  }
  @keyframes spin360 { to { transform: rotate(360deg); } }
  .tok-card { animation: fadeInUp 0.38s ease both; }
  .tok-card:nth-child(2) { animation-delay: 0.08s; }
  .tok-card:nth-child(3) { animation-delay: 0.16s; }
  .tok-tab  { transition: all 0.2s ease; cursor: pointer; outline: none; }
  .tok-tab:hover { transform: translateY(-1px); }
  .spin360  { animation: spin360 1s linear infinite; }
  .pend-blink { animation: pendingBlink 1.3s ease-in-out infinite; }
  .live-ring {
    position: absolute; inset: 0; border-radius: 50%;
    background: #F59E0B;
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .tx-row td { transition: background 0.15s; }
  .tx-row:hover td { background: #F8FAFF !important; cursor: pointer; }
`

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(val: string | number, decimals = 2) {
  try {
    const n = typeof val === 'string' ? BigInt(val) : BigInt(Math.floor(Number(val)))
    const whole = n / BigInt('1000000000000000000')
    const frac  = n % BigInt('1000000000000000000')
    const result = Number(whole) + Number(frac) / 1e18
    return isNaN(result) ? '0.00' : result.toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  } catch { return '0.00' }
}
function fmtCompact(val: string | number) {
  try {
    const n = typeof val === 'string' ? BigInt(val) : BigInt(Math.floor(Number(val)))
    const w = Number(n / BigInt('1000000000000000000'))
    if (w >= 1_000_000) return (w / 1e6).toFixed(2) + 'M'
    if (w >= 1_000)     return (w / 1e3).toFixed(2) + 'K'
    return w.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } catch { return '0.00' }
}
function shortenAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 8) + '...' + addr.slice(-6)
}
function isValidWallet(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}
function parseQRPayload(raw: string): { wallet: string; amount?: string } | null {
  const t = raw.trim()
  if (isValidWallet(t)) return { wallet: t.toLowerCase() }
  try {
    const obj = JSON.parse(t) as Record<string, unknown>
    const wallet = typeof obj.wallet === 'string' ? obj.wallet.toLowerCase() : ''
    if (!isValidWallet(wallet)) return null
    return { wallet, amount: obj.amount !== undefined ? String(obj.amount) : undefined }
  } catch { return null }
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TX_STATUS: Record<string, { color: string; label: string; bg: string }> = {
  PENDING:   { color: '#D97706', label: 'Đang xử lý',  bg: '#FFFBEB' },
  CONFIRMED: { color: '#059669', label: 'Đã xác nhận', bg: '#ECFDF5' },
  FAILED:    { color: '#DC2626', label: 'Thất bại',     bg: '#FEF2F2' },
}
const TX_TYPE: Record<string, { label: string; icon: string; color: string }> = {
  TRANSFER:              { label: 'Chuyển khoản',      icon: '\u{1F4B8}', color: '#4338CA' },
  ACTIVITY_REWARD:       { label: 'Thưởng hoạt động',  icon: '\u{1F3AF}', color: '#10B981' },
  DAO_REWARD:            { label: 'Phần thưởng DAO',   icon: '\u{1F5F3}', color: '#7C3AED' },
  NFT_PURCHASE:          { label: 'Mua NFT',            icon: '\u{1F5BC}', color: '#D97706' },
  CAMPAIGN_CONTRIBUTION: { label: 'Đóng góp gây quỹ',  icon: '\u{1F397}', color: '#DB2777' },
  TICKET_PURCHASE:       { label: 'Mua vé',             icon: '\u{1F3AB}', color: '#0891B2' },
  REFUND:                { label: 'Hoàn tiền',          icon: '\u21A9',    color: '#6B7280' },
}

// ─── QRScanner ─────────────────────────────────────────────────────────────────
interface QRScanResult { wallet: string; amount?: string }
function QRScanner({ onResult }: { onResult: (r: QRScanResult) => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef<number>(0)
  const [error,    setError]    = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [detected, setDetected] = useState(false)

  useEffect(() => { void startCamera(); return () => stopCamera() }, [])

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }
  async function startCamera() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        void videoRef.current.play()
        setScanning(true)
        tick()
      }
    } catch { setError('Không thể truy cập camera. Hãy cho phép quyền camera và thử lại.') }
  }
  function tick() {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return }
    const ctx = canvas.getContext('2d')!
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const img  = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(img.data, img.width, img.height)
    if (code) {
      const parsed = parseQRPayload(code.data)
      if (parsed) { setDetected(true); stopCamera(); onResult(parsed); return }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  if (error) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <CloseCircleOutlined style={{ fontSize: 48, color: '#EF4444', display: 'block', marginBottom: 12 }} />
      <Text type="danger" style={{ display: 'block', marginBottom: 16 }}>{error}</Text>
      <Button icon={<ReloadOutlined />} onClick={() => void startCamera()} type="primary"
        style={{ background: '#4338CA', borderColor: '#4338CA', borderRadius: 10 }}>Thử lại</Button>
    </div>
  )
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 360, margin: '0 auto' }}>
      <video ref={videoRef} muted playsInline
        style={{ width: '100%', borderRadius: 16, display: detected ? 'none' : 'block', background: '#000' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {scanning && !detected && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 160, height: 160, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}>
          <div style={{ position: 'absolute', top: 0,    left:  0,   width: 22, height: 22, borderTop:    '3px solid #6366F1', borderLeft:   '3px solid #6366F1' }} />
          <div style={{ position: 'absolute', top: 0,    right: 0,   width: 22, height: 22, borderTop:    '3px solid #6366F1', borderRight:  '3px solid #6366F1' }} />
          <div style={{ position: 'absolute', bottom: 0, left:  0,   width: 22, height: 22, borderBottom: '3px solid #6366F1', borderLeft:   '3px solid #6366F1' }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0,   width: 22, height: 22, borderBottom: '3px solid #6366F1', borderRight:  '3px solid #6366F1' }} />
        </div>
      )}
      {detected && (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 56, color: '#10B981' }} />
          <Title level={4} style={{ color: '#10B981', marginTop: 12 }}>Đọc QR thành công!</Title>
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Đưa mã QR vào khung để quét tự động</Text>
      </div>
    </div>
  )
}

// ─── RecipientCard ─────────────────────────────────────────────────────────────
function RecipientCard({ info, walletAddr }: { info: PublicUserInfo | null; walletAddr: string }) {
  if (!walletAddr) return null
  const isKYC = info?.kyc_verified
  return (
    <div style={{ borderRadius: 14, padding: '14px 18px', background: isKYC ? 'linear-gradient(135deg,#ECFDF5,#D1FAE5)' : 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: `1.5px solid ${isKYC ? '#6EE7B7' : '#FCD34D'}`, display: 'flex', alignItems: 'center', gap: 14 }}>
      <Avatar size={48} src={info?.avatar_uri} icon={<UserOutlined />}
        style={{ background: isKYC ? '#10B981' : '#F59E0B', flexShrink: 0, border: `2px solid ${isKYC ? '#6EE7B7' : '#FCD34D'}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {info ? (
          <>
            <Text strong style={{ fontSize: 15 }}>{info.full_name || info.username || shortenAddr(info.wallet_address)}</Text>
            <div style={{ marginTop: 4 }}>
              {info.username && <Tag style={{ fontSize: 11 }}>{info.username}</Tag>}
              <Tag color={isKYC ? 'success' : 'warning'} style={{ fontSize: 11 }}>
                {isKYC ? <><SafetyCertificateOutlined /> KYC Lv {info.kyc_level}</> : <><WarningOutlined /> Chưa KYC</>}
              </Tag>
            </div>
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{shortenAddr(info.wallet_address)}</Text>
          </>
        ) : (
          <>
            <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{shortenAddr(walletAddr)}</Text>
            <div><Tag color="warning" style={{ fontSize: 11 }}><WarningOutlined /> Không tìm thấy thông tin</Tag></div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── TransferPanel ─────────────────────────────────────────────────────────────
type InputMethod = 'qr' | 'username' | 'manual'
interface TransferPanelProps { walletAddr: string; onchainBal: number; onSuccess: () => void }

function TransferPanel({ walletAddr, onchainBal, onSuccess }: TransferPanelProps) {
  const [method,          setMethod]          = useState<InputMethod>('qr')
  const [recipientWallet, setRecipientWallet] = useState('')
  const [recipientInfo,   setRecipientInfo]   = useState<PublicUserInfo | null>(null)
  const [lookupLoading,   setLookupLoading]   = useState(false)
  const [lookupError,     setLookupError]     = useState<string | null>(null)
  const [hasNonKYCWarning, setHasNonKYCWarning] = useState(false)
  const [nonKYCConfirmed,  setNonKYCConfirmed]  = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [manualInput,   setManualInput]   = useState('')
  const [amount,      setAmount]      = useState<number | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [note,        setNote]        = useState('')
  const [sending,     setSending]     = useState(false)
  const [step,        setStep]        = useState(0)

  function resetRecipient() {
    setRecipientWallet(''); setRecipientInfo(null); setLookupError(null)
    setHasNonKYCWarning(false); setNonKYCConfirmed(false)
    setManualInput(''); setUsernameInput(''); setStep(0); setAmount(null); setAmountError(null); setNote('')
  }
  function applyRecipient(wallet: string, info: PublicUserInfo | null, presetAmount?: string) {
    setRecipientWallet(wallet); setRecipientInfo(info)
    setHasNonKYCWarning(!info?.kyc_verified); setNonKYCConfirmed(false)
    if (presetAmount) setAmount(parseFloat(presetAmount) || null)
    setStep(1)
  }
  function handleQRResult(result: QRScanResult) {
    setScanModalOpen(false)
    const wallet = result.wallet.toLowerCase()
    void (async () => {
      setLookupLoading(true)
      try {
        const info = await lookupUserByWallet(wallet)
        applyRecipient(wallet, info, result.amount)
      } catch {
        // On API error, proceed with null info (will show KYC warning)
        applyRecipient(wallet, null, result.amount)
      } finally {
        setLookupLoading(false)
      }
    })()
  }
  async function handleUsernameSearch() {
    if (!usernameInput.trim()) return
    setLookupLoading(true); setLookupError(null)
    try {
      const info = await lookupUserByUsername(usernameInput.trim())
      applyRecipient(info.wallet_address, info)
    } catch { setLookupError('Không tìm thấy người dùng với username này') }
    finally { setLookupLoading(false) }
  }
  async function handleManualLookup() {
    const normalized = manualInput.trim().toLowerCase()
    if (!isValidWallet(normalized)) { setLookupError('Địa chỉ ví không hợp lệ (cần bắt đầu bằng 0x, 42 ký tự)'); return }
    setLookupLoading(true); setLookupError(null)
    try {
      const info = await lookupUserByWallet(normalized)
      // info === null  → wallet not linked to any user in system (404) → warn
      // info.kyc_verified === false → user found but not KYC'd → warn
      // info.kyc_verified === true  → all good, no warning
      applyRecipient(normalized, info)
    } catch {
      setLookupError('Không thể kiểm tra địa chỉ ví. Vui lòng thử lại sau.')
    } finally {
      setLookupLoading(false)
    }
  }
  async function handleSend() {
    if (!recipientWallet || !amount) return
    if (hasNonKYCWarning && !nonKYCConfirmed) return
    setSending(true)
    try {
      const chainId  = Number((import.meta as unknown as { env: Record<string, string> }).env?.VITE_CHAIN_ID ?? 31337)
      const contract = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_TOKEN_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000'
      await switchChain(chainId, window.ethereum)
      const { nonce } = await getNonce(walletAddr)
      const deadline  = Math.floor(Date.now() / 1000) + 3600
      const amountWei = toWei(amount)
      const typedData = buildTransferTypedData({ chainId, verifyingContract: contract, from: walletAddr, to: recipientWallet, amount: amountWei, nonce: nonce.toString(), deadline: deadline.toString() })
      const sig = await signTypedData(window.ethereum, walletAddr, typedData as Record<string, unknown>)
      await transferToken(walletAddr, recipientWallet, amountWei, sig as string, typedData as Record<string, unknown>)
      antMessage.success('Giao dịch đã gửi thành công!')
      resetRecipient(); onSuccess()
    } catch (e) { antMessage.error(e instanceof Error ? e.message : 'Giao dịch thất bại') }
    finally { setSending(false) }
  }

  const methodOptions = [
    { value: 'qr',       label: <Space size={4}><QrcodeOutlined />Quét QR</Space> },
    { value: 'username', label: <Space size={4}><UserOutlined />Mã sinh viên</Space> },
    { value: 'manual',   label: <Space size={4}><EditOutlined />Địa chỉ ví</Space> },
  ]

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      {/* Steps indicator */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#4338CA', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, boxShadow: '0 0 0 4px rgba(67,56,202,0.15)', flexShrink: 0 }}>1</div>
          <Text style={{ fontSize: 13, fontWeight: step === 0 ? 700 : 500, color: '#4338CA' }}>Chọn người nhận</Text>
        </div>
        <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg,#4338CA ${step >= 1 ? '100%' : '8%'},#E5E7EB ${step >= 1 ? '100%' : '8%'})`, borderRadius: 2, transition: 'all 0.4s ease', margin: '0 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: step >= 1 ? '#4338CA' : '#E5E7EB', color: step >= 1 ? '#fff' : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, transition: 'all 0.3s', flexShrink: 0 }}>2</div>
          <Text style={{ fontSize: 13, fontWeight: step === 1 ? 700 : 500, color: step >= 1 ? '#4338CA' : '#9CA3AF', transition: 'all 0.3s' }}>Xác nhận giao dịch</Text>
        </div>
      </div>

      {step === 0 && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Segmented value={method} onChange={(v) => { setMethod(v as InputMethod); resetRecipient() }} options={methodOptions} block style={{ borderRadius: 12 }} />

          {method === 'qr' && (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg,#EEF2FF,#E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 20px rgba(67,56,202,0.15)' }}>
                <QrcodeOutlined style={{ fontSize: 40, color: '#4338CA' }} />
              </div>
              <Text style={{ color: '#6B7280', fontSize: 14, display: 'block', marginBottom: 24, lineHeight: 1.7 }}>
                Quét mã QR từ ví người nhận.<br />Số token trong QR sẽ tự động điền vào.
              </Text>
              <Button type="primary" size="large" icon={<QrcodeOutlined />} onClick={() => setScanModalOpen(true)}
                style={{ minWidth: 230, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#4338CA,#6366F1)', border: 'none', fontSize: 15, fontWeight: 700, boxShadow: '0 8px 24px rgba(67,56,202,0.35)' }}>
                Mở Camera Quét QR
              </Button>
              {lookupLoading && <div style={{ marginTop: 16 }}><Spin tip="Đang tra cứu ví..." /></div>}
            </div>
          )}
          {method === 'username' && (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Nhập mã sinh viên để tra cứu địa chỉ ví tự động.</Text>
              <Input.Search value={usernameInput} onChange={(e) => { setUsernameInput(e.target.value); setLookupError(null) }}
                onSearch={() => void handleUsernameSearch()} placeholder="VD: 20021234" size="large"
                loading={lookupLoading}
                enterButton={<Button type="primary" style={{ background: '#4338CA', borderColor: '#4338CA' }}>Tra cứu</Button>}
                prefix={<UserOutlined style={{ color: '#9CA3AF' }} />} />
              {lookupError && <Alert type="error" message={lookupError} showIcon style={{ borderRadius: 10 }} />}
            </Space>
          )}
          {method === 'manual' && (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>Nhập địa chỉ ví Ethereum (0x...). Hệ thống sẽ kiểm tra trạng thái KYC.</Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input value={manualInput} onChange={(e) => { setManualInput(e.target.value); setLookupError(null) }}
                  placeholder="0x..." size="large" style={{ fontFamily: 'monospace' }}
                  prefix={<WalletOutlined style={{ color: '#9CA3AF' }} />} />
                <Button type="primary" size="large" loading={lookupLoading} onClick={() => void handleManualLookup()}
                  disabled={!isValidWallet(manualInput)} style={{ background: '#4338CA', borderColor: '#4338CA' }}>Kiểm tra</Button>
              </Space.Compact>
              {lookupError && <Alert type="error" message={lookupError} showIcon style={{ borderRadius: 10 }} />}
            </Space>
          )}
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <RecipientCard info={recipientInfo} walletAddr={recipientWallet} />
          {hasNonKYCWarning && (
            <Alert type="warning" showIcon icon={<WarningOutlined />}
              message={recipientInfo ? 'Người nhận chưa hoàn thành KYC' : 'Địa chỉ ví chưa đăng ký trong hệ thống'}
              description={
                <Space direction="vertical" size={8}>
                  <Text>
                    {recipientInfo
                      ? <>Tài khoản <Text code style={{ fontSize: 11 }}>{shortenAddr(recipientWallet)}</Text> chưa được xác minh KYC. Giao dịch có thể gặp rủi ro.</>
                      : <>Địa chỉ <Text code style={{ fontSize: 11 }}>{shortenAddr(recipientWallet)}</Text> chưa được gắn với tài khoản nào trong hệ thống. Hãy kiểm tra lại trước khi chuyển.</>
                    }
                  </Text>
                  <Button danger={!nonKYCConfirmed} type={nonKYCConfirmed ? 'default' : 'primary'} size="small"
                    icon={nonKYCConfirmed ? <CheckCircleOutlined /> : <WarningOutlined />}
                    onClick={() => setNonKYCConfirmed(!nonKYCConfirmed)}>
                    {nonKYCConfirmed ? 'Đã xác nhận rủi ro' : 'Tôi hiểu và muốn tiếp tục'}
                  </Button>
                </Space>
              }
              style={{ borderRadius: 12 }} />
          )}
          <div style={{ background: '#F8FAFF', borderRadius: 16, padding: '20px 22px', border: '1.5px solid #E0E7FF' }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#1A1744' }}>Số lượng VNDC</Text>
                <InputNumber
                  value={amount}
                  onChange={(v) => {
                    setAmount(v)
                    if (v === null || v <= 0) setAmountError('Vui lòng nhập số lượng lớn hơn 0')
                    else if (v > onchainBal) setAmountError(`Vượt quá số dư khả dụng (${fmt(onchainBal)} VNDC)`)
                    else setAmountError(null)
                  }}
                  min={0}
                  precision={2}
                  style={{ width: '100%', borderColor: amountError ? '#DC2626' : undefined }}
                  size="large"
                  addonAfter={<Text strong style={{ color: '#4338CA' }}>VNDC</Text>}
                  placeholder="0.00"
                  status={amountError ? 'error' : undefined}
                />
                {amountError && (
                  <Text style={{ fontSize: 12, color: '#DC2626', display: 'block', marginTop: 4 }}>
                    ⚠ {amountError}
                  </Text>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: amountError ? 4 : 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Khả dụng: <Text strong style={{ color: '#10B981' }}>{fmt(onchainBal)} VNDC</Text></Text>
                  <Button type="link" size="small"
                    onClick={() => { setAmount(onchainBal); setAmountError(null) }}
                    style={{ fontSize: 12, padding: 0, height: 'auto', color: '#4338CA' }}>Tối đa</Button>
                </div>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#1A1744' }}>
                  Ghi chú <Text type="secondary" style={{ fontWeight: 400 }}>(tùy chọn)</Text>
                </Text>
                <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder="Lý do chuyển khoản..." maxLength={200} showCount style={{ borderRadius: 10 }} />
              </div>
            </Space>
          </div>
          <Alert type="info" showIcon icon={<InfoCircleOutlined />}
            message="Giao dịch dùng chữ ký EIP-712 qua MetaMask. Không mất gas fee."
            style={{ borderRadius: 10, fontSize: 13 }} />
          <Row gutter={12}>
            <Col span={10}>
              <Button block size="large" onClick={resetRecipient} icon={<ArrowUpOutlined />}
                style={{ borderRadius: 12, height: 50 }}>Chọn lại</Button>
            </Col>
            <Col span={14}>
              <Button block type="primary" size="large" icon={<SendOutlined />} loading={sending}
                disabled={!amount || amount <= 0 || !!amountError || (hasNonKYCWarning && !nonKYCConfirmed)}
                onClick={() => void handleSend()}
                style={{ borderRadius: 12, height: 50, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg,#4338CA,#6366F1)', border: 'none', boxShadow: '0 8px 24px rgba(67,56,202,0.35)' }}>
                {sending ? 'Đang ký...' : 'Ký & Chuyển khoản'}
              </Button>
            </Col>
          </Row>
        </Space>
      )}

      <Modal open={scanModalOpen} onCancel={() => setScanModalOpen(false)}
        title={<Space><QrcodeOutlined style={{ color: '#4338CA' }} /><span style={{ fontWeight: 700 }}>Quét Mã QR</span></Space>}
        footer={null} width={420} destroyOnClose centered>
        <QRScanner onResult={handleQRResult} />
      </Modal>
    </Space>
  )
}

// ─── ReceivePanel ──────────────────────────────────────────────────────────────
function ReceivePanel({ walletAddr }: { walletAddr: string }) {
  const [amount, setAmount] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const qrData = amount && amount > 0
    ? JSON.stringify({ wallet: walletAddr, amount: amount.toFixed(2), token: 'VNDC' })
    : walletAddr

  function copyWallet() {
    void navigator.clipboard.writeText(walletAddr).then(() => {
      setCopied(true); void antMessage.success('Đã sao chép địa chỉ ví!')
      setTimeout(() => setCopied(false), 2000)
    })
  }
  function downloadQR() {
    const svg = document.getElementById('receive-qr-svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `vndc-receive-${walletAddr.slice(0, 8)}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div style={{ background: 'linear-gradient(135deg,#1E1A5C,#312E81)', borderRadius: 18, padding: '24px 28px' }}>
        <Text style={{ color: '#A5B4FC', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 8 }}>Địa chỉ ví của bạn</Text>
        <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 14, wordBreak: 'break-all', display: 'block', lineHeight: 1.7, marginBottom: 16 }}>{walletAddr}</Text>
        <Button icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />} onClick={copyWallet}
          style={{ borderColor: 'rgba(165,180,252,0.4)', color: copied ? '#6EE7B7' : '#A5B4FC', background: 'rgba(255,255,255,0.08)', borderRadius: 10, transition: 'all 0.2s', fontWeight: 600 }}>
          {copied ? 'Đã sao chép!' : 'Sao chép địa chỉ'}
        </Button>
      </div>
      <Row gutter={[20, 20]}>
        <Col xs={24} md={12}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 20px 16px', border: '1.5px solid #E0E7FF', textAlign: 'center', boxShadow: '0 4px 24px rgba(67,56,202,0.08)', height: '100%' }}>
            <Tag color="blue" style={{ fontSize: 12, marginBottom: 14 }}><QrcodeOutlined /> Mã QR nhận token</Tag>
            <div style={{ padding: 14, background: '#fff', borderRadius: 14, display: 'inline-block', boxShadow: '0 2px 16px rgba(0,0,0,0.1)', marginBottom: 14 }}>
              <QRCodeSVG id="receive-qr-svg" value={qrData || walletAddr} size={200} level="H" includeMargin />
            </div>
            {amount && amount > 0 && (
              <div style={{ marginBottom: 10 }}>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 14px' }}>Yêu cầu: {fmt(amount)} VNDC</Tag>
              </div>
            )}
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#D1D5DB', display: 'block', marginBottom: 14 }}>{shortenAddr(walletAddr)}</Text>
            <Button icon={<DownloadOutlined />} onClick={downloadQR} style={{ borderRadius: 10 }}>Tải QR về</Button>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div style={{ background: '#FFFBEB', borderRadius: 18, padding: '20px 22px', border: '1.5px solid #FDE68A', height: '100%' }}>
            <div style={{ marginBottom: 14 }}>
              <SwapOutlined style={{ color: '#D97706', fontSize: 18, marginRight: 8 }} />
              <Text strong style={{ color: '#92400E', fontSize: 15 }}>Nhúng số token vào QR</Text>
              <Tag style={{ marginLeft: 8, fontSize: 11 }}>Tùy chọn</Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16, lineHeight: 1.6 }}>
              Người gửi sẽ thấy số VNDC cần chuyển khi quét QR — tiện cho giao dịch cố định.
            </Text>
            <InputNumber value={amount} onChange={(v) => setAmount(v)} min={0} precision={2}
              style={{ width: '100%' }} size="large"
              addonAfter={<Text strong style={{ color: '#D97706' }}>VNDC</Text>}
              placeholder="Để trống nếu không cố định" />
            {amount && amount > 0 && (
              <Alert type="warning" showIcon message={`QR sẽ yêu cầu chuyển ${fmt(amount)} VNDC`}
                style={{ marginTop: 12, borderRadius: 10 }} />
            )}
          </div>
        </Col>
      </Row>
    </Space>
  )
}

// ─── HistoryPanel ──────────────────────────────────────────────────────────────
function HistoryPanel({ walletAddr, loading, txs, total, page, onPageChange, onRefresh }: {
  walletAddr: string; loading: boolean; txs: Transaction[]; total: number; page: number;
  onPageChange: (p: number) => void; onRefresh: () => void;
}) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [detailOpen, setDetailOpen]  = useState(false)
  const hasPending = txs.some(t => t.status === 'PENDING')

  const columns: ColumnsType<Transaction> = [
    {
      title: 'Loại', dataIndex: 'type', width: 170,
      render: (type: string, tx: Transaction) => {
        const isSend   = tx.from_wallet?.toLowerCase() === walletAddr.toLowerCase()
        const typeInfo = TX_TYPE[type] ?? { label: type, icon: '·', color: '#6B7280' }
        return (
          <Space direction="vertical" size={3}>
            <Space size={5}>
              <span style={{ fontSize: 16 }}>{typeInfo.icon}</span>
              <Text style={{ fontSize: 12, fontWeight: 600, color: typeInfo.color }}>{typeInfo.label}</Text>
            </Space>
            <span style={{ fontSize: 10, fontWeight: 600, color: isSend ? '#DC2626' : '#059669', background: isSend ? '#FEF2F2' : '#ECFDF5', padding: '1px 8px', borderRadius: 4, display: 'inline-block' }}>
              {isSend ? '↑ Gửi đi' : '↓ Nhận về'}
            </span>
          </Space>
        )
      },
    },
    {
      title: 'Đối tác', key: 'addr',
      render: (_: unknown, tx: Transaction) => {
        const isSend      = tx.from_wallet?.toLowerCase() === walletAddr.toLowerCase()
        const counterpart = isSend ? tx.to_wallet : tx.from_wallet
        return (
          <Space direction="vertical" size={1}>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{isSend ? '→ Đến' : '← Từ'}</Text>
            <Text copyable={{ text: counterpart }} style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortenAddr(counterpart)}</Text>
          </Space>
        )
      },
    },
    {
      title: 'Số lượng', dataIndex: 'amount', width: 160,
      render: (amount: string, tx: Transaction) => {
        const isSend = tx.from_wallet?.toLowerCase() === walletAddr.toLowerCase()
        return (
          <Text strong style={{ color: isSend ? '#DC2626' : '#059669', fontFamily: 'monospace', fontSize: 15 }}>
            {isSend ? '−' : '+'}{fmt(amount)}
            <Text style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 4 }}>VNDC</Text>
          </Text>
        )
      },
    },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 140,
      render: (status: string) => {
        const s = TX_STATUS[status] ?? { color: '#6B7280', label: status, bg: '#F9FAFB' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {status === 'PENDING' ? (
              <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
                <div className="live-ring" style={{ background: '#D97706' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', position: 'absolute', top: 1, left: 1 }} />
              </div>
            ) : (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            )}
            <Text style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</Text>
          </div>
        )
      },
    },
    {
      title: 'Thời gian', dataIndex: 'created_at', width: 140,
      render: (v: string) => (
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
          {new Date(v).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </Text>
      ),
    },
    {
      title: '', width: 48,
      render: (_: unknown, tx: Transaction) => (
        <Button type="text" size="small" icon={<InfoCircleOutlined style={{ color: '#9CA3AF' }} />}
          onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); setDetailOpen(true) }} />
      ),
    },
  ]

  return (
    <>
      <div style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', overflow: 'hidden', boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E0E7FF', background: '#F8FAFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <Space>
            <HistoryOutlined style={{ color: '#4338CA', fontSize: 16 }} />
            <Text strong style={{ color: '#1A1744', fontSize: 15 }}>Lịch Sử Giao Dịch</Text>
            <div style={{ padding: '2px 10px', background: '#EEF2FF', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{total}</div>
            {hasPending && (
              <Space size={6}>
                <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
                  <div className="live-ring" style={{ background: '#D97706' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', position: 'absolute', top: 1, left: 1 }} />
                </div>
                <Text className="pend-blink" style={{ color: '#D97706', fontSize: 12, fontWeight: 700 }}>Đang cập nhật tự động...</Text>
              </Space>
            )}
          </Space>
          <Button icon={<SyncOutlined className={loading ? 'spin360' : ''} />} onClick={onRefresh}
            size="small" style={{ borderRadius: 8, borderColor: '#E0E7FF', color: '#4338CA' }}>Làm mới</Button>
        </div>
        {txs.length === 0 && !loading ? (
          <Empty description="Chưa có giao dịch nào" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '52px 0' }} />
        ) : (
          <Table dataSource={txs} columns={columns} rowKey="id" loading={loading} size="small" scroll={{ x: 720 }}
            rowClassName={() => 'tx-row'}
            onRow={(tx) => ({ onClick: () => { setSelectedTx(tx); setDetailOpen(true) } })}
            pagination={{ total, current: page, pageSize: 10, onChange: onPageChange, showTotal: (t) => `${t} giao dịch`, showSizeChanger: false, style: { margin: '12px 16px' } }} />
        )}
      </div>

      <Modal open={detailOpen} onCancel={() => setDetailOpen(false)}
        title={<Space><InfoCircleOutlined style={{ color: '#4338CA' }} /><Text strong>Chi Tiết Giao Dịch</Text></Space>}
        footer={<Button onClick={() => setDetailOpen(false)} style={{ borderRadius: 8 }}>Đóng</Button>}
        width={520} centered>
        {selectedTx && (() => {
          const isSend     = selectedTx.from_wallet?.toLowerCase() === walletAddr.toLowerCase()
          const typeInfo   = TX_TYPE[selectedTx.type] ?? { label: selectedTx.type, icon: '·', color: '#6B7280' }
          const statusInfo = TX_STATUS[selectedTx.status] ?? { color: '#6B7280', label: selectedTx.status, bg: '#F9FAFB' }
          return (
            <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
              <div style={{ background: isSend ? '#FEF2F2' : '#ECFDF5', borderRadius: 14, padding: '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{typeInfo.icon}</div>
                <Title level={3} style={{ color: isSend ? '#DC2626' : '#059669', margin: 0, fontFamily: 'monospace' }}>
                  {isSend ? '−' : '+'}{fmt(selectedTx.amount)} <span style={{ fontSize: 16, opacity: 0.8 }}>VNDC</span>
                </Title>
                <div style={{ marginTop: 10, padding: '4px 14px', display: 'inline-block', borderRadius: 20, background: statusInfo.bg, border: `1px solid ${statusInfo.color}`, color: statusInfo.color, fontWeight: 700, fontSize: 13 }}>
                  {statusInfo.label}
                </div>
              </div>
              <Descriptions column={1} size="small" bordered style={{ borderRadius: 10, overflow: 'hidden' }}>
                <Descriptions.Item label="ID"><Text copyable style={{ fontFamily: 'monospace', fontSize: 11 }}>{selectedTx.id}</Text></Descriptions.Item>
                <Descriptions.Item label="Loại"><Space><span>{typeInfo.icon}</span><Text>{typeInfo.label}</Text></Space></Descriptions.Item>
                <Descriptions.Item label="Từ"><Text copyable style={{ fontFamily: 'monospace', fontSize: 11 }}>{selectedTx.from_wallet}</Text></Descriptions.Item>
                <Descriptions.Item label="Đến"><Text copyable style={{ fontFamily: 'monospace', fontSize: 11 }}>{selectedTx.to_wallet}</Text></Descriptions.Item>
                <Descriptions.Item label="Thời gian">{new Date(selectedTx.created_at).toLocaleString('vi-VN')}</Descriptions.Item>
                {selectedTx.tx_hash && <Descriptions.Item label="TX Hash"><Text copyable style={{ fontFamily: 'monospace', fontSize: 10 }}>{selectedTx.tx_hash}</Text></Descriptions.Item>}
              </Descriptions>
            </Space>
          )
        })()}
      </Modal>
    </>
  )
}

// ─── TokenPage (main) ──────────────────────────────────────────────────────────
interface TokenPageProps { user?: AuthUser }
type ActiveTab = 'transfer' | 'receive' | 'history'

export function TokenPage({ user }: TokenPageProps) {
  const [balance,       setBalance]       = useState<BalanceResponse | null>(null)
  const [txs,           setTxs]           = useState<Transaction[]>([])
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [activeTab,     setActiveTab]     = useState<ActiveTab>('transfer')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const walletAddr    = user?.wallet_address ?? ''
  const onchainBalWei = balance?.on_chain ?? '0'
  const pendingBalWei = balance?.pending  ?? '0'

  const availableWei = (() => {
    try { const v = BigInt(onchainBalWei) - BigInt(pendingBalWei); return v < 0n ? '0' : v.toString() }
    catch { return '0' }
  })()

  const hasPending = (() => {
    try { return BigInt(pendingBalWei) > 0n || txs.some(t => t.status === 'PENDING') }
    catch { return false }
  })()

  const loadData = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const [bal, txData] = await Promise.all([
        getBalance(walletAddr).catch(() => null),
        getTransactions(p, 10).catch(() => ({ transactions: [], total: 0 })),
      ])
      if (bal) setBalance(bal)
      setTxs(txData.transactions ?? [])
      setTotal(txData.total)
      setLastRefreshed(new Date())
    } finally { setLoading(false) }
  }, [page, walletAddr])

  const silentRefresh = useCallback(async () => {
    try {
      const [bal, txData] = await Promise.all([
        getBalance(walletAddr).catch(() => null),
        getTransactions(page, 10).catch(() => ({ transactions: [], total: 0 })),
      ])
      if (bal) setBalance(bal)
      setTxs(txData.transactions ?? [])
      setTotal(txData.total)
      setLastRefreshed(new Date())
    } catch { /* silent */ }
  }, [walletAddr, page])

  // Initial load
  useEffect(() => { void loadData() }, [])

  // Auto-refresh every 3s when any transaction is pending
  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => void silentRefresh(), 3000)
    return () => clearInterval(timer)
  }, [hasPending, silentRefresh])

  const tabDefs = [
    { value: 'transfer' as ActiveTab, emoji: '💸', label: 'Chuyển Token',  color: '#4338CA' },
    { value: 'receive'  as ActiveTab, emoji: '📥', label: 'Nhận Token',    color: '#059669' },
    { value: 'history'  as ActiveTab, emoji: '📋', label: 'Lịch Sử',       color: '#D97706' },
  ]

  return (
    <>
      <style>{PAGE_STYLES}</style>
      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 40 }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#0F0E2B 0%,#1E1A5C 50%,#312E81 100%)', borderRadius: 22, padding: '24px 32px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', boxShadow: '0 20px 60px rgba(67,56,202,0.32)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', pointerEvents: 'none' }} />
          <div style={{ width: 58, height: 58, borderRadius: 17, background: 'rgba(99,102,241,0.2)', border: '1.5px solid rgba(165,180,252,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WalletOutlined style={{ fontSize: 28, color: '#A5B4FC' }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Title level={3} style={{ color: '#fff', margin: 0, fontFamily: 'Georgia,serif', lineHeight: 1.2 }}>Quản Lý Token VNDC</Title>
            <Text style={{ color: '#818CF8', fontSize: 13 }}>Chuyển, nhận token và theo dõi giao dịch theo thời gian thực</Text>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 180 }}>
            {hasPending ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 5 }}>
                <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
                  <div className="live-ring" style={{ background: '#F59E0B' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', position: 'absolute', top: 1, left: 1 }} />
                </div>
                <Text className="pend-blink" style={{ color: '#FCD34D', fontSize: 12, fontWeight: 700 }}>Đang xử lý · Tự cập nhật / 3s</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                <Text style={{ color: '#6EE7B7', fontSize: 12, fontWeight: 600 }}>Đã đồng bộ</Text>
              </div>
            )}
            {lastRefreshed && (
              <Text style={{ color: '#818CF8', fontSize: 11 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {lastRefreshed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            )}
          </div>
        </div>

        {/* ── Balance Cards ── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
          <Col xs={24} sm={8} className="tok-card">
            <div style={{ background: 'linear-gradient(135deg,#4338CA,#6366F1)', borderRadius: 18, padding: '22px 24px', boxShadow: '0 12px 40px rgba(67,56,202,0.3)', position: 'relative', overflow: 'hidden', height: '100%', minHeight: 130 }}>
              <div style={{ position: 'absolute', right: -16, bottom: -16, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 8 }}>Số dư khả dụng</Text>
              {loading ? <Spin size="small" style={{ marginTop: 4 }} /> : (
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.2, marginBottom: 6 }}>
                  {fmtCompact(availableWei)} <span style={{ fontSize: 14, opacity: 0.8, fontWeight: 500 }}>VNDC</span>
                </div>
              )}
              <Tooltip title={walletAddr}>
                <Text style={{ color: 'rgba(255,255,255,0.52)', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer' }}
                  onClick={() => { void navigator.clipboard.writeText(walletAddr); void antMessage.success('Đã sao chép!') }}>
                  <CopyOutlined style={{ marginRight: 4 }} />{shortenAddr(walletAddr)}
                </Text>
              </Tooltip>
            </div>
          </Col>

          <Col xs={24} sm={8} className="tok-card">
            <div style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', border: '1.5px solid #A7F3D0', boxShadow: '0 4px 20px rgba(16,185,129,0.1)', height: '100%', minHeight: 130 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowDownOutlined style={{ color: '#10B981', fontSize: 17 }} />
                </div>
                <Text style={{ fontSize: 12, color: '#065F46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>On-Chain · Xác nhận</Text>
              </div>
              {loading ? <Spin size="small" /> : (
                <div style={{ color: '#065F46', fontSize: 22, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.2, marginBottom: 6 }}>
                  {fmt(onchainBalWei)} <span style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>VNDC</span>
                </div>
              )}
              <Text style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>✓ Đã xác nhận trên blockchain</Text>
            </div>
          </Col>

          <Col xs={24} sm={8} className="tok-card">
            <div style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', border: `1.5px solid ${hasPending ? '#FCD34D' : '#E5E7EB'}`, boxShadow: hasPending ? '0 4px 20px rgba(245,158,11,0.18)' : '0 2px 8px rgba(0,0,0,0.04)', height: '100%', minHeight: 130, transition: 'all 0.35s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: hasPending ? '#FFFBEB' : '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SyncOutlined className={hasPending ? 'spin360' : ''} style={{ color: hasPending ? '#F59E0B' : '#9CA3AF', fontSize: 17 }} />
                </div>
                <Text style={{ fontSize: 12, color: hasPending ? '#92400E' : '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đang xử lý</Text>
              </div>
              {loading ? <Spin size="small" /> : (
                <div style={{ color: hasPending ? '#D97706' : '#9CA3AF', fontSize: 22, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.2, marginBottom: 6, transition: 'color 0.3s' }}>
                  {fmt(pendingBalWei)} <span style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>VNDC</span>
                </div>
              )}
              {hasPending
                ? <Text className="pend-blink" style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>⏳ Chờ blockchain xác nhận</Text>
                : <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Không có giao dịch chờ</Text>
              }
            </div>
          </Col>
        </Row>

        {/* ── Tab Navigation ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, background: '#F1F5F9', borderRadius: 16, padding: 5 }}>
          {tabDefs.map(tab => (
            <button key={tab.value} className="tok-tab" onClick={() => setActiveTab(tab.value)}
              style={{ flex: 1, padding: '13px 10px', borderRadius: 13, border: 'none', cursor: 'pointer', background: activeTab === tab.value ? '#fff' : 'transparent', boxShadow: activeTab === tab.value ? '0 2px 14px rgba(0,0,0,0.09)' : 'none', color: activeTab === tab.value ? tab.color : '#6B7280', fontWeight: activeTab === tab.value ? 700 : 500, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{tab.emoji}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ animation: 'fadeInUp 0.25s ease' }}>
          {activeTab === 'transfer' && (
            <Card style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }}
              title={<Space><span style={{ fontSize: 18 }}>💸</span><Text strong style={{ color: '#1A1744', fontSize: 15 }}>Chuyển Token VNDC</Text></Space>}
              styles={{ body: { padding: '24px 28px' } }}>
              <TransferPanel walletAddr={walletAddr}
                onchainBal={Number(BigInt(availableWei)) / 1e18}
                onSuccess={() => { setActiveTab('history'); void loadData(1) }} />
            </Card>
          )}
          {activeTab === 'receive' && (
            <Card style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }}
              title={<Space><span style={{ fontSize: 18 }}>📥</span><Text strong style={{ color: '#1A1744', fontSize: 15 }}>Nhận Token VNDC</Text></Space>}
              styles={{ body: { padding: '24px 28px' } }}>
              <ReceivePanel walletAddr={walletAddr} />
            </Card>
          )}
          {activeTab === 'history' && (
            <HistoryPanel walletAddr={walletAddr} loading={loading} txs={txs} total={total} page={page}
              onPageChange={(p) => { setPage(p); void loadData(p) }}
              onRefresh={() => void loadData(page)} />
          )}
        </div>
      </div>
    </>
  )
}

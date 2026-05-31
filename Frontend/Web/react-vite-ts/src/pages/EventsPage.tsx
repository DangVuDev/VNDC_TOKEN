import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert, Badge, Button, Col, DatePicker, Descriptions, Divider, Empty,
  Form, Input, InputNumber, message as antMessage,
  Modal, QRCode, Row, Select, Space, Spin, Steps,
  Switch, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  DeleteOutlined, DownloadOutlined, PlusOutlined, QrcodeOutlined, ReloadOutlined,
  ShoppingOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jsQR from 'jsqr'
import {
  getTicketProducts, getMyTicketPurchases, purchaseTicket,
  createTicketProduct,
  getTicketScanLogs,
  getTicketPurchase,
  scanTicketByCode,
  toWei, getNonce,
  type ScanTicketResult, type ServiceTicketProduct, type ServiceTicketPurchase, type ServiceTicketScanLog,
} from '../lib/services'
import { signTypedData, buildTransferTypedData, switchChain } from '../lib/wallet'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

const EVENTS_STYLES = `
.event-page {
  --ev-ink: #0f172a;
  --ev-muted: #64748b;
  --ev-border: rgba(148,163,184,.24);
  --ev-page-bg: #F4F6FB;
  --ev-paper: #FFF8E8;
}
.event-page .ev-glass {
  background: rgba(255,255,255,.88);
  border: 1px solid var(--ev-border);
  border-radius: 16px;
  box-shadow: 0 14px 28px rgba(15,23,42,.08);
}
.event-page .ev-hero {
  background: linear-gradient(135deg,#0F0E2B 0%,#1E1A5C 50%,#312E81 100%);
  border-radius: 22px;
  padding: 22px 26px;
  color: #fff;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(67,56,202,.32);
  margin-bottom: 18px;
}
.event-page .ev-hero::after {
  content: '';
  position: absolute;
  right: -30px;
  top: -30px;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: rgba(99,102,241,.12);
}
.event-page .ev-qr-shell {
  background: radial-gradient(circle at top, #1f2564 0%, #13183f 68%);
  border-radius: 16px;
  padding: 18px;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(165,180,252,.2), 0 12px 32px rgba(30,27,75,.35);
}
.event-page .ev-scan-result {
  border-radius: 14px;
  padding: 14px;
  border: 1px solid var(--ev-border);
}
@media (max-width: 768px) {
  .event-page .ev-hero { padding: 16px; border-radius: 16px; }
}
`

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fromWei(wei: string): number {
  if (!wei || wei === '0') return 0
  try { return Number(BigInt(wei)) / 1e18 } catch { return 0 }
}

function fmtVNDC(wei: string): string {
  const n = fromWei(wei)
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function shortWallet(w?: string): string {
  if (!w || w.length < 10) return w ?? ''
  return `${w.slice(0, 6)}â€¦${w.slice(-4)}`
}

function checkIsAdmin(user?: AuthUser): boolean {
  return !!user?.roles?.some(r => r === 'ADMIN' || r === 'SUPER_ADMIN')
}

const ENV = (import.meta as unknown as { env: Record<string, string> }).env
function getChainId(): number { return parseInt(ENV?.VITE_CHAIN_ID ?? '1337') }
function getTokenContract(): string { return ENV?.VITE_TOKEN_CONTRACT_ADDRESS ?? '' }

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORY_LABEL: Record<string, string> = {
  EVENT_SEAT: 'Sự kiện',
  RETAKE_EXAM: 'Thi lai',
  GRADE_UPGRADE: 'Nâng điểm',
  COMPUTER_RENTAL: 'Thuê máy tính',
  PARKING_MONTHLY: 'Vé xe tháng',
  OTHER: 'Khác',
}

const CATEGORY_COLORS: Record<string, { bg: string; light: string }> = {
  EVENT_SEAT:      { bg: '#7C3AED', light: '#EDE9FE' },
  RETAKE_EXAM:     { bg: '#DC2626', light: '#FEE2E2' },
  GRADE_UPGRADE:   { bg: '#059669', light: '#D1FAE5' },
  COMPUTER_RENTAL: { bg: '#2563EB', light: '#DBEAFE' },
  PARKING_MONTHLY: { bg: '#D97706', light: '#FEF3C7' },
  OTHER:           { bg: '#6B7280', light: '#F3F4F6' },
}

const PURCHASE_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  COMPLETED:       'Đã thanh toán',
  FAILED:          'Thất bại',
  USED:            'Đã sử dụng',
  EXPIRED:         'Hết hạn',
}

const PURCHASE_STATUS_COLOR: Record<string, 'success' | 'error' | 'default' | 'warning' | 'processing'> = {
  PENDING_PAYMENT: 'processing',
  COMPLETED:       'success',
  FAILED:          'error',
  USED:            'default',
  EXPIRED:         'warning',
}

// â”€â”€â”€ TicketCard â€” Physical ticket design â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TicketCard({
  product,
  onClick,
}: {
  product: ServiceTicketProduct
  onClick: () => void
}) {
  const col = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.OTHER
  const isLimited = product.stock_mode === 'LIMITED'
  const outOfStock = isLimited && product.available_stock <= 0
  const isActive = product.status === 'ACTIVE'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        display: 'flex',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        background: '#fff',
        userSelect: 'none',
        transition: 'box-shadow 0.18s, transform 0.18s',
        opacity: isActive ? 1 : 0.75,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.14)'
        el.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'
        el.style.transform = ''
      }}
    >
      {/* Left color stripe */}
      <div style={{ width: 8, flexShrink: 0, background: col.bg }} />

      {/* Main content */}
      <div style={{ flex: 1, padding: '14px 16px 12px', minWidth: 0, overflow: 'hidden', background: 'var(--ev-paper)' }}>
        {/* Category + type tags */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            background: col.light, color: col.bg,
            borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700,
          }}>
            {CATEGORY_LABEL[product.category] ?? product.category}
          </span>
          <span style={{
            background: '#F3F4F6', color: '#6B7280',
            borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500,
          }}>
            {product.ticket_type}
          </span>
          {!isActive && (
            <span style={{
              background: '#FFF7ED', color: '#C2410C',
              borderRadius: 4, padding: '2px 8px', fontSize: 11,
            }}>
              {product.status}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4, lineHeight: 1.3 }}>
          {product.title}
        </div>

        {/* Description â€” 2 lines max */}
        {product.description && (
          <div style={{
            fontSize: 12, color: '#6B7280', marginBottom: 8,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}>
            {product.description}
          </div>
        )}

        {/* Stock + date info */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {outOfStock ? (
            <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>Hết vé</span>
          ) : isLimited ? (
            <span style={{ color: '#059669', fontSize: 12 }}>
              Còn <strong>{product.available_stock.toLocaleString()}</strong> vé
            </span>
          ) : (
            <span style={{ color: '#059669', fontSize: 12 }}>Không giới hạn</span>
          )}
          {product.sale_ends_at && (
            <span style={{ color: '#9CA3AF', fontSize: 11 }}>
              Đến {dayjs(product.sale_ends_at).format('DD/MM/YYYY')}
            </span>
          )}
        </div>
      </div>

      {/* Ticket seam with two notches */}
      <div
        style={{
          width: 0,
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          flexShrink: 0,
          overflow: 'visible',
        }}
      >
        <div style={{
          width: 1,
          position: 'absolute',
          left: -0.5,
          top: 10,
          bottom: 10,
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 4px, #D1D5DB 4px 8px)',
        }} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -11,
            transform: 'translateX(-50%)',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'var(--ev-page-bg)',
            border: '1px solid #D7DFEB',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -11,
            transform: 'translateX(-50%)',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'var(--ev-page-bg)',
            border: '1px solid #D7DFEB',
          }}
        />
      </div>

      {/* Price stub */}
      <div style={{
        width: 110,
        flexShrink: 0,
        background: `linear-gradient(160deg, ${col.bg}DD, ${col.bg})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: '12px 8px',
      }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: 1 }}>ĐƠN GIÁ</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>
          {fmtVNDC(product.unit_price)}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>VNDC</span>
        {isActive && !outOfStock ? (
          <div style={{
            marginTop: 6, background: 'rgba(255,255,255,0.22)',
            borderRadius: 4, padding: '3px 8px',
            fontSize: 10, color: '#fff', fontWeight: 700, letterSpacing: 0.3,
          }}>
            XEM CHI TIẾT
          </div>
        ) : outOfStock ? (
          <div style={{
            marginTop: 6, background: 'rgba(0,0,0,0.25)',
            borderRadius: 4, padding: '3px 8px',
            fontSize: 10, color: '#fff', fontWeight: 700,
          }}>
            HẾT VÉ
          </div>
        ) : null}
      </div>
    </div>
  )
}

// â”€â”€â”€ PurchaseModal â€” EIP-712 purchase flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PurchaseModal({
  product,
  user,
  open,
  onClose,
  onSuccess,
}: {
  product: ServiceTicketProduct
  user: AuthUser
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncLabel, setSyncLabel] = useState('')

  useEffect(() => {
    if (!open) { setStep(-1); setError(''); setSyncLabel('') }
  }, [open])

  async function waitForSettlement(purchaseID: string): Promise<ServiceTicketPurchase | null> {
    const started = Date.now()
    while (Date.now() - started < 45000) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      try {
        const latest = await getTicketPurchase(purchaseID)
        if (latest.status === 'COMPLETED' || latest.status === 'FAILED') {
          return latest
        }
      } catch {
        // Keep polling transient failures.
      }
    }
    return null
  }

  async function handleBuy() {
    setLoading(true)
    setError('')
    try {
      setStep(0)
      await switchChain(getChainId())

      setStep(1)
      const { nonce } = await getNonce(user.wallet_address)

      setStep(2)
      const deadline = Math.floor(Date.now() / 1000) + 3600
      const typedData = buildTransferTypedData({
        chainId: getChainId(),
        verifyingContract: getTokenContract(),
        from: user.wallet_address,
        to: product.seller_wallet,
        amount: product.unit_price,
        nonce: String(nonce),
        deadline,
      })
      const signature = await signTypedData(undefined, user.wallet_address, typedData as Record<string, unknown>)

      setStep(3)
      const purchase = await purchaseTicket(product.id, {
        from_wallet: user.wallet_address,
        quantity: 1,
        nonce: String(nonce),
        deadline,
        signature: signature ?? '',
      })

      if (purchase.status === 'COMPLETED') {
        setStep(5)
        antMessage.success('Mua vé thành công!')
        onSuccess()
        return
      }

      setStep(4)
      setSyncLabel('Đang đợi batch settle on-chain và cập nhật DB...')
      const settled = await waitForSettlement(purchase.id)
      if (!settled) {
        setSyncLabel('Lệnh đã được gửi. Hệ thống sẽ tiếp tục đồng bộ trong nền.')
        antMessage.info('Lệnh mua vé đã gửi, đang chờ đồng bộ on-chain/off-chain.')
        onSuccess()
        return
      }
      if (settled.status === 'FAILED') {
        throw new Error(settled.failure_reason || 'Thanh toán thất bại trong quá trình settle')
      }

      setStep(5)
      setSyncLabel('Đồng bộ hoàn tất.')
      antMessage.success('Mua vé thành công!')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const col = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.OTHER
  const isDone = step === 4

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Xác nhận mua vé"
      footer={null}
      width={440}
      closable={!loading}
      maskClosable={!loading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {/* Summary card */}
        <div style={{
          background: col.light, borderRadius: 8,
          padding: '12px 16px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <Text strong style={{ color: col.bg, display: 'block' }}>{product.title}</Text>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>{product.ticket_type}</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text strong style={{ fontSize: 20, color: col.bg }}>{fmtVNDC(product.unit_price)}</Text>
            <Text style={{ fontSize: 11, color: '#6B7280', display: 'block' }}>VNDC</Text>
          </div>
        </div>

        {/* Progress */}
        {step >= 0 && (
          <Steps
            current={step}
            size="small"
            status={error ? 'error' : isDone ? 'finish' : 'process'}
            items={[
              { title: 'Chuyển mạng' },
              { title: 'Lấy nonce' },
              { title: 'Ký EIP-712' },
              { title: 'Gửi lên server' },
              { title: 'Batch settle' },
              { title: 'Hoàn tất' },
            ]}
          />
        )}

        {syncLabel && !error && <Alert type="info" message={syncLabel} showIcon />}

        {error && <Alert type="error" message={error} showIcon />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          {isDone ? (
            <Button type="primary" onClick={onClose}>Đóng</Button>
          ) : (
            <Button
              type="primary"
              loading={loading}
              onClick={handleBuy}
              style={{ background: col.bg, borderColor: col.bg }}
            >
              Thanh toán {fmtVNDC(product.unit_price)} VNDC
            </Button>
          )}
        </div>
      </Space>
    </Modal>
  )
}

// â”€â”€â”€ TicketDetailModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TicketDetailModal({
  product,
  user,
  open,
  onClose,
  onBuySuccess,
}: {
  product: ServiceTicketProduct | null
  user?: AuthUser
  open: boolean
  onClose: () => void
  onBuySuccess: () => void
}) {
  const [showBuy, setShowBuy] = useState(false)

  useEffect(() => {
    if (!open) setShowBuy(false)
  }, [open])

  if (!product) return null

  const col = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.OTHER
  const isLimited = product.stock_mode === 'LIMITED'
  const outOfStock = isLimited && product.available_stock <= 0
  const canBuy = product.status === 'ACTIVE' && !outOfStock && !!user

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={520}
        title={
          <Space>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: col.bg, flexShrink: 0 }} />
            <Text strong style={{ fontSize: 16 }}>{product.title}</Text>
          </Space>
        }
      >
        {product.image_uri && (
          <div style={{ margin: '-8px -24px 16px', height: 200, overflow: 'hidden' }}>
            <img
              src={product.image_uri}
              alt={product.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space wrap>
            <Tag color="purple">{CATEGORY_LABEL[product.category] ?? product.category}</Tag>
            <Tag>{product.ticket_type}</Tag>
            <Tag color={product.status === 'ACTIVE' ? 'green' : 'orange'}>{product.status}</Tag>
          </Space>

          {product.description && (
            <Paragraph style={{ margin: 0, color: '#374151', lineHeight: 1.7 }}>
              {product.description}
            </Paragraph>
          )}

          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Đơn giá" span={2}>
              <Text strong style={{ fontSize: 20, color: col.bg }}>
                {fmtVNDC(product.unit_price)} VNDC
              </Text>
            </Descriptions.Item>

            {isLimited && (
              <>
                <Descriptions.Item label="Tổng SL">
                  {product.total_stock.toLocaleString()} vé
                </Descriptions.Item>
                <Descriptions.Item label="Còn lại">
                  <Text style={{ color: outOfStock ? '#DC2626' : '#059669', fontWeight: 600 }}>
                    {outOfStock ? 'Hết vé' : `${product.available_stock.toLocaleString()} vé`}
                  </Text>
                </Descriptions.Item>
              </>
            )}

            {product.sale_starts_at && (
              <Descriptions.Item label="Mo ban">
                {dayjs(product.sale_starts_at).format('HH:mm DD/MM/YYYY')}
              </Descriptions.Item>
            )}
            {product.sale_ends_at && (
              <Descriptions.Item label="Ket thuc">
                {dayjs(product.sale_ends_at).format('HH:mm DD/MM/YYYY')}
              </Descriptions.Item>
            )}

            <Descriptions.Item label="Ma SP" span={2}>
              <Text code>{product.code}</Text>
            </Descriptions.Item>
          </Descriptions>

          {canBuy ? (
            <Button
              type="primary"
              size="large"
              block
              onClick={() => setShowBuy(true)}
              style={{ background: col.bg, borderColor: col.bg, fontWeight: 700 }}
            >
              Mua vé &mdash; {fmtVNDC(product.unit_price)} VNDC
            </Button>
          ) : outOfStock ? (
            <Alert type="warning" showIcon message="Vé đã hết, không thể mua thêm." />
          ) : product.status !== 'ACTIVE' ? (
            <Alert type="warning" showIcon message="Sản phẩm này tạm thời không bán." />
          ) : (
            <Alert type="info" showIcon message="Đăng nhập để mua vé." />
          )}
        </Space>
      </Modal>

      {user && showBuy && (
        <PurchaseModal
          product={product}
          user={user}
          open={showBuy}
          onClose={() => setShowBuy(false)}
          onSuccess={() => {
            setShowBuy(false)
            onClose()
            onBuySuccess()
          }}
        />
      )}
    </>
  )
}

// â”€â”€â”€ MyTickets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MyTickets({ user }: { user: AuthUser }) {
  const [purchases, setPurchases] = useState<ServiceTicketPurchase[]>([])
  const [productMap, setProductMap] = useState<Record<string, ServiceTicketProduct>>({})
  const [loading, setLoading] = useState(false)
  const [qrItem, setQrItem] = useState<ServiceTicketPurchase | null>(null)
  const [detailItem, setDetailItem] = useState<ServiceTicketPurchase | null>(null)
  const [hasPending, setHasPending] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanResultOpen, setScanResultOpen] = useState(false)
  const [scanResult, setScanResult] = useState<ScanTicketResult | null>(null)
  const [scanCode, setScanCode] = useState('')
  const qrWrapRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ items }, productsResp] = await Promise.all([
        getMyTicketPurchases({ page: 1, page_size: 50 }),
        getTicketProducts({ page: 1, page_size: 200 }),
      ])
      setPurchases(items)
      setHasPending(items.some(item => item.status === 'PENDING_PAYMENT'))
      const map: Record<string, ServiceTicketProduct> = {}
      for (const product of productsResp.items) map[product.id] = product
      setProductMap(map)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => { void load() }, 3000)
    return () => clearInterval(timer)
  }, [hasPending, load])

  function getProduct(item: ServiceTicketPurchase): ServiceTicketProduct | undefined {
    return productMap[item.product_id]
  }

  function getTicketName(item: ServiceTicketPurchase): string {
    const product = getProduct(item)
    if (product?.title) return product.title
    return `Vé #${item.product_id.slice(0, 8)}`
  }

  async function handleScanTicketCode(ticketCode: string) {
    setScanOpen(false)
    setScanCode(ticketCode)
    try {
      const result = await scanTicketByCode({ ticket_code: ticketCode, scanner_wallet: user.wallet_address })
      setScanResult(result)
      setScanResultOpen(true)
    } catch (e) {
      antMessage.error('Không thể quét vé: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function downloadTicketQr() {
    if (!qrItem || !qrWrapRef.current) return
    const canvas = qrWrapRef.current.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) {
      antMessage.error('Không tìm thấy QR để tải')
      return
    }
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `ticket-qr-${qrItem.ticket_code}.png`
    link.click()
  }

  const columns = [
    {
      title: 'Tên vé', key: 'ticket_name',
      render: (_: unknown, row: ServiceTicketPurchase) => {
        const product = getProduct(row)
        return (
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, textAlign: 'left' }}
              onClick={event => {
                event.stopPropagation()
                setDetailItem(row)
              }}
            >
              {getTicketName(row)}
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {product?.ticket_type ?? 'Ticket'}
            </Text>
          </Space>
        )
      },
    },
    { title: 'SL', dataIndex: 'quantity', key: 'quantity', width: 48, align: 'center' as const },
    {
      title: 'Tổng tiền', dataIndex: 'total_price', key: 'total_price',
      render: (v: string) => <Text>{fmtVNDC(v)} VNDC</Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (v: string) => (
        <Badge
          status={PURCHASE_STATUS_COLOR[v] ?? 'default'}
          text={PURCHASE_STATUS_LABEL[v] ?? v}
        />
      ),
    },
    {
      title: 'Ngày mua', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => dayjs(v).format('DD/MM/YY HH:mm'),
    },
    {
      title: '', key: 'qr', width: 60,
      render: (_: unknown, row: ServiceTicketPurchase) => (
        <Tooltip title="Xem QR">
          <Button
            size="small"
            icon={<QrcodeOutlined />}
            onClick={event => {
              event.stopPropagation()
              setQrItem(row)
            }}
            disabled={row.status !== 'COMPLETED'}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Text strong>Vé của tôi ({purchases.length})</Text>
          {hasPending && (
            <Tag color="processing" icon={<ClockCircleOutlined />}>Đang đồng bộ thanh toán...</Tag>
          )}
        </Space>
        <Space>
          <Button size="small" icon={<QrcodeOutlined />} onClick={() => setScanOpen(true)}>Quét vé</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>Làm mới</Button>
        </Space>
      </div>

      <Table
        dataSource={purchases}
        columns={columns}
        rowKey="id"
        loading={loading}
        onRow={row => ({
          onClick: () => setDetailItem(row),
          style: { cursor: 'pointer' },
        })}
        pagination={{ pageSize: 10 }}
        size="small"
        locale={{ emptyText: <Empty description="Bạn chưa mua vé nào" /> }}
        scroll={{ x: 760 }}
      />

      <Modal
        open={!!detailItem}
        onCancel={() => setDetailItem(null)}
        title="Chi tiết vé"
        width={560}
        footer={
          <Space>
            <Button onClick={() => setDetailItem(null)}>Đóng</Button>
            <Button
              icon={<QrcodeOutlined />}
              disabled={!detailItem || detailItem.status !== 'COMPLETED'}
              onClick={() => {
                if (!detailItem || detailItem.status !== 'COMPLETED') return
                setQrItem(detailItem)
              }}
            >
              Xem QR
            </Button>
          </Space>
        }
      >
        {detailItem && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {getProduct(detailItem)?.image_uri && (
              <div style={{ margin: '-8px -24px 8px', height: 180, overflow: 'hidden' }}>
                <img
                  src={getProduct(detailItem)!.image_uri}
                  alt={getTicketName(detailItem)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Tên vé" span={2}>
                <Text strong>{getTicketName(detailItem)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Loại vé">
                {getProduct(detailItem)?.ticket_type ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục">
                {CATEGORY_LABEL[getProduct(detailItem)?.category ?? ''] ?? getProduct(detailItem)?.category ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Mã vé" span={2}>
                <Text code>{detailItem.ticket_code}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}>
                <Badge status={PURCHASE_STATUS_COLOR[detailItem.status] ?? 'default'} text={PURCHASE_STATUS_LABEL[detailItem.status] ?? detailItem.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Số lượng">{detailItem.quantity}</Descriptions.Item>
              <Descriptions.Item label="Đơn giá">{fmtVNDC(detailItem.unit_price)} VNDC</Descriptions.Item>
              <Descriptions.Item label="Tổng thanh toán" span={2}>
                <Text strong>{fmtVNDC(detailItem.total_price)} VNDC</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày mua">
                {dayjs(detailItem.created_at).format('HH:mm DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Hoàn tất">
                {detailItem.completed_at ? dayjs(detailItem.completed_at).format('HH:mm DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Người mua" span={2}>
                <Text code>{shortWallet(detailItem.buyer_wallet)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Giao dịch on-chain" span={2}>
                <Text code>{detailItem.payment_tx_hash ?? '-'}</Text>
              </Descriptions.Item>
              {detailItem.failure_reason && (
                <Descriptions.Item label="Lý do thất bại" span={2}>
                  <Text type="danger">{detailItem.failure_reason}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Space>
        )}
      </Modal>

      <Modal
        open={!!qrItem}
        onCancel={() => setQrItem(null)}
        title="QR Ticket"
        footer={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={downloadTicketQr}>Tải QR</Button>
            <Button onClick={() => setQrItem(null)}>Đóng</Button>
          </Space>
        }
        width={380}
        centered
      >
        {qrItem && (
          <div className="ev-qr-shell">
            <Space direction="vertical" align="center" style={{ width: '100%' }} size={12}>
              <Tag color="cyan">{getTicketName(qrItem)}</Tag>
              <div ref={qrWrapRef} style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 8px 22px rgba(15,23,42,.2)' }}>
                <QRCode value={qrItem.ticket_code} size={220} />
              </div>
              <Text code style={{ fontSize: 13, color: '#C7D2FE' }}>{qrItem.ticket_code}</Text>
              <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                Owner: {shortWallet(user.wallet_address)}
              </Text>
            </Space>
          </div>
        )}
      </Modal>

      <Modal
        open={scanOpen}
        onCancel={() => setScanOpen(false)}
        footer={null}
        title="Quét mã vé"
        width={560}
        destroyOnClose
        centered
      >
        <TicketScanner
          onDetected={code => { void handleScanTicketCode(code) }}
          onClose={() => setScanOpen(false)}
        />
      </Modal>

      <Modal
        open={scanResultOpen}
        onCancel={() => setScanResultOpen(false)}
        title="Kết quả quét vé"
        footer={<Button onClick={() => setScanResultOpen(false)}>Đóng</Button>}
        centered
      >
        {scanResult && (
          <ScanResultCard result={scanResult} scannedCode={scanCode} />
        )}
      </Modal>
    </>
  )
}

function TicketScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [error, setError] = useState('')
  const [cameraHints, setCameraHints] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    void startCamera()
    return () => stopCamera()
  }, [])

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }

  async function startCamera() {
    setError('')
    setCameraHints([])
    if (!window.isSecureContext) {
      setError('Môi trường hiện tại không an toàn cho camera.')
      setCameraHints([
        'Mở ứng dụng bằng http://localhost hoặc https:// (không dùng file://).',
        'Nếu đang mở từ IP LAN, hãy bật HTTPS hoặc dùng localhost tunnel.',
      ])
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Trình duyệt không hỗ trợ MediaDevices API.')
      setCameraHints([
        'Cap nhat Chrome/Edge phien ban moi.',
        'Nếu đang trong chế độ private bị giới hạn camera, hãy mở tab thường.',
      ])
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      loop()
    } catch (primaryErr) {
      try {
        // Fallback for desktop/laptops where 'environment' camera is unavailable.
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true })
        streamRef.current = fallbackStream
        if (!videoRef.current) return
        videoRef.current.srcObject = fallbackStream
        await videoRef.current.play()
        loop()
      } catch (fallbackErr) {
        const domErr = (fallbackErr ?? primaryErr) as DOMException | Error
        const errName = (domErr as DOMException)?.name || 'UnknownError'
        if (errName === 'NotAllowedError') {
          setError('Camera bi tu choi quyen truy cap.')
          setCameraHints([
            'Bam icon camera tren thanh dia chi va chon Allow.',
            'Vào Site Settings -> Camera -> Allow cho trang này, sau đó tải lại.',
          ])
          return
        }
        if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setError('Không tim thay thiet bi camera tren may.')
          setCameraHints([
            'Kiểm tra webcam đã cắm/được hệ điều hành nhận diện.',
            'Đóng ứng dụng khác đang chiếm camera (Zoom, Teams, OBS).',
          ])
          return
        }
        if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setError('Camera đang bị ứng dụng khác chiếm dụng.')
          setCameraHints([
            'Đóng tất cả app đang dùng camera rồi thử lại.',
            'Nếu vẫn lỗi, thử tắt/mở lại trình duyệt.',
          ])
          return
        }
        setError('Không thể mở camera. Hãy cấp quyền camera trong trình duyệt hoặc dùng quét từ ảnh/manual bên dưới.')
        setCameraHints([
          `Chi tiết lỗi: ${errName}`,
          'Bạn vẫn có thể quét bằng upload ảnh QR hoặc nhập mã vé thủ công.',
        ])
      }
    }
  }

  function extractTicketCode(raw: string): string | null {
    const data = raw.trim()
    if (!data) return null
    if (data.startsWith('{')) {
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>
        if (typeof parsed.ticket_code === 'string' && parsed.ticket_code.trim()) return parsed.ticket_code.trim()
      } catch {
        return null
      }
    }
    return data
  }

  function loop() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || busy) return
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const sourceW = video.videoWidth
    const sourceH = video.videoHeight
    const sourceSide = Math.min(sourceW, sourceH)
    const sourceX = Math.floor((sourceW - sourceSide) / 2)
    const sourceY = Math.floor((sourceH - sourceSide) / 2)

    const targetSide = 720
    if (canvas.width !== targetSide || canvas.height !== targetSide) {
      canvas.width = targetSide
      canvas.height = targetSide
    }

    ctx.drawImage(video, sourceX, sourceY, sourceSide, sourceSide, 0, 0, targetSide, targetSide)

    const scanRegions = [
      { x: 0, y: 0, size: targetSide },
      { x: Math.floor(targetSide * 0.16), y: Math.floor(targetSide * 0.16), size: Math.floor(targetSide * 0.68) },
    ]

    for (const region of scanRegions) {
      const img = ctx.getImageData(region.x, region.y, region.size, region.size)
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
      if (code) {
        const ticketCode = extractTicketCode(code.data)
        if (ticketCode) {
          setBusy(true)
          stopCamera()
          onDetected(ticketCode)
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  function submitManualCode() {
    const code = manualCode.trim()
    if (!code) return
    stopCamera()
    setBusy(true)
    onDetected(code)
  }

  async function scanFromImage(file: File) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('read-failed'))
        reader.readAsDataURL(file)
      })

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('image-invalid'))
        image.src = dataUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas-unavailable')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      const parsed = code ? extractTicketCode(code.data) : null
      if (!parsed) {
        antMessage.warning('Không đọc được mã QR trong ảnh đã chọn')
        return
      }
      stopCamera()
      setBusy(true)
      onDetected(parsed)
    } catch {
      antMessage.error('Không thể quét từ ảnh. Vui lòng thử lại.')
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={14}>
      {error ? (
        <Alert
          type="error"
          message={error}
          description={
            <Space direction="vertical" size={6}>
              {cameraHints.map((hint, idx) => (
                <Text key={idx} style={{ fontSize: 12 }}>{`- ${hint}`}</Text>
              ))}
              <Button size="small" onClick={() => { void startCamera() }}>Thu mo camera lai</Button>
            </Space>
          }
          showIcon
        />
      ) : (
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 280,
              height: 280,
              border: '2px solid rgba(99,102,241,.65)',
              borderRadius: 16,
              boxShadow: '0 0 0 9999px rgba(0,0,0,.42)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', left: -2, top: -2, width: 34, height: 34, borderLeft: '4px solid #818CF8', borderTop: '4px solid #818CF8', borderTopLeftRadius: 12 }} />
            <div style={{ position: 'absolute', right: -2, top: -2, width: 34, height: 34, borderRight: '4px solid #818CF8', borderTop: '4px solid #818CF8', borderTopRightRadius: 12 }} />
            <div style={{ position: 'absolute', left: -2, bottom: -2, width: 34, height: 34, borderLeft: '4px solid #818CF8', borderBottom: '4px solid #818CF8', borderBottomLeftRadius: 12 }} />
            <div style={{ position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRight: '4px solid #818CF8', borderBottom: '4px solid #818CF8', borderBottomRightRadius: 12 }} />
          </div>
        </div>
      )}
      <Text type="secondary" style={{ fontSize: 12 }}>
        Hệ thống đang theo dõi liên tục. Đưa QR vào khung là sẽ tự động quét ngay.
      </Text>

      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={manualCode}
          onChange={event => setManualCode(event.target.value)}
          placeholder="Nhập mã vé nếu không mở được camera"
        />
        <Button onClick={submitManualCode} type="primary" disabled={!manualCode.trim()}>Quét mã</Button>
      </Space.Compact>

      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Input
          type="file"
          accept="image/*"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) void scanFromImage(file)
            event.target.value = ''
          }}
          style={{ maxWidth: 220 }}
        />
        <Button onClick={onClose}>Đóng</Button>
      </Space>
    </Space>
  )
}

function ScanResultCard({ result, scannedCode }: { result: ScanTicketResult; scannedCode: string }) {
  const visual = {
    SUCCESS: { color: '#059669', label: 'Check-in thành công', type: 'success' as const },
    ALREADY_USED: { color: '#D97706', label: 'Vé đã được sử dụng', type: 'warning' as const },
    EXPIRED: { color: '#DC2626', label: 'Vé đã hết hạn', type: 'error' as const },
    INVALID_CODE: { color: '#DC2626', label: 'Mã vé không hợp lệ', type: 'error' as const },
    UNAUTHORIZED_SCANNER: { color: '#7C3AED', label: 'Ví quét không được cấp quyền', type: 'warning' as const },
    NOT_FOUND: { color: '#334155', label: 'Không tìm thấy vé', type: 'warning' as const },
    PRODUCT_INACTIVE: { color: '#B45309', label: 'Sự kiện tạm ngưng', type: 'warning' as const },
  }[result.result]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Alert type={visual.type} showIcon message={visual.label} />
      <div className="ev-scan-result" style={{ background: `${visual.color}10` }}>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Mã quét">
            <Text code>{scannedCode}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tên vé">
            <Text strong>{result.product?.title ?? 'Không xác định'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Loại vé">
            {result.product?.ticket_type ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái hiện tại">
            <Tag color={visual.type === 'success' ? 'green' : visual.type === 'error' ? 'red' : 'orange'}>
              {result.purchase?.status ?? '-'}
            </Tag>
          </Descriptions.Item>
          {result.used_at && (
            <Descriptions.Item label="Đã dùng lúc">
              {dayjs(result.used_at).format('HH:mm DD/MM/YYYY')}
            </Descriptions.Item>
          )}
          {result.used_by_wallet && (
            <Descriptions.Item label="Ví quét trước đó">
              <Text code>{shortWallet(result.used_by_wallet)}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    </Space>
  )
}

// â”€â”€â”€ CreateProductModal (Admin only, multi-variant) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TicketVariant {
  ticket_type: string
  description: string
  unit_price: number
  total_stock: number
  is_limited: boolean
}

const DEFAULT_VARIANT: TicketVariant = {
  ticket_type: 'STANDARD',
  description: '',
  unit_price: 0,
  total_stock: 100,
  is_limited: true,
}

function CreateProductModal({
  user,
  open,
  onClose,
  onSuccess,
}: {
  user: AuthUser
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [imageUri, setImageUri] = useState('')
  const [saleStart, setSaleStart] = useState<ReturnType<typeof dayjs> | null>(null)
  const [saleEnd, setSaleEnd] = useState<ReturnType<typeof dayjs> | null>(null)
  const [variants, setVariants] = useState<TicketVariant[]>([{ ...DEFAULT_VARIANT }])

  function resetForm() {
    setTitle(''); setCategory(''); setImageUri(''); setSaleStart(null); setSaleEnd(null)
    setVariants([{ ...DEFAULT_VARIANT }])
  }

  function updateVariant(idx: number, field: keyof TicketVariant, value: unknown) {
    setVariants(vs => vs.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    setVariants(vs => [...vs, { ...DEFAULT_VARIANT, ticket_type: '' }])
  }

  function removeVariant(idx: number) {
    if (variants.length <= 1) return
    setVariants(vs => vs.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!title.trim()) { antMessage.warning('Vui lòng nhập tiêu đề'); return }
    if (!category) { antMessage.warning('Vui lòng chọn danh mục'); return }
    const invalid = variants.find(v => !v.ticket_type.trim() || v.unit_price <= 0)
    if (invalid) { antMessage.warning('Mỗi loại vé cần có tên loại và đơn giá > 0'); return }

    const hasDates = !!saleStart && !!saleEnd
    if (hasDates && saleEnd!.isBefore(saleStart!)) {
      antMessage.warning('Ngày kết thúc phải sau ngày bắt đầu'); return
    }

    setLoading(true)
    try {
      await Promise.all(
        variants.map(v => createTicketProduct({
          title: title.trim(),
          category,
          image_uri: imageUri.trim() || undefined,
          ticket_type: v.ticket_type.trim().toUpperCase(),
          description: v.description.trim() || undefined,
          unit_price: toWei(String(v.unit_price)),
          stock_mode: v.is_limited ? 'LIMITED' : 'UNLIMITED',
          total_stock: v.is_limited ? v.total_stock : undefined,
          seller_wallet: user.wallet_address,
          sale_mode: hasDates ? 'WINDOWED' : 'ALWAYS_ON',
          sale_starts_at: hasDates ? saleStart!.unix() : undefined,
          sale_ends_at: hasDates ? saleEnd!.unix() : undefined,
        }))
      )
      antMessage.success(`Tạo thành công ${variants.length} loại vé!`)
      resetForm()
      onSuccess()
      onClose()
    } catch (e) {
      antMessage.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) { resetForm(); onClose() }
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Tạo vé mới"
      footer={null}
      width={680}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size={0}>
        <Divider style={{ marginTop: 8, marginBottom: 14 }}>Thông tin sự kiện / dịch vụ</Divider>

        <Row gutter={12}>
          <Col span={16}>
            <Form.Item label="Tiêu đề" required style={{ marginBottom: 12 }}>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="VD: Lễ hội Âm nhạc 2025"
                maxLength={200}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Danh mục" required style={{ marginBottom: 12 }}>
              <Select
                value={category || undefined}
                onChange={setCategory}
                style={{ width: '100%' }}
                placeholder="Chọn danh mục"
                options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="URL ảnh bìa (tùy chọn)" style={{ marginBottom: 12 }}>
          <Input
            value={imageUri}
            onChange={e => setImageUri(e.target.value)}
            placeholder="https://example.com/banner.jpg"
          />
        </Form.Item>

        <Row gutter={12} style={{ marginBottom: 14 }}>
          <Col span={12}>
            <Form.Item label="Bắt đầu bán (tùy chọn)" style={{ marginBottom: 0 }}>
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                value={saleStart}
                onChange={val => setSaleStart(val)}
                style={{ width: '100%' }}
                placeholder="Chọn ngày bắt đầu"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Kết thúc bán (tùy chọn)" style={{ marginBottom: 0 }}>
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                value={saleEnd}
                onChange={val => setSaleEnd(val)}
                style={{ width: '100%' }}
                placeholder="Chọn ngày kết thúc"
                disabledDate={curr => !!saleStart && curr.isBefore(saleStart, 'day')}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ marginBottom: 14 }}>Các loại vé</Divider>

        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {variants.map((v, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '14px 16px 10px',
                background: '#FAFAFA',
                position: 'relative',
              }}
            >
              {variants.length > 1 && (
                <Button
                  size="small"
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  style={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={() => removeVariant(idx)}
                />
              )}

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item label="Loại vé" required style={{ marginBottom: 10 }}>
                    <Input
                      value={v.ticket_type}
                      onChange={e => updateVariant(idx, 'ticket_type', e.target.value)}
                      placeholder="VD: VIP, STANDARD"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Đơn giá (VNDC)" required style={{ marginBottom: 10 }}>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={v.unit_price}
                      onChange={val => updateVariant(idx, 'unit_price', val ?? 0)}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => Number(value?.replace(/,/g, '') ?? 0)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Giới hạn SL" style={{ marginBottom: 10 }}>
                    <Switch
                      checked={v.is_limited}
                      onChange={val => updateVariant(idx, 'is_limited', val)}
                      checkedChildren="Có"
                      unCheckedChildren="Không"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={v.is_limited ? 16 : 24}>
                  <Form.Item label="Mô tả loại vé" style={{ marginBottom: 8 }}>
                    <Input.TextArea
                      rows={2}
                      value={v.description}
                      onChange={e => updateVariant(idx, 'description', e.target.value)}
                      placeholder="Mô tả chi tiết cho loại vé này..."
                    />
                  </Form.Item>
                </Col>
                {v.is_limited && (
                  <Col span={8}>
                    <Form.Item label="Số lượng vé" required style={{ marginBottom: 8 }}>
                      <InputNumber
                        min={1}
                        style={{ width: '100%' }}
                        value={v.total_stock}
                        onChange={val => updateVariant(idx, 'total_stock', val ?? 1)}
                      />
                    </Form.Item>
                  </Col>
                )}
              </Row>
            </div>
          ))}

          <Button icon={<PlusOutlined />} onClick={addVariant} type="dashed" block>
            Thêm loại vé
          </Button>
        </Space>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button onClick={handleClose}>Hủy</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            {`Tạo ${variants.length > 1 ? `${variants.length} loại vé` : 'vé'}`}
          </Button>
        </div>
      </Space>
    </Modal>
  )
}

// â”€â”€â”€ BrowseProducts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BrowseProducts({
  user,
  isAdmin,
}: {
  user?: AuthUser
  isAdmin: boolean
}) {
  const [products, setProducts] = useState<ServiceTicketProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [selected, setSelected] = useState<ServiceTicketProduct | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { items } = await getTicketProducts({
        category: filterCategory || undefined,
        status: 'ACTIVE',
        search: filterSearch || undefined,
        page: 1,
        page_size: 100,
      })
      setProducts(items)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterSearch])

  useEffect(() => { void load() }, [load])

  function openDetail(p: ServiceTicketProduct) {
    setSelected(p)
    setShowDetail(true)
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input.Search
          placeholder="Tìm kiếm vé..."
          allowClear
          onSearch={v => setFilterSearch(v)}
          onChange={e => { if (!e.target.value) setFilterSearch('') }}
          style={{ width: 220 }}
        />
        <Select
          allowClear
          placeholder="Danh mục"
          value={filterCategory || undefined}
          onChange={v => setFilterCategory(v ?? '')}
          style={{ width: 160 }}
          options={[
            { value: '', label: 'Tất cả danh mục' },
            ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
        {isAdmin && user && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto' }}
          >
            Tạo vé mới
          </Button>
        )}
      </div>

      {/* Product list */}
      <Spin spinning={loading}>
        {products.length === 0 && !loading ? (
          <Empty description="Không có sản phẩm nào" style={{ margin: '48px 0' }} />
        ) : (
          <Row gutter={[12, 12]}>
            {products.map(p => (
              <Col key={p.id} xs={24} lg={12}>
                <TicketCard product={p} onClick={() => openDetail(p)} />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <TicketDetailModal
        product={selected}
        user={user}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onBuySuccess={load}
      />

      {isAdmin && user && (
        <CreateProductModal
          user={user}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={load}
        />
      )}
    </div>
  )
}

function EventAdminTab({ user }: { user: AuthUser }) {
  const [scanOpen, setScanOpen] = useState(false)
  const [scanResultOpen, setScanResultOpen] = useState(false)
  const [scanResult, setScanResult] = useState<ScanTicketResult | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [scanLogs, setScanLogs] = useState<ServiceTicketScanLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsResult, setLogsResult] = useState('')

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const { items } = await getTicketScanLogs({ page: 1, page_size: 50, result: logsResult || undefined })
      setScanLogs(items)
    } finally {
      setLogsLoading(false)
    }
  }, [logsResult])

  useEffect(() => { void loadLogs() }, [loadLogs])

  async function handleScan(ticketCode: string) {
    setScanOpen(false)
    setScanCode(ticketCode)
    try {
      const result = await scanTicketByCode({ ticket_code: ticketCode, scanner_wallet: user.wallet_address })
      setScanResult(result)
      setScanResultOpen(true)
      void loadLogs()
    } catch (e) {
      antMessage.error('Không thể quét vé: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const columns = [
    {
      title: 'Thời gian', dataIndex: 'created_at', key: 'created_at', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM HH:mm:ss'),
    },
    {
      title: 'Tên vé', key: 'product_title',
      render: (_: unknown, row: ServiceTicketScanLog) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.product_title || '(Không xác định)'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.ticket_type || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Kết quả', dataIndex: 'result', key: 'result', width: 180,
      render: (v: ServiceTicketScanLog['result']) => {
        const colorMap: Record<ServiceTicketScanLog['result'], string> = {
          SUCCESS: 'success',
          ALREADY_USED: 'warning',
          EXPIRED: 'error',
          INVALID_CODE: 'error',
          UNAUTHORIZED_SCANNER: 'processing',
          NOT_FOUND: 'default',
          PRODUCT_INACTIVE: 'orange',
        }
        return <Tag color={colorMap[v]}>{v}</Tag>
      },
    },
    {
      title: 'Mã vé', dataIndex: 'ticket_code', key: 'ticket_code',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Người quét', dataIndex: 'scanner_wallet', key: 'scanner_wallet', width: 120,
      render: (v: string) => <Text type="secondary">{shortWallet(v)}</Text>,
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={14}>
      <div className="ev-glass" style={{ padding: 14 }}>
        <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 16 }}>Quản trị Sự kiện</Text>
            <Text type="secondary">Tạo vé, quét vé tại cổng và theo dõi lịch sử quét theo thời gian thực.</Text>
          </Space>
          <Space>
            <Button icon={<QrcodeOutlined />} type="primary" onClick={() => setScanOpen(true)}>Quét vé</Button>
            <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>Tạo vé mới</Button>
          </Space>
        </Space>
      </div>

      <div className="ev-glass" style={{ padding: 14 }}>
        <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
          <Text strong>Lịch sử quét</Text>
          <Space>
            <Select
              allowClear
              style={{ width: 180 }}
              placeholder="Lọc kết quả"
              value={logsResult || undefined}
              onChange={value => setLogsResult(value ?? '')}
              options={[
                { value: 'SUCCESS', label: 'SUCCESS' },
                { value: 'ALREADY_USED', label: 'ALREADY_USED' },
                { value: 'EXPIRED', label: 'EXPIRED' },
                { value: 'INVALID_CODE', label: 'INVALID_CODE' },
                { value: 'UNAUTHORIZED_SCANNER', label: 'UNAUTHORIZED_SCANNER' },
                { value: 'NOT_FOUND', label: 'NOT_FOUND' },
                { value: 'PRODUCT_INACTIVE', label: 'PRODUCT_INACTIVE' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={logsLoading}>Làm mới</Button>
          </Space>
        </Space>
        <Table
          rowKey="id"
          dataSource={scanLogs}
          columns={columns}
          loading={logsLoading}
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="Chưa có log quét nào" /> }}
          scroll={{ x: 900 }}
        />
      </div>

      <Modal
        open={scanOpen}
        onCancel={() => setScanOpen(false)}
        footer={null}
        title="Quét mã vé"
        width={560}
        destroyOnClose
        centered
      >
        <TicketScanner onDetected={code => { void handleScan(code) }} onClose={() => setScanOpen(false)} />
      </Modal>

      <Modal
        open={scanResultOpen}
        onCancel={() => setScanResultOpen(false)}
        title="Kết quả quét"
        footer={<Button onClick={() => setScanResultOpen(false)}>Đóng</Button>}
        centered
      >
        {scanResult && <ScanResultCard result={scanResult} scannedCode={scanCode} />}
      </Modal>

      <CreateProductModal
        user={user}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          antMessage.success('Đã tạo vé thành công')
        }}
      />
    </Space>
  )
}

// â”€â”€â”€ EventsPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface EventsPageProps {
  user?: AuthUser
}

export default function EventsPage({ user }: EventsPageProps) {
  const admin = checkIsAdmin(user)

  const tabItems = [
    {
      key: 'browse',
          label: <Space><UnorderedListOutlined />Mua vé</Space>,
      children: <BrowseProducts user={user} isAdmin={admin} />,
    },
    ...(user
      ? [{
          key: 'my',
          label: <Space><ShoppingOutlined />Vé của tôi</Space>,
          children: <MyTickets user={user} />,
        }]
      : []),
    ...(admin && user
      ? [{
          key: 'admin',
          label: <Space><span style={{ fontSize: 16 }}>🛡️</span>Quản trị</Space>,
          children: <EventAdminTab user={user} />,
        }]
      : []),
  ]

  return (
    <div style={{ padding: '24px', maxWidth: 1080, margin: '0 auto' }} className="event-page">
      <style>{EVENTS_STYLES}</style>

      <div className="ev-hero">
        <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <Space direction="vertical" size={2}>
            <Title level={3} style={{ color: '#fff', margin: 0, fontFamily: 'Georgia,serif' }}>Sự kiện & Ticketing</Title>
            <Text style={{ color: '#A5B4FC', fontSize: 13 }}>
              Bố cục mới, luồng mua vé theo dõi batch settle và trạng thái đồng bộ on-chain/off-chain/DB.
            </Text>
          </Space>
          <Space direction="vertical" align="end" size={2}>
            <Space>
              <Tag color="blue">On-chain transfer</Tag>
              <Tag color="cyan">Off-chain order</Tag>
              <Tag color="green">DB finalize</Tag>
            </Space>
            <Text style={{ color: '#93C5FD', fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />Tự động cập nhật khi có pending
            </Text>
          </Space>
        </Space>
      </div>

      <div className="ev-glass" style={{ padding: 12 }}>
        <Tabs items={tabItems} defaultActiveKey="browse" />
      </div>
    </div>
  )
}


import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Row, Col, Card, Typography, Tag, Space, Spin, Button,
  Empty, Modal, Input, Form, Select, message as antMessage, Badge,
} from 'antd'
import {
  ClockCircleOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PlusOutlined, CloseOutlined, BellOutlined, FireOutlined,
  FundOutlined,
  RiseOutlined, LeftOutlined, RightOutlined, EditOutlined,
  WalletOutlined, ApartmentOutlined, ShopOutlined, CalendarOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  getBalance, getTransactions, getContractInfo, getAdminAnalytics,
  type Transaction, type AdminAnalytics, type BalanceResponse,
} from '../lib/services'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text } = Typography

function formatVNDC(val: string | number, compact = false) {
  try {
    const n = typeof val === 'string' ? BigInt(val) : BigInt(Math.floor(Number(val)))
    const whole = Number(n / BigInt('1000000000000000000'))
    if (compact) {
      if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M`
      if (whole >= 1_000) return `${(whole / 1_000).toFixed(1)}K`
      return whole.toLocaleString('vi-VN')
    }
    const frac = n % BigInt('1000000000000000000')
    const result = whole + Number(frac) / 1e18
    return isNaN(result) ? '0.00' : result.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } catch { return '0.00' }
}

function shortenAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`
}

interface Announcement {
  id: string
  title: string
  content: string
  type: 'info' | 'success' | 'warning' | 'highlight'
  createdAt: string
  author: string
}

const ANN_KEY = 'vndc_announcements'

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  { id: 'default-1', title: 'VNDC Platform ra mắt chính thức', content: 'Nền tảng VNDC Token đã hoàn thành giai đoạn phát triển và chính thức đi vào hoạt động. Khám phá các tính năng mới.', type: 'highlight', createdAt: new Date().toISOString(), author: 'Admin' },
  { id: 'default-2', title: 'DAO Voting đã mở', content: 'Các đề xuất đầu tiên đã được tạo. Hãy tham gia bỏ phiếu để định hình tương lai của nền tảng.', type: 'info', createdAt: new Date().toISOString(), author: 'Admin' },
  { id: 'default-3', title: 'Sự kiện tặng điểm hoạt động', content: 'Hoàn thành các nhiệm vụ trên hệ thống để nhận điểm hoạt động và đổi lấy VNDC Token.', type: 'success', createdAt: new Date().toISOString(), author: 'Admin' },
]

function loadAnnouncements(): Announcement[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ANN_KEY) || 'null')
    return Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_ANNOUNCEMENTS
  } catch { return DEFAULT_ANNOUNCEMENTS }
}

function saveAnnouncements(items: Announcement[]) {
  localStorage.setItem(ANN_KEY, JSON.stringify(items))
}

const ANN_STYLE: Record<string, { border: string; bg: string; tag: string; tagColor: string }> = {
  highlight: { border: '#FCD34D', bg: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', tag: 'Nổi bật',     tagColor: '#D97706' },
  info:      { border: '#93C5FD', bg: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', tag: 'Thông báo',  tagColor: '#2563EB' },
  success:   { border: '#6EE7B7', bg: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', tag: 'Mới',         tagColor: '#059669' },
  warning:   { border: '#FCA5A5', bg: 'linear-gradient(135deg,#FEF2F2,#FEE2E2)', tag: 'Quan trọng', tagColor: '#DC2626' },
}

type ChartRange = 'hour' | 'day' | '3d' | '7d' | '30d'

interface ChartPoint {
  label: string
  balance: number
  received: number
  sent: number
  net: number
  from: Date
  to: Date
}

const CHART_RANGE_OPTIONS: Record<ChartRange, { label: string; points: number; bucketMs: number; detail: string }> = {
  hour: { label: 'Theo giờ', points: 12, bucketMs: 60 * 60 * 1000, detail: '12 giờ gần nhất' },
  day:  { label: '24 giờ',   points: 24, bucketMs: 60 * 60 * 1000, detail: '24 giờ gần nhất' },
  '3d': { label: '3 ngày',   points: 12, bucketMs: 6 * 60 * 60 * 1000, detail: 'mỗi 6 giờ' },
  '7d': { label: '7 ngày',   points: 7,  bucketMs: 24 * 60 * 60 * 1000, detail: 'mỗi ngày' },
  '30d':{ label: '30 ngày',  points: 30, bucketMs: 24 * 60 * 60 * 1000, detail: 'mỗi ngày' },
}

function weiToNumber(wei?: string | number): number {
  try {
    return Number(BigInt(String(wei ?? '0'))) / 1e18
  } catch {
    return 0
  }
}

function balanceToNumber(balance: BalanceResponse | null): number {
  if (!balance) return 0
  const available = (balance as BalanceResponse & { available?: string }).available
  if (available !== undefined) return weiToNumber(available)
  try {
    const onChain = BigInt((balance as BalanceResponse & { on_chain?: string }).on_chain ?? '0')
    const pending = BigInt((balance as BalanceResponse & { pending?: string }).pending ?? '0')
    const result = onChain - pending
    return Number(result > 0n ? result : 0n) / 1e18
  } catch {
    return 0
  }
}

function isConfirmedTx(tx: Transaction): boolean {
  return tx.status === 'CONFIRMED' || tx.status === 'SUCCESS' || !tx.status
}

function isIncomingTx(tx: Transaction, walletAddr: string): boolean {
  return !!walletAddr && tx.to_wallet?.toLowerCase() === walletAddr.toLowerCase()
}

function isOutgoingTx(tx: Transaction, walletAddr: string): boolean {
  return !!walletAddr && tx.from_wallet?.toLowerCase() === walletAddr.toLowerCase()
}

function formatBucketLabel(date: Date, range: ChartRange): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  if (range === 'hour' || range === 'day') return `${hh}:00`
  if (range === '3d') return `${dd}/${mm} ${hh}h`
  return `${dd}/${mm}`
}

function buildBalanceChartData(
  txs: Transaction[],
  walletAddr: string,
  balance: BalanceResponse | null,
  range: ChartRange,
): ChartPoint[] {
  const cfg = CHART_RANGE_OPTIONS[range]
  const now = new Date()
  const currentBalance = balanceToNumber(balance)
  const buckets = Array.from({ length: cfg.points }, (_, i) => {
    const from = new Date(now.getTime() - (cfg.points - i) * cfg.bucketMs)
    const to = new Date(now.getTime() - (cfg.points - 1 - i) * cfg.bucketMs)
    return { from, to, label: formatBucketLabel(to, range) }
  })

  const confirmed = txs.filter(tx => isConfirmedTx(tx))

  return buckets.map(bucket => {
    let received = 0
    let sent = 0
    let futureNet = 0

    for (const tx of confirmed) {
      const txDate = new Date(tx.created_at)
      if (Number.isNaN(txDate.getTime())) continue
      const amount = weiToNumber(tx.amount || '0')
      const direction = isIncomingTx(tx, walletAddr) ? 1 : isOutgoingTx(tx, walletAddr) ? -1 : 0
      if (!direction) continue

      if (txDate >= bucket.from && txDate < bucket.to) {
        if (direction > 0) received += amount
        else sent += amount
      }

      if (txDate > bucket.to) {
        futureNet += direction * amount
      }
    }

    const balanceAtPoint = Math.max(0, currentBalance - futureNet)
    return {
      label: bucket.label,
      balance: balanceAtPoint,
      received,
      sent,
      net: received - sent,
      from: bucket.from,
      to: bucket.to,
    }
  })
}

function AreaChart({ data, height = 260 }: { data: ChartPoint[]; height?: number }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  if (!data.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>Chưa có dữ liệu</div>

  const W = 940
  const H = height
  const pad = { t: 22, r: 28, b: 46, l: 66 }
  const cW = W - pad.l - pad.r
  const cH = H - pad.t - pad.b
  const values = data.map(d => d.balance)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const rawRange = Math.max(rawMax - rawMin, Math.max(rawMax * 0.08, 1))
  const minVal = Math.max(0, rawMin - rawRange * 0.18)
  const maxVal = rawMax + rawRange * 0.2
  const yRange = Math.max(maxVal - minVal, 1)

  const xScale = (i: number) => data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW
  const yScale = (v: number) => cH - ((v - minVal) / yRange) * cH
  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.balance), d, i }))

  function smoothPath() {
    if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] ?? points[i]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] ?? p2
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  }

  const linePath = smoothPath()
  const last = points[points.length - 1]
  const first = points[0]
  const areaPath = points.length === 1
    ? `M ${first.x} ${cH} L ${first.x} ${first.y} L ${first.x + 1} ${cH} Z`
    : `${linePath} L ${last.x.toFixed(1)} ${cH} L ${first.x.toFixed(1)} ${cH} Z`
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    v: minVal + yRange * t,
    y: cH - t * cH,
  }))
  const xStep = Math.max(1, Math.ceil(data.length / 8))
  const xLabels = data.map((d, i) => ({ d, i })).filter(({ i }) => i % xStep === 0 || i === data.length - 1)
  const fmtY = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v.toFixed(v >= 10 ? 0 : 2)
  const hover = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1]

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }} onMouseLeave={() => setHoverIndex(null)}>
        <defs>
          <linearGradient id="balance-area-soft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.34" />
            <stop offset="52%" stopColor="#0EA5E9" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="balance-line-soft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="52%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <filter id="balance-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.145 0 0 0 0 0.388 0 0 0 0 0.922 0 0 0 .28 0" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g transform={`translate(${pad.l},${pad.t})`}>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={0} y1={t.y} x2={cW} y2={t.y} stroke="rgba(148,163,184,.28)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '5 5'} />
              <text x={-10} y={t.y + 4} textAnchor="end" fontSize="11" fill="#64748B">{fmtY(t.v)}</text>
            </g>
          ))}
          <path d={areaPath} fill="url(#balance-area-soft)" />
          <path d={linePath} fill="none" stroke="url(#balance-line-soft)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" filter="url(#balance-glow)" />
          {data.map((d, i) => {
            const x = xScale(i)
            const barBase = cH + 20
            const netAbs = Math.min(Math.abs(d.net) / Math.max(...data.map(p => Math.abs(p.net)), 1), 1)
            const barH = Math.max(0, netAbs * 18)
            if (!d.net) return null
            return (
              <rect
                key={`flow-${i}`}
                x={x - 3}
                y={d.net >= 0 ? barBase - barH : barBase}
                width={6}
                height={barH}
                rx={3}
                fill={d.net >= 0 ? '#10B981' : '#F43F5E'}
                opacity="0.46"
              />
            )
          })}
          {xLabels.map(({ d, i }) => (
            <text key={i} x={xScale(i)} y={cH + 38} textAnchor="middle" fontSize="11" fill="#64748B">{d.label}</text>
          ))}
          {points.map(p => (
            <rect key={`hit-${p.i}`} x={p.x - Math.max(10, cW / data.length / 2)} y={0} width={Math.max(20, cW / data.length)} height={cH + 28} fill="transparent" onMouseMove={() => setHoverIndex(p.i)} />
          ))}
          {hover && (
            <g>
              <line x1={hover.x} y1={0} x2={hover.x} y2={cH} stroke="rgba(37,99,235,.28)" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx={hover.x} cy={hover.y} r="5.5" fill="#fff" stroke="#2563EB" strokeWidth="3" />
            </g>
          )}
        </g>
      </svg>
      {hover && (
        <div style={{ position: 'absolute', right: 12, top: 8, minWidth: 180, border: '1px solid rgba(255,255,255,.64)', borderRadius: 14, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(14px) saturate(1.4)', boxShadow: '0 18px 38px rgba(37,99,235,.14)', padding: '10px 12px' }}>
          <Text style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>{hover.d.label}</Text>
          <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 17, fontWeight: 800, color: '#1D4ED8' }}>
            {hover.d.balance.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} VNDC
          </div>
          <Space size={10} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: '#059669' }}>+{hover.d.received.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</Text>
            <Text style={{ fontSize: 11, color: '#DC2626' }}>-{hover.d.sent.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</Text>
          </Space>
        </div>
      )}
    </div>
  )
}

const TX_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  TRANSFER:             { label: 'Chuyển',      color: 'blue' },
  ACTIVITY_REWARD:      { label: 'Phần thưởng', color: 'green' },
  DAO_REWARD:           { label: 'DAO',          color: 'purple' },
  NFT_PURCHASE:         { label: 'NFT',          color: 'gold' },
  CAMPAIGN_CONTRIBUTION:{ label: 'Gây quỹ',     color: 'orange' },
  TICKET_PURCHASE:      { label: 'Vé',           color: 'cyan' },
  REFUND:               { label: 'Hoàn tiền',    color: 'lime' },
}

interface DashboardPageProps { user?: AuthUser }

export function DashboardPage({ user }: DashboardPageProps) {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [txs, setTxs] = useState<Transaction[]>([])
  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [contractInfo, setContractInfo] = useState<{ total_supply: string; paused: boolean } | null>(null)
  const [, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartPeriod, setChartPeriod] = useState<ChartRange>('7d')
  const [announcements, setAnnouncements] = useState<Announcement[]>(loadAnnouncements)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [annForm] = Form.useForm()

  const walletAddr = user?.wallet_address ?? ''
  const displayName = user?.full_name || user?.username || shortenAddr(walletAddr)
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('ADMIN')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txData, bal, ci] = await Promise.all([
        getTransactions(1, 300).catch(() => ({ transactions: [], total: 0 })),
        getBalance(walletAddr).catch(() => null),
        getContractInfo().catch(() => null),
      ])
      setTxs(txData.transactions ?? [])
      setBalance(bal)
      setContractInfo(ci)
      if (isAdmin) setAnalytics(await getAdminAnalytics().catch(() => null))
    } finally { setLoading(false) }
  }, [walletAddr, isAdmin])

  useEffect(() => { void load() }, [load])

  const chartData = buildBalanceChartData(txs, walletAddr, balance, chartPeriod)
  const totalReceived = chartData.reduce((sum, p) => sum + p.received, 0)
  const totalSent = chartData.reduce((sum, p) => sum + p.sent, 0)
  const currentBalance = balanceToNumber(balance)
  const startBalance = chartData[0]?.balance ?? currentBalance
  const balanceDelta = currentBalance - startBalance

  function addAnnouncement(vals: Omit<Announcement, 'id' | 'createdAt' | 'author'>) {
    const next: Announcement = { ...vals, id: `ann-${Date.now()}`, createdAt: new Date().toISOString(), author: displayName }
    const updated = [next, ...announcements]
    setAnnouncements(updated); saveAnnouncements(updated)
    annForm.resetFields(); setShowAnnModal(false)
    void antMessage.success('Đã đăng thông báo')
  }

  function removeAnnouncement(id: string) {
    const updated = announcements.filter(a => a.id !== id)
    setAnnouncements(updated); saveAnnouncements(updated)
  }

  function scrollAnns(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  return (
    <Spin spinning={loading}>
      <div className="dashboard-liquid-page" style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 40 }}>

        {/* Hero Banner */}
<div className="dashboard-hero" style={{ flexWrap: 'wrap' }}>
  <div className="dashboard-hero-copy">
    <div className="dashboard-hero-kicker">
      Hệ thống quản lý VNDC
    </div>

    <Title level={2} className="dashboard-hero-title">
      Xin chào, {displayName}
    </Title>

    <Text className="dashboard-hero-muted">
      Theo dõi nguồn cung, giao dịch và trạng thái vận hành của hệ thống trong thời gian thực.
    </Text>

    <Space size={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
      <Text className="dashboard-hero-muted">
        {new Date().toLocaleDateString('vi-VN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </Text>

      {isAdmin && (
        <span
          style={{
            padding: '2px 10px',
            background: '#D97706',
            color: '#fff',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ADMIN
        </span>
      )}

      {contractInfo?.paused && (
        <span
          style={{
            padding: '2px 10px',
            background: '#DC2626',
            color: '#fff',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          HỢP ĐỒNG TẠM DỪNG
        </span>
      )}
    </Space>
  </div>
</div>


        {/* Announcements */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Space>
              <BellOutlined style={{ color: '#F59E0B', fontSize: 18 }} />
              <Text strong style={{ fontSize: 15, color: '#1A1744' }}>Thông báo từ Ban quản trị</Text>
              <Badge count={announcements.length} style={{ background: '#4338CA' }} />
            </Space>
            <Space>
              <Button size="small" shape="circle" icon={<LeftOutlined />} onClick={() => scrollAnns('left')} style={{ border: '1px solid #E0E7FF', color: '#4338CA' }} />
              <Button size="small" shape="circle" icon={<RightOutlined />} onClick={() => scrollAnns('right')} style={{ border: '1px solid #E0E7FF', color: '#4338CA' }} />
              {isAdmin && (
                <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => setShowAnnModal(true)} style={{ background: '#4338CA', borderColor: '#4338CA', borderRadius: 8, fontSize: 12 }}>
                  Đăng thông báo
                </Button>
              )}
            </Space>
          </div>
          <div ref={scrollRef} style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
            {announcements.map(ann => {
              const st = ANN_STYLE[ann.type]
              return (
                <div key={ann.id} className="liquid-announcement" style={{ minWidth: 300, maxWidth: 340, flexShrink: 0, background: st.bg, border: `1.5px solid ${st.border}`, borderRadius: 16, padding: '16px 18px', position: 'relative' }}>
                  {isAdmin && (<Button size="small" type="text" shape="circle" icon={<CloseOutlined style={{ fontSize: 10 }} />} onClick={() => removeAnnouncement(ann.id)} style={{ position: 'absolute', top: 10, right: 10, color: '#9CA3AF', width: 22, height: 22, minWidth: 22 }} />)}
                  <div style={{ fontSize: 11, fontWeight: 700, color: st.tagColor, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.tag}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1744', marginBottom: 6, lineHeight: 1.3 }}>{ann.title}</div>
                  <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>{ann.content}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>{ann.author} · {new Date(ann.createdAt).toLocaleDateString('vi-VN')}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Analytics Chart */}
        <Card className="liquid-panel" style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', marginBottom: 28, boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }} styles={{ body: { padding: '20px 24px' } }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
            <Space direction="vertical" size={2}>
              <Space>
                <RiseOutlined style={{ color: '#4338CA', fontSize: 18 }} />
                <Text strong style={{ fontSize: 16, color: '#1A1744' }}>Biến động số dư</Text>
              </Space>
              <Text style={{ fontSize: 12, color: '#64748B' }}>
                Biểu đồ miền mềm theo số dư ví qua từng mốc thời gian · {CHART_RANGE_OPTIONS[chartPeriod].detail}
              </Text>
            </Space>
            <Space size={12} wrap>
              <Space size={6}><div style={{ width: 18, height: 4, background: 'linear-gradient(90deg,#2563EB,#0EA5E9,#10B981)', borderRadius: 999 }} /><Text style={{ fontSize: 12, color: '#6B7280' }}>Số dư</Text></Space>
              <Space size={6}><div style={{ width: 8, height: 8, background: '#10B981', borderRadius: 999, opacity: .72 }} /><Text style={{ fontSize: 12, color: '#6B7280' }}>Dòng tiền vào</Text></Space>
              <Space size={6}><div style={{ width: 8, height: 8, background: '#F43F5E', borderRadius: 999, opacity: .72 }} /><Text style={{ fontSize: 12, color: '#6B7280' }}>Dòng tiền ra</Text></Space>
              <div className="liquid-segment" style={{ background: 'rgba(241,245,249,.72)', borderRadius: 12, padding: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(Object.keys(CHART_RANGE_OPTIONS) as ChartRange[]).map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)} style={{ padding: '6px 12px', borderRadius: 9, border: 'none', background: chartPeriod === p ? 'linear-gradient(135deg,#2563EB,#0EA5E9)' : 'transparent', color: chartPeriod === p ? '#fff' : '#64748B', fontWeight: chartPeriod === p ? 800 : 600, cursor: 'pointer', fontSize: 12, transition: 'all 0.15s', boxShadow: chartPeriod === p ? '0 10px 22px rgba(37,99,235,.18)' : 'none' }}>
                    {CHART_RANGE_OPTIONS[p].label}
                  </button>
                ))}
              </div>
            </Space>
          </div>
          <AreaChart data={chartData} height={260} />
          <div style={{ display: 'flex', gap: 32, marginTop: 16, paddingTop: 16, borderTop: '1px solid #E0E7FF', flexWrap: 'wrap' }}>
            {[
              { label: 'Số dư hiện tại', value: currentBalance, color: '#1D4ED8', prefix: '' },
              { label: 'Biến động kỳ này', value: balanceDelta, color: balanceDelta >= 0 ? '#10B981' : '#DC2626', prefix: balanceDelta >= 0 ? '+' : '' },
              { label: 'Tổng nhận', value: totalReceived, color: '#10B981', prefix: '+' },
              { label: 'Tổng gửi',  value: totalSent,     color: '#F43F5E', prefix: '-' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>
                  {s.prefix}{s.value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <span style={{ fontSize: 11, fontWeight: 500 }}>VNDC</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom Row */}
        <Row gutter={[20, 20]}>
          <Col xs={24} lg={16}>
            <Card
              className="liquid-panel"
              title={<Space><ClockCircleOutlined style={{ color: '#6366F1' }} /><Text strong style={{ color: '#1A1744', fontSize: 15 }}>Giao dịch gần đây</Text></Space>}
              extra={<Button type="link" onClick={() => navigate('/tokens')} size="small" icon={<RightOutlined />} iconPosition="end" style={{ color: '#2563EB', fontWeight: 600 }}>Xem tất cả</Button>}
              style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }}
              styles={{ body: { padding: '0 20px 16px' } }}
            >
              {txs.length === 0 ? <Empty description="Chưa có giao dịch nào" style={{ padding: 40 }} /> : (
                <div>
                  {txs.slice(0, 6).map(tx => {
                    const typeInfo = TX_TYPE_LABEL[tx.type] ?? { label: tx.type, color: 'default' }
                    const isSend = tx.from_wallet?.toLowerCase() === walletAddr.toLowerCase()
                    const isPending = tx.status === 'PENDING'
                    return (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <Space size={12}>
                          <div className="liquid-icon-tile" style={{ width: 40, height: 40, borderRadius: 12, background: isSend ? '#FEF2F2' : '#ECFDF5', border: `1.5px solid ${isSend ? '#FECACA' : '#A7F3D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSend ? '#DC2626' : '#059669', fontSize: 16 }}>
                            {isSend ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                          </div>
                          <div>
                            <Space size={6}>
                              <Tag color={typeInfo.color} style={{ fontSize: 11, margin: 0, borderRadius: 4 }}>{typeInfo.label}</Tag>
                              {isPending && <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>Đang xử lý</Tag>}
                            </Space>
                            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
                              {isSend ? `\u2192 ${shortenAddr(tx.to_wallet)}` : `\u2190 ${shortenAddr(tx.from_wallet)}`}
                              &nbsp;/&nbsp;{new Date(tx.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </Space>
                        <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: isSend ? '#DC2626' : '#059669' }}>
                          {isSend ? '\u2212' : '+'}{formatVNDC(tx.amount, true)} VNDC
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              className="liquid-panel"
              title={<Space><FireOutlined style={{ color: '#D97706' }} /><Text strong style={{ color: '#1A1744', fontSize: 15 }}>Khám phá nhanh</Text></Space>}
              style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', marginBottom: 20, boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }}
              styles={{ body: { padding: '12px 16px 16px' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: <WalletOutlined />, label: 'Chuyển Token',       desc: 'Gửi VNDC an toàn',       path: '/tokens',      color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
                  { icon: <ApartmentOutlined />, label: 'DAO Voting',       desc: 'Tham gia quản trị',       path: '/dao',         color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
                  { icon: <ShopOutlined />, label: 'NFT Marketplace',       desc: 'Mua bán NFT',             path: '/marketplace', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                  { icon: <CalendarOutlined />, label: 'Sự kiện & Hoạt động', desc: 'Tích điểm nhận thưởng',  path: '/events',      color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                  { icon: <FundOutlined />, label: 'Chiến dịch',            desc: 'Gây quỹ cộng đồng',      path: '/campaigns',   color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
                ].map(a => (
                  <button key={a.path} className="liquid-quick-action" onClick={() => navigate(a.path)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${a.border}`, background: a.bg, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = a.color; e.currentTarget.style.borderColor = a.color; const label = e.currentTarget.querySelector<HTMLElement>('.nav-label'); if (label) label.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = a.bg; e.currentTarget.style.borderColor = a.border; const label = e.currentTarget.querySelector<HTMLElement>('.nav-label'); if (label) label.style.color = a.color }}
                  >
                    <span className="liquid-icon-tile" style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', color: a.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
                    <div>
                      <div className="nav-label" style={{ fontSize: 13, fontWeight: 700, color: a.color, transition: 'color 0.15s' }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{a.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="liquid-panel" style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }} styles={{ body: { padding: '16px 20px' } }}>
              <Space style={{ marginBottom: 14 }}>
                <EditOutlined style={{ color: '#4338CA' }} />
                <Text strong style={{ color: '#1A1744' }}>Hoạt động của tôi</Text>
              </Space>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {[
                  { val: txs.length, label: 'Giao dịch', color: '#4338CA', bg: '#EEF2FF' },
                  { val: txs.filter(t => t.to_wallet?.toLowerCase() === walletAddr.toLowerCase()).length, label: 'Nhận vào', color: '#059669', bg: '#ECFDF5' },
                  { val: txs.filter(t => t.from_wallet?.toLowerCase() === walletAddr.toLowerCase()).length, label: 'Gửi đi', color: '#DC2626', bg: '#FEF2F2' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div className="liquid-icon-tile" style={{ width: 48, height: 48, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Announcement Modal */}
        <Modal title={<Space><BellOutlined style={{ color: '#4338CA' }} /><span>Đăng thông báo mới</span></Space>} open={showAnnModal} onCancel={() => { setShowAnnModal(false); annForm.resetFields() }} onOk={() => annForm.submit()} okText="Đăng ngay" cancelText="Hủy" okButtonProps={{ style: { background: '#4338CA', borderColor: '#4338CA' } }} destroyOnClose>
          <Form form={annForm} layout="vertical" onFinish={v => addAnnouncement(v as Omit<Announcement, 'id' | 'createdAt' | 'author'>)} style={{ marginTop: 16 }}>
            <Form.Item name="type" label="Loại thông báo" initialValue="info" rules={[{ required: true }]}>
              <Select><Select.Option value="highlight">Nổi bật</Select.Option><Select.Option value="info">Thông báo</Select.Option><Select.Option value="success">Mới / Tốt</Select.Option><Select.Option value="warning">Quan trọng</Select.Option></Select>
            </Form.Item>
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
              <Input placeholder="VD: Sự kiện mới tháng 6" maxLength={80} showCount />
            </Form.Item>
            <Form.Item name="content" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
              <Input.TextArea rows={3} placeholder="Mô tả chi tiết thông báo..." maxLength={300} showCount />
            </Form.Item>
          </Form>
        </Modal>

      </div>
    </Spin>
  )
}

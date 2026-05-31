import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Row, Col, Card, Typography, Tag, Space, Spin, Button, Avatar,
  Empty, Modal, Input, Form, Select, message as antMessage, Badge,
} from 'antd'
import {
  ClockCircleOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PlusOutlined, CloseOutlined, BellOutlined, FireOutlined,
  GlobalOutlined, TeamOutlined, BarChartOutlined, FundOutlined,
  RiseOutlined, LeftOutlined, RightOutlined, EditOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  getBalance, getTransactions, getContractInfo, getAdminAnalytics,
  type Transaction, type AdminAnalytics,
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
  { id: 'default-1', title: '🚀 VNDC Platform ra mắt chính thức', content: 'Nền tảng VNDC Token đã hoàn thành giai đoạn phát triển và chính thức đi vào hoạt động. Khám phá các tính năng mới!', type: 'highlight', createdAt: new Date().toISOString(), author: 'Admin' },
  { id: 'default-2', title: '🗳️ DAO Voting đã mở', content: 'Các đề xuất đầu tiên đã được tạo. Hãy tham gia bỏ phiếu để định hình tương lai của nền tảng.', type: 'info', createdAt: new Date().toISOString(), author: 'Admin' },
  { id: 'default-3', title: '🎁 Sự kiện tặng điểm hoạt động', content: 'Hoàn thành các nhiệm vụ trên hệ thống để nhận điểm hoạt động và đổi lấy VNDC Token.', type: 'success', createdAt: new Date().toISOString(), author: 'Admin' },
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
  highlight: { border: '#FCD34D', bg: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', tag: '⭐ Nổi bật',     tagColor: '#D97706' },
  info:      { border: '#93C5FD', bg: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', tag: '📢 Thông báo',  tagColor: '#2563EB' },
  success:   { border: '#6EE7B7', bg: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', tag: '✅ Mới',         tagColor: '#059669' },
  warning:   { border: '#FCA5A5', bg: 'linear-gradient(135deg,#FEF2F2,#FEE2E2)', tag: '⚠️ Quan trọng', tagColor: '#DC2626' },
}

interface ChartPoint { date: string; received: number; sent: number }

function AreaChart({ data, height = 220 }: { data: ChartPoint[]; height?: number }) {
  if (!data.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>Chưa có dữ liệu</div>
  const W = 900; const H = height
  const pad = { t: 16, r: 24, b: 44, l: 60 }
  const cW = W - pad.l - pad.r; const cH = H - pad.t - pad.b
  const maxVal = Math.max(...data.flatMap(d => [d.received, d.sent]), 1)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: maxVal * t, y: cH - t * cH }))
  const xScale = (i: number) => data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW
  const yScale = (v: number) => cH - Math.min(v / maxVal, 1) * cH
  const toPath = (key: 'received' | 'sent') => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(d[key]).toFixed(1)}`).join(' ')
  const toArea = (key: 'received' | 'sent') => { const last = data.length - 1; return toPath(key) + ` L ${xScale(last).toFixed(1)} ${cH} L ${xScale(0).toFixed(1)} ${cH} Z` }
  const xStep = Math.max(1, Math.floor(data.length / 7))
  const xLabels = data.map((d, i) => ({ d, i })).filter(({ i }) => i % xStep === 0 || i === data.length - 1)
  const fmtY = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v.toFixed(0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id="grad-recv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.4" /><stop offset="100%" stopColor="#10B981" stopOpacity="0.02" /></linearGradient>
        <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F43F5E" stopOpacity="0.3" /><stop offset="100%" stopColor="#F43F5E" stopOpacity="0.02" /></linearGradient>
      </defs>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {yTicks.map((t, i) => (<g key={i}><line x1={0} y1={t.y} x2={cW} y2={t.y} stroke="#E0E7FF" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '4 3'} /><text x={-8} y={t.y + 4} textAnchor="end" fontSize="11" fill="#9CA3AF">{fmtY(t.v)}</text></g>))}
        <path d={toArea('received')} fill="url(#grad-recv)" />
        <path d={toArea('sent')} fill="url(#grad-sent)" />
        <path d={toPath('received')} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={toPath('sent')} fill="none" stroke="#F43F5E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 3" />
        {xLabels.map(({ d, i }) => (<text key={i} x={xScale(i)} y={cH + 18} textAnchor="middle" fontSize="11" fill="#9CA3AF">{d.date}</text>))}
        <line x1={0} y1={0} x2={0} y2={cH} stroke="#E0E7FF" strokeWidth="1" />
      </g>
    </svg>
  )
}

function buildChartData(txs: Transaction[], walletAddr: string, days: number): ChartPoint[] {
  const now = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (days - 1 - i))
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    let received = 0; let sent = 0
    for (const tx of txs) {
      const txDate = new Date(tx.created_at)
      if (txDate < dayStart || txDate >= dayEnd) continue
      const amount = Number(BigInt(tx.amount || '0')) / 1e18
      if (tx.to_wallet?.toLowerCase() === walletAddr.toLowerCase()) received += amount
      if (tx.from_wallet?.toLowerCase() === walletAddr.toLowerCase()) sent += amount
    }
    return { date: dateStr, received, sent }
  })
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
  const [contractInfo, setContractInfo] = useState<{ total_supply: string; paused: boolean } | null>(null)
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartPeriod, setChartPeriod] = useState<'30' | '7'>('30')
  const [announcements, setAnnouncements] = useState<Announcement[]>(loadAnnouncements)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [annForm] = Form.useForm()

  const walletAddr = user?.wallet_address ?? ''
  const displayName = user?.full_name || user?.username || shortenAddr(walletAddr)
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('ADMIN')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txData, , ci] = await Promise.all([
        getTransactions(1, 200).catch(() => ({ transactions: [], total: 0 })),
        getBalance(walletAddr).catch(() => null),
        getContractInfo().catch(() => null),
      ])
      setTxs(txData.transactions ?? [])
      setContractInfo(ci)
      if (isAdmin) setAnalytics(await getAdminAnalytics().catch(() => null))
    } finally { setLoading(false) }
  }, [walletAddr, isAdmin])

  useEffect(() => { void load() }, [load])

  const chartData = buildChartData(txs, walletAddr, Number(chartPeriod))
  const totalReceived = txs.filter(t => t.to_wallet?.toLowerCase() === walletAddr.toLowerCase()).reduce((s, t) => s + Number(BigInt(t.amount || '0')) / 1e18, 0)
  const totalSent = txs.filter(t => t.from_wallet?.toLowerCase() === walletAddr.toLowerCase()).reduce((s, t) => s + Number(BigInt(t.amount || '0')) / 1e18, 0)
  const pendingCount = txs.filter(t => t.status === 'PENDING').length

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
      <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 40 }}>

        {/* Hero Banner */}
        <div style={{ background: 'linear-gradient(135deg,#0F0E2B 0%,#1E1A5C 45%,#312E81 100%)', borderRadius: 20, padding: '28px 36px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', boxShadow: '0 20px 60px rgba(67,56,202,0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: 80, bottom: -60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', pointerEvents: 'none' }} />
          <Avatar size={64} style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: '3px solid rgba(165,180,252,0.4)', flexShrink: 0, boxShadow: '0 0 24px rgba(99,102,241,0.5)', fontSize: 26, fontWeight: 800, fontFamily: 'Georgia,serif' }}>
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>Chào mừng trở lại</div>
            <Title level={2} style={{ margin: 0, color: '#FFFFFF', fontFamily: 'Georgia,serif', lineHeight: 1.15 }}>{displayName}</Title>
            <Space size={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: '#818CF8', fontSize: 13 }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              {isAdmin && <span style={{ padding: '2px 10px', background: '#D97706', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>ADMIN</span>}
              {contractInfo?.paused && <span style={{ padding: '2px 10px', background: '#DC2626', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>HỢP ĐỒNG TẠM DỪNG</span>}
            </Space>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: '#818CF8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Địa chỉ ví</div>
            <code style={{ fontSize: 13, color: '#C7D2FE', background: 'rgba(0,0,0,0.3)', padding: '6px 14px', borderRadius: 8, display: 'block', letterSpacing: '0.05em' }}>{shortenAddr(walletAddr)}</code>
            <Button size="small" onClick={() => void load()} style={{ marginTop: 10, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#A5B4FC', borderRadius: 8, fontSize: 12 }}>↻ Làm mới</Button>
          </div>
        </div>

        {/* Platform Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
          {[
            { icon: <GlobalOutlined style={{ fontSize: 22, color: '#6366F1' }} />, label: 'Tổng cung VNDC', value: contractInfo ? formatVNDC(contractInfo.total_supply, true) : '—', sub: 'Token lưu hành', bg: '#EEF2FF', border: '#C7D2FE', iconBg: '#4338CA22' },
            { icon: <TeamOutlined style={{ fontSize: 22, color: '#10B981' }} />, label: 'Người dùng', value: isAdmin && analytics ? analytics.users.total.toLocaleString('vi-VN') : '—', sub: isAdmin && analytics ? `${analytics.users.active_today} hoạt động hôm nay` : 'Chỉ admin xem được', bg: '#ECFDF5', border: '#A7F3D0', iconBg: '#10B98122' },
            { icon: <BarChartOutlined style={{ fontSize: 22, color: '#F59E0B' }} />, label: 'Giao dịch', value: isAdmin && analytics ? analytics.transactions.total.toLocaleString('vi-VN') : txs.length.toString(), sub: `${pendingCount} đang chờ xử lý`, bg: '#FFFBEB', border: '#FDE68A', iconBg: '#F59E0B22' },
            { icon: <FundOutlined style={{ fontSize: 22, color: '#8B5CF6' }} />, label: 'DAO & Chiến dịch', value: isAdmin && analytics ? `${analytics.dao.total_daos} / ${analytics.fundraising.total_campaigns}` : '—', sub: isAdmin && analytics ? `${analytics.dao.active_proposals} đề xuất đang mở` : 'Chỉ admin xem được', bg: '#F5F3FF', border: '#DDD6FE', iconBg: '#8B5CF622' },
          ].map((s, idx) => (
            <Col xs={12} sm={12} md={6} key={idx}>
              <Card style={{ borderRadius: 16, background: s.bg, border: `1.5px solid ${s.border}`, height: '100%' }} styles={{ body: { padding: '18px 20px' } }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1744', lineHeight: 1.1, fontFamily: 'monospace' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{s.sub}</div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

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
                <div key={ann.id} style={{ minWidth: 300, maxWidth: 340, flexShrink: 0, background: st.bg, border: `1.5px solid ${st.border}`, borderRadius: 16, padding: '16px 18px', position: 'relative' }}>
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
        <Card style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', marginBottom: 28, boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }} styles={{ body: { padding: '20px 24px' } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <Space>
              <RiseOutlined style={{ color: '#4338CA', fontSize: 18 }} />
              <Text strong style={{ fontSize: 16, color: '#1A1744' }}>Biến động giao dịch</Text>
            </Space>
            <Space size={16}>
              <Space size={6}><div style={{ width: 16, height: 3, background: '#10B981', borderRadius: 2 }} /><Text style={{ fontSize: 12, color: '#6B7280' }}>Nhận vào</Text></Space>
              <Space size={6}><div style={{ width: 16, height: 2, background: '#F43F5E', borderRadius: 2, borderTop: '2px dashed #F43F5E' }} /><Text style={{ fontSize: 12, color: '#6B7280' }}>Chuyển ra</Text></Space>
              <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 3, display: 'flex' }}>
                {(['7', '30'] as const).map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: chartPeriod === p ? '#4338CA' : 'transparent', color: chartPeriod === p ? '#fff' : '#6B7280', fontWeight: chartPeriod === p ? 700 : 500, cursor: 'pointer', fontSize: 13, transition: 'all 0.15s' }}>
                    {p === '7' ? '7 ngày' : '30 ngày'}
                  </button>
                ))}
              </div>
            </Space>
          </div>
          <AreaChart data={chartData} height={220} />
          <div style={{ display: 'flex', gap: 32, marginTop: 16, paddingTop: 16, borderTop: '1px solid #E0E7FF', flexWrap: 'wrap' }}>
            {[
              { label: 'Tổng nhận', value: totalReceived, color: '#10B981', prefix: '+' },
              { label: 'Tổng gửi',  value: totalSent,     color: '#F43F5E', prefix: '-' },
              { label: 'Net',        value: totalReceived - totalSent, color: totalReceived >= totalSent ? '#4338CA' : '#DC2626', prefix: '' },
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
              title={<Space><ClockCircleOutlined style={{ color: '#6366F1' }} /><Text strong style={{ color: '#1A1744', fontSize: 15 }}>Giao dịch gần đây</Text></Space>}
              extra={<Button type="link" onClick={() => navigate('/tokens')} size="small" style={{ color: '#4338CA', fontWeight: 600 }}>Xem tất cả →</Button>}
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
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: isSend ? '#FEF2F2' : '#ECFDF5', border: `1.5px solid ${isSend ? '#FECACA' : '#A7F3D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSend ? '#DC2626' : '#059669', fontSize: 16 }}>
                            {isSend ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                          </div>
                          <div>
                            <Space size={6}>
                              <Tag color={typeInfo.color} style={{ fontSize: 11, margin: 0, borderRadius: 4 }}>{typeInfo.label}</Tag>
                              {isPending && <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>Đang xử lý</Tag>}
                            </Space>
                            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
                              {isSend ? `\u2192 ${shortenAddr(tx.to_wallet)}` : `\u2190 ${shortenAddr(tx.from_wallet)}`}
                              &nbsp;·&nbsp;{new Date(tx.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
              title={<Space><FireOutlined style={{ color: '#D97706' }} /><Text strong style={{ color: '#1A1744', fontSize: 15 }}>Khám phá nhanh</Text></Space>}
              style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', marginBottom: 20, boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }}
              styles={{ body: { padding: '12px 16px 16px' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { emoji: '💸', label: 'Chuyển Token',       desc: 'Gửi VNDC an toàn',       path: '/tokens',      color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE' },
                  { emoji: '🗳️', label: 'DAO Voting',          desc: 'Tham gia quản trị',       path: '/dao',         color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
                  { emoji: '🛒', label: 'NFT Marketplace',     desc: 'Mua bán NFT',             path: '/marketplace', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                  { emoji: '📅', label: 'Sự kiện & Hoạt động', desc: 'Tích điểm nhận thưởng',  path: '/events',      color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                  { emoji: '🎗️', label: 'Chiến dịch',           desc: 'Gây quỹ cộng đồng',      path: '/campaigns',   color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
                ].map(a => (
                  <button key={a.path} onClick={() => navigate(a.path)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${a.border}`, background: a.bg, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = a.color; e.currentTarget.style.borderColor = a.color; const label = e.currentTarget.querySelector<HTMLElement>('.nav-label'); if (label) label.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = a.bg; e.currentTarget.style.borderColor = a.border; const label = e.currentTarget.querySelector<HTMLElement>('.nav-label'); if (label) label.style.color = a.color }}
                  >
                    <span style={{ fontSize: 20 }}>{a.emoji}</span>
                    <div>
                      <div className="nav-label" style={{ fontSize: 13, fontWeight: 700, color: a.color, transition: 'color 0.15s' }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{a.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card style={{ borderRadius: 20, border: '1.5px solid #E0E7FF', boxShadow: '0 4px 24px rgba(67,56,202,0.07)' }} styles={{ body: { padding: '16px 20px' } }}>
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
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
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
              <Select><Select.Option value="highlight">⭐ Nổi bật</Select.Option><Select.Option value="info">📢 Thông báo</Select.Option><Select.Option value="success">✅ Mới / Tốt</Select.Option><Select.Option value="warning">⚠️ Quan trọng</Select.Option></Select>
            </Form.Item>
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
              <Input placeholder="VD: 🚀 Sự kiện mới tháng 6" maxLength={80} showCount />
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

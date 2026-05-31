import { useCallback, useEffect, useState } from 'react'
import {
  Card, Typography, Space, Button, Tag, Progress, Modal, Form, Input,
  InputNumber, Spin, Empty, message as antMessage, Divider, Row, Col,
  Tabs, Select, Drawer, Table, Steps, Tooltip, DatePicker,
  Popconfirm, Badge,
} from 'antd'
import {
  FundOutlined, PlusOutlined, HeartOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, UserOutlined, TrophyOutlined,
  MoneyCollectOutlined, DeleteOutlined, TeamOutlined, BookOutlined,
  SearchOutlined, ReloadOutlined, EditOutlined, ArrowRightOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getFunds, getMyFunds, getFund, getFundSummary, getFundLedger,
  createFund, closeFund, reopenFund,
  addFundDeputy, removeFundDeputy,
  recordContribution, recordExpense,
  createFundPotOnChain, setFundContractStatus,
  recordFundContractContribution, spendFundContract,
  toWei, getNonce,
  type FundActivity, type FundLedgerEntry, type FundSummary,
} from '../lib/services'
import { signTypedData, buildTransferTypedData, switchChain } from '../lib/wallet'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

function fromWei(wei: string): number {
  if (!wei || wei === '0') return 0
  try {
    const n = BigInt(wei)
    const divisor = BigInt('1000000000000000000')
    const whole = n / divisor
    const remainder = n % divisor
    return Number(whole) + Number(remainder) / 1e18
  } catch { return 0 }
}

function fmtVNDC(wei: string): string {
  const n = fromWei(wei)
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function addWei(base: string, delta: string): string {
  try {
    const b = BigInt(base || '0')
    const d = BigInt(delta || '0')
    return (b + d).toString()
  } catch {
    return base || '0'
  }
}

function resolveFundImage(activity: FundActivity): string {
  const legacy = (activity as FundActivity & { image_url?: string }).image_url
  return (activity.image_uri || legacy || '').trim()
}

function shortWallet(w: string) {
  if (!w) return ''
  return `${w.slice(0, 6)}...${w.slice(-4)}`
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  DRAFT:     { color: 'default', label: 'Sắp mở',        icon: <ClockCircleOutlined /> },
  ACTIVE:    { color: 'blue',    label: 'Đang gây quỹ',  icon: <FundOutlined /> },
  CLOSED:    { color: 'green',   label: 'Đã đóng',       icon: <CheckCircleOutlined /> },
  CANCELLED: { color: 'red',     label: 'Đã hủy',        icon: <CloseCircleOutlined /> },
}

const CATEGORY_OPTIONS = [
  { value: 'EDUCATION',   label: '🎓 Giáo dục' },
  { value: 'HEALTH',      label: '🏥 Sức khỏe' },
  { value: 'ENVIRONMENT', label: '🌿 Môi trường' },
  { value: 'COMMUNITY',   label: '🤝 Cộng đồng' },
  { value: 'CHARITY',     label: '💙 Từ thiện' },
  { value: 'DISASTER',    label: '🆘 Thiên tai' },
  { value: 'BUSINESS',    label: '💼 Kinh doanh' },
  { value: 'OTHER',       label: '📦 Khác' },
]

const CAMPAIGN_STYLES = `
.fund-page {
  --f-bg1: #f8fcff;
  --f-bg2: #eef7f4;
  --f-ink: #0f172a;
  --f-muted: #64748b;
  --f-brand: #0ea5a4;
  --f-accent: #2563eb;
  --f-border: rgba(148,163,184,0.24);
  background:
    radial-gradient(900px 440px at 8% -12%, rgba(37,99,235,.14), transparent 62%),
    radial-gradient(820px 420px at 90% -12%, rgba(16,185,129,.16), transparent 60%),
    linear-gradient(180deg, var(--f-bg1), var(--f-bg2));
  border-radius: 24px;
  padding: 18px;
}
.fund-page .hero {
  background: linear-gradient(145deg, rgba(255,255,255,.94), rgba(240,253,250,.88));
  border: 1px solid var(--f-border);
  border-radius: 20px;
  padding: 16px 18px;
  box-shadow: 0 16px 34px rgba(15,23,42,.08);
  animation: heroIn .45s ease both;
}
.fund-page .hero-kpi {
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.2);
  background: #fff;
  min-width: 120px;
  padding: 10px 12px;
  text-align: center;
}
.fund-page .hero-kpi .value { font-weight: 800; font-size: 20px; color: var(--f-ink); }
.fund-page .hero-kpi .label { font-size: 11px; color: var(--f-muted); }
.fund-page .glass {
  background: rgba(255,255,255,.9);
  border: 1px solid var(--f-border);
  border-radius: 16px;
  box-shadow: 0 14px 28px rgba(15,23,42,.06);
}
.fund-page .fund-card {
  border-radius: 16px;
  border: 1px solid rgba(148,163,184,.2);
  transition: transform .18s ease, box-shadow .18s ease;
  animation: cardIn .35s ease both;
}
.fund-page .fund-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 36px rgba(15,23,42,.10);
}
.fund-page .fund-toolbar {
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.18);
  background: rgba(255,255,255,.82);
  padding: 10px;
}
.fund-page .admin-tabs .ant-tabs-nav {
  margin-bottom: 14px;
}
.fund-page .admin-tabs .ant-tabs-tab {
  border-radius: 999px;
  font-weight: 700;
  padding: 8px 14px;
}
.fund-page .admin-tabs .ant-tabs-tab.ant-tabs-tab-active {
  background: linear-gradient(135deg, rgba(59,130,246,.12), rgba(16,185,129,.12));
}
.fund-page .admin-shell {
  border: 1px solid rgba(148,163,184,.18);
  border-radius: 14px;
  padding: 12px;
  background: rgba(255,255,255,.76);
}
.fund-page .admin-kpi-card {
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  border: 1px solid rgba(148,163,184,.22);
  box-shadow: 0 8px 18px rgba(15,23,42,.05);
  animation: cardIn .28s ease both;
}
.fund-page .admin-kpi-card .kpi-label {
  font-size: 11px;
  color: #64748b;
  display: block;
}
.fund-page .admin-kpi-card .kpi-value {
  font-size: 14px;
  font-weight: 800;
}
.fund-page .contract-grid-card {
  border-radius: 12px;
  border: 1px solid rgba(148,163,184,.18);
  box-shadow: 0 8px 20px rgba(15,23,42,.05);
}
.fund-page .admin-tab-panel {
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.2);
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(241,245,249,.86));
  box-shadow: 0 10px 24px rgba(15,23,42,.06);
  padding: 12px;
}
@keyframes cardIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes heroIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 768px) {
  .fund-page { padding: 12px; border-radius: 16px; }
  .fund-page .hero { padding: 14px; }
  .fund-page .hero-kpi { min-width: 100px; }
}
`

function categoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find(c => c.value === cat)?.label ?? cat
}

function getProgress(a: FundActivity): number {
  const raised = fromWei(a.total_raised)
  const target = fromWei(a.target_amount)
  if (target <= 0) return 0
  return Math.min(Math.round((raised / target) * 100), 100)
}

// ─── FundCard ──────────────────────────────────────────────────────

function FundCard({ activity, onContribute, onDetail, isOwner }: {
  activity: FundActivity
  onContribute: () => void
  onDetail: () => void
  isOwner: boolean
}) {
  const imageUrl = resolveFundImage(activity)
  const st = STATUS_CONFIG[activity.status] ?? STATUS_CONFIG.ACTIVE
  const pct = getProgress(activity)
  const hasStarted = !activity.starts_at || !dayjs(activity.starts_at).isAfter(dayjs())
  const hasEnded = !!activity.ends_at && dayjs(activity.ends_at).isBefore(dayjs())
  const canContribute = (activity.status === 'ACTIVE' || activity.status === 'DRAFT') && hasStarted && !hasEnded
  const syncReady = !!activity.onchain_pot_id && !!activity.contract_address

  return (
    <Card
      className="fund-card"
      style={{ border: `1px solid ${activity.status === 'ACTIVE' ? '#BFDBFE' : '#E5E7EB'}`, height: '100%' }}
      bodyStyle={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {imageUrl && (
        <div
          style={{
            width: '100%',
            height: 132,
            borderRadius: 12,
            marginBottom: 14,
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid #E5E7EB',
          }}
        />
      )}
      <Space direction="vertical" size={12} style={{ width: '100%', flex: 1 }}>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Tag color={st.color} icon={st.icon}>{st.label}</Tag>
          <Space size={6}>
            <Tag color={syncReady ? 'cyan' : 'orange'}>{syncReady ? 'On-chain ready' : 'Sync pending'}</Tag>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{categoryLabel(activity.category)}</Text>
          </Space>
        </Space>
        <div>
          <Text strong style={{ fontSize: 14, color: '#111827', lineHeight: 1.4, display: 'block' }}>
            {activity.title}
          </Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
            <UserOutlined /> {shortWallet(activity.owner_wallet)}
            {isOwner && <Tag color="purple" style={{ marginLeft: 6, fontSize: 10 }}>Của bạn</Tag>}
          </Text>
        </div>
        <Paragraph style={{ color: '#6B7280', margin: 0, fontSize: 12 }} ellipsis={{ rows: 2 }}>
          {activity.description || 'Không có mô tả'}
        </Paragraph>
        <div>
          <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
              {fmtVNDC(activity.total_raised)} / {fmtVNDC(activity.target_amount)} VNDC
            </Text>
            <Text strong style={{ color: pct >= 100 ? '#10B981' : '#3B82F6', fontSize: 13 }}>{pct}%</Text>
          </Space>
          <Progress percent={pct} showInfo={false} strokeWidth={6}
            strokeColor={pct >= 100 ? '#10B981' : '#3B82F6'} trailColor="#E5E7EB" />
        </div>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button size="small" icon={<BookOutlined />} onClick={onDetail}>Chi tiết</Button>
          {canContribute && (
            <Button size="small" type="primary" icon={<HeartOutlined />} onClick={onContribute}
              style={{ background: '#10B981', borderColor: '#10B981' }}>
              Đóng góp
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  )
}

// ─── ContributeModal (EIP-712) ─────────────────────────────────────

function ContributeModal({ activity, user, open, onClose, onSuccess }: {
  activity: FundActivity | null
  user: AuthUser
  open: boolean
  onClose: () => void
  onSuccess: (payload: { activityId: string; amountWei: string }) => void
}) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => { if (!open) { setStep(0); form.resetFields() } }, [open, form])

  if (!activity) return null

  async function handleSubmit(values: { amount: number; note?: string }) {
    if (!user?.wallet_address || !activity) return
    setLoading(true)
    try {
      const chainId = parseInt((import.meta as unknown as { env: Record<string, string> }).env?.VITE_CHAIN_ID ?? '1337')
      await switchChain(chainId)
      setStep(1)

      const { nonce: nonceNum } = await getNonce(user.wallet_address)
      const nonceStr = nonceNum.toString()
      const deadline = Math.floor(Date.now() / 1000) + 3600
      setStep(2)

      const amountWei = toWei(values.amount.toString())
      const toAddress = activity.contract_address
      if (!toAddress) {
        throw new Error('Quỹ chưa sẵn sàng on-chain, chưa thể đóng góp')
      }

      const typedData = buildTransferTypedData({
        chainId,
        verifyingContract: (import.meta as unknown as { env: Record<string, string> }).env?.VITE_TOKEN_CONTRACT_ADDRESS,
        from: user.wallet_address,
        to: toAddress,
        amount: amountWei,
        nonce: nonceStr,
        deadline,
      })
      const signature = await signTypedData(undefined, user.wallet_address, typedData as Record<string, unknown>)
      setStep(3)

      await recordContribution(activity.id, {
        amount: amountWei,
        from_wallet: user.wallet_address,
        nonce: nonceStr,
        deadline,
        signature: signature ?? '',
        note: values.note,
      })
      setStep(4)
      antMessage.success(`Đóng góp ${values.amount} VNDC thành công!`)
      onSuccess({ activityId: activity.id, amountWei })
      onClose()
    } catch (err: unknown) {
      antMessage.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)))
      setStep(0)
    } finally {
      setLoading(false)
    }
  }

  const pct = getProgress(activity)

  return (
    <Modal
      title={<Space><HeartOutlined style={{ color: '#10B981' }} />Đóng góp vào quỹ</Space>}
      open={open} onCancel={onClose} footer={null} width={480}
    >
      <Divider />
      <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 14 }}>{activity.title}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {fmtVNDC(activity.total_raised)} / {fmtVNDC(activity.target_amount)} VNDC ({pct}%)
        </Text>
        <Progress percent={pct} showInfo={false} strokeColor="#10B981" strokeWidth={4} />
        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
          Tiền sẽ chuyển đến: {shortWallet(activity.contract_address || activity.owner_wallet)}
        </Text>
      </Space>

      <Steps size="small" current={step} style={{ marginBottom: 20 }} items={[
        { title: 'Kết nối' },
        { title: 'Nonce' },
        { title: 'Ký EIP-712' },
        { title: 'Xác nhận' },
      ]} />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Số tiền đóng góp (VNDC)" name="amount"
          rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập số tiền tối thiểu 0.01 VNDC' }]}
        >
          <InputNumber min={0.01} precision={2} style={{ width: '100%' }} addonAfter="VNDC"
            placeholder="Nhập số tiền..." />
        </Form.Item>
        <Form.Item label="Ghi chú (tuỳ chọn)" name="note">
          <Input placeholder="Ví dụ: Ủng hộ chương trình học bổng..." maxLength={200} />
        </Form.Item>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<ArrowRightOutlined />}
            style={{ background: '#10B981', borderColor: '#10B981' }}>
            Ký &amp; Đóng góp
          </Button>
        </Space>
      </Form>
    </Modal>
  )
}

// ─── RecordExpenseModal ────────────────────────────────────────────

function RecordExpenseModal({ activity, open, onClose, onSuccess }: {
  activity: FundActivity
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => { if (!open) form.resetFields() }, [open, form])

  async function handleSubmit(values: { amount: number; note: string; beneficiary_wallet: string; reference?: string }) {
    setLoading(true)
    try {
      await recordExpense(activity.id, {
        amount: toWei(values.amount.toString()),
        note: values.note,
        beneficiary_wallet: values.beneficiary_wallet,
        reference: values.reference,
      })
      antMessage.success('Ghi chi tiêu thành công!')
      onSuccess(); onClose()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Ghi chi tiêu thất bại')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={<Space><MoneyCollectOutlined style={{ color: '#EF4444' }} />Ghi chi tiêu từ quỹ</Space>}
      open={open} onCancel={onClose} footer={null} width={460}>
      <Divider />
      <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 16 }}>
        <Text strong>{activity.title}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Số dư khả dụng: <Text strong style={{ color: '#10B981' }}>{fmtVNDC(activity.available_balance)} VNDC</Text>
        </Text>
      </Space>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Số tiền (VNDC)" name="amount"
          rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập số tiền' }]}>
          <InputNumber min={0.01} precision={2} style={{ width: '100%' }} addonAfter="VNDC" />
        </Form.Item>
        <Form.Item label="Ví nhận tiền" name="beneficiary_wallet"
          rules={[{ required: true, message: 'Nhập địa chỉ ví người nhận' }]}>
          <Input placeholder="0x..." maxLength={42} />
        </Form.Item>
        <Form.Item label="Nội dung chi" name="note"
          rules={[{ required: true, message: 'Nhập nội dung' }]}>
          <Input.TextArea rows={2} placeholder="Mô tả mục đích chi tiêu..." maxLength={500} />
        </Form.Item>
        <Form.Item label="Mã tham chiếu (tuỳ chọn)" name="reference">
          <Input placeholder="VD: HD-2026-001" maxLength={100} />
        </Form.Item>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="primary" danger htmlType="submit" loading={loading} icon={<MoneyCollectOutlined />}>
            Xác nhận chi
          </Button>
        </Space>
      </Form>
    </Modal>
  )
}

// ─── CreateFundModal ───────────────────────────────────────────────

function CreateFundModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [deputies, setDeputies] = useState<string[]>([])
  const [deputyInput, setDeputyInput] = useState('')
  const [form] = Form.useForm()

  useEffect(() => { if (!open) { form.resetFields(); setDeputies([]); setDeputyInput('') } }, [open, form])

  function addDeputy() {
    const w = deputyInput.trim()
    if (!w || deputies.includes(w)) return
    setDeputies(prev => [...prev, w])
    setDeputyInput('')
  }

  async function handleSubmit(values: {
    title: string; description?: string; category: string
    image_uri?: string
    target_amount: number; starts_at?: dayjs.Dayjs; ends_at?: dayjs.Dayjs
  }) {
    setLoading(true)
    try {
      await createFund({
        title: values.title,
        description: values.description,
        image_uri: values.image_uri?.trim() || undefined,
        image_url: values.image_uri?.trim() || undefined,
        category: values.category,
        target_amount: toWei(values.target_amount.toString()),
        currency: 'VNDC',
        deputy_wallets: deputies,
        starts_at: values.starts_at?.toISOString(),
        ends_at: values.ends_at?.toISOString(),
      })
      antMessage.success('Tạo quỹ gây quỹ thành công!')
      onSuccess(); onClose()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Tạo quỹ thất bại')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={<Space><PlusOutlined style={{ color: '#10B981' }} />Tạo quỹ gây quỹ mới</Space>}
      open={open} onCancel={onClose} footer={null} width={580}>
      <Divider />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Tên quỹ" name="title"
          rules={[{ required: true, min: 5, max: 200, message: 'Tên quỹ từ 5-200 ký tự' }]}>
          <Input placeholder="Ví dụ: Quỹ học bổng cho sinh viên khó khăn" maxLength={200} showCount />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Danh mục" name="category" rules={[{ required: true, message: 'Chọn danh mục' }]}>
              <Select placeholder="Chọn danh mục" options={CATEGORY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Mục tiêu (VNDC)" name="target_amount"
              rules={[{ required: true, type: 'number', min: 1, message: 'Nhập mục tiêu ≥ 1 VNDC' }]}>
              <InputNumber min={1} precision={2} style={{ width: '100%' }} addonAfter="VNDC" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} placeholder="Mô tả mục tiêu và kế hoạch sử dụng quỹ..." maxLength={1000} showCount />
        </Form.Item>
        <Form.Item
          label="URL ảnh quỹ (tuỳ chọn)"
          name="image_uri"
          rules={[{ type: 'url', message: 'URL ảnh không hợp lệ' }]}
        >
          <Input placeholder="https://example.com/fund-cover.jpg" maxLength={500} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Bắt đầu (tuỳ chọn)" name="starts_at">
              <DatePicker style={{ width: '100%' }} showTime format="DD/MM/YYYY HH:mm" placeholder="Ngay lập tức" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Kết thúc (tuỳ chọn)" name="ends_at">
              <DatePicker style={{ width: '100%' }} showTime format="DD/MM/YYYY HH:mm" placeholder="Không giới hạn" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label={<Space><TeamOutlined />Đại diện phụ (tuỳ chọn)</Space>}>
          <Space.Compact style={{ width: '100%' }}>
            <Input value={deputyInput} onChange={e => setDeputyInput(e.target.value)}
              placeholder="Địa chỉ ví đại diện (0x...)" maxLength={42}
              onPressEnter={e => { e.preventDefault(); addDeputy() }} />
            <Button onClick={addDeputy} icon={<PlusOutlined />}>Thêm</Button>
          </Space.Compact>
          <div style={{ marginTop: 8 }}>
            {deputies.map(w => (
              <Tag key={w} closable onClose={() => setDeputies(prev => prev.filter(d => d !== w))}
                style={{ marginBottom: 4 }}>{shortWallet(w)}</Tag>
            ))}
          </div>
        </Form.Item>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={loading}
            style={{ background: '#10B981', borderColor: '#10B981' }}>Tạo quỹ</Button>
        </Space>
      </Form>
    </Modal>
  )
}

// ─── FundDetailDrawer ──────────────────────────────────────────────

function FundDetailDrawer({ activityId, user, open, onClose, onReload, initialTab = 'summary' }: {
  activityId: string | null; user?: AuthUser
  open: boolean; onClose: () => void; onReload: () => void
  initialTab?: string
}) {
  const [activity, setActivity] = useState<FundActivity | null>(null)
  const [summary, setSummary] = useState<FundSummary | null>(null)
  const [ledger, setLedger] = useState<FundLedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [deputyInput, setDeputyInput] = useState('')
  const [deputyLoading, setDeputyLoading] = useState(false)
  const [contractLoading, setContractLoading] = useState(false)
  const [contractStatus, setContractStatus] = useState<'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'>('ACTIVE')
  const [manualContribForm] = Form.useForm()
  const [manualSpendForm] = Form.useForm()

  const load = useCallback(async () => {
    if (!activityId) return
    setLoading(true)
    try {
      const [act, sum, led] = await Promise.all([
        getFund(activityId),
        getFundSummary(activityId),
        getFundLedger(activityId, 1, 50),
      ])
      setActivity(act); setSummary(sum); setLedger(led.items)
    } catch { antMessage.error('Không tải được chi tiết quỹ') }
    finally { setLoading(false) }
  }, [activityId])

  useEffect(() => {
    if (open && activityId) { setActiveTab(initialTab); void load() }
  }, [open, activityId, load, initialTab])

  const isOwner = !!(activity && user?.wallet_address &&
    activity.owner_wallet.toLowerCase() === user.wallet_address.toLowerCase())
  const isDeputy = !!(activity && user?.wallet_address &&
    activity.deputy_wallets.some(d => d.toLowerCase() === user.wallet_address!.toLowerCase()))
  const canManage = isOwner || isDeputy

  async function handleClose() {
    if (!activity) return
    try { await closeFund(activity.id); antMessage.success('Đã đóng quỹ'); void load(); onReload() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
  }

  async function handleReopen() {
    if (!activity) return
    try { await reopenFund(activity.id); antMessage.success('Đã mở lại quỹ'); void load(); onReload() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
  }

  async function handleAddDeputy() {
    if (!activity || !deputyInput.trim()) return
    setDeputyLoading(true)
    try { await addFundDeputy(activity.id, deputyInput.trim()); antMessage.success('Đã thêm đại diện'); setDeputyInput(''); void load() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
    finally { setDeputyLoading(false) }
  }

  async function handleRemoveDeputy(wallet: string) {
    if (!activity) return
    try { await removeFundDeputy(activity.id, wallet); antMessage.success('Đã xóa đại diện'); void load() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
  }

  async function handleCreatePotOnChain() {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await createFundPotOnChain(activity.id)
      antMessage.success(`Đã tạo pot on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Tạo pot on-chain thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleSetContractStatus() {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await setFundContractStatus(activity.id, contractStatus)
      antMessage.success(`Đã cập nhật trạng thái on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleManualContractContribution(values: { contributor_wallet: string; amount: number; transfer_tx_hash: string; note?: string }) {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await recordFundContractContribution(activity.id, {
        contributor_wallet: values.contributor_wallet,
        amount: toWei(values.amount.toString()),
        transfer_tx_hash: values.transfer_tx_hash,
        note: values.note,
      })
      antMessage.success(`Đã ghi đóng góp on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      manualContribForm.resetFields()
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Ghi đóng góp on-chain thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleManualContractSpend(values: { beneficiary_wallet: string; amount: number; note: string; reference?: string }) {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await spendFundContract(activity.id, {
        beneficiary_wallet: values.beneficiary_wallet,
        amount: toWei(values.amount.toString()),
        note: values.note,
        reference: values.reference,
      })
      antMessage.success(`Đã chi on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      manualSpendForm.resetFields()
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Chi on-chain thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  const st = activity ? (STATUS_CONFIG[activity.status] ?? STATUS_CONFIG.ACTIVE) : null

  const ledgerColumns = [
    { title: 'Loại', dataIndex: 'entry_type', width: 100,
      render: (t: string) => <Tag color={t === 'CONTRIBUTION' ? 'blue' : t === 'EXPENSE' ? 'red' : 'default'}>
        {t === 'CONTRIBUTION' ? 'Đóng góp' : t === 'EXPENSE' ? 'Chi tiêu' : 'Điều chỉnh'}
      </Tag> },
    { title: 'Số tiền', dataIndex: 'amount', width: 130,
      render: (a: string, r: FundLedgerEntry) =>
        <Text strong style={{ color: r.entry_type === 'CONTRIBUTION' ? '#10B981' : '#EF4444' }}>
          {r.entry_type === 'CONTRIBUTION' ? '+' : '-'}{fmtVNDC(a)} VNDC
        </Text> },
    { title: 'Tác nhân', dataIndex: 'actor_wallet',
      render: (w: string) => <Text code style={{ fontSize: 11 }}>{shortWallet(w)}</Text> },
    { title: 'Ghi chú', dataIndex: 'note',
      render: (n: string) => <Text style={{ fontSize: 12 }}>{n || '—'}</Text> },
    { title: 'Thời gian', dataIndex: 'created_at', width: 120,
      render: (d: string) => <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{dayjs(d).format('DD/MM HH:mm')}</Text> },
  ]

  return (
    <>
      <Drawer
        title={activity ? (
          <Space direction="vertical" size={2}>
            <Space>
              {st && <Tag color={st.color} icon={st.icon}>{st.label}</Tag>}
              <Text strong style={{ fontSize: 15 }}>{activity.title}</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Dashboard quản trị quỹ: tổng quan, vận hành và thao tác hợp đồng on-chain.
            </Text>
          </Space>
        ) : 'Chi tiết quỹ'}
        open={open} onClose={onClose} width={680}
        extra={activity && user && (
          <Space>
            {canManage && (
              <Button size="small" danger icon={<MoneyCollectOutlined />} onClick={() => setExpenseOpen(true)}>
                Ghi chi tiêu
              </Button>
            )}
            {(activity.status === 'ACTIVE' || activity.status === 'DRAFT') && (
              <Button size="small" type="primary" icon={<HeartOutlined />} onClick={() => setContributeOpen(true)}
                style={{ background: '#10B981', borderColor: '#10B981' }}>
                Đóng góp
              </Button>
            )}
          </Space>
        )}
      >
        <Spin spinning={loading}>
          {activity && summary && (
            <Tabs className="admin-tabs" activeKey={activeTab} onChange={setActiveTab} items={[
              {
                key: 'summary',
                label: <Space><TrophyOutlined />Tổng quan</Space>,
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <div className="admin-shell">
                      <Row gutter={[10, 10]}>
                        {[
                          { label: 'Mục tiêu', value: fmtVNDC(summary.target_amount), color: '#374151' },
                          { label: 'Đã gây quỹ', value: fmtVNDC(summary.total_raised), color: '#10B981' },
                          { label: 'Đã chi', value: fmtVNDC(summary.total_spent), color: '#EF4444' },
                          { label: 'Số dư', value: fmtVNDC(summary.available_balance), color: '#3B82F6' },
                        ].map(s => (
                          <Col xs={12} sm={6} key={s.label}>
                            <Card className="admin-kpi-card" bodyStyle={{ padding: '10px 12px', textAlign: 'center' }}>
                              <Text className="kpi-label">{s.label}</Text>
                              <Text className="kpi-value" style={{ color: s.color }}>{s.value}</Text>
                              <Text style={{ fontSize: 10, color: '#9CA3AF' }}> {summary.currency}</Text>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </div>

                    <div className="admin-shell">
                      <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
                        <Text strong>{getProgress(activity)}% đạt mục tiêu</Text>
                        <Space>
                          <Badge count={summary.contribution_count} showZero color="#3B82F6" />
                          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>đóng góp</Text>
                          <Badge count={summary.expense_count} showZero color="#EF4444" />
                          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>chi tiêu</Text>
                        </Space>
                      </Space>
                      <Progress percent={getProgress(activity)} strokeColor="#10B981" trailColor="#E5E7EB" strokeWidth={10} />
                    </div>

                    <Card className="contract-grid-card" bodyStyle={{ padding: 16 }}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space><Text type="secondary">Danh mục:</Text><Text>{categoryLabel(activity.category)}</Text></Space>
                        <Space><Text type="secondary">Chủ quỹ:</Text><Text code>{shortWallet(activity.owner_wallet)}</Text></Space>
                        {activity.contract_address && (
                          <Space><Text type="secondary">Contract:</Text><Text code style={{ fontSize: 11 }}>{shortWallet(activity.contract_address)}</Text></Space>
                        )}
                        {activity.starts_at && (
                          <Space><Text type="secondary">Bắt đầu:</Text><Text>{dayjs(activity.starts_at).format('DD/MM/YYYY HH:mm')}</Text></Space>
                        )}
                        {activity.ends_at && (
                          <Space><Text type="secondary">Kết thúc:</Text><Text>{dayjs(activity.ends_at).format('DD/MM/YYYY HH:mm')}</Text></Space>
                        )}
                        {activity.description && (
                          <div>
                            <Text type="secondary">Mô tả:</Text>
                            <Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>{activity.description}</Paragraph>
                          </div>
                        )}
                      </Space>
                    </Card>
                    {isOwner && (
                      <Space>
                        {activity.status === 'ACTIVE' && (
                          <Popconfirm title="Đóng quỹ?" onConfirm={() => void handleClose()} okText="Đóng" cancelText="Hủy">
                            <Button danger icon={<CloseCircleOutlined />}>Đóng quỹ</Button>
                          </Popconfirm>
                        )}
                        {activity.status === 'CLOSED' && (
                          <Popconfirm title="Mở lại quỹ?" onConfirm={() => void handleReopen()} okText="Mở lại" cancelText="Hủy">
                            <Button icon={<CheckCircleOutlined />}>Mở lại quỹ</Button>
                          </Popconfirm>
                        )}
                      </Space>
                    )}
                  </Space>
                ),
              },
              {
                key: 'ledger',
                label: <Space><BookOutlined />Sổ quỹ ({ledger.length})</Space>,
                children: (
                  <Table dataSource={ledger} columns={ledgerColumns} rowKey="id"
                    size="small" pagination={false} scroll={{ x: 500 }}
                    locale={{ emptyText: <Empty description="Chưa có giao dịch" /> }} />
                ),
              },
              {
                key: 'deputies',
                label: <Space><TeamOutlined />Đại diện ({activity.deputy_wallets.length})</Space>,
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {activity.deputy_wallets.length === 0
                      ? <Empty description="Chưa có đại diện phụ" />
                      : activity.deputy_wallets.map(w => (
                        <Card key={w} bodyStyle={{ padding: '10px 16px' }}>
                          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                            <Space><UserOutlined /><Text code>{w}</Text></Space>
                            {isOwner && (
                              <Popconfirm title="Xóa đại diện này?" onConfirm={() => void handleRemoveDeputy(w)}
                                okText="Xóa" cancelText="Hủy">
                                <Button danger size="small" icon={<DeleteOutlined />}>Xóa</Button>
                              </Popconfirm>
                            )}
                          </Space>
                        </Card>
                      ))
                    }
                    {isOwner && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                          Thêm đại diện mới:
                        </Text>
                        <Space.Compact style={{ width: '100%' }}>
                          <Input value={deputyInput} onChange={e => setDeputyInput(e.target.value)}
                            placeholder="Địa chỉ ví (0x...)" maxLength={42}
                            onPressEnter={e => { e.preventDefault(); void handleAddDeputy() }} />
                          <Button type="primary" loading={deputyLoading} onClick={() => void handleAddDeputy()}>Thêm</Button>
                        </Space.Compact>
                      </div>
                    )}
                  </Space>
                ),
              },
              ...(canManage ? [{
                key: 'contract',
                label: <Space><FundOutlined />Hợp đồng</Space>,
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <Card className="contract-grid-card" bodyStyle={{ padding: 14 }}>
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Text strong>Quản trị pot on-chain</Text>
                        <Space wrap>
                          <Tag color={activity.onchain_pot_id ? 'cyan' : 'orange'}>
                            PotID: {activity.onchain_pot_id ? shortWallet(activity.onchain_pot_id) : 'Chưa có'}
                          </Tag>
                          <Tag color={activity.contract_address ? 'blue' : 'orange'}>
                            Contract: {activity.contract_address ? shortWallet(activity.contract_address) : 'Chưa gán'}
                          </Tag>
                        </Space>
                        <Space wrap>
                          <Button onClick={() => void handleCreatePotOnChain()} loading={contractLoading}>
                            Create pot on-chain
                          </Button>
                          <Select
                            style={{ width: 180 }}
                            value={contractStatus}
                            onChange={value => setContractStatus(value)}
                            options={[
                              { value: 'DRAFT', label: 'DRAFT' },
                              { value: 'ACTIVE', label: 'ACTIVE' },
                              { value: 'CLOSED', label: 'CLOSED' },
                              { value: 'CANCELLED', label: 'CANCELLED' },
                            ]}
                          />
                          <Button type="primary" onClick={() => void handleSetContractStatus()} loading={contractLoading}>
                            Set status
                          </Button>
                        </Space>
                      </Space>
                    </Card>

                    <Row gutter={[12, 12]}>
                      <Col xs={24} lg={12}>
                        <Card className="contract-grid-card" bodyStyle={{ padding: 14 }} title="Manual recordContribution">
                          <Form layout="vertical" form={manualContribForm} onFinish={values => void handleManualContractContribution(values)}>
                            <Form.Item name="contributor_wallet" label="Contributor wallet"
                              rules={[{ required: true, message: 'Nhập ví contributor' }]}
                            >
                              <Input placeholder="0x..." />
                            </Form.Item>
                            <Form.Item name="amount" label="Amount (VNDC)"
                              rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập amount > 0' }]}
                            >
                              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
                            </Form.Item>
                            <Form.Item name="transfer_tx_hash" label="Transfer tx hash"
                              rules={[{ required: true, message: 'Nhập transfer tx hash' }]}
                            >
                              <Input placeholder="0x..." />
                            </Form.Item>
                            <Form.Item name="note" label="Note">
                              <Input placeholder="Manual sync from contract" />
                            </Form.Item>
                            <Button htmlType="submit" type="primary" loading={contractLoading}>Submit contribution</Button>
                          </Form>
                        </Card>
                      </Col>

                      <Col xs={24} lg={12}>
                        <Card className="contract-grid-card" bodyStyle={{ padding: 14 }} title="Manual spend">
                          <Form layout="vertical" form={manualSpendForm} onFinish={values => void handleManualContractSpend(values)}>
                            <Form.Item name="beneficiary_wallet" label="Beneficiary wallet"
                              rules={[{ required: true, message: 'Nhập ví nhận tiền' }]}
                            >
                              <Input placeholder="0x..." />
                            </Form.Item>
                            <Form.Item name="amount" label="Amount (VNDC)"
                              rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập amount > 0' }]}
                            >
                              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
                            </Form.Item>
                            <Form.Item name="note" label="Note"
                              rules={[{ required: true, message: 'Nhập nội dung chi' }]}
                            >
                              <Input placeholder="Chi cho hoạt động..." />
                            </Form.Item>
                            <Form.Item name="reference" label="Reference">
                              <Input placeholder="Optional reference" />
                            </Form.Item>
                            <Button htmlType="submit" danger type="primary" loading={contractLoading}>Submit spend</Button>
                          </Form>
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                ),
              }] : []),
            ]} />
          )}
        </Spin>
      </Drawer>

      {activity && user && (
        <>
          <RecordExpenseModal activity={activity} open={expenseOpen}
            onClose={() => setExpenseOpen(false)}
            onSuccess={() => { void load(); onReload() }} />
          <ContributeModal activity={activity} user={user} open={contributeOpen}
            onClose={() => setContributeOpen(false)}
            onSuccess={() => { void load(); onReload() }} />
        </>
      )}
    </>
  )
}

function FundAdminTab({ user, onOpenContract, onOpenSummary, onCreate }: {
  user: AuthUser
  onOpenContract: (id: string) => void
  onOpenSummary: (id: string) => void
  onCreate: () => void
}) {
  const [funds, setFunds] = useState<FundActivity[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { items } = await getMyFunds(user.wallet_address)
      setFunds(items)
    } catch {
      setFunds([])
    } finally {
      setLoading(false)
    }
  }, [user.wallet_address])

  useEffect(() => { void load() }, [load])

  const readyCount = funds.filter(f => !!f.onchain_pot_id && !!f.contract_address).length

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <div className="admin-tab-panel">
        <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 16 }}>Trung tâm Quản trị Gây quỹ</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tập trung quản lý vận hành và hợp đồng on-chain cho các quỹ của bạn.
            </Text>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Làm mới</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}
              style={{ background: '#4338CA', borderColor: '#6366F1' }}>
              Tạo quỹ mới
            </Button>
          </Space>
        </Space>
      </div>

      <Row gutter={[10, 10]}>
        <Col xs={12} sm={8}>
          <Card className="admin-kpi-card" bodyStyle={{ padding: '10px 12px', textAlign: 'center' }}>
            <Text className="kpi-label">Tổng quỹ quản trị</Text>
            <Text className="kpi-value" style={{ color: '#334155' }}>{funds.length}</Text>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="admin-kpi-card" bodyStyle={{ padding: '10px 12px', textAlign: 'center' }}>
            <Text className="kpi-label">On-chain ready</Text>
            <Text className="kpi-value" style={{ color: '#0891B2' }}>{readyCount}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="admin-kpi-card" bodyStyle={{ padding: '10px 12px', textAlign: 'center' }}>
            <Text className="kpi-label">Đang hoạt động</Text>
            <Text className="kpi-value" style={{ color: '#10B981' }}>{funds.filter(f => f.status === 'ACTIVE' || f.status === 'DRAFT').length}</Text>
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
        {funds.length === 0 && !loading ? (
          <Empty description="Chưa có quỹ để quản trị" />
        ) : (
          <Row gutter={[12, 12]}>
            {funds.map(f => {
              const st = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.ACTIVE
              return (
                <Col xs={24} md={12} key={f.id}>
                  <Card className="contract-grid-card" bodyStyle={{ padding: 14 }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Tag color={st.color} icon={st.icon}>{st.label}</Tag>
                        <Tag color={f.onchain_pot_id && f.contract_address ? 'cyan' : 'orange'}>
                          {f.onchain_pot_id && f.contract_address ? 'On-chain ready' : 'Sync pending'}
                        </Tag>
                      </Space>
                      <Text strong>{f.title}</Text>
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>Đã gây quỹ:</Text>
                        <Text strong style={{ color: '#10B981' }}>{fmtVNDC(f.total_raised)} VNDC</Text>
                      </Space>
                      <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                        <Button size="small" onClick={() => onOpenSummary(f.id)}>Tổng quan</Button>
                        <Button size="small" type="primary" onClick={() => onOpenContract(f.id)}>
                          Quản trị hợp đồng
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Spin>
    </Space>
  )
}

// ─── BrowseTab ─────────────────────────────────────────────────────

function BrowseTab({ user, onDetail, onContribute, optimisticRaised }: {
  user?: AuthUser
  onDetail: (id: string) => void
  onContribute: (a: FundActivity) => void
  optimisticRaised: Record<string, bigint>
}) {
  const [funds, setFunds] = useState<FundActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [status, setStatus] = useState<string>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const statusFilter = status === 'ALL' ? undefined : status
      const { items } = await getFunds(1, 50, statusFilter, category, search)
      setFunds(items)
    } catch { setFunds([]) }
    finally { setLoading(false) }
  }, [status, category, search])

  useEffect(() => { void load() }, [load])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]} align="middle" className="fund-toolbar">
        <Col xs={24} sm={10}>
          <Input.Search placeholder="Tìm kiếm quỹ..." allowClear
            onSearch={v => setSearch(v)} onChange={e => { if (!e.target.value) setSearch('') }}
            prefix={<SearchOutlined />} />
        </Col>
        <Col xs={12} sm={7}>
          <Select style={{ width: '100%' }} placeholder="Danh mục" allowClear
            options={CATEGORY_OPTIONS} value={category} onChange={v => setCategory(v)} />
        </Col>
        <Col xs={8} sm={5}>
          <Select style={{ width: '100%' }} placeholder="Trạng thái" value={status}
            onChange={v => setStatus(v)}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'ACTIVE', label: 'Đang gây quỹ' },
              { value: 'DRAFT', label: 'Sắp mở' },
              { value: 'CLOSED', label: 'Đã đóng' },
              { value: 'CANCELLED', label: 'Đã hủy' },
            ]} />
        </Col>
        <Col xs={4} sm={2}>
          <Tooltip title="Làm mới">
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} />
          </Tooltip>
        </Col>
      </Row>
      <Spin spinning={loading}>
        {funds.length === 0 && !loading
          ? <Empty description="Không tìm thấy quỹ nào" style={{ padding: 48 }} />
          : <Row gutter={[16, 16]}>
              {funds.map(a => (
                (() => {
                  const delta = optimisticRaised[a.id] ?? 0n
                  const displayActivity = delta > 0n
                    ? { ...a, total_raised: addWei(a.total_raised, delta.toString()) }
                    : a
                  return (
                <Col xs={24} sm={12} lg={8} key={a.id}>
                  <FundCard activity={displayActivity}
                    isOwner={!!(user?.wallet_address && displayActivity.owner_wallet.toLowerCase() === user.wallet_address.toLowerCase())}
                    onContribute={() => onContribute(a)} onDetail={() => onDetail(displayActivity.id)} />
                </Col>
                  )
                })()
              ))}
            </Row>
        }
      </Spin>
    </Space>
  )
}

// ─── MyFundsTab ────────────────────────────────────────────────────

function MyFundsTab({ user, onDetail, onContribute, onCreate, optimisticRaised }: {
  user: AuthUser
  onDetail: (id: string) => void
  onContribute: (a: FundActivity) => void
  onCreate: () => void
  optimisticRaised: Record<string, bigint>
}) {
  const [funds, setFunds] = useState<FundActivity[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user.wallet_address) return
    setLoading(true)
    try { const { items } = await getMyFunds(user.wallet_address); setFunds(items) }
    catch { setFunds([]) }
    finally { setLoading(false) }
  }, [user.wallet_address])

  useEffect(() => { void load() }, [load])

  const totalRaised = funds.reduce((sum, f) => {
    const delta = optimisticRaised[f.id] ?? 0n
    const raised = delta > 0n ? addWei(f.total_raised, delta.toString()) : f.total_raised
    return sum + fromWei(raised)
  }, 0)

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {[
          { label: 'Đang hoạt động', value: funds.filter(f => f.status === 'ACTIVE' || f.status === 'DRAFT').length, color: '#3B82F6' },
          { label: 'Đã kết thúc', value: funds.filter(f => f.status === 'CLOSED' || f.status === 'CANCELLED').length, color: '#6B7280' },
          { label: 'Tổng đã gây quỹ (VNDC)', value: totalRaised.toLocaleString('vi-VN', { maximumFractionDigits: 2 }), color: '#10B981' },
        ].map(s => (
          <Col xs={24} sm={8} key={s.label}>
            <Card bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}>
              <Text style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>{s.label}</Text>
              <Text strong style={{ color: s.color, fontSize: 20 }}>{s.value}</Text>
            </Card>
          </Col>
        ))}
      </Row>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Text strong>Danh sách quỹ của tôi ({funds.length})</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}
            style={{ background: '#10B981', borderColor: '#10B981' }}>Tạo quỹ mới</Button>
        </Space>
      </Space>
      <Spin spinning={loading}>
        {funds.length === 0 && !loading
          ? <Empty description="Bạn chưa có quỹ nào">
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}
                style={{ background: '#10B981', borderColor: '#10B981' }}>Tạo quỹ đầu tiên</Button>
            </Empty>
          : <Row gutter={[16, 16]}>
              {funds.map(a => (
                (() => {
                  const delta = optimisticRaised[a.id] ?? 0n
                  const displayActivity = delta > 0n
                    ? { ...a, total_raised: addWei(a.total_raised, delta.toString()) }
                    : a
                  return (
                <Col xs={24} sm={12} lg={8} key={a.id}>
                  <FundCard activity={displayActivity}
                    isOwner={displayActivity.owner_wallet.toLowerCase() === user.wallet_address.toLowerCase()}
                    onContribute={() => onContribute(a)} onDetail={() => onDetail(displayActivity.id)} />
                </Col>
                  )
                })()
              ))}
            </Row>
        }
      </Spin>
    </Space>
  )
}

// ─── CampaignsPage (main) ──────────────────────────────────────────

interface CampaignsPageProps { user?: AuthUser }

export function CampaignsPage({ user }: CampaignsPageProps) {
  const [tab, setTab] = useState('browse')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState('summary')
  const [contributeActivity, setContributeActivity] = useState<FundActivity | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [optimisticRaised, setOptimisticRaised] = useState<Record<string, bigint>>({})

  function applyOptimisticContribution(activityId: string, amountWei: string) {
    let amount = 0n
    try {
      amount = BigInt(amountWei)
    } catch {
      return
    }
    if (amount <= 0n) return

    setOptimisticRaised(prev => ({
      ...prev,
      [activityId]: (prev[activityId] ?? 0n) + amount,
    }))

    // Auto-clear optimistic delta after settlement window to avoid double counting.
    setTimeout(() => {
      setOptimisticRaised(prev => {
        const current = prev[activityId] ?? 0n
        const next = current - amount
        if (next <= 0n) {
          const { [activityId]: _removed, ...rest } = prev
          return rest
        }
        return { ...prev, [activityId]: next }
      })
    }, 20000)
  }

  function reload() { setReloadKey(k => k + 1) }

  function openDetail(id: string, targetTab: 'summary' | 'contract' | 'ledger' | 'deputies' = 'summary') {
    setDetailTab(targetTab)
    setDetailId(id)
  }

  const tabItems = [
    {
      key: 'browse',
      label: <Space><SearchOutlined />Khám phá</Space>,
      children: (
        <BrowseTab key={`browse-${reloadKey}`} user={user}
          onDetail={id => openDetail(id, 'summary')} onContribute={setContributeActivity} optimisticRaised={optimisticRaised} />
      ),
    },
    ...(user ? [{
      key: 'mine',
      label: <Space><EditOutlined />Quỹ của tôi</Space>,
      children: (
        <MyFundsTab key={`mine-${reloadKey}`} user={user}
          onDetail={id => openDetail(id, 'summary')} onContribute={setContributeActivity} optimisticRaised={optimisticRaised}
          onCreate={() => setCreateOpen(true)} />
      ),
    }] : []),
    ...(user ? [{
      key: 'admin',
      label: <Space><EditOutlined />Quản trị</Space>,
      children: (
        <FundAdminTab
          user={user}
          onOpenSummary={id => openDetail(id, 'summary')}
          onOpenContract={id => openDetail(id, 'contract')}
          onCreate={() => setCreateOpen(true)}
        />
      ),
    }] : []),
  ]

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }} className="fund-page">
      <style>{CAMPAIGN_STYLES}</style>

      <div
        style={{
          background: 'linear-gradient(135deg,#0F0E2B 0%,#1E1A5C 50%,#312E81 100%)',
          borderRadius: 22,
          padding: '24px 28px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
          boxShadow: '0 20px 60px rgba(67,56,202,0.32)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', pointerEvents: 'none' }} />
        <div style={{ width: 58, height: 58, borderRadius: 17, background: 'rgba(99,102,241,0.2)', border: '1.5px solid rgba(165,180,252,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FundOutlined style={{ fontSize: 28, color: '#A5B4FC' }} />
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <Title level={3} style={{ color: '#fff', margin: 0, fontFamily: 'Georgia,serif', lineHeight: 1.2 }}>
            Gây quỹ cộng đồng
          </Title>
          <Text style={{ color: '#818CF8', fontSize: 13 }}>
            Thiết kế quỹ tinh gọn metadata on-chain, dữ liệu chi tiết và vận hành nằm ở off-chain/DB.
          </Text>
        </div>

        <div style={{ textAlign: 'right', minWidth: 210 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
            <Text style={{ color: '#6EE7B7', fontSize: 12, fontWeight: 600 }}>Đồng bộ On-chain / Off-chain</Text>
          </div>
          <Text style={{ color: '#818CF8', fontSize: 11 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />Pot · Ledger · DB
          </Text>
          {user && (
            <div style={{ marginTop: 10 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}
                style={{ background: '#4338CA', borderColor: '#6366F1', boxShadow: '0 8px 22px rgba(99,102,241,.35)' }}>
                Tạo quỹ mới
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="glass" bodyStyle={{ padding: 12 }}>
        <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
      </Card>

      <CreateFundModal open={createOpen} onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); reload() }} />

      <FundDetailDrawer activityId={detailId} user={user} open={!!detailId}
        onClose={() => { setDetailId(null); setDetailTab('summary') }} onReload={reload} initialTab={detailTab} />

      {contributeActivity && user && (
        <ContributeModal activity={contributeActivity} user={user} open={!!contributeActivity}
          onClose={() => setContributeActivity(null)}
          onSuccess={({ activityId, amountWei }) => {
            applyOptimisticContribution(activityId, amountWei)
            setContributeActivity(null)
            reload()
          }} />
      )}

      {contributeActivity && !user && (
        <Modal open title={<Space><ExclamationCircleOutlined style={{ color: '#F59E0B' }} />Yêu cầu đăng nhập</Space>}
          onCancel={() => setContributeActivity(null)} footer={null}>
          <Text>Vui lòng đăng nhập để đóng góp vào quỹ.</Text>
        </Modal>
      )}
    </div>
  )
}

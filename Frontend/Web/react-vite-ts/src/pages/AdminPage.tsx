import { useEffect, useState, useCallback } from 'react'
import {
  Tabs, Card, Row, Col, Button, Space, Form, Input, InputNumber, Modal, Drawer, Table, message as antMessage,
  Tag, Progress, Typography, Alert, List, Tooltip, Divider, Switch, Select, Spin,
  Descriptions,
} from 'antd'
import {
  ContainerOutlined, BellOutlined,
  CheckCircleOutlined, CloseCircleOutlined, PlusOutlined,
  ReloadOutlined, UserOutlined, LockOutlined,
  UnlockOutlined, WarningOutlined, InfoCircleOutlined, SettingOutlined,
  SafetyCertificateOutlined, BarChartOutlined, TeamOutlined,
  TransactionOutlined, ApartmentOutlined, ShopOutlined,
  CalendarOutlined, FundOutlined, GlobalOutlined,
  SearchOutlined, KeyOutlined, ApiOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { AuthUser } from '../hooks/useAuth'
import {
  getAdminAnalytics, getAdminUsers, adminListUsers, adminGetUser,
  adminSuspendUser, adminUnsuspendUser, adminAssignRole, adminRemoveRole, adminApproveKYC,
  getTransactionsByWallet,
  adminMint, adminPauseContract, adminUnpauseContract, toWei,
  adminVestTokens, adminReleaseVested,
  getBalance as getTokenBalance,
  getNonce,
  getFunds, createFundPotOnChain, setFundContractStatus,
  recordFundContractContribution, spendFundContract,
  getDAOs, getProposals, createDAO, setDAOStatus, createProposal,
  castVote, queueProposal, executeProposal, cancelProposal,
  getListings, listNFT, updateListingPrice, cancelListing,
  getTaskAdminList, createTaskAdmin, pauseTaskAdmin, resumeTaskAdmin,
  adminMintCollectionToken, adminApproveCollectionToken,
  adminCreateNotification, adminListNotifications,
  type AdminAnalytics, type AdminUserItem, type UserProfile, type Transaction,
  type FundActivity, type DAOOrg, type Proposal, type NFTListing, type TaskAdminItem,
  type AppNotification, type AppNotificationType,
} from '../lib/services'
import {
  CONTRACTS, ROLES, type ContractKey,
  readVNDCToken, checkRole, checkOwner, checkPaused,
  readVestingInfo, readTaskManagerState,
  readStakingState,
  getNetworkInfo, formatVNDC,
  type VNDCTokenState,
} from '../lib/contracts'

dayjs.extend(relativeTime)

const { Title, Text, Paragraph } = Typography

// ─── Helpers ────────────────────────────────────────────────────

function fmtWei(wei: string | number | undefined): string {
  try {
    const n = BigInt(String(wei ?? '0'))
    const whole = n / BigInt('1000000000000000000')
    const frac = n % BigInt('1000000000000000000')
    const result = Number(whole) + Number(frac) / 1e18
    return result.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
  } catch {
    return '0.00'
  }
}

function shortAddr(addr?: string) {
  if (!addr) return '—'
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

// ─── Section header ──────────────────────────────────────────────

function SectionHeader({ icon, title, extra }: { icon: React.ReactNode; title: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <Space>
        <span style={{ fontSize: 18, color: '#4338CA' }}>{icon}</span>
        <Title level={5} style={{ margin: 0 }}>{title}</Title>
      </Space>
      {extra}
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────

function StatCard({
  title, value, suffix, color, icon, trend,
}: {
  title: string; value: string | number; suffix?: string;
  color?: string; icon?: React.ReactNode; trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor = trend === 'up' ? '#52c41a' : trend === 'down' ? '#ff4d4f' : '#8c8c8c'
  return (
    <Card style={{ borderRadius: 10, height: '100%' }} bodyStyle={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>{title}</Text>
          <div style={{ fontSize: 24, fontWeight: 700, color: color ?? '#1A1744', lineHeight: 1.3, marginTop: 4 }}>
            {value}
            {suffix && <span style={{ fontSize: 13, fontWeight: 400, color: '#8c8c8c', marginLeft: 4 }}>{suffix}</span>}
          </div>
        </div>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: color ? `${color}18` : '#4338CA18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: color ?? '#4338CA',
          }}>
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div style={{ marginTop: 8, fontSize: 11, color: trendColor }}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─'} So với hôm qua
        </div>
      )}
    </Card>
  )
}

function ChartCard({
  title,
  subtitle,
  extra,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card style={{ borderRadius: 14, height: '100%', boxShadow: '0 10px 30px rgba(26, 23, 68, 0.06)' }} bodyStyle={{ padding: 20 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <Text strong style={{ fontSize: 15, color: '#1A1744' }}>{title}</Text>
            {subtitle && <div style={{ marginTop: 2 }}><Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text></div>}
          </div>
          {extra}
        </div>
        {children}
      </Space>
    </Card>
  )
}

function SegmentedDonut({
  items,
  centerLabel,
  centerValue,
}: {
  items: { label: string; value: number; color: string }[]
  centerLabel: string
  centerValue: string
}) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1
  let current = 0
  const radius = 46
  const strokeWidth = 16
  const circumference = 2 * Math.PI * radius

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 132, height: 132, flex: '0 0 auto' }}>
        <svg viewBox="0 0 120 120" width="132" height="132" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#EEF2FF" strokeWidth={strokeWidth} />
          {items.map(item => {
            const dash = (Math.max(0, item.value) / total) * circumference
            const dashOffset = circumference - current - dash
            current += dash
            return (
              <circle
                key={item.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{centerLabel}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1744', lineHeight: 1.1 }}>{centerValue}</div>
          </div>
        </div>
      </div>
      <Space direction="vertical" size={8} style={{ minWidth: 220, flex: '1 1 220px' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Space size={8}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, display: 'inline-block' }} />
              <Text style={{ fontSize: 12 }}>{item.label}</Text>
            </Space>
            <Text strong style={{ color: item.color }}>{item.value.toLocaleString('vi-VN')}</Text>
          </div>
        ))}
      </Space>
    </div>
  )
}

function HorizontalBars({
  items,
}: {
  items: { label: string; value: number; color: string }[]
}) {
  const maxValue = Math.max(...items.map(item => item.value), 1)
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {items.map(item => {
        const width = `${Math.max(6, (item.value / maxValue) * 100)}%`
        return (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12 }}>{item.label}</Text>
              <Text strong style={{ fontSize: 12, color: item.color }}>{item.value.toLocaleString('vi-VN')}</Text>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: '#EEF2FF', overflow: 'hidden' }}>
              <div style={{ width, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}cc 100%)` }} />
            </div>
          </div>
        )
      })}
    </Space>
  )
}

function VerticalBarChart({
  items,
}: {
  items: { label: string; value: number; color: string }[]
}) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 6)}, minmax(0, 1fr))`, gap: 10, alignItems: 'end', minHeight: 220 }}>
      {items.slice(0, 6).map(item => {
        const h = Math.max(14, Math.round((item.value / max) * 160))
        return (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <Text strong style={{ fontSize: 11, color: item.color }}>{item.value.toLocaleString('vi-VN')}</Text>
            <div style={{ height: 170, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', margin: '6px 0' }}>
              <div style={{ width: '70%', height: h, borderRadius: '8px 8px 4px 4px', background: `linear-gradient(180deg, ${item.color}CC 0%, ${item.color} 100%)` }} />
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>{item.label}</Text>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// TAB 1 — Blockchain / Contract Management
// ══════════════════════════════════════════════════════════════════

// ── Network status bar ────────────────────────────────────────────
interface NetworkInfo { chainId: number; name: string; blockNumber: number }

function NetworkBar({ info, loading }: { info: NetworkInfo | null; loading: boolean }) {
  const connected = !!info
  return (
    <Alert
      type={connected ? 'success' : 'warning'}
      showIcon
      icon={connected ? <CheckCircleOutlined /> : <WarningOutlined />}
      message={
        <Space split={<Divider type="vertical" />} wrap>
          <Space size={4}>
            <GlobalOutlined />
            <Text strong>RPC</Text>
            <Text code style={{ fontSize: 11 }}>{import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545'}</Text>
          </Space>
          {info && <>
            <Text>Chain ID: <Text strong>{info.chainId}</Text></Text>
            <Text>Block: <Text strong>#{info.blockNumber.toLocaleString('vi-VN')}</Text></Text>
          </>}
          {loading && <Spin size="small" />}
          {!connected && !loading && <Tag color="warning">Chưa kết nối RPC</Tag>}
        </Space>
      }
    />
  )
}

// ── Contract registry card ────────────────────────────────────────
function ContractRegistryCard({
  selectedKey,
  onSelect,
}: {
  selectedKey: ContractKey
  onSelect: (k: ContractKey) => void
}) {
  const hiddenContractKeys: ContractKey[] = ['VNDCStaking', 'TaskManager']

  return (
    <Card
      title={<SectionHeader icon={<ApiOutlined />} title="Danh sách hợp đồng" />}
      style={{ borderRadius: 10 }}
      bodyStyle={{ padding: '8px 0' }}
    >
      <List
        size="small"
        dataSource={(Object.entries(CONTRACTS) as [ContractKey, typeof CONTRACTS[ContractKey]][])
          .filter(([key]) => !hiddenContractKeys.includes(key))}
        renderItem={([key, meta]) => (
          <List.Item
            onClick={() => onSelect(key)}
            style={{
              cursor: 'pointer',
              padding: '10px 20px',
              background: selectedKey === key ? '#F0EEFF' : 'transparent',
              borderLeft: selectedKey === key ? '3px solid #4338CA' : '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 13 }}>{meta.label}</Text>
                <Tag color={meta.deployed ? 'success' : 'default'} style={{ fontSize: 10 }}>
                  {meta.deployed ? '✓ Deployed' : '○ Chưa Deploy'}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>{meta.type}</Text>
              {meta.deployed && meta.address && (
                <div>
                  <Text code style={{ fontSize: 10 }}>{meta.address.slice(0, 14)}…</Text>
                </div>
              )}
            </div>
          </List.Item>
        )}
      />
    </Card>
  )
}

// ── Role checker panel (AccessControl contracts) ──────────────────
function RoleCheckerPanel({ contractAddress }: { contractAddress: string }) {
  const [addr, setAddr] = useState('')
  const [results, setResults] = useState<Record<string, boolean> | null>(null)
  const [checking, setChecking] = useState(false)

  async function checkAllRoles() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      antMessage.warning('Địa chỉ không hợp lệ')
      return
    }
    setChecking(true)
    try {
      const [isAdmin, isMinter, isPauser] = await Promise.all([
        checkRole(contractAddress, ROLES.DEFAULT_ADMIN_ROLE, addr),
        checkRole(contractAddress, ROLES.MINTER_ROLE, addr),
        checkRole(contractAddress, ROLES.PAUSER_ROLE, addr),
      ])
      setResults({ DEFAULT_ADMIN_ROLE: isAdmin, MINTER_ROLE: isMinter, PAUSER_ROLE: isPauser })
    } catch (e) {
      antMessage.error(`Lỗi khi kiểm tra role: ${(e as Error).message}`)
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card
      size="small"
      title={<Space><KeyOutlined /><span>Kiểm tra vai trò (AccessControl)</span></Space>}
      style={{ borderRadius: 8 }}
    >
      <Space.Compact style={{ width: '100%', marginBottom: results ? 12 : 0 }}>
        <Input
          placeholder="0x... địa chỉ ví cần kiểm tra"
          value={addr}
          onChange={e => { setAddr(e.target.value); setResults(null) }}
        />
        <Button icon={<SearchOutlined />} onClick={() => void checkAllRoles()} loading={checking}>Kiểm tra</Button>
      </Space.Compact>
      {results && (
        <Space wrap>
          {Object.entries(results).map(([role, has]) => (
            <Tag key={role} color={has ? 'success' : 'default'} icon={has ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
              {role}
            </Tag>
          ))}
        </Space>
      )}
    </Card>
  )
}

// ── Vesting lookup ────────────────────────────────────────────────
function VestingLookup({ contractAddress }: { contractAddress: string }) {
  const [holder, setHolder] = useState('')
  const [info, setInfo] = useState<{ amount: bigint; releaseTime: bigint } | null>(null)
  const [loading, setLoading] = useState(false)

  async function lookup() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(holder)) { antMessage.warning('Địa chỉ không hợp lệ'); return }
    setLoading(true)
    try { setInfo(await readVestingInfo(contractAddress, holder)) }
    catch (e) { antMessage.error(`Lỗi tra cứu vesting: ${(e as Error).message}`) }
    finally { setLoading(false) }
  }

  const nowTs = BigInt(Math.floor(Date.now() / 1000))

  return (
    <Card size="small" title={<Space><LockOutlined /><span>Tra cứu vesting</span></Space>} style={{ borderRadius: 8 }}>
      <Space.Compact style={{ width: '100%', marginBottom: info ? 12 : 0 }}>
        <Input placeholder="0x... địa chỉ holder" value={holder} onChange={e => { setHolder(e.target.value); setInfo(null) }} />
        <Button icon={<SearchOutlined />} onClick={() => void lookup()} loading={loading}>Tra cứu</Button>
      </Space.Compact>
      {info && (
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Số lượng khóa">
            <Text strong>{info.amount === 0n ? '—' : `${formatVNDC(info.amount)} VNDC`}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Mở khóa vào">
            {info.releaseTime === 0n
              ? <Tag>Không có vesting</Tag>
              : <Tag color={info.releaseTime > nowTs ? 'warning' : 'success'}>
                  {dayjs(Number(info.releaseTime) * 1000).format('HH:mm DD/MM/YYYY')}
                  {' '}{info.releaseTime > nowTs ? '(Đang khóa)' : '(Đã mở khóa)'}
                </Tag>
            }
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}

// ── VNDCToken detail panel ────────────────────────────────────────
function VNDCTokenPanel({ address }: { address: string }) {
  const [state, setState] = useState<VNDCTokenState | null>(null)
  const [loading, setLoading] = useState(true)
  const [mintForm] = Form.useForm()
  const [vestForm] = Form.useForm()
  const [releaseForm] = Form.useForm()
  const [walletToolsForm] = Form.useForm()
  const [showMint, setShowMint] = useState(false)
  const [showVest, setShowVest] = useState(false)
  const [showRelease, setShowRelease] = useState(false)
  const [minting, setMinting] = useState(false)
  const [vesting, setVesting] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [toolLoading, setToolLoading] = useState(false)
  const [walletToolData, setWalletToolData] = useState<{ wallet: string; onChain: string; pending: string; available: string; nonce: number } | null>(null)
  const [pausing, setPausing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setState(await readVNDCToken(address)) }
    catch (e) { console.error('readVNDCToken', e) }
    finally { setLoading(false) }
  }, [address])

  useEffect(() => { void load() }, [load])

  async function handleMint(vals: { recipient: string; amount: number }) {
    setMinting(true)
    try {
      await adminMint(vals.recipient, toWei(vals.amount))
      antMessage.success(`Đã mint ${vals.amount.toLocaleString('vi-VN')} VNDC → ${shortAddr(vals.recipient)}`)
      mintForm.resetFields(); setShowMint(false); void load()
    } catch (e) { antMessage.error(`Mint thất bại: ${(e as Error).message}`) }
    finally { setMinting(false) }
  }

  async function togglePause() {
    setPausing(true)
    try {
      if (state?.paused) { await adminUnpauseContract(); antMessage.success('Đã mở lại hợp đồng') }
      else { await adminPauseContract(); antMessage.success('Đã tạm dừng hợp đồng') }
      void load()
    } catch (e) { antMessage.error(`Lỗi: ${(e as Error).message}`) }
    finally { setPausing(false) }
  }

  async function handleVest(vals: { holder: string; amount: number; release_at: number }) {
    setVesting(true)
    try {
      const tx = await adminVestTokens(vals.holder, toWei(vals.amount), vals.release_at)
      antMessage.success(`Đã tạo vesting: ${tx.tx_hash.slice(0, 12)}…`)
      vestForm.resetFields(); setShowVest(false); void load()
    } catch (e) {
      antMessage.error(`Vest thất bại: ${(e as Error).message}`)
    } finally {
      setVesting(false)
    }
  }

  async function handleRelease(vals: { holder: string }) {
    setReleasing(true)
    try {
      const tx = await adminReleaseVested(vals.holder)
      antMessage.success(`Đã release vested: ${tx.tx_hash.slice(0, 12)}…`)
      releaseForm.resetFields(); setShowRelease(false); void load()
    } catch (e) {
      antMessage.error(`Release vested thất bại: ${(e as Error).message}`)
    } finally {
      setReleasing(false)
    }
  }

  async function handleWalletTool(vals: { wallet: string }) {
    setToolLoading(true)
    try {
      const [bal, nonceRes] = await Promise.all([
        getTokenBalance(vals.wallet),
        getNonce(vals.wallet),
      ])
      setWalletToolData({
        wallet: vals.wallet,
        onChain: bal.on_chain,
        pending: bal.pending,
        available: bal.available,
        nonce: nonceRes.nonce,
      })
    } catch (e) {
      antMessage.error(`Tra cứu ví thất bại: ${(e as Error).message}`)
    } finally {
      setToolLoading(false)
    }
  }

  const supplyPct = state ? Number(state.totalSupply * 100n / state.maxSupply) : 0

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      {/* Status banner */}
      <Alert
        type={state?.paused ? 'error' : 'success'}
        showIcon
        icon={state?.paused ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
        message={
          <Space split={<Divider type="vertical" />} wrap>
            <Text strong>{state?.name ?? 'VNDC Token'}</Text>
            <Text type="secondary">Symbol: <Text strong>{state?.symbol}</Text></Text>
            <Text type="secondary">Decimals: <Text strong>{state?.decimals}</Text></Text>
            <Tag color={state?.paused ? 'error' : 'success'}>{state?.paused ? '⏸ Tạm dừng' : '▶ Đang chạy'}</Tag>
          </Space>
        }
      />

      {/* Supply cards */}
      <Spin spinning={loading}>
        <Row gutter={[14, 14]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="totalSupply" value={state ? formatVNDC(state.totalSupply) : '—'} suffix="VNDC" color="#4338CA" icon={<ContainerOutlined />} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="MAX_SUPPLY" value={state ? formatVNDC(state.maxSupply) : '—'} suffix="VNDC" color="#059669" icon={<SafetyCertificateOutlined />} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="Còn có thể mint" value={state ? formatVNDC(state.maxSupply - state.totalSupply) : '—'} suffix="VNDC" color="#D97706" icon={<PlusOutlined />} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: '16px 20px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Mức độ lưu thông</Text>
              <div style={{ marginTop: 8 }}>
                <Progress percent={supplyPct} strokeColor={{ '0%': '#4338CA', '100%': '#6366F1' }} format={p => <Text strong>{p}%</Text>} />
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* Roles & address */}
      <Card title={<SectionHeader icon={<InfoCircleOutlined />} title="Thông tin hợp đồng & vai trò" />} style={{ borderRadius: 10 }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
          <Descriptions.Item label="Địa chỉ hợp đồng" span={2}>
            <Text code copyable>{address}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="DEFAULT_ADMIN_ROLE (hash)">
            <Tooltip title={state?.adminRole}><Text code style={{ fontSize: 10 }}>{state?.adminRole?.slice(0, 20)}…</Text></Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="MINTER_ROLE (hash)">
            <Tooltip title={state?.minterRole}><Text code style={{ fontSize: 10 }}>{state?.minterRole?.slice(0, 20)}…</Text></Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="PAUSER_ROLE (hash)">
            <Tooltip title={state?.pauserRole}><Text code style={{ fontSize: 10 }}>{state?.pauserRole?.slice(0, 20)}…</Text></Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={state?.paused ? 'error' : 'success'}>{loading ? '…' : state?.paused ? 'Paused' : 'Active'}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Action buttons */}
      <Card
        title={<SectionHeader icon={<SettingOutlined />} title="Điều khiển" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Tải lại RPC</Button>} />}
        style={{ borderRadius: 10 }}
      >
        <Space wrap size={10}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowMint(true)} disabled={!!state?.paused}>
            Mint Token
          </Button>
          <Button icon={<LockOutlined />} onClick={() => setShowVest(true)} disabled={!!state?.paused}>Vest Token</Button>
          <Button icon={<UnlockOutlined />} onClick={() => setShowRelease(true)} disabled={!!state?.paused}>Release Vested</Button>
          {state?.paused
            ? <Button icon={<UnlockOutlined />} loading={pausing} onClick={() => void togglePause()} style={{ borderColor: '#52c41a', color: '#52c41a' }}>Mở lại hợp đồng</Button>
            : <Button danger icon={<LockOutlined />} loading={pausing} onClick={() => void togglePause()}>Tạm dừng hợp đồng</Button>
          }
        </Space>
        <div style={{ marginTop: 10 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Write operations được thực hiện qua backend relayer (POST /v1/tokens/mint, /pause, /unpause — yêu cầu ADMIN role JWT).
          </Text>
        </div>
      </Card>

      {/* Role checker */}
      <RoleCheckerPanel contractAddress={address} />

      {/* Wallet tool */}
      <Card size="small" title={<Space><SearchOutlined /><span>Tra cứu ví (Balance + Nonce)</span></Space>} style={{ borderRadius: 8 }}>
        <Form form={walletToolsForm} layout="vertical" onFinish={v => void handleWalletTool(v as { wallet: string })}>
          <Row gutter={[10, 0]}>
            <Col xs={24} md={16}>
              <Form.Item name="wallet" label="Wallet" rules={[{ required: true }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Địa chỉ Ethereum không hợp lệ' }]}>
                <Input placeholder="0x..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label=" ">
                <Button htmlType="submit" icon={<SearchOutlined />} loading={toolLoading} block>Tra cứu</Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {walletToolData && (
          <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Wallet" span={2}><Text code>{walletToolData.wallet}</Text></Descriptions.Item>
            <Descriptions.Item label="On-chain">{fmtWei(walletToolData.onChain)} VNDC</Descriptions.Item>
            <Descriptions.Item label="Pending">{fmtWei(walletToolData.pending)} VNDC</Descriptions.Item>
            <Descriptions.Item label="Available">{fmtWei(walletToolData.available)} VNDC</Descriptions.Item>
            <Descriptions.Item label="Nonce">{walletToolData.nonce}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {/* Vesting lookup */}
      <VestingLookup contractAddress={address} />

      {/* Mint modal */}
      <Modal
        title={<Space><PlusOutlined /><span>Mint token VNDC mới</span></Space>}
        open={showMint}
        onCancel={() => setShowMint(false)}
        footer={null}
        width={460}
        destroyOnClose
      >
        <Alert type="warning" showIcon message="Hành động tạo thêm token on-chain. Không thể hoàn tác." style={{ marginBottom: 16 }} />
        <Form form={mintForm} layout="vertical" onFinish={v => void handleMint(v as { recipient: string; amount: number })}>
          <Form.Item label="Địa chỉ ví nhận" name="recipient"
            rules={[{ required: true }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Địa chỉ Ethereum không hợp lệ' }]}>
            <Input placeholder="0x..." prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="Số lượng (VNDC)" name="amount" rules={[{ required: true }, { type: 'number', min: 1 }]}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder="1000000" addonAfter="VNDC" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowMint(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={minting} icon={<PlusOutlined />}>Xác nhận mint</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Space><LockOutlined /><span>Tạo lịch vesting</span></Space>}
        open={showVest}
        onCancel={() => setShowVest(false)}
        footer={null}
        width={460}
        destroyOnClose
      >
        <Form form={vestForm} layout="vertical" onFinish={v => void handleVest(v as { holder: string; amount: number; release_at: number })}>
          <Form.Item label="Holder" name="holder" rules={[{ required: true }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Địa chỉ Ethereum không hợp lệ' }]}>
            <Input placeholder="0x..." />
          </Form.Item>
          <Form.Item label="Số lượng (VNDC)" name="amount" rules={[{ required: true }, { type: 'number', min: 1 }]}>
            <InputNumber style={{ width: '100%' }} min={1} addonAfter="VNDC" />
          </Form.Item>
          <Form.Item label="Release Time (Unix timestamp)" name="release_at" rules={[{ required: true }, { type: 'number', min: Math.floor(Date.now() / 1000) + 60 }]}>
            <InputNumber style={{ width: '100%' }} min={Math.floor(Date.now() / 1000) + 60} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowVest(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={vesting}>Tạo Vesting</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Space><UnlockOutlined /><span>Release Vested Token</span></Space>}
        open={showRelease}
        onCancel={() => setShowRelease(false)}
        footer={null}
        width={460}
        destroyOnClose
      >
        <Form form={releaseForm} layout="vertical" onFinish={v => void handleRelease(v as { holder: string })}>
          <Form.Item label="Holder" name="holder" rules={[{ required: true }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Địa chỉ Ethereum không hợp lệ' }]}>
            <Input placeholder="0x..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowRelease(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={releasing}>Release</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

// ── Generic Ownable+Pausable panel ────────────────────────────────
function OwnablePausablePanel({ contractKey, address }: { contractKey: ContractKey; address: string }) {
  const meta = CONTRACTS[contractKey]
  const [owner, setOwner] = useState<string | null>(null)
  const [paused, setPausedState] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, p] = await Promise.all([checkOwner(address), checkPaused(address)])
      setOwner(o); setPausedState(p)
    } catch (e) { console.error(contractKey, e) }
    finally { setLoading(false) }
  }, [address, contractKey])

  useEffect(() => { void load() }, [load])

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert
        type={paused ? 'error' : 'success'}
        showIcon
        icon={paused ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
        message={
          <Space split={<Divider type="vertical" />} wrap>
            <Text strong>{meta.label}</Text>
            <Text type="secondary">{meta.type}</Text>
            <Tag color={paused ? 'error' : paused === null ? 'default' : 'success'}>
              {loading ? '…' : paused ? '⏸ Tạm dừng' : '▶ Đang chạy'}
            </Tag>
          </Space>
        }
      />
      <Spin spinning={loading}>
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Địa chỉ hợp đồng" span={2}>
            <Text code copyable>{address}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Owner">
            {owner ? <Text code copyable>{owner}</Text> : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng Thái">
            <Tag color={paused ? 'error' : 'success'}>{loading ? '…' : paused ? 'Paused' : 'Active'}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Spin>
      <Alert
        type="info"
        showIcon
        message="Các thao tác ghi của hợp đồng này có thể thực hiện qua các endpoint quản trị trong module tương ứng (DAO, Marketplace, v.v.)."
      />
      <div style={{ textAlign: 'right' }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Tải lại RPC</Button>
      </div>
    </Space>
  )
}

// ── TaskManager panel ─────────────────────────────────────────────
function TaskManagerPanel({ address }: { address: string }) {
  const [state, setState] = useState<{ owner: string; poolBalance: bigint; paused: boolean } | null>(null)
  const [tasks, setTasks] = useState<TaskAdminItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [loading, setLoading] = useState(true)

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null

  const load = useCallback(async () => {
    setLoading(true)
    try { setState(await readTaskManagerState(address)) }
    catch (e) { console.error('TaskManagerPanel', e) }
    finally { setLoading(false) }
  }, [address])

  const loadTasks = useCallback(async () => {
    setAdminLoading(true)
    try {
      const res = await getTaskAdminList(1, 200)
      setTasks(res.tasks ?? [])
      if (!selectedTaskId && res.tasks?.length) setSelectedTaskId(res.tasks[0].id)
    } catch (e) {
      antMessage.error(`Không tải được tasks: ${(e as Error).message}`)
    } finally {
      setAdminLoading(false)
    }
  }, [selectedTaskId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadTasks() }, [loadTasks])

  async function handleCreateTask(vals: { title: string; description: string; task_type: 'READING' | 'VIDEO' | 'QUIZ' | 'PHYSICAL'; reward_amount: number; max_slots: number }) {
    setAdminLoading(true)
    try {
      await createTaskAdmin({
        title: vals.title,
        description: vals.description,
        cluster: 'LEARNING',
        task_type: vals.task_type,
        reward_amount: toWei(vals.reward_amount),
        max_slots: vals.max_slots,
      })
      antMessage.success('Tạo task thành công')
      createForm.resetFields()
      void loadTasks()
    } catch (e) {
      antMessage.error(`Tạo task thất bại: ${(e as Error).message}`)
    } finally {
      setAdminLoading(false)
    }
  }

  async function handlePauseTask() {
    if (!selectedTaskId) return
    setAdminLoading(true)
    try {
      await pauseTaskAdmin(selectedTaskId)
      antMessage.success('Đã pause task')
      void loadTasks()
    } catch (e) {
      antMessage.error(`Pause task thất bại: ${(e as Error).message}`)
    } finally {
      setAdminLoading(false)
    }
  }

  async function handleResumeTask() {
    if (!selectedTaskId) return
    setAdminLoading(true)
    try {
      await resumeTaskAdmin(selectedTaskId)
      antMessage.success('Đã resume task')
      void loadTasks()
    } catch (e) {
      antMessage.error(`Resume task thất bại: ${(e as Error).message}`)
    } finally {
      setAdminLoading(false)
    }
  }

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert
        type={state?.paused ? 'error' : 'success'}
        showIcon
        icon={state?.paused ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
        message={
          <Space split={<Divider type="vertical" />} wrap>
            <Text strong>Task Manager</Text>
            <Text type="secondary">Ownable + Pausable + ERC20</Text>
            <Tag color={state?.paused ? 'error' : 'success'}>{state?.paused ? '⏸ Tạm dừng' : '▶ Đang chạy'}</Tag>
          </Space>
        }
      />
      <Spin spinning={loading}>
        <Row gutter={[14, 14]}>
          <Col xs={24} sm={12}>
            <StatCard title="Pool Balance (VNDC)" value={state ? formatVNDC(state.poolBalance) : '—'} suffix="VNDC" color="#4338CA" icon={<FundOutlined />} />
          </Col>
          <Col xs={24} sm={12}>
            <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: '16px 20px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Owner (Relayer)</Text>
              <div style={{ marginTop: 6 }}>
                <Text code copyable style={{ fontSize: 11 }}>{state?.owner ?? '—'}</Text>
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
      <Alert type="info" showIcon message="Pool được nạp qua POST /v1/tasks/admin/:id/fund. Reward được phát qua backend khi sinh viên hoàn thành nhiệm vụ." />

      <Card style={{ borderRadius: 10 }} title={<SectionHeader icon={<CalendarOutlined />} title="Quản lý tác vụ" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadTasks()} loading={adminLoading}>Tải lại</Button>} />}>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Select
            value={selectedTaskId || undefined}
            onChange={setSelectedTaskId}
            placeholder="Chọn task"
            options={tasks.map(t => ({ value: t.id, label: `${t.title} (${t.status})` }))}
          />
          {selectedTask && (
            <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Task" span={2}>{selectedTask.title}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={selectedTask.status === 'ACTIVE' ? 'success' : 'default'}>{selectedTask.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Reward">{fmtWei(selectedTask.reward_amount)} VNDC</Descriptions.Item>
              <Descriptions.Item label="Slots">{selectedTask.current_slots}/{selectedTask.max_slots}</Descriptions.Item>
            </Descriptions>
          )}
          <Space>
            <Button onClick={() => void handlePauseTask()} loading={adminLoading} disabled={!selectedTaskId}>Pause</Button>
            <Button type="primary" onClick={() => void handleResumeTask()} loading={adminLoading} disabled={!selectedTaskId}>Resume</Button>
          </Space>
        </Space>
      </Card>

      <Card style={{ borderRadius: 10 }} title="Tạo tác vụ mới">
        <Form form={createForm} layout="vertical" onFinish={v => void handleCreateTask(v as { title: string; description: string; task_type: 'READING' | 'VIDEO' | 'QUIZ' | 'PHYSICAL'; reward_amount: number; max_slots: number })}>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="task_type" label="Task type" initialValue="READING" rules={[{ required: true }]}>
                <Select options={[{ value: 'READING', label: 'READING' }, { value: 'VIDEO', label: 'VIDEO' }, { value: 'QUIZ', label: 'QUIZ' }, { value: 'PHYSICAL', label: 'PHYSICAL' }]} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="description" label="Mô tả" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="reward_amount" label="Reward (VNDC)" rules={[{ required: true, type: 'number', min: 0.000001 }]}>
                <InputNumber style={{ width: '100%' }} min={0.000001} addonAfter="VNDC" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="max_slots" label="Max slots" initialValue={100} rules={[{ required: true, type: 'number', min: 1 }]}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Button htmlType="submit" type="primary" loading={adminLoading}>Tạo Task</Button>
        </Form>
      </Card>

      <div style={{ textAlign: 'right' }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => { void load(); void loadTasks() }} loading={loading || adminLoading}>Tải lại RPC</Button>
      </div>
    </Space>
  )
}

// ── FundingManager panel ─────────────────────────────────────────
function FundingManagerPanel({ address }: { address: string }) {
  const [funds, setFunds] = useState<FundActivity[]>([])
  const [selectedFundId, setSelectedFundId] = useState<string>('')
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'>('ACTIVE')
  const [loading, setLoading] = useState(false)
  const [contribForm] = Form.useForm()
  const [spendForm] = Form.useForm()

  const selectedFund = funds.find(f => f.id === selectedFundId) || null

  const loadFunds = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFunds(1, 200)
      setFunds(res.items ?? [])
      if (!selectedFundId && res.items?.length) setSelectedFundId(res.items[0].id)
    } catch (e) {
      antMessage.error(`Không tải được danh sách quỹ: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [selectedFundId])

  useEffect(() => { void loadFunds() }, [loadFunds])

  async function handleCreatePot() {
    if (!selectedFundId) return
    setLoading(true)
    try {
      const resp = await createFundPotOnChain(selectedFundId)
      antMessage.success(`Create pot thành công: ${resp.tx_hash.slice(0, 12)}…`)
      void loadFunds()
    } catch (e) {
      antMessage.error(`Create pot thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetStatus() {
    if (!selectedFundId) return
    setLoading(true)
    try {
      const resp = await setFundContractStatus(selectedFundId, status)
      antMessage.success(`Đã set status ${status}: ${resp.tx_hash.slice(0, 12)}…`)
      void loadFunds()
    } catch (e) {
      antMessage.error(`Set status thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleManualContribution(vals: { contributor_wallet: string; amount: number; transfer_tx_hash: string; note?: string }) {
    if (!selectedFundId) return
    setLoading(true)
    try {
      const resp = await recordFundContractContribution(selectedFundId, {
        contributor_wallet: vals.contributor_wallet,
        amount: toWei(vals.amount),
        transfer_tx_hash: vals.transfer_tx_hash,
        note: vals.note,
      })
      antMessage.success(`recordContribution thành công: ${resp.tx_hash.slice(0, 12)}…`)
      contribForm.resetFields()
      void loadFunds()
    } catch (e) {
      antMessage.error(`recordContribution thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleManualSpend(vals: { beneficiary_wallet: string; amount: number; note: string; reference?: string }) {
    if (!selectedFundId) return
    setLoading(true)
    try {
      const resp = await spendFundContract(selectedFundId, {
        beneficiary_wallet: vals.beneficiary_wallet,
        amount: toWei(vals.amount),
        note: vals.note,
        reference: vals.reference,
      })
      antMessage.success(`spend thành công: ${resp.tx_hash.slice(0, 12)}…`)
      spendForm.resetFields()
      void loadFunds()
    } catch (e) {
      antMessage.error(`spend thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={
          <Space split={<Divider type="vertical" />} wrap>
            <Text strong>Funding Manager</Text>
            <Text type="secondary">On-chain contract operations</Text>
            <Text code>{address}</Text>
          </Space>
        }
      />

      <Card style={{ borderRadius: 10 }} title={<SectionHeader icon={<FundOutlined />} title="Chọn Quỹ Để Vận Hành" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadFunds()} loading={loading}>Tải lại</Button>} />}>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Select
            showSearch
            value={selectedFundId || undefined}
            onChange={setSelectedFundId}
            placeholder="Chọn quỹ"
            style={{ width: '100%' }}
            optionFilterProp="label"
            options={funds.map(f => ({
              value: f.id,
              label: `${f.title} (${f.status})`,
            }))}
          />
          {selectedFund && (
            <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tên quỹ" span={2}>{selectedFund.title}</Descriptions.Item>
              <Descriptions.Item label="Status DB"><Tag color="blue">{selectedFund.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="On-chain PotID">{selectedFund.onchain_pot_id ? shortAddr(selectedFund.onchain_pot_id) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Đã gây quỹ">{fmtWei(selectedFund.total_raised)} VNDC</Descriptions.Item>
              <Descriptions.Item label="Số dư">{fmtWei(selectedFund.available_balance)} VNDC</Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      </Card>

      <Card style={{ borderRadius: 10 }} title={<SectionHeader icon={<SettingOutlined />} title="Điều khiển hợp đồng" />}>
        <Space wrap>
          <Button type="primary" onClick={() => void handleCreatePot()} loading={loading} disabled={!selectedFundId}>
            createPot
          </Button>
          <Select
            value={status}
            onChange={v => setStatus(v)}
            style={{ width: 180 }}
            options={[
              { value: 'DRAFT', label: 'DRAFT' },
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'CLOSED', label: 'CLOSED' },
              { value: 'CANCELLED', label: 'CANCELLED' },
            ]}
          />
          <Button onClick={() => void handleSetStatus()} loading={loading} disabled={!selectedFundId}>setPotStatus</Button>
        </Space>
      </Card>

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="recordContribution (manual)">
            <Form form={contribForm} layout="vertical" onFinish={v => void handleManualContribution(v as { contributor_wallet: string; amount: number; transfer_tx_hash: string; note?: string })}>
              <Form.Item name="contributor_wallet" label="Contributor wallet" rules={[{ required: true }]}>
                <Input placeholder="0x..." />
              </Form.Item>
              <Form.Item name="amount" label="Amount (VNDC)" rules={[{ required: true, type: 'number', min: 0.01 }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} addonAfter="VNDC" />
              </Form.Item>
              <Form.Item name="transfer_tx_hash" label="Transfer Tx Hash" rules={[{ required: true }]}>
                <Input placeholder="0x..." />
              </Form.Item>
              <Form.Item name="note" label="Note">
                <Input placeholder="manual contribution sync" />
              </Form.Item>
              <Button htmlType="submit" type="primary" loading={loading} disabled={!selectedFundId}>Submit</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="spend (manual)">
            <Form form={spendForm} layout="vertical" onFinish={v => void handleManualSpend(v as { beneficiary_wallet: string; amount: number; note: string; reference?: string })}>
              <Form.Item name="beneficiary_wallet" label="Beneficiary wallet" rules={[{ required: true }]}>
                <Input placeholder="0x..." />
              </Form.Item>
              <Form.Item name="amount" label="Amount (VNDC)" rules={[{ required: true, type: 'number', min: 0.01 }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} addonAfter="VNDC" />
              </Form.Item>
              <Form.Item name="note" label="Note" rules={[{ required: true }]}>
                <Input placeholder="chi cho hoạt động" />
              </Form.Item>
              <Form.Item name="reference" label="Reference">
                <Input placeholder="optional" />
              </Form.Item>
              <Button htmlType="submit" danger type="primary" loading={loading} disabled={!selectedFundId}>Submit</Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

// ── DAOManager panel ─────────────────────────────────────────────
function DAOManagerPanel({ address }: { address: string }) {
  const [daos, setDaos] = useState<DAOOrg[]>([])
  const [selectedDaoId, setSelectedDaoId] = useState<string>('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selectedProposalId, setSelectedProposalId] = useState<string>('')
  const [queuePower, setQueuePower] = useState<string>('1000000000000000000')
  const [cancelReason, setCancelReason] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [daoForm] = Form.useForm()
  const [proposalForm] = Form.useForm()

  const selectedDao = daos.find(d => d.id === selectedDaoId) || null
  const selectedProposal = proposals.find(p => p.id === selectedProposalId) || null

  const loadDAOs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDAOs()
      const items = res.daos ?? []
      setDaos(items)
      if (!selectedDaoId && items.length) setSelectedDaoId(items[0].id)
    } catch (e) {
      antMessage.error(`Không tải được DAO: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [selectedDaoId])

  const loadProposals = useCallback(async (daoId: string) => {
    if (!daoId) {
      setProposals([])
      setSelectedProposalId('')
      return
    }
    setLoading(true)
    try {
      const res = await getProposals(daoId)
      const items = res.proposals ?? []
      setProposals(items)
      setSelectedProposalId(items[0]?.id ?? '')
    } catch (e) {
      antMessage.error(`Không tải được proposal: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDAOs() }, [loadDAOs])
  useEffect(() => { void loadProposals(selectedDaoId) }, [selectedDaoId, loadProposals])

  async function handleCreateDAO(vals: { name: string; description?: string; quorum_bps: number; voting_period_sec: number }) {
    setLoading(true)
    try {
      await createDAO({
        name: vals.name,
        description: vals.description ?? '',
        governance_token: CONTRACTS.VNDCToken.address,
        quorum_bps: vals.quorum_bps,
        voting_period_sec: vals.voting_period_sec,
      })
      antMessage.success('Tạo DAO thành công')
      daoForm.resetFields()
      void loadDAOs()
    } catch (e) {
      antMessage.error(`Tạo DAO thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleDAO(active: boolean) {
    if (!selectedDaoId) return
    setLoading(true)
    try {
      await setDAOStatus(selectedDaoId, active)
      antMessage.success(active ? 'Đã kích hoạt DAO' : 'Đã tạm dừng DAO')
      void loadDAOs()
    } catch (e) {
      antMessage.error(`Set status DAO thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProposal(vals: { title: string; description: string; voting_period_hours: number }) {
    if (!selectedDaoId) return
    setLoading(true)
    try {
      await createProposal(selectedDaoId, vals)
      antMessage.success('Tạo proposal thành công')
      proposalForm.resetFields()
      void loadProposals(selectedDaoId)
    } catch (e) {
      antMessage.error(`Tạo proposal thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleVote(vote: 'FOR' | 'AGAINST' | 'ABSTAIN') {
    if (!selectedProposalId) return
    setLoading(true)
    try {
      await castVote(selectedProposalId, vote)
      antMessage.success(`Đã vote ${vote}`)
      void loadProposals(selectedDaoId)
    } catch (e) {
      antMessage.error(`Vote thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleQueue() {
    if (!selectedProposalId) return
    setLoading(true)
    try {
      await queueProposal(selectedProposalId, queuePower)
      antMessage.success('Đã queue proposal')
      void loadProposals(selectedDaoId)
    } catch (e) {
      antMessage.error(`Queue thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleExecute() {
    if (!selectedProposalId) return
    setLoading(true)
    try {
      await executeProposal(selectedProposalId)
      antMessage.success('Đã execute proposal')
      void loadProposals(selectedDaoId)
    } catch (e) {
      antMessage.error(`Execute thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!selectedProposalId) return
    setLoading(true)
    try {
      await cancelProposal(selectedProposalId, cancelReason)
      antMessage.success('Đã cancel proposal')
      setCancelReason('')
      void loadProposals(selectedDaoId)
    } catch (e) {
      antMessage.error(`Cancel thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert type="info" showIcon message={<Space split={<Divider type="vertical" />}><Text strong>DAO Manager</Text><Text code>{address}</Text></Space>} />

      <Card
        style={{ borderRadius: 10 }}
        title={<SectionHeader icon={<ApartmentOutlined />} title="Danh sách DAO" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadDAOs()} loading={loading}>Tải lại</Button>} />}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Select
            value={selectedDaoId || undefined}
            onChange={setSelectedDaoId}
            placeholder="Chọn DAO"
            options={daos.map(d => ({ value: d.id, label: `${d.name} (${d.status})` }))}
          />
          {selectedDao && (
            <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tên DAO" span={2}>{selectedDao.name}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color={selectedDao.status === 'ACTIVE' ? 'success' : 'default'}>{selectedDao.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Founder"><Text code>{shortAddr(selectedDao.founder_wallet)}</Text></Descriptions.Item>
              <Descriptions.Item label="Quorum">{selectedDao.quorum_bps} bps</Descriptions.Item>
              <Descriptions.Item label="Voting period">{selectedDao.voting_period_sec}s</Descriptions.Item>
            </Descriptions>
          )}
          <Space>
            <Switch
              checked={selectedDao?.status === 'ACTIVE'}
              onChange={checked => void handleToggleDAO(checked)}
              disabled={!selectedDaoId || loading}
              checkedChildren="ACTIVE"
              unCheckedChildren="INACTIVE"
            />
          </Space>
        </Space>
      </Card>

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="Tạo DAO">
            <Form form={daoForm} layout="vertical" onFinish={v => void handleCreateDAO(v as { name: string; description?: string; quorum_bps: number; voting_period_sec: number })}>
              <Form.Item name="name" label="Tên DAO" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="quorum_bps" label="Quorum (bps)" initialValue={2000} rules={[{ required: true, type: 'number', min: 1, max: 10000 }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={10000} />
              </Form.Item>
              <Form.Item name="voting_period_sec" label="Voting period (sec)" initialValue={604800} rules={[{ required: true, type: 'number', min: 60 }]}>
                <InputNumber style={{ width: '100%' }} min={60} />
              </Form.Item>
              <Button htmlType="submit" type="primary" loading={loading}>Tạo DAO</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="Tạo đề xuất">
            <Form form={proposalForm} layout="vertical" onFinish={v => void handleCreateProposal(v as { title: string; description: string; voting_period_hours: number })}>
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input disabled={!selectedDaoId} /></Form.Item>
              <Form.Item name="description" label="Nội dung" rules={[{ required: true }]}><Input.TextArea rows={3} disabled={!selectedDaoId} /></Form.Item>
              <Form.Item name="voting_period_hours" label="Voting period (hours)" initialValue={72} rules={[{ required: true, type: 'number', min: 1 }]}>
                <InputNumber style={{ width: '100%' }} min={1} disabled={!selectedDaoId} />
              </Form.Item>
              <Button htmlType="submit" type="primary" loading={loading} disabled={!selectedDaoId}>Tạo Proposal</Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 10 }} title="Quản trị đề xuất / thao tác hợp đồng">
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Select
            value={selectedProposalId || undefined}
            onChange={setSelectedProposalId}
            placeholder="Chọn proposal"
            options={proposals.map(p => ({ value: p.id, label: `${p.title} (${p.status})` }))}
          />
          {selectedProposal && (
            <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Đề xuất" span={2}>{selectedProposal.title}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color="blue">{selectedProposal.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Ủng hộ / Phản đối">{selectedProposal.for_votes} / {selectedProposal.against_votes}</Descriptions.Item>
            </Descriptions>
          )}
          <Space wrap>
            <Button onClick={() => void handleVote('FOR')} loading={loading} disabled={!selectedProposalId}>Bỏ phiếu ủng hộ</Button>
            <Button onClick={() => void handleVote('AGAINST')} loading={loading} disabled={!selectedProposalId}>Bỏ phiếu phản đối</Button>
            <Button onClick={() => void handleVote('ABSTAIN')} loading={loading} disabled={!selectedProposalId}>Bỏ phiếu trắng</Button>
          </Space>
          <Space wrap>
            <Input
              value={queuePower}
              onChange={e => setQueuePower(e.target.value)}
              style={{ width: 260 }}
              placeholder="Tổng sức mạnh biểu quyết (wei)"
              disabled={!selectedProposalId}
            />
            <Button onClick={() => void handleQueue()} loading={loading} disabled={!selectedProposalId}>Xếp hàng</Button>
            <Button type="primary" onClick={() => void handleExecute()} loading={loading} disabled={!selectedProposalId}>Thực thi</Button>
          </Space>
          <Space wrap>
            <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Lý do hủy" style={{ width: 320 }} disabled={!selectedProposalId} />
            <Button danger onClick={() => void handleCancel()} loading={loading} disabled={!selectedProposalId}>Hủy</Button>
          </Space>
        </Space>
      </Card>
    </Space>
  )
}

// ── MarketplaceManager panel ─────────────────────────────────────
function MarketplaceManagerPanel({ address }: { address: string }) {
  const [listings, setListings] = useState<NFTListing[]>([])
  const [selectedListingId, setSelectedListingId] = useState<string>('')
  const [newPrice, setNewPrice] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [createForm] = Form.useForm()

  const selectedListing = listings.find(l => l.id === selectedListingId) || null

  const loadListings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getListings(1, 100, '')
      const items = res.items ?? []
      setListings(items)
      if (!selectedListingId && items.length) setSelectedListingId(items[0].id)
    } catch (e) {
      antMessage.error(`Không tải được listings: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [selectedListingId])

  useEffect(() => { void loadListings() }, [loadListings])

  async function handleCreateListing(vals: { title: string; token_id: string; amount: number; price: number; category?: string; description?: string }) {
    setLoading(true)
    try {
      await listNFT({
        title: vals.title,
        token_id: vals.token_id,
        amount: String(vals.amount),
        price: toWei(vals.price),
        category: vals.category || 'nft',
        description: vals.description,
      })
      antMessage.success('Tạo listing thành công')
      createForm.resetFields()
      void loadListings()
    } catch (e) {
      antMessage.error(`Tạo listing thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePrice() {
    if (!selectedListingId || newPrice <= 0) return
    setLoading(true)
    try {
      await updateListingPrice(selectedListingId, toWei(newPrice))
      antMessage.success('Cập nhật giá thành công')
      setNewPrice(0)
      void loadListings()
    } catch (e) {
      antMessage.error(`Cập nhật giá thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelListing() {
    if (!selectedListingId) return
    setLoading(true)
    try {
      await cancelListing(selectedListingId)
      antMessage.success('Hủy listing thành công')
      void loadListings()
    } catch (e) {
      antMessage.error(`Hủy listing thất bại: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert type="info" showIcon message={<Space split={<Divider type="vertical" />}><Text strong>Trình quản lý Marketplace</Text><Text code>{address}</Text></Space>} />

      <Card style={{ borderRadius: 10 }} title={<SectionHeader icon={<ShopOutlined />} title="Danh sách đăng bán" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadListings()} loading={loading}>Tải lại</Button>} />}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Select
            showSearch
            value={selectedListingId || undefined}
            onChange={setSelectedListingId}
            placeholder="Chọn mục đăng bán"
            optionFilterProp="label"
            options={listings.map(l => ({ value: l.id, label: `${l.title} (${l.status})` }))}
          />
          {selectedListing && (
            <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tiêu đề" span={2}>{selectedListing.title}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color={selectedListing.status === 'ACTIVE' ? 'success' : selectedListing.status === 'SOLD' ? 'blue' : 'default'}>{selectedListing.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Người bán"><Text code>{shortAddr(selectedListing.seller_wallet)}</Text></Descriptions.Item>
              <Descriptions.Item label="Giá">{fmtWei(selectedListing.price)} VNDC</Descriptions.Item>
              <Descriptions.Item label="Token ID">{selectedListing.token_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="On-chain ID">{selectedListing.onchain_listing_id ? shortAddr(selectedListing.onchain_listing_id) : '—'}</Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      </Card>

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="Tạo listing mới">
            <Form form={createForm} layout="vertical" onFinish={v => void handleCreateListing(v as { title: string; token_id: string; amount: number; price: number; category?: string; description?: string })}>
              <Form.Item name="title" label="Tên sản phẩm" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="token_id" label="Token ID"><Input placeholder="1" /></Form.Item>
              <Form.Item name="amount" label="Số lượng" initialValue={1} rules={[{ required: true, type: 'number', min: 1 }]}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
              <Form.Item name="price" label="Giá (VNDC)" rules={[{ required: true, type: 'number', min: 0.000001 }]}>
                <InputNumber style={{ width: '100%' }} min={0.000001} addonAfter="VNDC" />
              </Form.Item>
              <Form.Item name="category" label="Danh mục" initialValue="nft"><Input /></Form.Item>
              <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
              <Button htmlType="submit" type="primary" loading={loading}>Tạo listing</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="Thao tác hợp đồng">
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              <InputNumber
                style={{ width: '100%' }}
                min={0.000001}
                addonAfter="VNDC"
                value={newPrice || undefined}
                onChange={v => setNewPrice(Number(v ?? 0))}
                placeholder="Giá mới"
                disabled={!selectedListingId}
              />
              <Space>
                <Button onClick={() => void handleUpdatePrice()} loading={loading} disabled={!selectedListingId || newPrice <= 0}>Cập nhật giá</Button>
                <Button danger onClick={() => void handleCancelListing()} loading={loading} disabled={!selectedListingId}>Hủy đăng bán</Button>
              </Space>
              <Alert type="warning" showIcon message="FinalizeSale được thực hiện tự động trong luồng mua/settlement. Tab này tập trung vào tạo/cập nhật/hủy đăng bán qua endpoint backend." />
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

// ── VNDCStaking panel ────────────────────────────────────────────
function VNDCStakingPanel({ address }: { address: string }) {
  const [state, setState] = useState<{
    totalStaked: bigint
    totalRewardsDistributed: bigint
    rewardRate: bigint
    minStakeAmount: bigint
    paused: boolean
    adminRole: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setState(await readStakingState(address))
    } catch (e) {
      console.error('VNDCStakingPanel', e)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { void load() }, [load])

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert
        type={state?.paused ? 'error' : 'success'}
        showIcon
        icon={state?.paused ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
        message={<Space split={<Divider type="vertical" />}><Text strong>VNDC Staking</Text><Text code>{address}</Text><Tag color={state?.paused ? 'error' : 'success'}>{state?.paused ? '⏸ Paused' : '▶ Active'}</Tag></Space>}
      />
      <Spin spinning={loading}>
        <Row gutter={[14, 14]}>
          <Col xs={24} sm={12} lg={6}><StatCard title="Tổng Stake" value={state ? formatVNDC(state.totalStaked) : '—'} suffix="VNDC" color="#4338CA" icon={<FundOutlined />} /></Col>
          <Col xs={24} sm={12} lg={6}><StatCard title="Tổng Reward Đã Trả" value={state ? formatVNDC(state.totalRewardsDistributed) : '—'} suffix="VNDC" color="#059669" icon={<CheckCircleOutlined />} /></Col>
          <Col xs={24} sm={12} lg={6}><StatCard title="Reward Rate" value={state ? formatVNDC(state.rewardRate) : '—'} suffix="wei/s" color="#D97706" icon={<BarChartOutlined />} /></Col>
          <Col xs={24} sm={12} lg={6}><StatCard title="Min Stake" value={state ? formatVNDC(state.minStakeAmount) : '—'} suffix="VNDC" color="#7C3AED" icon={<SafetyCertificateOutlined />} /></Col>
        </Row>
      </Spin>
      <Card style={{ borderRadius: 10 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Tab staking hiện dùng on-chain read-only để giám sát trạng thái hợp đồng. Write actions sẽ được nối vào endpoint backend khi module staking backend được mở rộng adapter/port.
        </Text>
      </Card>
      <div style={{ textAlign: 'right' }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Tải lại RPC</Button>
      </div>
    </Space>
  )
}

// ── VNDCNFTCollection panel ──────────────────────────────────────
function VNDCNFTCollectionPanel({ address }: { address: string }) {
  const [minting, setMinting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [mintForm] = Form.useForm()
  const [approveForm] = Form.useForm()

  async function handleMint(vals: { to: string; token_uri: string }) {
    setMinting(true)
    try {
      const res = await adminMintCollectionToken(vals.to, vals.token_uri)
      antMessage.success(`Mint NFT thành công token #${res.token_id}: ${res.tx_hash.slice(0, 12)}…`)
      mintForm.resetFields()
    } catch (e) {
      antMessage.error(`Mint NFT thất bại: ${(e as Error).message}`)
    } finally {
      setMinting(false)
    }
  }

  async function handleApprove(vals: { spender: string; token_id: string }) {
    setApproving(true)
    try {
      const res = await adminApproveCollectionToken(vals.spender, vals.token_id)
      antMessage.success(`Approve token #${res.token_id} thành công: ${res.tx_hash.slice(0, 12)}…`)
      approveForm.resetFields()
    } catch (e) {
      antMessage.error(`Approve NFT thất bại: ${(e as Error).message}`)
    } finally {
      setApproving(false)
    }
  }

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert type="info" showIcon message={<Space split={<Divider type="vertical" />}><Text strong>VNDC NFT Collection</Text><Text code>{address}</Text></Space>} />

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="Admin Mint ERC721">
            <Form form={mintForm} layout="vertical" onFinish={v => void handleMint(v as { to: string; token_uri: string })}>
              <Form.Item name="to" label="Recipient wallet" rules={[{ required: true }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Địa chỉ ví không hợp lệ' }]}>
                <Input placeholder="0x..." />
              </Form.Item>
              <Form.Item name="token_uri" label="Token URI" rules={[{ required: true }]}>
                <Input placeholder="ipfs://... hoặc https://..." />
              </Form.Item>
              <Button htmlType="submit" type="primary" loading={minting}>Mint</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card style={{ borderRadius: 10 }} title="Admin Approve ERC721">
            <Form form={approveForm} layout="vertical" onFinish={v => void handleApprove(v as { spender: string; token_id: string })}>
              <Form.Item name="spender" label="Spender wallet/contract" rules={[{ required: true }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Địa chỉ không hợp lệ' }]}>
                <Input placeholder="0x..." />
              </Form.Item>
              <Form.Item name="token_id" label="Token ID" rules={[{ required: true }]}>
                <Input placeholder="1" />
              </Form.Item>
              <Button htmlType="submit" loading={approving}>Approve</Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Alert type="success" showIcon message="Các thao tác ghi đã được backend hóa qua /v1/marketplace/admin/collection/mint và /approve (ADMIN/SUPER_ADMIN)." />
    </Space>
  )
}

// ── Not deployed placeholder ──────────────────────────────────────
function NotDeployedPanel({ contractKey }: { contractKey: ContractKey }) {
  const meta = CONTRACTS[contractKey]
  const scriptMap: Record<string, string> = {
    VNDCStaking: 'scripts/deploy-staking.ts',
    DAOManager: 'scripts/deploy-dao.ts',
    MarketplaceManager: 'scripts/deploy-marketplace.ts',
    FundingManager: 'scripts/deploy-funding.ts',
    TaskManager: 'scripts/deploy-task.ts',
    VNDCNFTCollection: 'scripts/deploy-nft.ts',
  }
  return (
    <Alert
      type="info"
      showIcon
      icon={<InfoCircleOutlined />}
      message={`${meta.label} chưa được deploy trên mạng hiện tại`}
      description={
        <div>
          <div>Chạy lệnh sau để triển khai:</div>
          <Text code copyable style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
            npx hardhat run {scriptMap[contractKey] ?? 'scripts/deploy.ts'} --network localhost
          </Text>
          <div style={{ marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Sau khi deploy, cập nhật địa chỉ trong <Text code>src/lib/contracts.ts</Text>
            </Text>
          </div>
        </div>
      }
    />
  )
}

// ── Main ContractTab ──────────────────────────────────────────────
function ContractTab() {
  const [selectedKey, setSelectedKey] = useState<ContractKey>('VNDCToken')
  const [network, setNetwork] = useState<NetworkInfo | null>(null)
  const [netLoading, setNetLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setNetLoading(true)
      try { setNetwork(await getNetworkInfo()) }
      catch { setNetwork(null) }
      finally { setNetLoading(false) }
    })()
  }, [])

  const meta = CONTRACTS[selectedKey]

  function renderDetail() {
    if (!meta.deployed || !meta.address) return <NotDeployedPanel contractKey={selectedKey} />
    switch (selectedKey) {
      case 'VNDCToken': return <VNDCTokenPanel address={meta.address} />
      case 'VNDCStaking': return <VNDCStakingPanel address={meta.address} />
      case 'DAOManager': return <DAOManagerPanel address={meta.address} />
      case 'MarketplaceManager': return <MarketplaceManagerPanel address={meta.address} />
      case 'TaskManager': return <TaskManagerPanel address={meta.address} />
      case 'FundingManager': return <FundingManagerPanel address={meta.address} />
      case 'VNDCNFTCollection': return <VNDCNFTCollectionPanel address={meta.address} />
      default: return <OwnablePausablePanel contractKey={selectedKey} address={meta.address} />
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <NetworkBar info={network} loading={netLoading} />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} lg={6}>
          <ContractRegistryCard selectedKey={selectedKey} onSelect={setSelectedKey} />
        </Col>
        <Col xs={24} md={16} lg={18}>
          {renderDetail()}
        </Col>
      </Row>
    </Space>
  )
}

// ══════════════════════════════════════════════════════════════════
// TAB 3 — Analytics & Reports
// ══════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [userLoading, setUserLoading] = useState(false)
  const [userLoadError, setUserLoadError] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(10)
  const [userStatus, setUserStatus] = useState<string>('')
  const [userKyc, setUserKyc] = useState<string>('')
  const [userSearch, setUserSearch] = useState('')
  const [userDetailOpen, setUserDetailOpen] = useState(false)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [selectedUserTxs, setSelectedUserTxs] = useState<Transaction[]>([])
  const [selectedUserTxTotal, setSelectedUserTxTotal] = useState(0)
  const [selectedUserWalletStats, setSelectedUserWalletStats] = useState<{ onChain: string; pending: string; available: string; nonce: number } | null>(null)
  const [selectedRole, setSelectedRole] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [userActionLoading, setUserActionLoading] = useState(false)

  async function loadAnalytics() {
    setLoading(true)
    try {
      // GET /v1/admin/analytics — real aggregated data from all modules
      const result = await getAdminAnalytics()
      setData(result)
    } catch (err) {
      console.error('AnalyticsTab: failed to load analytics', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadUsers(page = 1, pageSize = userPageSize) {
    setUserLoading(true)
    setUserLoadError('')
    try {
      const params = {
        page,
        page_size: pageSize,
        ...(userStatus ? { status: userStatus } : {}),
        ...(userKyc ? { kyc_level: userKyc } : {}),
        ...(userSearch.trim() ? { search: userSearch.trim() } : {}),
      }

      const mapUserProfileToAdmin = (u: UserProfile): AdminUserItem => ({
        id: u.id,
        wallet_address: u.wallet_address,
        username: u.username,
        email: u.email,
        kyc_level: u.kyc_level,
        kyc_status: u.kyc_status,
        status: u.status,
        roles: u.roles ?? [],
        last_login_at: u.last_login_at,
        created_at: u.created_at,
      })

      let resolvedItems: AdminUserItem[] = []
      let resolvedTotal = 0
      let primaryError = ''

      try {
        const result = await getAdminUsers(params)
        resolvedItems = result.items ?? []
        resolvedTotal = result.total ?? 0
      } catch (e) {
        primaryError = (e as Error).message
      }

      if (resolvedItems.length === 0 && resolvedTotal === 0) {
        try {
          // Fallback to /v1/users admin listing in case /v1/admin/users is unavailable in current backend build.
          const fallback = await adminListUsers({
            page,
            page_size: pageSize,
            ...(userStatus ? { status: userStatus } : {}),
            ...(userSearch.trim() ? { search: userSearch.trim() } : {}),
          })
          resolvedItems = (fallback.items ?? []).map(mapUserProfileToAdmin)
          resolvedTotal = fallback.total ?? 0
        } catch {
          // continue to final fallback below
        }
      }

      if (resolvedItems.length === 0 && resolvedTotal === 0 && (data?.users.total ?? 0) > 0) {
        // Last fallback: unfiltered fetch so UI still has data even if some filters are unsupported by current backend.
        try {
          const fallbackUnfiltered = await adminListUsers({ page, page_size: pageSize })
          resolvedItems = (fallbackUnfiltered.items ?? []).map(mapUserProfileToAdmin)
          resolvedTotal = fallbackUnfiltered.total ?? 0
          if (resolvedItems.length > 0) {
            setUserLoadError('Bộ lọc API hiện tại chưa tương thích hoàn toàn, đang hiển thị dữ liệu người dùng không lọc để đảm bảo vận hành.')
          }
        } catch {
          // keep empty
        }
      }

      setUsers(resolvedItems)
      setUserTotal(resolvedTotal)

      if (resolvedItems.length === 0 && resolvedTotal === 0 && primaryError) {
        setUserLoadError(`Không tải được danh sách user từ API admin: ${primaryError}`)
      }

      setUserPage(page)
      setUserPageSize(pageSize)
    } catch (err) {
      console.error('AnalyticsTab: failed to load users', err)
      setUserLoadError((err as Error).message || 'Không tải được danh sách user từ API')
      antMessage.error('Không tải được danh sách user từ API')
    } finally {
      setUserLoading(false)
    }
  }

  async function openUserDetail(row: AdminUserItem) {
    setUserDetailOpen(true)
    setUserDetailLoading(true)
    setSelectedUser(null)
    setSelectedUserTxs([])
    setSelectedUserWalletStats(null)
    try {
      const [profile, txRes, bal, nonceRes] = await Promise.all([
        adminGetUser(row.id),
        getTransactionsByWallet(row.wallet_address, 1, 100),
        getTokenBalance(row.wallet_address),
        getNonce(row.wallet_address),
      ])
      setSelectedUser(profile)
      setSelectedUserTxs(txRes.transactions ?? [])
      setSelectedUserTxTotal(txRes.total ?? 0)
      setSelectedUserWalletStats({
        onChain: bal.on_chain,
        pending: bal.pending,
        available: bal.available,
        nonce: nonceRes.nonce,
      })
    } catch (e) {
      antMessage.error(`Không tải được chi tiết user: ${(e as Error).message}`)
    } finally {
      setUserDetailLoading(false)
    }
  }

  async function reloadSelectedUser() {
    if (!selectedUser) return
    await openUserDetail({
      id: selectedUser.id,
      wallet_address: selectedUser.wallet_address,
      username: selectedUser.username,
      email: selectedUser.email,
      kyc_level: selectedUser.kyc_level,
      kyc_status: selectedUser.kyc_status,
      status: selectedUser.status,
      roles: selectedUser.roles,
      last_login_at: selectedUser.last_login_at,
      created_at: selectedUser.created_at,
    })
  }

  async function handleSuspend() {
    if (!selectedUser) return
    if (!suspendReason.trim()) {
      antMessage.warning('Nhập lý do khóa tài khoản')
      return
    }
    setUserActionLoading(true)
    try {
      await adminSuspendUser(selectedUser.id, suspendReason.trim())
      antMessage.success('Đã khóa tài khoản')
      setSuspendReason('')
      await Promise.all([reloadSelectedUser(), loadUsers(userPage, userPageSize)])
    } catch (e) {
      antMessage.error(`Khóa tài khoản thất bại: ${(e as Error).message}`)
    } finally {
      setUserActionLoading(false)
    }
  }

  async function handleUnsuspend() {
    if (!selectedUser) return
    setUserActionLoading(true)
    try {
      await adminUnsuspendUser(selectedUser.id)
      antMessage.success('Đã gỡ khóa tài khoản')
      await Promise.all([reloadSelectedUser(), loadUsers(userPage, userPageSize)])
    } catch (e) {
      antMessage.error(`Gỡ khóa thất bại: ${(e as Error).message}`)
    } finally {
      setUserActionLoading(false)
    }
  }

  async function handleApproveKYC(level: number) {
    if (!selectedUser) return
    setUserActionLoading(true)
    try {
      await adminApproveKYC(selectedUser.id, level)
      antMessage.success(`Đã duyệt KYC level ${level}`)
      await Promise.all([reloadSelectedUser(), loadUsers(userPage, userPageSize)])
    } catch (e) {
      antMessage.error(`Duyệt KYC thất bại: ${(e as Error).message}`)
    } finally {
      setUserActionLoading(false)
    }
  }

  async function handleAssignRole() {
    if (!selectedUser || !selectedRole) return
    setUserActionLoading(true)
    try {
      await adminAssignRole(selectedUser.id, selectedRole)
      antMessage.success(`Đã cấp role ${selectedRole}`)
      setSelectedRole('')
      await Promise.all([reloadSelectedUser(), loadUsers(userPage, userPageSize)])
    } catch (e) {
      antMessage.error(`Cấp role thất bại: ${(e as Error).message}`)
    } finally {
      setUserActionLoading(false)
    }
  }

  async function handleRemoveRole(role: string) {
    if (!selectedUser) return
    setUserActionLoading(true)
    try {
      await adminRemoveRole(selectedUser.id, role)
      antMessage.success(`Đã gỡ role ${role}`)
      await Promise.all([reloadSelectedUser(), loadUsers(userPage, userPageSize)])
    } catch (e) {
      antMessage.error(`Gỡ role thất bại: ${(e as Error).message}`)
    } finally {
      setUserActionLoading(false)
    }
  }

  useEffect(() => { void loadAnalytics() }, [])
  useEffect(() => { void loadUsers(1) }, [userStatus, userKyc])

  const d = data
  const txHealthItems = [
    { label: 'Chờ', value: d?.transactions.pending ?? 0, color: '#D97706' },
    { label: 'Đang', value: d?.transactions.processing ?? 0, color: '#0891B2' },
    { label: 'Thành công', value: d?.transactions.success ?? 0, color: '#059669' },
    { label: 'Thất bại', value: d?.transactions.failed ?? 0, color: '#DC2626' },
  ]
  const userBreakdownItems = [
    { label: 'KYC 0', value: d?.users.kyc_level0 ?? 0, color: '#94A3B8' },
    { label: 'KYC 1', value: d?.users.kyc_level1 ?? 0, color: '#4338CA' },
    { label: 'KYC 2', value: d?.users.kyc_level2 ?? 0, color: '#0891B2' },
    { label: 'Bị khóa/cấm', value: d?.users.suspended ?? 0, color: '#DC2626' },
  ]
  const moduleVolumeItems = [
    { label: 'Marketplace', value: d?.marketplace.total_listings ?? 0, color: '#059669' },
    { label: 'DAO', value: d?.dao.total_daos ?? 0, color: '#7C3AED' },
    { label: 'Gây quỹ', value: d?.fundraising.total_campaigns ?? 0, color: '#DC2626' },
    { label: 'Vé', value: d?.ticketing.total_products ?? 0, color: '#D97706' },
    { label: 'Tác vụ', value: d?.tasks.total_tasks ?? 0, color: '#0891B2' },
    { label: 'Hoạt động', value: d?.activities.total_activities ?? 0, color: '#1A1744' },
  ]
  const moduleActiveItems = [
    {
      label: 'Marketplace đang hoạt động',
      value: d?.marketplace.total_listings ? Math.round((d.marketplace.active_listings / d.marketplace.total_listings) * 100) : 0,
      color: '#059669',
    },
    {
      label: 'Đề xuất DAO đang hoạt động',
      value: d?.dao.total_proposals ? Math.round((d.dao.active_proposals / d.dao.total_proposals) * 100) : 0,
      color: '#7C3AED',
    },
    {
      label: 'Gây quỹ đang hoạt động',
      value: d?.fundraising.total_campaigns ? Math.round((d.fundraising.active_campaigns / d.fundraising.total_campaigns) * 100) : 0,
      color: '#DC2626',
    },
    {
      label: 'Vé đang hoạt động',
      value: d?.ticketing.total_products ? Math.round((d.ticketing.active_products / d.ticketing.total_products) * 100) : 0,
      color: '#D97706',
    },
    {
      label: 'Tác vụ đang hoạt động',
      value: d?.tasks.total_tasks ? Math.round((d.tasks.active_tasks / d.tasks.total_tasks) * 100) : 0,
      color: '#0891B2',
    },
  ]
  const selectedWallet = selectedUser?.wallet_address?.toLowerCase() ?? ''
  const selectedUserTxItems = [
    { label: 'Thành công', value: selectedUserTxs.filter(t => t.status === 'SUCCESS').length, color: '#059669' },
    { label: 'Đang chờ', value: selectedUserTxs.filter(t => t.status === 'PENDING' || t.status === 'QUEUED').length, color: '#D97706' },
    { label: 'Thất bại', value: selectedUserTxs.filter(t => t.status === 'FAILED' || t.status === 'REJECTED').length, color: '#DC2626' },
    { label: 'Khác', value: selectedUserTxs.filter(t => !['SUCCESS', 'PENDING', 'QUEUED', 'FAILED', 'REJECTED'].includes(t.status)).length, color: '#64748B' },
  ]
  const selectedUserActivityItems = [
    { label: 'Số lần đăng nhập', value: selectedUser?.login_count ?? 0, color: '#4338CA' },
    { label: 'Điểm hoạt động', value: selectedUser?.activity_points ?? 0, color: '#0891B2' },
    { label: 'Số TX hiển thị', value: selectedUserTxs.length, color: '#059669' },
    { label: 'TX Tổng (API)', value: selectedUserTxTotal, color: '#7C3AED' },
    { label: 'TX Đi', value: selectedUserTxs.filter(t => (t.from_wallet ?? '').toLowerCase() === selectedWallet).length, color: '#D97706' },
    { label: 'TX Đến', value: selectedUserTxs.filter(t => (t.to_wallet ?? '').toLowerCase() === selectedWallet).length, color: '#DC2626' },
  ]

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <ChartCard
        title="Bản đồ phân tích hệ thống"
        subtitle="Dữ liệu realtime từ /v1/admin/analytics"
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => { void loadAnalytics(); void loadUsers(userPage) }} loading={loading || userLoading}>Làm mới</Button>}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <SegmentedDonut
              centerLabel="TX Tổng"
              centerValue={(d?.transactions.total ?? 0).toLocaleString('vi-VN')}
              items={txHealthItems}
            />
          </Col>
          <Col xs={24} lg={8}>
            <HorizontalBars items={userBreakdownItems} />
          </Col>
          <Col xs={24} lg={8}>
            <HorizontalBars items={moduleVolumeItems} />
          </Col>
        </Row>
      </ChartCard>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <StatCard title="Tổng người dùng" value={d?.users.total ?? '—'} color="#4338CA" icon={<TeamOutlined />} trend="up" />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Tổng giao dịch" value={d?.transactions.total?.toLocaleString('vi-VN') ?? '—'} color="#059669" icon={<TransactionOutlined />} trend="up" />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Người dùng mới (7 ngày)" value={d?.users.new_this_week ?? '—'} color="#7C3AED" icon={<UserOutlined />} trend="up" />
        </Col>
      </Row>

      <ChartCard title="Thống kê theo cụm tính năng" subtitle="Biểu đồ cột tổng quy mô của từng cụm chức năng">
        <Spin spinning={loading}>
          <VerticalBarChart items={moduleVolumeItems} />
        </Spin>
      </ChartCard>

      <ChartCard title="Tỷ lệ hoạt động theo cụm" subtitle="Biểu đồ cột % thành phần active của từng module">
        <Spin spinning={loading}>
          <VerticalBarChart items={moduleActiveItems} />
        </Spin>
      </ChartCard>

      <Card
        title={<SectionHeader icon={<TeamOutlined />} title="Quản lý cụm người dùng" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadUsers(userPage)} loading={userLoading}>Tải lại người dùng</Button>} />}
        style={{ borderRadius: 10 }}
      >
        {userLoadError && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={userLoadError}
          />
        )}
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={24} sm={8}>
            <Select
              allowClear
              value={userStatus || undefined}
              onChange={v => setUserStatus(v ?? '')}
              placeholder="Lọc trạng thái"
              style={{ width: '100%' }}
              options={[
                { label: 'ACTIVE', value: 'ACTIVE' },
                { label: 'SUSPENDED', value: 'SUSPENDED' },
                { label: 'BANNED', value: 'BANNED' },
                { label: 'PENDING_VERIFICATION', value: 'PENDING_VERIFICATION' },
              ]}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select
              allowClear
              value={userKyc || undefined}
              onChange={v => setUserKyc(v ?? '')}
              placeholder="Lọc KYC"
              style={{ width: '100%' }}
              options={[
                { label: 'KYC 0', value: '0' },
                { label: 'KYC 1', value: '1' },
                { label: 'KYC 2', value: '2' },
              ]}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Tìm username/email/wallet"
                onPressEnter={() => void loadUsers(1, userPageSize)}
              />
              <Button icon={<SearchOutlined />} onClick={() => void loadUsers(1, userPageSize)}>Tìm</Button>
            </Space.Compact>
          </Col>
        </Row>

        <Table<AdminUserItem>
          size="small"
          rowKey="id"
          loading={userLoading}
          dataSource={users}
          pagination={{
            current: userPage,
            total: userTotal,
            pageSize: userPageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (p, size) => void loadUsers(p, size),
            showTotal: total => `${total} users`,
          }}
          onRow={(record) => ({
            onClick: () => void openUserDetail(record),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText: <Text type="secondary">Không có dữ liệu người dùng từ API</Text> }}
          columns={[
            {
              title: 'Wallet',
              dataIndex: 'wallet_address',
              render: (v: string) => <Text code>{shortAddr(v)}</Text>,
            },
            {
              title: 'User',
              key: 'user',
              render: (_: unknown, r: AdminUserItem) => (
                <div>
                  <div><Text strong>{r.username || '—'}</Text></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.email || '—'}</Text>
                </div>
              ),
            },
            {
              title: 'KYC',
              dataIndex: 'kyc_level',
              width: 90,
              render: (v: number) => <Tag color={v >= 2 ? 'green' : v === 1 ? 'blue' : 'default'}>Lv {v}</Tag>,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 150,
              render: (v: string) => {
                const color = v === 'ACTIVE' ? 'success' : v === 'SUSPENDED' ? 'warning' : v === 'BANNED' ? 'error' : 'processing'
                return <Tag color={color}>{v}</Tag>
              },
            },
            {
              title: 'Roles',
              dataIndex: 'roles',
              render: (roles: string[]) => (
                <Space size={4} wrap>
                  {(roles ?? []).slice(0, 3).map(role => <Tag key={role}>{role}</Tag>)}
                </Space>
              ),
            },
            {
              title: 'Lần đăng nhập cuối',
              dataIndex: 'last_login_at',
              width: 130,
              render: (v?: string) => v ? dayjs(v).fromNow() : '—',
            },
            {
              title: 'Chi tiết',
              width: 100,
              render: (_: unknown, r: AdminUserItem) => (
                <Button size="small" onClick={e => { e.stopPropagation(); void openUserDetail(r) }}>
                  Mở
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={selectedUser ? `Chi tiết người dùng: ${selectedUser.username || shortAddr(selectedUser.wallet_address)}` : 'Chi tiết người dùng'}
        open={userDetailOpen}
        onClose={() => setUserDetailOpen(false)}
        width={820}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void reloadSelectedUser()} loading={userDetailLoading || userActionLoading}>Làm mới</Button>}
      >
        <Spin spinning={userDetailLoading}>
          {selectedUser && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card size="small" title="Thông tin người dùng" style={{ borderRadius: 8 }}>
                <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
                  <Descriptions.Item label="ID" span={2}><Text code>{selectedUser.id}</Text></Descriptions.Item>
                  <Descriptions.Item label="Ví" span={2}><Text code>{selectedUser.wallet_address}</Text></Descriptions.Item>
                  <Descriptions.Item label="Tên đăng nhập">{selectedUser.username || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Họ tên">{selectedUser.full_name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Email">{selectedUser.email || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Số điện thoại">{selectedUser.phone || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Trạng thái"><Tag color={selectedUser.status === 'ACTIVE' ? 'success' : selectedUser.status === 'SUSPENDED' ? 'warning' : 'error'}>{selectedUser.status}</Tag></Descriptions.Item>
                  <Descriptions.Item label="KYC">Cấp {selectedUser.kyc_level} ({selectedUser.kyc_status})</Descriptions.Item>
                  <Descriptions.Item label="Số lần đăng nhập">{selectedUser.login_count.toLocaleString('vi-VN')}</Descriptions.Item>
                  <Descriptions.Item label="Điểm hoạt động">{selectedUser.activity_points.toLocaleString('vi-VN')}</Descriptions.Item>
                  <Descriptions.Item label="Lần đăng nhập gần nhất" span={2}>{selectedUser.last_login_at ? dayjs(selectedUser.last_login_at).format('DD/MM/YYYY HH:mm:ss') : '—'}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Row gutter={[12, 12]}>
                <Col xs={24} lg={12}>
                  <Card size="small" title="Biểu đồ trạng thái giao dịch" style={{ borderRadius: 8 }}>
                    <SegmentedDonut
                      centerLabel="TX Tổng"
                      centerValue={selectedUserTxTotal.toLocaleString('vi-VN')}
                      items={selectedUserTxItems}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card size="small" title="Biểu đồ hoạt động người dùng" style={{ borderRadius: 8 }}>
                    <HorizontalBars items={selectedUserActivityItems} />
                  </Card>
                </Col>
              </Row>

              {selectedUserWalletStats && (
                <Card size="small" title="Chỉ số ví" style={{ borderRadius: 8 }}>
                  <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="On-chain">{fmtWei(selectedUserWalletStats.onChain)} VNDC</Descriptions.Item>
                    <Descriptions.Item label="Pending">{fmtWei(selectedUserWalletStats.pending)} VNDC</Descriptions.Item>
                    <Descriptions.Item label="Available">{fmtWei(selectedUserWalletStats.available)} VNDC</Descriptions.Item>
                    <Descriptions.Item label="Nonce">{selectedUserWalletStats.nonce}</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Card size="small" title="Hành động quản trị người dùng" style={{ borderRadius: 8 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  <Space wrap>
                    <Input
                      value={suspendReason}
                      onChange={e => setSuspendReason(e.target.value)}
                      placeholder="Lý do khóa tài khoản"
                      style={{ width: 280 }}
                    />
                    <Button danger onClick={() => void handleSuspend()} loading={userActionLoading}>Khóa tài khoản</Button>
                    <Button onClick={() => void handleUnsuspend()} loading={userActionLoading}>Gỡ khóa tài khoản</Button>
                  </Space>
                  <Space wrap>
                    <Button onClick={() => void handleApproveKYC(1)} loading={userActionLoading}>Duyệt KYC Lv1</Button>
                    <Button onClick={() => void handleApproveKYC(2)} loading={userActionLoading}>Duyệt KYC Lv2</Button>
                  </Space>
                  <Space wrap>
                    <Select
                      value={selectedRole || undefined}
                      onChange={setSelectedRole}
                      placeholder="Chọn role"
                      style={{ width: 180 }}
                      options={[
                        { label: 'STUDENT', value: 'STUDENT' },
                        { label: 'ADMIN', value: 'ADMIN' },
                        { label: 'SUPER_ADMIN', value: 'SUPER_ADMIN' },
                        { label: 'DEPUTY', value: 'DEPUTY' },
                      ]}
                    />
                    <Button type="primary" onClick={() => void handleAssignRole()} loading={userActionLoading} disabled={!selectedRole}>Cấp role</Button>
                  </Space>
                  <Space wrap>
                    {(selectedUser.roles ?? []).map(role => (
                      <Tag key={role} closable onClose={(e) => { e.preventDefault(); void handleRemoveRole(role) }}>
                        {role}
                      </Tag>
                    ))}
                  </Space>
                  <Alert type="info" showIcon message="Cập nhật thông tin quản trị người dùng hiện hỗ trợ trạng thái tài khoản, quyền và KYC theo API admin hiện có." />
                </Space>
              </Card>
            </Space>
          )}
        </Spin>
      </Drawer>

      <Alert type="info" showIcon message="Tab phân tích chỉ dùng dữ liệu thật từ API admin (analytics + users), đã loại bỏ block dư thừa và số liệu giả lập." />
    </Space>
  )
}

// ══════════════════════════════════════════════════════════════════
// TAB 4 — System Notifications
// ══════════════════════════════════════════════════════════════════

const NOTIF_COLORS: Record<AppNotificationType, string> = {
  success: '#52c41a', warning: '#faad14', error: '#ff4d4f', info: '#1890ff',
}

const NOTIF_ICONS: Record<AppNotificationType, React.ReactNode> = {
  success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  warning: <WarningOutlined style={{ color: '#faad14' }} />,
  error: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  info: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
}

function NotificationsTab() {
  const [createForm] = Form.useForm()
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [filterType, setFilterType] = useState<AppNotificationType | 'all'>('all')
  const [showExpired, setShowExpired] = useState(true)

  async function loadNotifications() {
    setLoading(true)
    try {
      const result = await adminListNotifications(1, 200, showExpired)
      setNotifs(result.items)
    } catch (err) {
      antMessage.error(`Không tải được thông báo: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadNotifications() }, [showExpired])

  async function handleCreate(values: {
    type: AppNotificationType
    title: string
    message: string
    source?: string
    target_scope?: 'ALL' | 'USER'
    target_user_id?: string
    expires_at?: string
  }) {
    const targetScope = values.target_scope ?? 'ALL'
    if (targetScope === 'USER' && !values.target_user_id?.trim()) {
      antMessage.warning('Khi chọn USER, cần nhập User ID đích')
      return
    }

    setCreating(true)
    try {
      const expiresAt = values.expires_at ? dayjs(values.expires_at).toISOString() : undefined
      await adminCreateNotification({
        type: values.type,
        title: values.title,
        message: values.message,
        source: values.source,
        target_scope: targetScope,
        target_user_id: targetScope === 'USER' ? values.target_user_id : undefined,
        expires_at: expiresAt,
      })
      antMessage.success('Tạo thông báo thành công')
      createForm.resetFields()
      createForm.setFieldsValue({ type: 'info', target_scope: 'ALL' })
      await loadNotifications()
    } catch (err) {
      antMessage.error(`Tạo thông báo thất bại: ${(err as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  const visible = notifs.filter(n => {
    if (filterType !== 'all' && n.type !== filterType) return false
    return true
  })

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card style={{ borderRadius: 10 }} title={<SectionHeader icon={<PlusOutlined />} title="Tạo thông báo" />}>
        <Form
          form={createForm}
          layout="vertical"
          onFinish={v => void handleCreate(v as {
            type: AppNotificationType
            title: string
            message: string
            source?: string
            target_scope?: 'ALL' | 'USER'
            target_user_id?: string
            expires_at?: string
          })}
          initialValues={{ type: 'info', source: 'System', target_scope: 'ALL' }}
        >
          <Row gutter={[12, 0]}>
            <Col xs={24} md={8}>
              <Form.Item name="type" label="Loại thông báo" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'info', label: 'Thông tin' },
                    { value: 'success', label: 'Thành công' },
                    { value: 'warning', label: 'Cảnh báo' },
                    { value: 'error', label: 'Lỗi' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="source" label="Nguồn">
                <Input placeholder="System / Backend / KYC..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="target_scope" label="Đối tượng nhận">
                <Select options={[{ value: 'ALL', label: 'Toàn bộ người dùng' }, { value: 'USER', label: 'Một người dùng cụ thể' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => (
                  <Form.Item
                    name="target_user_id"
                    label="User ID đích"
                    rules={getFieldValue('target_scope') === 'USER' ? [{ required: true, message: 'Nhập user ID' }] : []}
                  >
                    <Input placeholder="UUID user (chỉ khi chọn USER)" disabled={getFieldValue('target_scope') !== 'USER'} />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="expires_at" label="Hạn thông báo">
                <Input type="datetime-local" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}>
                <Input placeholder="Ví dụ: Bảo trì hệ thống" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="message" label="Nội dung" rules={[{ required: true }]}>
                <Input placeholder="Mô tả ngắn thông báo gửi tới người dùng" />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" loading={creating}>Tạo thông báo</Button>
        </Form>
      </Card>

      {/* Controls */}
      <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: '12px 20px' }}>
        <Row align="middle" gutter={[12, 12]}>
          <Col flex="auto">
            <Space wrap>
              <Text>Lọc:</Text>
              {(['all', 'error', 'warning', 'success', 'info'] as const).map(t => (
                <Tag.CheckableTag
                  key={t}
                  checked={filterType === t}
                  onChange={() => setFilterType(t)}
                  style={filterType === t ? { fontWeight: 600 } : {}}
                >
                  {t === 'all' ? 'Tất cả' : t === 'error' ? 'Lỗi' : t === 'warning' ? 'Cảnh báo' : t === 'success' ? 'Thành công' : 'Thông tin'}
                </Tag.CheckableTag>
              ))}
              <Divider type="vertical" />
              <Switch
                size="small"
                checked={showExpired}
                onChange={setShowExpired}
                checkedChildren="Có hết hạn"
                unCheckedChildren="Đang hiệu lực"
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadNotifications()} loading={loading}>Tải lại</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Notification list */}
      {loading ? (
        <Card style={{ borderRadius: 10, textAlign: 'center', padding: 40 }}>
          <Spin />
        </Card>
      ) : visible.length === 0 ? (
        <Card style={{ borderRadius: 10, textAlign: 'center', padding: 40 }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', display: 'block', marginBottom: 12 }} />
          <Text type="secondary">Không có thông báo nào</Text>
        </Card>
      ) : (
        <List
          dataSource={visible}
          renderItem={n => (
            <List.Item
              key={n.id}
              style={{ padding: 0, marginBottom: 10 }}
            >
              <Card
                style={{
                  width: '100%',
                  borderRadius: 10,
                  borderLeft: `4px solid ${NOTIF_COLORS[n.type]}`,
                }}
                bodyStyle={{ padding: '14px 18px' }}
              >
                <Row align="top" gutter={12}>
                  <Col flex="none" style={{ paddingTop: 2, fontSize: 18 }}>
                    {NOTIF_ICONS[n.type]}
                  </Col>
                  <Col flex="auto">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <Text strong>{n.title}</Text>
                      <Tag color={n.type} style={{ fontSize: 11 }}>{n.source || 'System'}</Tag>
                      <Tag color={n.target_scope === 'USER' ? 'purple' : 'blue'} style={{ fontSize: 11 }}>
                        {n.target_scope === 'USER' ? 'USER' : 'ALL'}
                      </Tag>
                      {n.expires_at && (
                        <Tag color={dayjs(n.expires_at).isBefore(dayjs()) ? 'error' : 'green'} style={{ fontSize: 11 }}>
                          {dayjs(n.expires_at).isBefore(dayjs()) ? 'Đã hết hạn' : 'Còn hiệu lực'}
                        </Tag>
                      )}
                    </div>
                    <Paragraph style={{ margin: 0, marginBottom: 6, color: '#374151' }}>{n.message}</Paragraph>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(n.created_at).fromNow()} — {dayjs(n.created_at).format('HH:mm DD/MM/YYYY')}
                    </Text>
                    {n.expires_at && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Hết hạn: {dayjs(n.expires_at).format('HH:mm DD/MM/YYYY')}
                        </Text>
                      </div>
                    )}
                  </Col>
                </Row>
              </Card>
            </List.Item>
          )}
        />
      )}
    </Space>
  )
}

// ══════════════════════════════════════════════════════════════════
// AdminPage — Main export (full /admin route page)
// ══════════════════════════════════════════════════════════════════

interface AdminPageProps {
  user?: AuthUser
}

export function AdminPage({ user }: AdminPageProps) {
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('ADMIN') ||
    user?.roles?.includes('SUPER_ADMIN') || user?.roles?.includes('super_admin')

  if (!isAdmin) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <CloseCircleOutlined style={{ fontSize: 64, color: '#DC2626', marginBottom: 16, display: 'block' }} />
        <Title level={4} style={{ color: '#DC2626' }}>Không có quyền truy cập</Title>
        <Text type="secondary">Trang này chỉ dành cho quản trị viên hệ thống.</Text>
      </div>
    )
  }

  const tabItems = [
    {
      key: 'contracts',
      label: (
        <Space>
          <ContainerOutlined />
          <span>Blockchain</span>
        </Space>
      ),
      children: <ContractTab />,
    },
    {
      key: 'analytics',
      label: (
        <Space>
          <BarChartOutlined />
          <span>Phân tích</span>
        </Space>
      ),
      children: <AnalyticsTab />,
    },
    {
      key: 'notifications',
      label: (
        <Space>
          <BellOutlined />
          <span>Thông báo</span>
        </Space>
      ),
      children: <NotificationsTab />,
    },
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1744 0%, #312E81 60%, #4338CA 100%)',
        borderRadius: 14,
        padding: '24px 32px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <Space align="center" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>🛡️</span>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>Bảng điều khiển quản trị</Title>
          </Space>
          <Text style={{ color: '#A5B4FC', fontSize: 13 }}>
            Quản lý toàn bộ hệ thống VNDC Education Platform - Blockchain, Backend, Analytics &amp; Thông báo
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Tag color="gold" style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8 }}>
            {user?.full_name ?? user?.username ?? 'Admin'}
          </Tag>
          <div style={{ marginTop: 6 }}>
            <Text style={{ color: '#818CF8', fontSize: 11 }}>
              {user?.wallet_address?.slice(0, 8)}…{user?.wallet_address?.slice(-6)}
            </Text>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        items={tabItems}
        defaultActiveKey="contracts"
        size="large"
        style={{ background: 'transparent' }}
        tabBarStyle={{ background: '#fff', padding: '0 16px', borderRadius: '10px 10px 0 0', marginBottom: 0 }}
      />
    </div>
  )
}

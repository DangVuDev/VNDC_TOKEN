import { useEffect, useState } from 'react'
import {
  Card, Typography, Space, Button, Modal, Form, Input,
  InputNumber, Spin, Select, Tabs, message as antMessage,
  Alert, Tooltip, Avatar, Divider, Row, Col, Tag, Badge,
} from 'antd'
import {
  ApartmentOutlined, PlusOutlined, CheckOutlined, CloseOutlined,
  MinusOutlined, ClockCircleOutlined, UserOutlined, FireOutlined,
  GlobalOutlined, TrophyOutlined, BankOutlined, TeamOutlined,
  FileDoneOutlined, SearchOutlined,
} from '@ant-design/icons'
import { getDAOs, getProposals, createProposal, castVote, createDAO, type DAOOrg, type Proposal, type CreateDAORequest } from '../lib/services'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

interface DAOPageProps { user?: AuthUser }

function weiToVNDC(wei: string): number {
  try {
    const val = BigInt(wei || '0')
    return Number(val / BigInt('1000000000000000000'))
  } catch { return 0 }
}

function timeLeft(endAt?: string) {
  if (!endAt) return 'Chưa xác định'
  const diff = new Date(endAt).getTime() - Date.now()
  if (diff <= 0) return 'Đã kết thúc'
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days} ngày ${hours} giờ`
  const mins  = Math.floor((diff % 3600000) / 60000)
  return `${hours} giờ ${mins} phút`
}

function formatDateTimeVi(iso?: string) {
  if (!iso) return 'Chưa xác định'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Chưa xác định'
  return d.toLocaleString('vi-VN', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeUntil(startAt?: string) {
  if (!startAt) return 'Chưa xác định'
  const diff = new Date(startAt).getTime() - Date.now()
  if (diff <= 0) return 'Có thể biểu quyết ngày'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days} ngày ${hours} giờ ${mins} phút`
  if (hours > 0) return `${hours} giờ ${mins} phút`
  return `${mins} phút`
}

function mapVoteErrorMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const msg = raw.toLowerCase()

  if (msg.includes('voting not started') || msg.includes('voting has not started yet')) {
    return 'Chưa đến thời gian biểu quyết. Vui lòng chờ đến lúc proposal bắt đầu.'
  }
  if (msg.includes('voting ended') || msg.includes('voting has ended')) {
    return 'Cuộc biểu quyết đã kết thúc.'
  }
  if (msg.includes('already voted')) {
    return 'Bạn đã biểu quyết cho đề xuất này.'
  }
  if (msg.includes('no voting power')) {
    return 'Bạn không đủ voting power để biểu quyết.'
  }

  return raw || 'Biểu quyết thất bại'
}

const statusCfg: Record<string, { color: string; bg: string; border: string; label: string; cssClass: string }> = {
  ACTIVE:    { color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE', label: 'Đang biểu quyết', cssClass: 'ballot-active'    },
  SUCCEEDED: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Đã thông qua',    cssClass: 'ballot-succeeded' },
  DEFEATED:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Bị phủ quyết',    cssClass: 'ballot-defeated'  },
  PENDING:   { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Chờ bắt đầu',     cssClass: 'ballot-pending'   },
  QUEUED:    { color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', label: 'Đang xếp hàng',   cssClass: 'ballot-queued'    },
  EXECUTED:  { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: 'Đã thi hành',     cssClass: 'ballot-executed'  },
  CANCELLED: { color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB', label: 'Đã hủy',          cssClass: 'ballot-cancelled' },
  EXPIRED:   { color: '#F59E0B', bg: '#FEF3C7', border: '#FCD34D', label: 'Hết thời gian',   cssClass: 'ballot-expired'   },
}

const userVoteLabel: Record<number, string> = { 1: 'Đồng ý', 0: 'Phản đối', 2: 'Trung lập' }

const DAO_PAGE_STYLES = `
  .dao-page {
    --dao-navy: #0F172A;
    --dao-ink: #1E293B;
    --dao-accent: #0F766E;
    --dao-accent-soft: #CCFBF1;
    --dao-warm: #D97706;
    --dao-surface: #FFFFFF;
    --dao-border: #E2E8F0;
    --dao-muted: #64748B;
    background:
      radial-gradient(1200px 500px at 10% -20%, rgba(13,148,136,0.12), transparent 60%),
      radial-gradient(900px 400px at 100% -15%, rgba(217,119,6,0.12), transparent 58%),
      linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%);
    border-radius: 22px;
    padding: 16px;
  }
  .dao-hero {
    animation: daoFadeUp .55s ease both;
    box-shadow: 0 10px 34px rgba(15, 23, 42, 0.25);
  }
  .dao-page .hover-lift {
    transition: transform .22s ease, box-shadow .22s ease;
  }
  .dao-page .hover-lift:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
  }
  .dao-page .ant-tabs-tab {
    border-radius: 999px !important;
    padding: 6px 14px !important;
    margin-inline-end: 8px !important;
    border: 1px solid var(--dao-border);
    background: #fff;
  }
  .dao-page .ant-tabs-tab-active {
    border-color: rgba(15,118,110,.45) !important;
    box-shadow: 0 4px 12px rgba(15,118,110,.15);
  }
  .dao-page .ant-tabs-ink-bar {
    display: none !important;
  }
  .dao-page .vote-bar-track {
    height: 11px;
    background: #E2E8F0;
    border-radius: 999px;
  }
  .dao-page .vote-bar-fill {
    border-radius: 999px;
  }
  @keyframes daoFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
`

function VoteBar({ pct, type }: { pct: number; type: 'for' | 'against' | 'abstain' }) {
  return (
    <div className="vote-bar-track" style={{ flex: 1, minWidth: 0 }}>
      <div
        className={`vote-bar-fill vote-bar-${type}`}
        style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
      />
    </div>
  )
}

function ProposalCard({ proposal, index, onVote }: {
  proposal: Proposal; index: number; onVote: () => void
}) {
  const [voting, setVoting]     = useState(false)
  const [expanded, setExpanded] = useState(false)

  const forVNDC     = weiToVNDC(proposal.for_votes)
  const againstVNDC = weiToVNDC(proposal.against_votes)
  const abstainVNDC = weiToVNDC(proposal.abstain_votes)
  const total       = forVNDC + againstVNDC + abstainVNDC || 1
  const forPct      = Math.round((forVNDC / total) * 100)
  const againstPct  = Math.round((againstVNDC / total) * 100)
  const abstainPct  = Math.round((abstainVNDC / total) * 100)
  const totalVotes  = forVNDC + againstVNDC + abstainVNDC

  const st       = statusCfg[proposal.status] ?? statusCfg.PENDING
  const hasVoted = proposal.user_vote !== undefined && proposal.user_vote !== null
  const isActive = proposal.status === 'ACTIVE'
  const canVote  = isActive && !hasVoted
  const blockVoteMessage = proposal.status === 'PENDING'
    ? 'Cuộc biểu quyết chưa bắt đầu'
    : proposal.status === 'EXPIRED'
      ? 'Cuộc biểu quyết này đã kết thúc'
      : 'Bạn không thể biểu quyết ở trạng thái hiện tại'
  const statusBannerStyle = proposal.status === 'PENDING'
    ? { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C' }
    : proposal.status === 'EXPIRED'
      ? { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C' }
      : { bg: '#F8FAFC', border: '#CBD5E1', text: '#475569' }
  const showStartHint = proposal.status === 'PENDING'

  useEffect(() => {
    console.log('[DAO][ProposalStatus]', {
      proposalId: proposal.id,
      title: proposal.title,
      status: proposal.status,
      startTime: proposal.start_time,
      endTime: proposal.end_time,
      hasVoted,
      canVote,
    })
  }, [proposal.id, proposal.title, proposal.status, proposal.start_time, proposal.end_time, hasVoted, canVote])

  async function vote(v: 'FOR' | 'AGAINST' | 'ABSTAIN') {
    if (!canVote) return
    setVoting(true)
    try {
      await castVote(proposal.id, v)
      antMessage.success(
        v === 'FOR' ? 'Đã biểu quyết: Đồng ý!' :
        v === 'AGAINST' ? 'Đã biểu quyết: Phản đối!' : 'Đã biểu quyết: Trung lập!'
      )
      onVote()
    } catch (e) {
      antMessage.error(mapVoteErrorMessage(e))
    } finally {
      setVoting(false)
    }
  }

  return (
    <div
      className={`hover-lift ${st.cssClass}`}
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        border: `1px solid ${st.border}`,
        marginBottom: 16,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(67,56,202,0.06)',
        display: 'flex',
      }}
    >
      {/* Colored left accent bar */}
      <div style={{ width: 5, background: st.color, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* -- Card Header -- */}
        <div style={{
          padding: '15px 20px 13px',
          borderBottom: `1px solid ${st.border}`,
          background: st.bg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
            {/* Number badge */}
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: `${st.color}18`,
              border: `1.5px solid ${st.border}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 8, color: st.color, fontWeight: 700, lineHeight: 1, textTransform: 'uppercase' }}>#</div>
              <div style={{ fontSize: 15, color: st.color, fontWeight: 800, lineHeight: 1 }}>
                {String(index + 1).padStart(2, '0')}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                {isActive && <span className="pulse-dot" style={{ background: st.color }} />}
                <span style={{ fontSize: 10, color: st.color, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Đề xuất
                </span>
              </div>
              <Title level={5} style={{
                margin: 0, color: '#1A1744', lineHeight: 1.35,
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 15.5,
              }}>
                {proposal.title}
              </Title>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              color: st.color, background: '#FFFFFF',
              border: `1.5px solid ${st.color}`,
              borderRadius: 20, padding: '3px 12px',
            }}>
              {st.label}
            </span>
            {hasVoted && proposal.user_vote !== undefined && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: '#7C3AED', background: '#EDE9FE',
                border: '1px solid #C4B5FD', borderRadius: 10,
                padding: '2px 8px',
              }}>
                Phieu: {userVoteLabel[proposal.user_vote]}
              </span>
            )}
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
              <ClockCircleOutlined style={{ marginRight: 3 }} />
              {timeLeft(proposal.end_time)}
            </Text>
          </div>
        </div>

        {/* -- Card Body -- */}
        <div style={{ padding: '15px 20px' }}>
          {!canVote && !hasVoted && !isActive && (
            <div style={{
              marginBottom: 12,
              padding: '9px 12px',
              borderRadius: 8,
              border: `1px solid ${statusBannerStyle.border}`,
              background: statusBannerStyle.bg,
            }}>
              <Text style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: statusBannerStyle.text }}>
                Trạng thái biểu quyết
              </Text>
              <Text style={{ fontSize: 13, fontWeight: 600, color: statusBannerStyle.text }}>
                {blockVoteMessage}
              </Text>
              {showStartHint && (
                <Text style={{ display: 'block', marginTop: 4, fontSize: 12, color: statusBannerStyle.text }}>
                  Bat dau luc {formatDateTimeVi(proposal.start_time)} (con {timeUntil(proposal.start_time)})
                </Text>
              )}
            </div>
          )}

          {/* Description */}
          <Text style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Mô tả đề xuất
          </Text>
          <Paragraph
            style={{ color: '#4B5563', fontSize: 13.5, margin: '0 0 10px', lineHeight: 1.65 }}
            ellipsis={expanded ? false : { rows: 2, expandable: false }}
          >
            {proposal.description || 'Không có mô tả'}
          </Paragraph>
          {proposal.description && proposal.description.length > 120 && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                background: 'none', border: 'none', color: '#6366F1',
                cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 12,
              }}
            >
              {expanded ? 'Thu gon' : 'Xem them...'}
            </button>
          )}

          {/* Author row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            padding: '7px 12px', background: '#F8F7FF', borderRadius: 8, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Avatar size={20} style={{ background: '#4338CA', fontSize: 10 }}>
                <UserOutlined />
              </Avatar>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>Người đề xuất:</Text>
              <code style={{ fontSize: 10, color: '#6366F1', background: '#EEF2FF', padding: '1px 6px', borderRadius: 4 }}>
                {`${proposal.proposer_wallet?.slice(0, 8)}...${proposal.proposer_wallet?.slice(-6)}`}
              </code>
            </div>
            {totalVotes > 0 && (
              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                {totalVotes.toLocaleString()} VNDC tham gia
              </Tag>
            )}
          </div>

          {/* Vote results */}
          <div style={{
            background: 'linear-gradient(135deg, #F8F7FF 0%, #F0EFFE 100%)',
            borderRadius: 10, padding: '13px 15px',
            border: '1px solid #E0E7FF',
            marginBottom: canVote ? 13 : 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Kết quả biểu quyết
              </Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                {totalVotes.toLocaleString()} VNDC
              </Text>
            </div>

            {[
              { label: 'Đồng ý',    pct: forPct,      val: forVNDC,      type: 'for'     as const, color: '#059669', icon: <CheckOutlined style={{ fontSize: 10 }} /> },
              { label: 'Phản đối',  pct: againstPct,  val: againstVNDC,  type: 'against' as const, color: '#DC2626', icon: <CloseOutlined style={{ fontSize: 10 }} /> },
              { label: 'Trung lập', pct: abstainPct,  val: abstainVNDC,  type: 'abstain' as const, color: '#9CA3AF', icon: <MinusOutlined style={{ fontSize: 10 }} /> },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: row.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {row.icon} {row.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>
                    {row.pct}%{' '}
                    <span style={{ fontSize: 11, fontWeight: 400, color: '#9CA3AF' }}>{row.val.toLocaleString()} VNDC</span>
                  </span>
                </div>
                <VoteBar pct={row.pct} type={row.type} />
              </div>
            ))}
          </div>

          {/* Vote buttons */}
          {canVote && (
            <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
              {[
                { v: 'FOR'     as const, label: 'Đồng ý',   color: '#059669', bg: '#ECFDF5' },
                { v: 'AGAINST' as const, label: 'Phản đối',  color: '#DC2626', bg: '#FEF2F2' },
                { v: 'ABSTAIN' as const, label: 'Trung lập', color: '#6B7280', bg: '#F9FAFB' },
              ].map(btn => (
                <button
                  key={btn.v}
                  onClick={() => vote(btn.v)}
                  disabled={voting}
                  style={{
                    flex: 1, height: 42, borderRadius: 8,
                    border: `2px solid ${btn.color}`,
                    background: btn.bg, color: btn.color,
                    fontWeight: 700, fontSize: 13,
                    cursor: voting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    transition: 'all 0.15s',
                    opacity: voting ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!voting) { e.currentTarget.style.background = btn.color; e.currentTarget.style.color = '#fff' } }}
                  onMouseLeave={e => { if (!voting) { e.currentTarget.style.background = btn.bg; e.currentTarget.style.color = btn.color } }}
                >
                  {btn.v === 'FOR' ? <CheckOutlined /> : btn.v === 'AGAINST' ? <CloseOutlined /> : <MinusOutlined />}
                  {btn.label}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export function DAOPage({ user }: DAOPageProps) {
  const [daos, setDaos]               = useState<DAOOrg[]>([])
  const [selectedDao, setSelectedDao] = useState<string>('')
  const [proposals, setProposals]     = useState<Proposal[]>([])
  const [loading, setLoading]         = useState(true)
  const [daoLoading, setDaoLoading]   = useState(true)
  const [createOpen, setCreateOpen]   = useState(false)
  const [creating, setCreating]       = useState(false)
  const [form]                        = Form.useForm()
  const [activeTab, setActiveTab]     = useState('ACTIVE')
  const [createDAOOpen, setCreateDAOOpen]   = useState(false)
  const [creatingDAO, setCreatingDAO]       = useState(false)
  const [daoForm]                           = Form.useForm()

  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('ADMIN')
 

  async function loadDAOs() {
    setDaoLoading(true)
    try {
      const data = await getDAOs().catch(() => ({ daos: [] }))
      const list = data?.daos ?? []
      setDaos(list)
      if (list.length > 0 && !selectedDao) setSelectedDao(list[0].id)
      else setLoading(false)
    } catch (e) {
      console.error('loadDAOs error:', e)
      setDaos([])
      setLoading(false)
    } finally {
      setDaoLoading(false)
    }
  }

  async function loadProposals(daoId: string) {
    setLoading(true)
    try {
      if (!daoId) {
        setProposals([])
        return
      }
      const data = await getProposals(daoId).catch(() => ({ proposals: [] }))
      setProposals(data?.proposals ?? [])
    } catch (e) {
      console.error('loadProposals error:', e)
      setProposals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadDAOs() }, [])
  useEffect(() => { void loadProposals(selectedDao) }, [selectedDao])

  async function handleCreate(values: { title: string; description: string; voting_period_hours: number }) {
    setCreating(true)
    try {
      await createProposal(selectedDao, values)
      antMessage.success('Đề xuất đã được tạo và gửi lên blockchain!')
      setCreateOpen(false)
      form.resetFields()
      void loadProposals(selectedDao)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Tạo đề xuất thất bại')
    } finally { setCreating(false) }
  }

  async function handleCreateDAO() {
    setCreatingDAO(true)
    try {
      const values = await daoForm.validateFields()
      const req: CreateDAORequest = {
        name: values.name,
        description: values.description,
        metadata_uri: values.metadata_uri || '',
        governance_token: values.governance_token || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        quorum_bps: (values.quorum_bps || 20) * 100,
        voting_delay_sec: (values.voting_delay_hours ?? 0) * 3600,
        voting_period_sec: (values.voting_period_hours || 72) * 3600,
        timelock_sec: (values.timelock_hours || 1) * 3600,
      }
      await createDAO(req)
      antMessage.success('DAO đã được tạo thành công trên blockchain!')
      setCreateDAOOpen(false)
      daoForm.resetFields()
      void loadDAOs()
    } catch (e) {
      antMessage.error('Lỗi tạo DAO: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setCreatingDAO(false) }
  }

  const filteredProposals = activeTab === 'ALL'
    ? proposals
    : proposals.filter((p) => p.status === activeTab)

  const activeCount    = proposals.filter(p => p.status === 'ACTIVE').length
  const succeededCount = proposals.filter(p => p.status === 'SUCCEEDED').length
  const defeatedCount  = proposals.filter(p => p.status === 'DEFEATED').length
  const currentDAO     = daos.find(d => d.id === selectedDao)

  return (
    <div className="dao-page" style={{ maxWidth: 1120, margin: '0 auto' }}>

      <style>{DAO_PAGE_STYLES}</style>

      

      {/* ===== HERO BANNER ===== */}
      <div className="dao-hero" style={{
        background: 'linear-gradient(136deg, #0F172A 0%, #1E293B 44%, #0F766E 100%)',
        borderRadius: 20,
        padding: '30px 30px 24px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          border: '1px solid rgba(153,246,228,0.16)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: 200,
          width: 300, height: 300, borderRadius: '50%',
          border: '1px solid rgba(251,191,36,0.10)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(15,118,110,0.45), rgba(20,184,166,0.24))',
              border: '1.5px solid rgba(153,246,228,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, flexShrink: 0,
            }}>
              ðŸ›ï¸
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#99F6E4', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                VNDC Â· Hoi dong Sinh vien
              </div>
              <Title level={2} style={{
                margin: 0, color: '#FFFFFF',
                fontWeight: 800, lineHeight: 1.2, fontSize: 27,
              }}>
                DAO &amp; Bau cu
              </Title>
              <Text style={{ color: '#CFFAFE', fontSize: 13, marginTop: 5, display: 'block' }}>
                Moi phieu bau deu co gia tri Â· Quyen luc thuoc ve cong dong
              </Text>
            </div>
          </div>

          {isAdmin && selectedDao ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateOpen(true)}
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                  border: 'none', height: 44, borderRadius: 10,
                  fontWeight: 700, fontSize: 14,
                  boxShadow: '0 4px 14px rgba(217,119,6,0.35)',
                  color: '#111827',
                }}
              >
                Tạo đề xuất
              </Button>
              <Button
                type="dashed"
                icon={<ApartmentOutlined />}
                onClick={() => setCreateDAOOpen(true)}
                size="large"
                style={{
                  border: '2px dashed #14B8A6', height: 44, borderRadius: 10,
                  fontWeight: 600, fontSize: 13,
                  color: '#0F766E', background: '#CCFBF1',
                }}
              >
                Tạo DAO mới
              </Button>
            </div>
          ) : isAdmin && !selectedDao ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ padding: '8px 16px', background: '#FEF9EC', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                Hãy chọn DAO để tạo đề xuất
              </div>
              <Button
                type="dashed"
                icon={<ApartmentOutlined />}
                onClick={() => setCreateDAOOpen(true)}
                size="large"
                style={{
                  border: '2px dashed #14B8A6', height: 44, borderRadius: 10,
                  fontWeight: 600, fontSize: 13,
                  color: '#0F766E', background: '#CCFBF1',
                }}
              >
                Tạo DAO mới
              </Button>
            </div>
          ) : !isAdmin ? (
            <div style={{ padding: '8px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
              Chỉ admin có thể tạo đề xuất
            </div>
          ) : null}
        </div>

        {/* Stats strip */}
        <div style={{
          display: 'flex',
          marginTop: 24,
          background: 'rgba(2, 6, 23, 0.30)',
          borderRadius: 12,
          border: '1px solid rgba(153,246,228,0.18)',
          overflow: 'hidden',
        }}>
          {[
            { icon: <FireOutlined />,       label: 'Đang biểu quyết', value: activeCount,    color: '#2DD4BF', highlight: activeCount > 0 },
            { icon: <TrophyOutlined />,     label: 'Đã thông qua',    value: succeededCount, color: '#34D399', highlight: false },
            { icon: <CloseOutlined />,      label: 'Bị phủ quyết',    value: defeatedCount,  color: '#F87171', highlight: false },
            { icon: <FileDoneOutlined />,   label: 'Tổng đề xuất',    value: proposals.length, color: '#FBBF24', highlight: false },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1, textAlign: 'center', padding: '14px 8px',
              borderRight: i < 3 ? '1px solid rgba(153,246,228,0.12)' : 'none',
              background: stat.highlight ? 'rgba(20,184,166,0.18)' : 'transparent',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: 3 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 10, color: '#CFFAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {stat.icon}
                <span>{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== NO DAOs STATE ===== */}
      {daoLoading === false && daos.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 40px',
          background: '#FFFFFF', borderRadius: 14,
          border: '2px dashed #C7D2FE', marginBottom: 24,
        }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>ðŸ›ï¸</div>
          <Title level={3} style={{ color: '#6B7280', fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 8 }}>
            Chưa có DAO nào được tạo
          </Title>
          <Text type="secondary" style={{ fontSize: 14, marginBottom: 20, display: 'block' }}>
            Hãy chờ admin tạo DAO để bắt đầu biểu quyết cùng cộng đồng
          </Text>
        </div>
      )}

      {/* ===== 2-COLUMN LAYOUT ===== */}
      {daos.length > 0 && (
      <Row gutter={[20, 20]}>

        {/* === LEFT: Proposals === */}
        <Col xs={24} lg={16}>

          {daos.length > 1 && (
            <Card
              style={{ borderRadius: 14, marginBottom: 16, border: '1px solid #D1FAE5', boxShadow: '0 4px 18px rgba(15,118,110,0.08)' }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <Space>
                <GlobalOutlined style={{ color: '#0F766E' }} />
                <Text style={{ fontWeight: 600, color: '#374151' }}>Chon DAO:</Text>
                <Select
                  value={selectedDao}
                  onChange={(v) => setSelectedDao(v)}
                  style={{ minWidth: 220 }}
                  options={daos.map((d) => ({ value: d.id, label: d.name }))}
                />
              </Space>
            </Card>
          )}

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'ACTIVE',
                label: (
                  <span>
                    <FireOutlined style={{ color: activeCount > 0 ? '#4338CA' : undefined }} />
                    Đang biểu quyết
                    {activeCount > 0 && (
                      <Badge count={activeCount} size="small" style={{ marginLeft: 6, background: '#4338CA' }} />
                    )}
                  </span>
                ),
              },
              {
                key: 'SUCCEEDED',
                label: (
                  <span>
                    <TrophyOutlined style={{ color: '#059669' }} />
                    Đã thông qua
                    {succeededCount > 0 && (
                      <Badge count={succeededCount} size="small" style={{ marginLeft: 6, background: '#059669' }} />
                    )}
                  </span>
                ),
              },
              {
                key: 'DEFEATED',
                label: (
                  <span>
                    <CloseOutlined style={{ color: '#DC2626' }} />
                    Bị phủ quyết
                  </span>
                ),
              },
              {
                key: 'ALL',
                label: (
                  <span>
                    <SearchOutlined />
                    Tat ca ({proposals.length})
                  </span>
                ),
              },
            ]}
          />

          <Spin spinning={loading}>
            {filteredProposals.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '56px 24px',
                background: '#FFFFFF', borderRadius: 14,
                border: '2px dashed #C7D2FE',
              }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🗳️</div>
                <Title level={4} style={{ color: '#6B7280', fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6 }}>
                  {activeTab === 'ACTIVE' ? 'Chưa có đề xuất nào đang biểu quyết' : 'Chưa có đề xuất nào'}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {activeTab === 'ACTIVE' && isAdmin && 'Hãy tạo đề xuất để cộng đồng bắt đầu biểu quyết'}
                </Text>
                {activeTab === 'ACTIVE' && isAdmin && selectedDao && (
                  <div style={{ marginTop: 18 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateOpen(true)}
                      style={{ background: 'linear-gradient(135deg, #4338CA, #6366F1)', border: 'none', borderRadius: 8 }}
                    >
                      Tạo đề xuất dau tien
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredProposals.map((p, i) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  index={i}
                  onVote={() => loadProposals(selectedDao)}
                />
              ))
            )}
          </Spin>
        </Col>

        {/* === RIGHT: Sidebar === */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>

            {currentDAO && (
              <Card
                style={{ borderRadius: 14, border: '1px solid #E0E7FF', overflow: 'hidden' }}
                styles={{ body: { padding: 0 } }}
              >
                <div style={{
                  background: 'linear-gradient(135deg, #1A1744, #3730A3)',
                  padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <Avatar size={44} style={{ background: 'rgba(99,102,241,0.4)', border: '1.5px solid #818CF8', flexShrink: 0 }}>
                    <ApartmentOutlined style={{ fontSize: 20, color: '#C7D2FE' }} />
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{
                      color: '#FFFFFF', fontWeight: 700, fontSize: 15,
                      fontFamily: "'Playfair Display', Georgia, serif",
                      display: 'block',
                    }}>
                      {currentDAO.name}
                    </Text>
                    <Text style={{ color: '#818CF8', fontSize: 11 }}>DAO Organization</Text>
                  </div>
                </div>
                <div style={{ padding: '14px 18px' }}>
                  {currentDAO.description && (
                    <Paragraph style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, marginBottom: 12 }} ellipsis={{ rows: 3 }}>
                      {currentDAO.description}
                    </Paragraph>
                  )}
                  <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <UserOutlined />
                    <code style={{ fontSize: 10, color: '#6366F1' }}>
                      {`${currentDAO.founder_wallet?.slice(0, 8)}...${currentDAO.founder_wallet?.slice(-4)}`}
                    </code>
                  </div>
                </div>
              </Card>
            )}

            {isAdmin && (
              <Card
                style={{ borderRadius: 14, border: '2px solid #D97706', background: 'linear-gradient(135deg, #FFFBEB, #FEF9EC)' }}
                styles={{ body: { padding: '14px 16px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>ðŸ‘‘</span>
                  <span style={{ fontWeight: 700, color: '#92400E', fontSize: 14 }}>Trang Thai Admin</span>
                </div>
                <Text style={{ fontSize: 12, color: '#B45309', lineHeight: 1.6 }}>
                  Bạn có quyền tạo và quản lý các đề xuất cho DAO dưới đây
                </Text>
              </Card>
            )}

            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BankOutlined style={{ color: '#4338CA' }} />
                  <span style={{ fontWeight: 700, color: '#1A1744', fontSize: 14 }}>Nguyên tắc biểu quyết</span>
                </div>
              }
              style={{ borderRadius: 14, border: '1px solid #E0E7FF' }}
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {[
                  { num: '01', text: 'Mỗi VNDC token = 1 phiếu biểu quyết', color: '#4338CA' },
                  { num: '02', text: 'Toàn bộ cộng đồng được tham gia bình chọn', color: '#7C3AED' },
                  { num: '03', text: 'Kết quả ghi nhận minh bạch trên blockchain', color: '#059669' },
                  { num: '04', text: 'Đề xuất thông qua khi đạt quy định tối thiểu', color: '#D97706' },
                ].map(rule => (
                  <div key={rule.num} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: `${rule.color}15`, border: `1px solid ${rule.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: rule.color,
                    }}>
                      {rule.num}
                    </div>
                    <Text style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.5 }}>{rule.text}</Text>
                  </div>
                ))}
              </Space>
            </Card>

            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TeamOutlined style={{ color: '#D97706' }} />
                  <span style={{ fontWeight: 700, color: '#1A1744', fontSize: 14 }}>Tham gia biểu quyết</span>
                </div>
              }
              style={{ borderRadius: 14, border: '1px solid #FDE68A', background: 'linear-gradient(135deg, #FFFBEB, #FEF9EC)' }}
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.6 }}>
                  Kết nối ví VNDC của bạn để tham gia bình chọn. Trọng lượng phiếu tương đương với số dư token.
                </Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  <Tag color="gold" style={{ fontSize: 11, padding: '2px 8px' }}>EIP-712 Signature</Tag>
                  <Tag color="gold" style={{ fontSize: 11, padding: '2px 8px' }}>On-chain Record</Tag>
                </div>
              </Space>
            </Card>

          </Space>
        </Col>
      </Row>
      )}

      {/* ===== CREATE MODAL ===== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>ðŸ“‹</span>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: '#1A1744', fontWeight: 700 }}>
              Tạo đề xuất mới
            </span>
          </div>
        }
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        footer={null}
        width={600}
        style={{ borderRadius: 16 }}
      >
        <Divider style={{ marginTop: 0 }} />
        <Alert
          type="info"
          showIcon
          message="Đề xuất sẽ được ghi nhận lên blockchain và mở cho toàn cộng đồng DAO biểu quyết. Quyền biểu quyết tính theo số dư VNDC token."
          style={{ marginBottom: 20, borderRadius: 8, background: '#F0EFFE', border: '1px solid #C7D2FE' }}
        />
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label={<span style={{ fontWeight: 600, color: '#1A1744' }}>Tiêu đề đề xuất</span>}
            name="title"
            rules={[{ required: true, min: 5, max: 200, message: 'Tiêu đề từ 5-200 ký tự' }]}
          >
            <Input
              size="large"
              placeholder="Ví dụ: Tăng phần thưởng hoạt động thể thao 20%"
              maxLength={200} showCount
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Form.Item
            label={<span style={{ fontWeight: 600, color: '#1A1744' }}>Mô tả chi tiết</span>}
            name="description"
            rules={[{ required: true, min: 20, max: 2000, message: 'Mô tả từ 20-2000 ký tự' }]}
          >
            <Input.TextArea
              rows={5}
              placeholder="Mô tả rõ lý do, mục tiêu và lợi ích của đề xuất..."
              maxLength={2000} showCount
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Form.Item
            label={
              <Tooltip title="Thời gian cộng đồng có thể biểu quyết">
                <span style={{ fontWeight: 600, color: '#1A1744' }}>Thời gian biểu quyết (giờ)</span>
              </Tooltip>
            }
            name="voting_period_hours"
            rules={[{ required: true, type: 'number', min: 1, max: 720, message: 'Tu 1 den 720 giờ' }]}
            initialValue={72}
          >
            <InputNumber min={1} max={720} style={{ width: '100%', borderRadius: 8 }} addonAfter="giờ" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields() }} style={{ borderRadius: 8 }}>
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={creating}
              icon={<FileDoneOutlined />}
              style={{
                background: 'linear-gradient(135deg, #4338CA, #6366F1)',
                border: 'none', borderRadius: 8, fontWeight: 600,
              }}
            >
              Gửi đề xuất
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ===== CREATE DAO MODAL ===== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🏛️</span>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: '#1A1744', fontWeight: 700 }}>
              Tạo DAO mới
            </span>
          </div>
        }
        open={createDAOOpen}
        onCancel={() => { setCreateDAOOpen(false); daoForm.resetFields() }}
        footer={null}
        width={700}
        style={{ borderRadius: 16 }}
      >
        <Divider style={{ marginTop: 0 }} />
        <Alert
          type="warning"
          showIcon
          message="DAO sẽ được đăng ký trên blockchain và có quyền tạo các đề xuất để cộng đồng biểu quyết. Các thông số này sẽ không thể thay đổi sau khi tạo."
          style={{ marginBottom: 20, borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A' }}
        />
        <Form form={daoForm} layout="vertical" onFinish={handleCreateDAO}>
          <Form.Item
            label={<span style={{ fontWeight: 600, color: '#1A1744' }}>Tên DAO</span>}
            name="name"
            rules={[{ required: true, min: 5, max: 100, message: 'Tên DAO từ 5-100 ký tự' }]}
          >
            <Input
              size="large"
              placeholder="Ví dụ: VNDC Education DAO"
              maxLength={100} showCount
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600, color: '#1A1744' }}>Mô tả DAO</span>}
            name="description"
            rules={[{ required: true, min: 20, max: 500, message: 'Mô tả từ 20-500 ký tự' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Mô tả mục tiêu và chức năng của DAO..."
              maxLength={500} showCount
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, color: '#1A1744' }}>Quorum (%)</span>}
                name="quorum_bps"
                rules={[{ required: true, type: 'number', min: 10, max: 100, message: 'Tu 10-100%' }]}
                initialValue={20}
              >
                <InputNumber min={10} max={100} style={{ width: '100%', borderRadius: 8 }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={
                  <Tooltip title="Thời gian chờ trước khi có thể biểu quyết">
                    <span style={{ fontWeight: 600, color: '#1A1744' }}>Voting Delay (h)</span>
                  </Tooltip>
                }
                name="voting_delay_hours"
                rules={[{ required: true, type: 'number', min: 0, max: 24, message: 'Từ 0-24 giờ' }]}
                initialValue={0}
              >
                <InputNumber min={0} max={24} style={{ width: '100%', borderRadius: 8 }} addonAfter="h" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={
                  <Tooltip title="Thời gian biểu quyết">
                    <span style={{ fontWeight: 600, color: '#1A1744' }}>Voting Period (h)</span>
                  </Tooltip>
                }
                name="voting_period_hours"
                rules={[{ required: true, type: 'number', min: 24, max: 720, message: 'Từ 24-720 giờ' }]}
                initialValue={72}
              >
                <InputNumber min={24} max={720} style={{ width: '100%', borderRadius: 8 }} addonAfter="h" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={
                  <Tooltip title="Thời gian timelock trước khi thực thi">
                    <span style={{ fontWeight: 600, color: '#1A1744' }}>Timelock (h)</span>
                  </Tooltip>
                }
                name="timelock_hours"
                rules={[{ required: true, type: 'number', min: 1, max: 168, message: 'Từ 1-168 giờ' }]}
                initialValue={1}
              >
                <InputNumber min={1} max={168} style={{ width: '100%', borderRadius: 8 }} addonAfter="h" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={<span style={{ fontWeight: 600, color: '#1A1744' }}>Governance Token (optional)</span>}
            name="governance_token"
            initialValue="0x5FbDB2315678afecb367f032d93F642f64180aa3"
          >
            <Input
              size="large"
              placeholder="0x... (default: VNDC token)"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600, color: '#1A1744' }}>Metadata URI (optional)</span>}
            name="metadata_uri"
          >
            <Input
              size="large"
              placeholder="ipfs://... (IPFS link cho metadata)"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <Button onClick={() => { setCreateDAOOpen(false); daoForm.resetFields() }} style={{ borderRadius: 8 }}>
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={creatingDAO}
              icon={<ApartmentOutlined />}
              style={{
                background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                border: 'none', borderRadius: 8, fontWeight: 600,
              }}
            >
              Tạo DAO trên Blockchain
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}


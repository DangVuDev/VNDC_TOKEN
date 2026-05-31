import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Card, Typography, Space, Tag, List, Spin, Empty, Row, Col,
  Button, Modal, Form, Input, Select, InputNumber,
  message, Badge, Divider, Alert, Progress, DatePicker,
  Radio, Pagination, Tooltip,
} from 'antd'
import {
  FireOutlined, CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined,
  UserOutlined, PlusOutlined, EditOutlined, BookOutlined,
  LockOutlined, TeamOutlined,
  PlayCircleOutlined, ReadOutlined, QuestionCircleOutlined, GlobalOutlined,
  HistoryOutlined, SafetyCertificateOutlined, DeleteOutlined,
  CalendarOutlined, FieldTimeOutlined, NumberOutlined,
  CheckSquareOutlined, SendOutlined, StarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getActivities, getMyActivityRecords, getActivityRecords,
  createActivity, recordActivity, editActivityRecord,
  enrollActivity, cancelActivityEnrollment, getMyEnrollments, getActivityEnrollments, evaluateEnrollment, submitLearning,
  getActivityRanking,
  type Activity, type ActivityRecord, type Enrollment, type SubmitLearningResponse,
  type CreateActivityInput, type RecordActivityInput, type EditActivityRecordInput,
  type RankEntry,
} from '../lib/services'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text } = Typography
const { TextArea } = Input

// ─── Design tokens (edu-tech palette) ────────────────────────────
const COLORS = {
  primary:   '#4F46E5',
  secondary: '#7C3AED',
  accent:    '#0EA5E9',
  success:   '#10B981',
  warning:   '#F59E0B',
  danger:    '#EF4444',
  surface:   '#F8FAFC',
  border:    '#E2E8F0',
  text:      '#0F172A',
  muted:     '#64748B',
}

const GRADIENT = {
  hero:       'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #0EA5E9 100%)',
  cardActive: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
  cardEvent:  'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
  cardDraft:  'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
  cardMy:     'linear-gradient(135deg, #ECFDF5 0%, #EFF6FF 100%)',
  stat:       'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
}

// ─── CSS animations (injected once at render time) ──────────────
const ACT_STYLES = `
  @keyframes actSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes actPopIn {
    0%   { transform: scale(0.6); opacity: 0;  }
    70%  { transform: scale(1.1);              }
    100% { transform: scale(1);   opacity: 1;  }
  }
  @keyframes actRing {
    0%   { transform: scale(1);   opacity: 0.8; }
    100% { transform: scale(2.8); opacity: 0;   }
  }
  @keyframes actGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
    50%       { box-shadow: 0 0 0 20px rgba(16,185,129,0); }
  }
  .act-card {
    animation: actSlideUp 0.35s ease both;
    transition: transform 0.22s ease, box-shadow 0.22s ease !important;
  }
  .act-card:hover { transform: translateY(-4px) !important; }
  .act-card:nth-child(2) { animation-delay: 0.07s; }
  .act-card:nth-child(3) { animation-delay: 0.14s; }
  .act-card:nth-child(4) { animation-delay: 0.21s; }
  .act-card:nth-child(5) { animation-delay: 0.28s; }
  .act-stat {
    animation: actSlideUp 0.4s ease both;
    transition: transform 0.2s ease !important;
  }
  .act-stat:hover { transform: translateY(-2px) !important; }
  .act-stat:nth-child(2) { animation-delay: 0.08s; }
  .act-stat:nth-child(3) { animation-delay: 0.16s; }
  .act-stat:nth-child(4) { animation-delay: 0.24s; }
  .act-token-pop  { animation: actPopIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }
  .act-token-ring {
    position: absolute; inset: -8px; border-radius: 50%;
    background: rgba(16,185,129,0.4);
    animation: actRing 1.8s ease-out infinite;
  }
  .act-token-glow { animation: actGlow 2s ease-in-out infinite; }
  .act-tab { transition: all 0.2s ease !important; }
`

const RATING_CONFIG = {
  POOR:    { color: '#F59E0B', bg: '#FFFBEB', label: 'Trung bình', icon: '★' },
  AVERAGE: { color: '#0EA5E9', bg: '#EFF6FF', label: 'Khá',        icon: '★★' },
  GOOD:    { color: '#10B981', bg: '#ECFDF5', label: 'Tốt',        icon: '★★★' },
} as const

const STATUS_CONFIG = {
  PENDING:   { color: '#F59E0B', bg: '#FFFBEB', label: 'Chờ xác nhận', icon: <ClockCircleOutlined /> },
  CONFIRMED: { color: '#10B981', bg: '#ECFDF5', label: 'Đã xác nhận',  icon: <CheckCircleOutlined /> },
  LOCKED:    { color: '#EF4444', bg: '#FEF2F2', label: 'Đã khóa',      icon: <LockOutlined /> },
} as const

const ENROLLMENT_STATUS_CONFIG = {
  REGISTERED: { color: '#0EA5E9', bg: '#EFF6FF', label: 'Đã đăng ký' },
  ATTENDED:   { color: '#10B981', bg: '#ECFDF5', label: 'Đã tham gia' },
  ABSENT:     { color: '#EF4444', bg: '#FEF2F2', label: 'Vắng mặt' },
  CANCELLED:  { color: '#64748B', bg: '#F8FAFC', label: 'Đã hủy' },
} as const

const CLUSTER_OPTIONS = [
  { value: 'LEARNING', label: 'Học tập' },
  { value: 'ACTIVITY', label: 'Hoạt động' },
]

const TYPE_OPTIONS = [
  { value: 'READING',  label: 'Đọc tài liệu' },
  { value: 'VIDEO',    label: 'Xem video' },
  { value: 'QUIZ',     label: 'Bài kiểm tra' },
]

const TYPE_HINTS: Record<string, { color: string; bg: string; icon: React.ReactNode; title: string; description: string }> = {
  READING: { color: '#4F46E5', bg: '#EEF2FF', icon: <BookOutlined />, title: 'Hoạt động đọc tài liệu', description: 'Sinh viên đọc tài liệu văn bản. Có thể giới hạn thời gian đọc tối thiểu.' },
  VIDEO:   { color: '#7C3AED', bg: '#F5F3FF', icon: <PlayCircleOutlined />, title: 'Hoạt động xem video', description: 'Sinh viên xem video học tập. Cần cung cấp URL và thời gian xem tối thiểu.' },
  QUIZ:    { color: '#0EA5E9', bg: '#EFF6FF', icon: <QuestionCircleOutlined />, title: 'Bài kiểm tra', description: 'Sinh viên hoàn thành bài quiz. Thiết lập câu hỏi & điểm chuẩn để đạt.' },
}

const CORRECT_LABEL = ['A', 'B', 'C', 'D']

// ─── Helpers ──────────────────────────────────────────────────────

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatTime(secs: number): string {
  if (secs <= 0) return '00:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function typeIcon(t: string) {
  const map: Record<string, React.ReactNode> = {
    READING:  <BookOutlined />,
    VIDEO:    <PlayCircleOutlined />,
    QUIZ:     <QuestionCircleOutlined />,
  }
  return map[t] ?? <FireOutlined />
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    let vid = ''
    if (u.hostname.includes('youtube.com')) vid = u.searchParams.get('v') ?? ''
    else if (u.hostname === 'youtu.be') vid = u.pathname.slice(1)
    if (!vid) return null
    return `https://www.youtube.com/embed/${vid}?autoplay=0&rel=0`
  } catch { return null }
}

// ─── Stat card ────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  return (
    <Card className="act-stat" styles={{ body: { padding: '12px 16px' } }} style={{ borderRadius: 16, border: `1px solid ${color}20`, background: '#fff', boxShadow: `0 2px 10px ${color}12` }}>
      <Space align="center" size={10}>
        {icon && (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 16, flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 500, marginTop: 1 }}>{label}</div>
        </div>
      </Space>
    </Card>
  )
}

// ─── Learning card (LEARNING cluster) ────────────────────────────

function LearningCard({ activity, onDetail }: { activity: Activity; onDetail: (a: Activity) => void }) {
  const isActive = activity.status === 'ACTIVE'
  const clr = TYPE_HINTS[activity.activity_type]?.color ?? COLORS.primary
  const timeLabel = activity.min_time_seconds ? `${Math.round(activity.min_time_seconds / 60)} phút` : null
  const typeEmoji: Record<string, string> = { READING: '📖', VIDEO: '🎬', QUIZ: '📝' }
  return (
    <Card
      className="act-card"
      onClick={() => onDetail(activity)}
      style={{ borderRadius: 18, marginBottom: 10, border: `1.5px solid ${clr}25`, background: 'linear-gradient(135deg, #FAFAFA 0%, #F0F3FF 100%)', overflow: 'hidden', boxShadow: `0 2px 12px ${clr}10`, cursor: 'pointer' }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${clr} 0%, #0EA5E9 100%)` }} />
      <div style={{ padding: '14px 18px 12px' }}>
        <Row gutter={12} align="middle" wrap={false}>
          <Col>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${clr} 0%, #0EA5E9 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              <span>{typeEmoji[activity.activity_type] ?? '📚'}</span>
            </div>
          </Col>
          <Col flex={1} style={{ minWidth: 0 }}>
            <Space direction="vertical" size={3} style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                <Text strong style={{ fontSize: 14, color: '#111827' }}>{activity.title}</Text>
                {!isActive && <Tag color="default" style={{ borderRadius: 8, fontSize: 10, margin: 0 }}>Đã đóng</Tag>}
              </Space>
              <Text style={{ fontSize: 12, color: COLORS.muted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.description}</Text>
              <Space size={6} wrap style={{ marginTop: 2 }}>
                <span style={{ padding: '2px 8px', borderRadius: 8, background: `${clr}15`, color: clr, fontSize: 10, fontWeight: 600 }}>
                  {typeIcon(activity.activity_type)} {activity.activity_type}
                </span>
                {timeLabel && <span style={{ fontSize: 10, color: COLORS.muted }}><FieldTimeOutlined /> {timeLabel}</span>}
                {activity.quiz_questions && activity.quiz_questions.length > 0 && (
                  <span style={{ fontSize: 10, color: COLORS.accent }}><QuestionCircleOutlined /> {activity.quiz_questions.length} câu</span>
                )}
                <span style={{ fontSize: 10, color: COLORS.success, fontWeight: 700 }}><TrophyOutlined /> +{activity.points_per_rating.good} điểm</span>
              </Space>
            </Space>
          </Col>
          <Col>
            <div style={{ color: '#C4C4C4', fontSize: 18, lineHeight: 1 }}>›</div>
          </Col>
        </Row>
      </div>
    </Card>
  )
}

// ─── Task Detail Modal (LEARNING tasks) — full info before starting ──

function TaskDetailModal({ activity, onClose, onStart }: { activity: Activity | null; onClose: () => void; onStart: (a: Activity) => void }) {
  if (!activity) return null
  const tHint = TYPE_HINTS[activity.activity_type]
  const minSecs = activity.min_time_seconds ?? 0
  const timeLabel = minSecs > 0
    ? (minSecs >= 60 ? `${Math.floor(minSecs / 60)} phút${minSecs % 60 ? ` ${minSecs % 60}s` : ''}` : `${minSecs}s`)
    : null
  const embedUrl = activity.content_url ? getYouTubeEmbedUrl(activity.content_url) : null
  const isActive = activity.status === 'ACTIVE'
  const typeEmoji: Record<string, string> = { READING: '📖', VIDEO: '🎬', QUIZ: '📝' }
  return (
    <Modal open={!!activity} onCancel={onClose} footer={null} width={600} destroyOnClose
      styles={{ body: { padding: 0, overflow: 'hidden', borderRadius: 16 } }}>
      {/* Gradient header */}
      <div style={{ padding: '24px 28px 20px', background: `linear-gradient(135deg, ${tHint?.color ?? COLORS.primary} 0%, #0EA5E9 100%)` }}>
        <Space size={14} align="start">
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
            {typeEmoji[activity.activity_type] ?? '📚'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.35, marginBottom: 6 }}>{activity.title}</div>
            <Tag style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
              {tHint?.title ?? activity.activity_type}
            </Tag>
          </div>
        </Space>
      </div>
      {/* Body */}
      <div style={{ padding: '20px 28px 24px', maxHeight: '65vh', overflowY: 'auto' }}>
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          {/* Description */}
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{activity.description}</div>

          {/* Video embed */}
          {activity.activity_type === 'VIDEO' && embedUrl && (
            <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
              <iframe src={embedUrl} width="100%" height="100%" style={{ border: 'none', display: 'block' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={activity.title} />
            </div>
          )}
          {activity.activity_type === 'VIDEO' && !embedUrl && activity.content_url && (
            <Alert type="info" showIcon message={<>Video: <a href={activity.content_url} target="_blank" rel="noopener noreferrer">{activity.content_url}</a></>} style={{ borderRadius: 10 }} />
          )}
          {activity.activity_type === 'READING' && activity.content_url && (
            <Alert type="info" showIcon message={<>Tài liệu: <a href={activity.content_url} target="_blank" rel="noopener noreferrer">Mở tài liệu đọc</a></>} style={{ borderRadius: 10 }} />
          )}

          {/* Meta badges */}
          {(timeLabel || (activity.quiz_questions && activity.quiz_questions.length > 0)) && (
            <Row gutter={[10, 10]}>
              {timeLabel && (
                <Col span={12}>
                  <div style={{ borderRadius: 10, padding: '12px 14px', background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                    <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 3, fontWeight: 500 }}>Thời gian tối thiểu</div>
                    <div style={{ fontWeight: 700, color: COLORS.primary, fontSize: 14 }}><ClockCircleOutlined style={{ marginRight: 6 }} />{timeLabel}</div>
                  </div>
                </Col>
              )}
              {activity.quiz_questions && activity.quiz_questions.length > 0 && (
                <Col span={12}>
                  <div style={{ borderRadius: 10, padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 3, fontWeight: 500 }}>Bài kiểm tra</div>
                    <div style={{ fontWeight: 700, color: COLORS.accent, fontSize: 14 }}><QuestionCircleOutlined style={{ marginRight: 6 }} />{activity.quiz_questions.length} câu hỏi</div>
                  </div>
                </Col>
              )}
            </Row>
          )}

          {/* Points breakdown */}
          <div style={{ borderRadius: 12, padding: '16px', background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700, marginBottom: 12 }}>🏆 Điểm thưởng Token VNDC</div>
            <Row gutter={8}>
              {([
                { label: '★★★ Tốt',    pts: activity.points_per_rating.good,    color: COLORS.success, bg: '#ECFDF5' },
                { label: '★★ Khá',     pts: activity.points_per_rating.average, color: COLORS.accent,  bg: '#EFF6FF' },
                { label: '★ Trung bình', pts: activity.points_per_rating.poor,  color: COLORS.warning, bg: '#FFFBEB' },
              ] as const).map((p) => (
                <Col span={8} key={p.label} style={{ textAlign: 'center' }}>
                  <div style={{ borderRadius: 8, padding: '10px 4px', background: p.bg, border: `1px solid ${p.color}33` }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: p.color }}>{p.pts}</div>
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{p.label}</div>
                  </div>
                </Col>
              ))}
            </Row>
            <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
              💳 Token chuyển tự động vào ví sau khi hoàn thành
            </div>
          </div>

          {/* CTA */}
          {isActive ? (
            <Button type="primary" size="large" block icon={<PlayCircleOutlined />}
              onClick={() => { onClose(); onStart(activity) }}
              style={{ height: 50, borderRadius: 14, fontWeight: 700, fontSize: 15, background: `linear-gradient(135deg, ${tHint?.color ?? COLORS.primary} 0%, #0EA5E9 100%)`, border: 'none' }}>
              Bắt đầu học ngay →
            </Button>
          ) : (
            <Alert type="warning" showIcon message="Hoạt động này đã đóng, không thể tham gia." style={{ borderRadius: 10 }} />
          )}
        </Space>
      </div>
    </Modal>
  )
}

// ─── Event card (ACTIVITY cluster) — clickable, opens detail modal ──

function EventCard({
  activity, myEnrollment, onClick,
}: {
  activity: Activity
  myEnrollment?: Enrollment
  onClick: (a: Activity) => void
}) {
  const isActive = activity.status === 'ACTIVE'
  const es = myEnrollment ? ENROLLMENT_STATUS_CONFIG[myEnrollment.status as keyof typeof ENROLLMENT_STATUS_CONFIG] : null
  const enrolled = !!myEnrollment
  const eventEnd = activity.event_ends_at ? new Date(activity.event_ends_at) : null
  return (
    <Card
      className="act-card"
      onClick={() => onClick(activity)}
      style={{ borderRadius: 18, marginBottom: 10, border: `1.5px solid ${COLORS.success}25`, background: 'linear-gradient(135deg, #FAFFFC 0%, #F0FDF4 100%)', overflow: 'hidden', boxShadow: `0 2px 12px ${COLORS.success}10`, cursor: 'pointer' }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${COLORS.success} 0%, #0EA5E9 100%)` }} />
      <div style={{ padding: '14px 18px 12px' }}>
        <Row gutter={12} align="middle" wrap={false}>
          <Col>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${COLORS.success} 0%, #0EA5E9 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              <span>📅</span>
            </div>
          </Col>
          <Col flex={1} style={{ minWidth: 0 }}>
            <Space direction="vertical" size={3} style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                <Text strong style={{ fontSize: 14, color: '#111827' }}>{activity.title}</Text>
                {!isActive && <Tag color="default" style={{ borderRadius: 8, fontSize: 10, margin: 0 }}>Đã đóng</Tag>}
              </Space>
              <Text style={{ fontSize: 12, color: COLORS.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{activity.description}</Text>
              <Space size={8} wrap style={{ marginTop: 2 }}>
                {activity.expires_at && (
                  <span style={{ fontSize: 10, color: COLORS.warning }}><CalendarOutlined /> Đăng ký đến: {new Date(activity.expires_at).toLocaleDateString('vi-VN')}</span>
                )}
                {eventEnd && (
                  <span style={{ fontSize: 10, color: COLORS.accent }}><CalendarOutlined /> Kết thúc: {eventEnd.toLocaleDateString('vi-VN')}</span>
                )}
                <span style={{ fontSize: 10, color: COLORS.success, fontWeight: 700 }}><TrophyOutlined /> +{activity.points_per_rating.good} điểm</span>
                {enrolled && es && (
                  <span style={{ padding: '1px 7px', borderRadius: 7, background: es.bg, color: es.color, fontSize: 10, fontWeight: 700 }}>✓ {es.label}</span>
                )}
              </Space>
            </Space>
          </Col>
          <Col>
            <div style={{ color: '#C4C4C4', fontSize: 18, lineHeight: 1 }}>›</div>
          </Col>
        </Row>
      </div>
    </Card>
  )
}

// ─── Event Detail Modal ───────────────────────────────────────────

function EventDetailModal({
  activity, myEnrollment, onClose, onEnrolled,
}: {
  activity: Activity | null
  myEnrollment?: Enrollment
  onClose: () => void
  onEnrolled: () => void
}) {
  const [enrolling, setEnrolling] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [enrollmentCount, setEnrollmentCount] = useState(0)

  const es = myEnrollment ? ENROLLMENT_STATUS_CONFIG[myEnrollment.status as keyof typeof ENROLLMENT_STATUS_CONFIG] : null
  const isActive = activity?.status === 'ACTIVE'
  const registrationDeadline = activity?.expires_at ? new Date(activity.expires_at) : null
  const eventEndTime = activity?.event_ends_at ? new Date(activity.event_ends_at) : null
  const isPast = registrationDeadline ? registrationDeadline < new Date() : false
  const isFull = activity?.max_slots ? enrollmentCount >= activity.max_slots : false
  const canCancel = !!myEnrollment && myEnrollment.status === 'REGISTERED' && !isPast

  // Fetch enrollment count when activity changes
  useEffect(() => {
    if (!activity) return
    const fetchCount = async () => {
      try {
        const result = await getActivityEnrollments(activity.id)
        setEnrollmentCount((result.enrollments ?? []).filter((e) => e.status === 'REGISTERED').length)
      } catch (e) {
        console.error('Failed to fetch enrollment count:', e)
      }
    }
    void fetchCount()
  }, [activity?.id])

  if (!activity) return null

  async function handleEnroll() {
    setEnrolling(true)
    try {
      await enrollActivity(activity!.id)
      void message.success('Đăng ký thành công!')
      // Refresh enrollment count after successful enrollment
      const result = await getActivityEnrollments(activity!.id)
      setEnrollmentCount((result.enrollments ?? []).filter((e) => e.status === 'REGISTERED').length)
      onEnrolled()
      onClose()
    } catch (e: unknown) {
      void message.error((e as Error)?.message ?? 'Đăng ký thất bại')
    } finally { setEnrolling(false) }
  }

  async function handleCancelEnrollment() {
    if (!activity) return
    setCancelling(true)
    try {
      await cancelActivityEnrollment(activity.id)
      void message.success('Đã hủy đăng ký thành công')
      const result = await getActivityEnrollments(activity.id)
      setEnrollmentCount((result.enrollments ?? []).filter((e) => e.status === 'REGISTERED').length)
      onEnrolled()
      onClose()
    } catch (e: unknown) {
      void message.error((e as Error)?.message ?? 'Hủy đăng ký thất bại')
    } finally { setCancelling(false) }
  }

  return (
    <Modal
      open={!!activity}
      onCancel={onClose}
      title={
        <Space>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: COLORS.success, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <CalendarOutlined />
          </div>
          <span>{activity.title}</span>
        </Space>
      }
      footer={null}
      width={560}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ width: '100%', paddingTop: 8 }}>
        {/* Description */}
        <div style={{ borderRadius: 12, padding: '14px 16px', background: GRADIENT.cardEvent, border: `1px solid ${COLORS.success}33` }}>
          <Text style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>{activity.description}</Text>
        </div>

        {/* Info grid */}
        <Row gutter={[12, 12]}>
          {registrationDeadline && (
            <Col span={12}>
              <div style={{ borderRadius: 10, padding: '12px 14px', background: isPast ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${isPast ? '#FCA5A5' : '#FDE68A'}` }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Hạn đăng ký</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isPast ? COLORS.danger : COLORS.warning }}>
                  <CalendarOutlined style={{ marginRight: 6 }} />
                  {registrationDeadline.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {isPast && <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 2 }}>Đã hết hạn đăng ký</div>}
              </div>
            </Col>
          )}
          {eventEndTime && (
            <Col span={12}>
              <div style={{ borderRadius: 10, padding: '12px 14px', background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Kết thúc sự kiện</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
                  <CalendarOutlined style={{ marginRight: 6 }} />
                  {eventEndTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </Col>
          )}
          {activity.max_slots && (
            <Col span={12}>
              <div style={{ borderRadius: 10, padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Số lượng</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isFull ? '#EF4444' : COLORS.accent }}>
                  <TeamOutlined style={{ marginRight: 6 }} />{enrollmentCount}/{activity.max_slots} người
                </div>
              </div>
            </Col>
          )}
          {activity.content_url && (
            <Col span={24}>
              <div style={{ borderRadius: 10, padding: '12px 14px', background: '#F8FAFC', border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Thông tin sự kiện</div>
                <a href={activity.content_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: COLORS.accent, wordBreak: 'break-all' }}>
                  <GlobalOutlined style={{ marginRight: 6 }} />{activity.content_url}
                </a>
              </div>
            </Col>
          )}
        </Row>

        {/* Points breakdown */}
        <div style={{ borderRadius: 12, padding: '14px 16px', background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, fontWeight: 600 }}>Điểm thưởng sau đánh giá</div>
          <Row gutter={8}>
            {[
              { label: 'Tốt ★★★',      val: activity.points_per_rating.good,    color: COLORS.success },
              { label: 'Khá ★★',       val: activity.points_per_rating.average, color: COLORS.accent },
              { label: 'Trung bình ★', val: activity.points_per_rating.poor,    color: COLORS.warning },
            ].map((p) => (
              <Col span={8} key={p.label} style={{ textAlign: 'center' }}>
                <div style={{ borderRadius: 8, padding: '8px 4px', background: '#fff' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: p.color }}>{p.val}</div>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{p.label}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        {/* Enroll action */}
        <div style={{ textAlign: 'center', paddingBottom: 4 }}>
          {es ? (
            <div style={{ padding: '14px', borderRadius: 12, background: es.bg, border: `1px solid ${es.color}33` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: es.color }}>
                <CheckCircleOutlined style={{ marginRight: 8 }} />{es.label}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Bạn đã đăng ký sự kiện này. Admin sẽ đánh giá sau khi sự kiện kết thúc.</div>
              {canCancel && (
                <Button danger style={{ marginTop: 10, borderRadius: 10 }} loading={cancelling} onClick={handleCancelEnrollment}>
                  Hủy đăng ký
                </Button>
              )}
            </div>
          ) : (
            <>
              {(!isActive || isPast) ? (
                <Alert type="warning" showIcon message="Sự kiện không còn nhận đăng ký." style={{ borderRadius: 10 }} />
              ) : isFull ? (
                <Alert type="error" showIcon message="Sự kiện đã đủ số lượng người đăng ký." style={{ borderRadius: 10 }} />
              ) : (
                <Button
                  type="primary" size="large" icon={<UserOutlined />}
                  loading={enrolling}
                  onClick={handleEnroll}
                  block
                  style={{ borderRadius: 12, height: 46, fontWeight: 700, background: `linear-gradient(135deg, ${COLORS.success} 0%, #0EA5E9 100%)`, border: 'none', fontSize: 15 }}
                >
                  Đăng ký tham gia
                </Button>
              )}
            </>
          )}
        </div>
      </Space>
    </Modal>
  )
}

// ─── Learning Modal ───────────────────────────────────────────────

interface LearningModalProps {
  activity: Activity | null
  onClose: () => void
  onDone: () => void
}

function LearningModal({ activity, onClose, onDone }: LearningModalProps) {
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitLearningResponse | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const minTime = activity?.min_time_seconds ?? 0
  const timeDone = timeElapsed >= minTime
  const hasQuiz = (activity?.quiz_questions?.length ?? 0) > 0
  const showQuiz = (activity?.activity_type === 'QUIZ') || (timeDone && hasQuiz)
  const canSubmit = activity?.activity_type === 'QUIZ'
    ? hasQuiz && Object.keys(quizAnswers).length === (activity?.quiz_questions?.length ?? 0)
    : timeDone

  // Start timer when modal opens (not for QUIZ type)
  useEffect(() => {
    if (!activity || activity.activity_type === 'QUIZ') return
    setTimeElapsed(0)
    timerRef.current = setInterval(() => setTimeElapsed((t) => t + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activity?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop timer when time requirement is met
  useEffect(() => {
    if (timeDone && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [timeDone])

  function handleClose() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeElapsed(0)
    setQuizAnswers({})
    setResult(null)
    onClose()
  }

  async function handleSubmit() {
    if (!activity) return
    setSubmitting(true)
    try {
      const answers = Object.entries(quizAnswers).map(([qid, idx]) => ({ question_id: qid, answer_index: idx }))
      const res = await submitLearning(activity.id, {
        time_spent_seconds: Math.max(timeElapsed, 1),
        quiz_answers: answers.length > 0 ? answers : undefined,
      })
      setResult(res)
      if (timerRef.current) clearInterval(timerRef.current)
    } catch (e: unknown) {
      void message.error((e as Error)?.message ?? 'Nộp bài thất bại')
    } finally { setSubmitting(false) }
  }

  if (!activity) return null

  const embedUrl = activity.content_url ? getYouTubeEmbedUrl(activity.content_url) : null
  const timePct = minTime > 0 ? Math.min(100, Math.round((timeElapsed / minTime) * 100)) : 100
  const ratingCfg = result ? RATING_CONFIG[result.rating as keyof typeof RATING_CONFIG] : null

  return (
    <Modal
      open={!!activity}
      onCancel={handleClose}
      title={
        <Space>
          <span style={{ color: TYPE_HINTS[activity.activity_type]?.color }}>{typeIcon(activity.activity_type)}</span>
          <span>{activity.title}</span>
        </Space>
      }
      footer={null}
      width={720}
      styles={{ body: { maxHeight: '80vh', overflowY: 'auto', padding: '16px 20px' } }}
      destroyOnClose
    >
      {/* ── Result screen ── */}
      {result ? (
        <div style={{ textAlign: 'center', padding: '24px 8px 32px' }}>
          {/* Trophy emoji */}
          <div className="act-token-pop" style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>
            {result.rating === 'GOOD' ? '🏆' : result.rating === 'AVERAGE' ? '🎯' : '📚'}
          </div>
          <Title level={3} style={{ color: ratingCfg?.color, marginBottom: 16, marginTop: 4 }}>
            {ratingCfg?.icon} {ratingCfg?.label}
          </Title>
          {/* Animated token orb */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ position: 'relative', width: 110, height: 110 }}>
              <div className="act-token-ring" />
              <div className="act-token-glow" style={{ width: 110, height: 110, borderRadius: '50%', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', boxShadow: '0 8px 32px rgba(16,185,129,0.4)', position: 'relative' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1 }}>+{result.points}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginTop: 2 }}>ĐIỂM</div>
              </div>
            </div>
          </div>
          {result.quiz_score !== undefined && (
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
              Bài kiểm tra: <strong style={{ color: result.quiz_passed ? COLORS.success : COLORS.danger }}>{result.quiz_score}%</strong>
              {' '}{result.quiz_passed ? '✅ Đạt' : '❌ Chưa đạt'}
            </div>
          )}
          {/* Token notice */}
          <div style={{ borderRadius: 14, padding: '12px 20px', background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', border: '1px solid #6EE7B7', margin: '0 auto 20px', maxWidth: 320, display: 'inline-block' }}>
            <div style={{ fontSize: 14, color: '#065F46', fontWeight: 700 }}>
              💳 Token đã chuyển tự động vào ví!
            </div>
            <div style={{ fontSize: 12, color: '#047857', marginTop: 3 }}>{result.message}</div>
          </div>
          <br />
          <Button type="primary" size="large"
            style={{ borderRadius: 12, background: GRADIENT.hero, border: 'none', fontWeight: 700, height: 46, minWidth: 160, fontSize: 15 }}
            onClick={() => { setResult(null); onDone(); handleClose() }}>
            Tuyệt vời! 🎉
          </Button>
        </div>
      ) : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {/* ── VIDEO content ── */}
          {activity.activity_type === 'VIDEO' && (
            <>
              {embedUrl ? (
                <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
                  <iframe src={embedUrl} width="100%" height="100%" style={{ border: 'none', display: 'block' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              ) : activity.content_url ? (
                <Alert type="info" showIcon message={<>Mở video: <a href={activity.content_url} target="_blank" rel="noopener noreferrer">{activity.content_url}</a></>} style={{ borderRadius: 10 }} />
              ) : null}
            </>
          )}

          {/* ── READING content ── */}
          {activity.activity_type === 'READING' && activity.content_url && (
            <Alert
              type="info" showIcon
              message={<Space><BookOutlined /><span>Tài liệu học tập:</span><a href={activity.content_url} target="_blank" rel="noopener noreferrer">Mở tài liệu</a></Space>}
              style={{ borderRadius: 10 }}
            />
          )}

          {/* ── Timer ── */}
          {activity.activity_type !== 'QUIZ' && minTime > 0 && (
            <div style={{ borderRadius: 14, padding: '16px 20px', background: timeDone ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${timeDone ? '#6EE7B7' : COLORS.border}` }}>
              <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                <Space>
                  <ClockCircleOutlined style={{ color: timeDone ? COLORS.success : COLORS.warning }} />
                  <Text strong style={{ color: timeDone ? COLORS.success : COLORS.text }}>
                    {timeDone ? 'Đã đủ thời gian!' : 'Thời gian học tập'}
                  </Text>
                </Space>
                <Text style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: timeDone ? COLORS.success : COLORS.primary }}>
                  {formatTime(timeElapsed)} / {formatTime(minTime)}
                </Text>
              </Space>
              <Progress percent={timePct} strokeColor={timeDone ? COLORS.success : COLORS.primary} showInfo={false} status={timeDone ? 'success' : 'active'} />
              {!timeDone && (
                <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 6, display: 'block' }}>
                  Còn {formatTime(minTime - timeElapsed)} - tiếp tục học để mở khóa bài kiểm tra
                </Text>
              )}
            </div>
          )}

          {/* ── Quiz section ── */}
          {showQuiz && activity.quiz_questions && activity.quiz_questions.length > 0 && (
            <div>
              <Divider style={{ margin: '4px 0 16px' }}>
                <Space><QuestionCircleOutlined style={{ color: COLORS.accent }} /><Text strong style={{ color: COLORS.accent }}>Bài kiểm tra</Text></Space>
              </Divider>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {activity.quiz_questions.map((q, idx) => (
                  <Card key={q.id} style={{ borderRadius: 14, border: `1px solid ${COLORS.border}` }} bodyStyle={{ padding: '16px 18px' }}>
                    <Text strong style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 12 }}>
                      Câu {idx + 1}: {q.question}
                    </Text>
                    <Radio.Group
                      value={quizAnswers[q.id]}
                      onChange={(e) => setQuizAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {q.options.map((opt, optIdx) => (
                          <Radio key={optIdx} value={optIdx} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: quizAnswers[q.id] === optIdx ? '#EEF2FF' : 'transparent' }}>
                            <Space>
                              <span style={{ fontWeight: 700, color: COLORS.primary }}>{CORRECT_LABEL[optIdx]}.</span>
                              <span>{opt}</span>
                            </Space>
                          </Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  </Card>
                ))}
              </Space>
            </div>
          )}

          {/* ── Submit button ── */}
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <Button
              type="primary" icon={<SendOutlined />} size="large"
              disabled={!canSubmit} loading={submitting}
              onClick={handleSubmit}
              style={{ borderRadius: 12, background: canSubmit ? GRADIENT.hero : undefined, border: 'none', fontWeight: 700, height: 46, minWidth: 160 }}
            >
              {activity.activity_type === 'QUIZ' ? 'Nộp bài' : timeDone ? 'Nộp bài' : `Đang học... ${timePct}%`}
            </Button>
          </div>
        </Space>
      )}
    </Modal>
  )
}

// ─── Countdown Timer component ────────────────────────────────────

function CountdownTimer({ seconds: initial }: { seconds: number }) {
  const [secs, setSecs] = useState(Math.max(0, initial))
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (secs <= 0) return
    ref.current = setInterval(() => setSecs((s) => { if (s <= 1) { clearInterval(ref.current!); return 0 } return s - 1 }), 1000)
    return () => clearInterval(ref.current!)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const urgent = secs < 3600
  return (
    <Space>
      <ClockCircleOutlined style={{ color: urgent ? COLORS.danger : COLORS.warning }} />
      <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: urgent ? COLORS.danger : COLORS.warning, fontSize: 13 }}>
        {formatTime(secs)}
      </Text>
    </Space>
  )
}

// ─── Record card ──────────────────────────────────────────────────

function RecordCard({ record, showEdit, onEdit }: { record: ActivityRecord; showEdit?: boolean; onEdit?: (r: ActivityRecord) => void }) {
  const rCfg = RATING_CONFIG[record.rating]
  const sCfg = STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
  return (
    <Card style={{ borderRadius: 14, marginBottom: 10, border: `1px solid ${rCfg.color}20`, background: '#FAFAFA', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }} styles={{ body: { padding: '12px 16px' } }}>
      <Row gutter={12} align="middle">
        <Col>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${rCfg.color} 0%, ${rCfg.color}BB 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', boxShadow: `0 3px 10px ${rCfg.color}30` }}>
            <TrophyOutlined />
          </div>
        </Col>
        <Col flex={1}>
          <Space direction="vertical" size={3} style={{ width: '100%' }}>
            <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
              <Space direction="vertical" size={1}>
                {record.activity_title && <Text strong style={{ fontSize: 13, color: '#111827' }}>{record.activity_title}</Text>}
                <Text style={{ fontSize: 11, color: COLORS.muted, fontFamily: 'monospace' }}>{shortAddr(record.student_address)}</Text>
              </Space>
              <Space size={4}>
                <span style={{ padding: '2px 8px', borderRadius: 8, background: rCfg.bg, color: rCfg.color, fontSize: 10, fontWeight: 700 }}>{rCfg.icon} {rCfg.label}</span>
                <span style={{ padding: '2px 8px', borderRadius: 8, background: sCfg.bg, color: sCfg.color, fontSize: 10, fontWeight: 600 }}>{sCfg.label}</span>
              </Space>
            </Space>
            <Space size={8} wrap>
              <Text style={{ fontSize: 13, color: COLORS.success, fontWeight: 800 }}>+{record.points} điểm</Text>
              {record.status === 'CONFIRMED' && (
                <span style={{ fontSize: 10, color: '#065F46', background: '#ECFDF5', padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>💳 Token đã nhận</span>
              )}
              {record.can_edit && <CountdownTimer seconds={record.time_remaining} />}
              {showEdit && record.can_edit && onEdit && (
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} style={{ borderRadius: 8, borderColor: COLORS.warning, color: COLORS.warning, height: 22, fontSize: 11, padding: '0 8px' }}>Sửa</Button>
              )}
            </Space>
            <Text style={{ fontSize: 10, color: '#9CA3AF' }}><HistoryOutlined style={{ marginRight: 4 }} />{new Date(record.created_at).toLocaleString('vi-VN')}</Text>
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Type-specific form fields ────────────────────────────────────

function TypeSpecificFields({ activityType }: { activityType: string | undefined }) {
  const hint = activityType ? TYPE_HINTS[activityType] : null
  if (!activityType) return <Alert type="info" showIcon message="Chọn loại hoạt động để hiển thị cấu hình chi tiết" style={{ borderRadius: 10, marginTop: 8 }} />
  return (
    <div>
      {hint && (
        <div style={{ borderRadius: 12, padding: '14px 16px', marginBottom: 20, background: hint.bg, border: `1px solid ${hint.color}33`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: hint.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}>{hint.icon}</div>
          <div>
            <div style={{ fontWeight: 700, color: hint.color, fontSize: 14, marginBottom: 2 }}>{hint.title}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>{hint.description}</div>
          </div>
        </div>
      )}

      {/* READING */}
      {activityType === 'READING' && (
        <>
          <Divider style={{ fontSize: 13, color: COLORS.muted, margin: '4px 0 16px' }}><Space><BookOutlined />Cấu hình tài liệu</Space></Divider>
          <Form.Item name="content_url" label="URL tài liệu" rules={[{ required: true, message: 'Vui lòng cung cấp URL' }, { type: 'url', message: 'URL không hợp lệ' }]} extra="Link PDF, Google Drive, hoặc trang web học tập">
            <Input placeholder="https://drive.google.com/file/..." prefix={<BookOutlined style={{ color: COLORS.muted }} />} style={{ borderRadius: 10 }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="min_time_seconds" label={<><FieldTimeOutlined /> Thời gian đọc tối thiểu</>} extra="Giây">
                <InputNumber min={0} addonAfter="giây" style={{ width: '100%', borderRadius: 10 }} placeholder="0 = không giới hạn" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="min_quiz_score" label={<><CheckSquareOutlined /> Điểm quiz tối thiểu</>} extra="%">
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%', borderRadius: 10 }} placeholder="0 = không yêu cầu" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="expires_at" label={<><CalendarOutlined /> Hạn chót tham gia</>}>
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%', borderRadius: 10 }} placeholder="Không có hạn chót" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
        </>
      )}

      {/* VIDEO */}
      {activityType === 'VIDEO' && (
        <>
          <Divider style={{ fontSize: 13, color: COLORS.muted, margin: '4px 0 16px' }}><Space><PlayCircleOutlined />Cấu hình video</Space></Divider>
          <Form.Item name="content_url" label="URL video" rules={[{ required: true, message: 'Vui lòng cung cấp URL video' }, { type: 'url', message: 'URL không hợp lệ' }]} extra="YouTube, Vimeo, hoặc URL video trực tiếp">
            <Input placeholder="https://youtube.com/watch?v=..." prefix={<PlayCircleOutlined style={{ color: COLORS.muted }} />} style={{ borderRadius: 10 }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="min_time_seconds" label={<><FieldTimeOutlined /> Thời gian xem tối thiểu</>} rules={[{ required: true, message: 'Nhập thời gian xem' }]} extra="Giây">
                <InputNumber min={1} addonAfter="giây" style={{ width: '100%', borderRadius: 10 }} placeholder="VD: 1800 = 30 phút" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="min_quiz_score" label={<><CheckSquareOutlined /> Điểm quiz tối thiểu</>} extra="%">
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%', borderRadius: 10 }} placeholder="0 = không yêu cầu" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="expires_at" label={<><CalendarOutlined /> Hạn chót</>}>
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%', borderRadius: 10 }} placeholder="Không có hạn chót" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
        </>
      )}

      {/* QUIZ */}
      {activityType === 'QUIZ' && (
        <>
          <Divider style={{ fontSize: 13, color: COLORS.muted, margin: '4px 0 16px' }}><Space><QuestionCircleOutlined />Cấu hình bài kiểm tra</Space></Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="min_quiz_score" label={<><CheckSquareOutlined /> Điểm tối thiểu để đạt</>} rules={[{ required: true, message: 'Nhập điểm tối thiểu' }]} extra="% số câu đúng">
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%', borderRadius: 10 }} placeholder="VD: 70" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_slots" label={<><NumberOutlined /> Số lượng giới hạn</>}>
                <InputNumber min={1} style={{ width: '100%', borderRadius: 10 }} placeholder="Không giới hạn" />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '16px 16px 8px', border: '1px solid #E2E8F0', marginBottom: 16 }}>
            <Space style={{ marginBottom: 12 }}>
              <QuestionCircleOutlined style={{ color: COLORS.accent }} />
              <Text strong style={{ fontSize: 13 }}>Câu hỏi trắc nghiệm</Text>
              <Tag color="blue" style={{ fontSize: 11 }}>Mỗi câu có 4 lựa chọn</Tag>
            </Space>
            <Form.List name="quiz_questions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, idx) => (
                    <Card key={field.key} style={{ borderRadius: 12, marginBottom: 12, border: '1px solid #BFDBFE' }} bodyStyle={{ padding: 16 }}>
                      <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                        <Text strong style={{ color: COLORS.primary, fontSize: 13 }}>Câu {idx + 1}</Text>
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>Xóa</Button>
                      </Space>
                      <Form.Item name={[field.name, 'id']} hidden initialValue={`q-${Date.now()}-${idx}`}><Input /></Form.Item>
                      <Form.Item name={[field.name, 'question']} rules={[{ required: true, message: 'Nhập câu hỏi' }]} style={{ marginBottom: 10 }}>
                        <Input.TextArea rows={2} placeholder={`Câu hỏi ${idx + 1}...`} style={{ borderRadius: 8 }} />
                      </Form.Item>
                      <Row gutter={[8, 8]}>
                        {[0, 1, 2, 3].map((optIdx) => (
                          <Col span={12} key={optIdx}>
                            <Form.Item name={[field.name, 'options', optIdx]} rules={[{ required: true, message: `Nhập đáp án ${CORRECT_LABEL[optIdx]}` }]} style={{ marginBottom: 0 }}>
                              <Input placeholder={`Đáp án ${CORRECT_LABEL[optIdx]}`} style={{ borderRadius: 8 }} prefix={<span style={{ width: 18, height: 18, borderRadius: '50%', background: COLORS.border, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: COLORS.muted, flexShrink: 0 }}>{CORRECT_LABEL[optIdx]}</span>} />
                            </Form.Item>
                          </Col>
                        ))}
                      </Row>
                      <Form.Item name={[field.name, 'correct_index']} label="Đáp án đúng" rules={[{ required: true, message: 'Chọn đáp án đúng' }]} style={{ marginTop: 10, marginBottom: 0 }}>
                        <Select placeholder="Chọn đáp án đúng" style={{ borderRadius: 8 }} options={[0, 1, 2, 3].map((i) => ({ value: i, label: <Space><span style={{ fontWeight: 700, color: COLORS.success }}>{CORRECT_LABEL[i]}</span><span>— Đáp án {CORRECT_LABEL[i]}</span></Space> }))} />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ id: `q-${Date.now()}`, question: '', options: ['', '', '', ''], correct_index: undefined })} style={{ borderRadius: 10, borderColor: COLORS.accent, color: COLORS.accent, height: 40 }}>
                    Thêm câu hỏi
                  </Button>
                </>
              )}
            </Form.List>
          </div>
          <Form.Item name="expires_at" label={<><CalendarOutlined /> Hạn chót nộp bài</>}>
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%', borderRadius: 10 }} placeholder="Không có hạn chót" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
        </>
      )}
    </div>
  )
}

// ─── Main page component ──────────────────────────────────────────

interface ActivitiesPageProps { user?: AuthUser }

export function ActivitiesPage({ user }: ActivitiesPageProps) {
  const isLecturer = user?.roles?.some((r) => r === 'LECTURER' || r === 'ADMIN') ?? false

  // ── State ─────────────────────────────────────────────────────
  const [activities,       setActivities]       = useState<Activity[]>([])
  const [myRecords,        setMyRecords]         = useState<ActivityRecord[]>([])
  const [myEnrollments,    setMyEnrollments]     = useState<Enrollment[]>([])
  const [adminEnrollments, setAdminEnrollments]  = useState<Enrollment[]>([])
  const [adminActivity,    setAdminActivity]     = useState<Activity | null>(null)
  const [loading,          setLoading]           = useState(true)
  const [activeTab,        setActiveTab]         = useState('learning')

  // Ranking
  const [ranking,       setRanking]       = useState<RankEntry[]>([])
  const [rankTotal,     setRankTotal]     = useState(0)
  const [rankPage,      setRankPage]      = useState(1)
  const [rankLoading,   setRankLoading]   = useState(false)

  // My records pagination
  const [myRecordsPage,  setMyRecordsPage]  = useState(1)
  const [myRecordsTotal, setMyRecordsTotal] = useState(0)
  const myRecordsLimit = 10

  // Learning modal
  const [learningActivity, setLearningActivity] = useState<Activity | null>(null)

  // Task detail modal (LEARNING activities — shown before starting)
  const [taskDetailActivity, setTaskDetailActivity] = useState<Activity | null>(null)

  // Event detail modal
  const [eventDetail, setEventDetail] = useState<Activity | null>(null)

  // Admin evaluate modal
  const [showEval,    setShowEval]    = useState(false)
  const [evalTarget,  setEvalTarget]  = useState<Enrollment | null>(null)
  const [evalSaving,  setEvalSaving]  = useState(false)
  const [evalForm]  = Form.useForm()

  // Admin records panel
  const [actRecords,  setActRecords]  = useState<ActivityRecord[]>([])
  const [recLoading,  setRecLoading]  = useState(false)
  const [showRecord, setShowRecord] = useState(false)
  const [editTarget, setEditTarget] = useState<ActivityRecord | null>(null)
  const [showEdit,   setShowEdit]   = useState(false)
  const [saving,     setSaving]     = useState(false)

  // Create activity modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm] = Form.useForm()
  const [recordForm] = Form.useForm()
  const [editForm]   = Form.useForm()
  const selectedType    = Form.useWatch('activity_type', createForm) as string | undefined
  const selectedCluster = Form.useWatch('cluster', createForm) as string | undefined

  // ── Load data ─────────────────────────────────────────────────

  const loadAll = useCallback(async (recordsPage = 1) => {
    setLoading(true)
    try {
      const [actData, recData, enrollData] = await Promise.all([
        getActivities().catch(() => ({ activities: [], total: 0 })),
        getMyActivityRecords(recordsPage, myRecordsLimit).catch(() => ({ records: [], total: 0, page: 1, limit: myRecordsLimit })),
        getMyEnrollments().catch(() => ({ enrollments: [], total: 0 })),
      ])
      setActivities(actData.activities ?? [])
      setMyRecords(recData.records ?? [])
      setMyRecordsTotal(recData.total ?? 0)
      setMyEnrollments(enrollData.enrollments ?? [])
    } finally {
      setLoading(false)
    }
  }, [myRecordsLimit])

  useEffect(() => { void loadAll() }, [loadAll])

  const loadRanking = useCallback(async (page = 1) => {
    setRankLoading(true)
    try {
      const data = await getActivityRanking(page, 20)
      setRanking(data.entries ?? [])
      setRankTotal(data.total ?? 0)
      setRankPage(page)
    } catch { /* ignore */ }
    finally { setRankLoading(false) }
  }, [])

  // ── Derived data ──────────────────────────────────────────────

  const learningActivities = activities.filter((a) => a.cluster === 'LEARNING')
  const activityActivities = activities.filter((a) => a.cluster === 'ACTIVITY')
  const activeActs = activities.filter((a) => a.status === 'ACTIVE')
  const confirmedPts = myRecords.filter((r) => r.status === 'CONFIRMED').reduce((s, r) => s + r.points, 0)
  const pendingPts   = myRecords.filter((r) => r.status === 'PENDING').reduce((s, r) => s + r.points, 0)
  const editableRecs = myRecords.filter((r) => r.can_edit)
  const topThree = [...ranking].filter((e) => e.rank <= 3).sort((a, b) => a.rank - b.rank)
  const nextTopTen = [...ranking].filter((e) => e.rank > 3 && e.rank <= 13).sort((a, b) => a.rank - b.rank)
  const myWallet = (user?.wallet_address ?? '').toLowerCase()
  const myRankEntry = myWallet ? ranking.find((e) => e.student_wallet.toLowerCase() === myWallet) : undefined

  function getMyEnrollment(activityId: string): Enrollment | undefined {
    return myEnrollments.find((e) => e.activity_id === activityId)
  }

  // ── Handlers ──────────────────────────────────────────────────

  async function handleCreate(values: Record<string, unknown>) {
    setSaving(true)
    try {
      // Prepare payload based on cluster
      const cluster = values.cluster as string
      const payload: CreateActivityInput = {
        ...(values as unknown as CreateActivityInput),
        expires_at: values.expires_at ? (values.expires_at as ReturnType<typeof dayjs>).toISOString() : undefined,
        event_ends_at: values.event_ends_at ? (values.event_ends_at as ReturnType<typeof dayjs>).toISOString() : undefined,
      }
      // ACTIVITY cluster: remove activity_type
      if (cluster === 'ACTIVITY') {
        delete (payload as any).activity_type
      }
      await createActivity(payload)
      void message.success('Tạo hoạt động thành công!')
      setShowCreate(false)
      createForm.resetFields()
      void loadAll()
    } catch (e: unknown) {
      void message.error((e as Error)?.message ?? 'Tạo thất bại')
    } finally { setSaving(false) }
  }

  async function loadAdminEnrollments(activity: Activity) {
    setAdminActivity(activity)
    setAdminEnrollments([])
    setActRecords([])
    setActiveTab('manage')
    setRecLoading(true)
    try {
      const [enData, recData] = await Promise.all([
        getActivityEnrollments(activity.id),
        getActivityRecords(activity.id).catch(() => ({ records: [] })),
      ])
      setAdminEnrollments(enData.enrollments ?? [])
      setActRecords(recData.records ?? [])
    } catch { void message.error('Không thể tải dữ liệu') }
    finally { setRecLoading(false) }
  }

  async function handleEvaluate(values: { rating: string }) {
    if (!evalTarget || !adminActivity) return
    setEvalSaving(true)
    try {
      await evaluateEnrollment(adminActivity.id, evalTarget.id, { rating: values.rating as 'POOR' | 'AVERAGE' | 'GOOD' })
      void message.success('Đánh giá thành công! Đã tạo record PENDING và đưa thưởng vào hàng đợi xử lý on-chain.')
      setShowEval(false)
      evalForm.resetFields()
      setEvalTarget(null)
      await loadAdminEnrollments(adminActivity)
    } catch (e: unknown) {
      void message.error((e as Error)?.message ?? 'Đánh giá thất bại')
    } finally { setEvalSaving(false) }
  }

  async function handleRecord(values: RecordActivityInput) {
    if (!adminActivity) return
    setSaving(true)
    try {
      await recordActivity(adminActivity.id, values)
      void message.success('Ghi nhận thành công! Đã tạo record PENDING và đưa thưởng vào hàng đợi xử lý on-chain.')
      setShowRecord(false)
      recordForm.resetFields()
      await loadAdminEnrollments(adminActivity)
    } catch (e: unknown) { void message.error((e as Error)?.message ?? 'Ghi nhận thất bại') }
    finally { setSaving(false) }
  }

  async function handleEdit(values: EditActivityRecordInput) {
    if (!editTarget || !adminActivity) return
    setSaving(true)
    try {
      await editActivityRecord(adminActivity.id, editTarget.record_id, values)
      void message.success('Cập nhật thành công!')
      setShowEdit(false); editForm.resetFields(); setEditTarget(null)
      await loadAdminEnrollments(adminActivity)
      void loadAll()
    } catch (e: unknown) { void message.error((e as Error)?.message ?? 'Cập nhật thất bại') }
    finally { setSaving(false) }
  }

  // ── Tab items ─────────────────────────────────────────────────

  const tabItems = [
    // Tab 1: LEARNING
    {
      key: 'learning',
      label: <Space size={6}><ReadOutlined /><span>Học tập</span><Badge count={learningActivities.filter(a => a.status === 'ACTIVE').length} style={{ background: COLORS.primary }} /></Space>,
      children: (
        <Spin spinning={loading}>
          {learningActivities.length === 0 && !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có nội dung học tập" style={{ padding: 60 }} />
          ) : (
            <Row gutter={[14, 14]}>
              {learningActivities.map((a) => (
                <Col xs={24} md={12} xl={8} key={a.id}>
                  <LearningCard activity={a} onDetail={setTaskDetailActivity} />
                </Col>
              ))}
            </Row>
          )}
        </Spin>
      ),
    },

    // Tab 2: ACTIVITY (Events)
    {
      key: 'events',
      label: <Space size={6}><CalendarOutlined /><span>Hoạt động</span><Badge count={activityActivities.filter(a => a.status === 'ACTIVE').length} style={{ background: COLORS.success }} /></Space>,
      children: (
        <Spin spinning={loading}>
          {activityActivities.length === 0 && !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động ngoại khóa" style={{ padding: 60 }} />
          ) : (
            <Row gutter={[14, 14]}>
              {activityActivities.map((a) => (
                <Col xs={24} md={12} xl={8} key={a.id}>
                  <EventCard
                    activity={a}
                    myEnrollment={getMyEnrollment(a.id)}
                    onClick={setEventDetail}
                  />
                </Col>
              ))}
            </Row>
          )}
        </Spin>
      ),
    },

    // Tab 3: MY PROGRESS
    {
      key: 'mine',
      label: <Space size={6}><TrophyOutlined /><span>Của tôi</span>{editableRecs.length > 0 && <Badge count={editableRecs.length} style={{ background: COLORS.warning }} />}</Space>,
      children: (
        <Spin spinning={loading}>
          {/* Stats */}
          {(myRecords.length > 0 || myEnrollments.length > 0) && (
            <Card style={{ borderRadius: 20, marginBottom: 20, border: 'none', background: GRADIENT.cardMy, boxShadow: '0 4px 20px rgba(79,70,229,.08)' }} styles={{ body: { padding: '20px 24px' } }}>
              <Row gutter={[16, 12]}>
                {[
                  { label: 'Học tập hoàn thành', val: myRecords.filter(r => r.lecturer_address === 'SYSTEM').length, color: COLORS.primary },
                  { label: 'Hoạt động đăng ký',  val: myEnrollments.length, color: COLORS.success },
                  { label: 'Điểm chờ duyệt',     val: pendingPts,           color: COLORS.warning },
                  { label: 'Điểm xác nhận',       val: confirmedPts,         color: COLORS.secondary },
                ].map((s) => (
                  <Col xs={12} sm={6} key={s.label} style={{ textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.val}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{s.label}</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* Learning completions */}
          {myRecords.length > 0 && (
            <>
              <Text strong style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 12 }}><ReadOutlined style={{ marginRight: 6 }} />Lịch sử học tập</Text>
              <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                {myRecords.map((r) => (
                  <Col xs={24} md={12} key={r.record_id}>
                    <RecordCard record={r} />
                  </Col>
                ))}
              </Row>
              {myRecordsTotal > myRecordsLimit && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <Pagination
                    current={myRecordsPage}
                    total={myRecordsTotal}
                    pageSize={myRecordsLimit}
                    onChange={(page) => {
                      setMyRecordsPage(page)
                      void loadAll(page)
                    }}
                    showSizeChanger={false}
                    showTotal={(total) => `${total} bản ghi`}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}
            </>
          )}

          {/* Event enrollments */}
          {myEnrollments.length > 0 && (
            <>
              <Text strong style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 12 }}><CalendarOutlined style={{ marginRight: 6 }} />Hoạt động ngoại khóa</Text>
              <Row gutter={[12, 12]}>
                {myEnrollments.map((e) => {
                  const es = ENROLLMENT_STATUS_CONFIG[e.status as keyof typeof ENROLLMENT_STATUS_CONFIG]
                  return (
                    <Col xs={24} md={12} key={e.id}>
                      <Card style={{ borderRadius: 14, border: `1px solid ${es?.bg ?? COLORS.border}`, height: '100%' }} styles={{ body: { padding: '14px 18px' } }}>
                        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                          <Space><CalendarOutlined style={{ color: COLORS.success }} /><Text style={{ fontSize: 13 }}>{e.activity_id}</Text></Space>
                          <Tag style={{ borderRadius: 8, background: es?.bg, color: es?.color, border: 'none', fontWeight: 600 }}>{es?.label ?? e.status}</Tag>
                        </Space>
                        <Text style={{ fontSize: 11, color: COLORS.muted, display: 'block', marginTop: 4 }}>Đăng ký: {new Date(e.enrolled_at).toLocaleDateString('vi-VN')}</Text>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            </>
          )}

          {myRecords.length === 0 && myEnrollments.length === 0 && !loading && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bạn chưa tham gia hoạt động nào" style={{ padding: 60 }} />
          )}
        </Spin>
      ),
    },

    // Tab 4: RANKING
    {
      key: 'ranking',
      label: <Space size={6}><TrophyOutlined /><span>Xếp hạng</span></Space>,
      children: (
        <Spin spinning={rankLoading}>
          {ranking.length === 0 && !rankLoading && activeTab === 'ranking' && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu xếp hạng" style={{ padding: 40 }} />
          )}
          {ranking.length > 0 && (
            <>
              <Card style={{ borderRadius: 16, marginBottom: 14, border: `1px solid ${COLORS.border}`, background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 46%, #F8FAFC 100%)' }} styles={{ body: { padding: '14px 16px' } }}>
                <Row justify="space-between" align="middle" gutter={[12, 12]}>
                  <Col>
                    <Space direction="vertical" size={2}>
                      <Text strong style={{ fontSize: 14, color: '#92400E' }}>Bảng vàng điểm hoạt động</Text>
                      <Text style={{ fontSize: 12, color: COLORS.muted }}>Top 3 nổi bật và Top 10 kế tiếp</Text>
                    </Space>
                  </Col>
                  <Col>
                    <div style={{ minWidth: 160, borderRadius: 12, padding: '8px 12px', background: '#fff', border: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      <Text style={{ display: 'block', fontSize: 11, color: COLORS.muted }}>Điểm của bạn</Text>
                      {myRankEntry ? (
                        <>
                          <Text strong style={{ fontSize: 16, color: COLORS.primary }}>#{myRankEntry.rank} • {myRankEntry.activity_points} pts</Text>
                          <Text style={{ display: 'block', fontSize: 11, color: COLORS.muted }}>{myRankEntry.student_name || shortAddr(myRankEntry.student_wallet)}</Text>
                        </>
                      ) : (
                        <Text strong style={{ fontSize: 13, color: COLORS.muted }}>Chưa có trong top hiện tại</Text>
                      )}
                    </div>
                  </Col>
                </Row>
              </Card>

              <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
                {topThree.map((entry) => {
                  const cardBg = entry.rank === 1
                    ? 'linear-gradient(135deg, #FFFBEB 0%, #FDE68A 100%)'
                    : entry.rank === 2
                      ? 'linear-gradient(135deg, #F8FAFC 0%, #E5E7EB 100%)'
                      : 'linear-gradient(135deg, #FFF7ED 0%, #FDBA74 100%)'
                  const badge = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'
                  return (
                    <Col xs={24} md={8} key={entry.student_wallet}>
                      <Card className="act-card" style={{ borderRadius: 16, border: `1px solid ${COLORS.warning}40`, background: cardBg }} styles={{ body: { padding: '14px 14px 12px' } }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 8 }}>{badge}</div>
                          <Text strong style={{ fontSize: 14, display: 'block' }}>{entry.student_name || shortAddr(entry.student_wallet)}</Text>
                          <Text style={{ fontSize: 11, color: COLORS.muted, display: 'block', marginTop: 2 }}>Hạng #{entry.rank}</Text>
                          {entry.class && <Text style={{ fontSize: 11, color: COLORS.muted, display: 'block' }}>{entry.class}</Text>}
                          <div style={{ marginTop: 10 }}>
                            <span style={{ padding: '5px 12px', borderRadius: 999, background: 'rgba(15,23,42,.08)', fontWeight: 800, color: COLORS.text, fontSize: 13 }}>{entry.activity_points} pts</span>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  )
                })}
              </Row>

              <Card style={{ borderRadius: 16, border: `1px solid ${COLORS.border}` }} styles={{ body: { padding: '10px 12px' } }}>
                <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13, color: COLORS.text }}>Top 10 tiếp theo</Text>
                {nextTopTen.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa đủ dữ liệu để hiển thị top 10 tiếp theo" style={{ padding: 18 }} />
                ) : (
                  <List
                    dataSource={nextTopTen}
                    renderItem={(entry) => (
                      <List.Item style={{ padding: '8px 2px' }}>
                        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                          <Space>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: COLORS.primary + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: COLORS.primary, fontSize: 13 }}>#{entry.rank}</div>
                            <Space direction="vertical" size={0}>
                              <Text strong style={{ fontSize: 13 }}>{entry.student_name || shortAddr(entry.student_wallet)}</Text>
                              {entry.class && <Text style={{ fontSize: 11, color: COLORS.muted }}>{entry.class}</Text>}
                            </Space>
                          </Space>
                          <Tag style={{ borderRadius: 999, marginInlineEnd: 0, background: COLORS.primary + '10', border: 'none', color: COLORS.primary, fontWeight: 800 }}>{entry.activity_points} pts</Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </>
          )}
          {rankTotal > 20 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Pagination
                current={rankPage} total={rankTotal} pageSize={20}
                onChange={(page) => void loadRanking(page)}
                showSizeChanger={false}
                showTotal={(t) => `${t} sinh viên`}
              />
            </div>
          )}
        </Spin>
      ),
    },
    ...(isLecturer ? [{
      key: 'manage',
      label: <Space size={6}><SafetyCertificateOutlined /><span>Quản lý</span></Space>,
      children: (
        <div>
          <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 20, flexWrap: 'wrap', rowGap: 8 }}>
            <Title level={5} style={{ margin: 0, color: COLORS.text }}>Quản lý hoạt động</Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}
              style={{ borderRadius: 12, height: 38, fontWeight: 600, background: GRADIENT.hero, border: 'none' }}>
              Tạo hoạt động
            </Button>
          </Space>

              {/* Activity list for admin: ACTIVITY only */}
          <Spin spinning={loading}>
            <Row gutter={[12, 12]}>
              {activityActivities.map((a) => (
                <Col xs={24} lg={12} key={a.id}>
                  <Card style={{ borderRadius: 16, border: `1px solid ${COLORS.border}`, height: '100%' }} styles={{ body: { padding: '14px 18px' } }}>
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Space direction="vertical" size={2}>
                        <Space wrap>
                          <Text strong style={{ fontSize: 14 }}>{a.title}</Text>
                          <Tag color={a.cluster === 'LEARNING' ? 'blue' : 'green'} style={{ borderRadius: 8, fontSize: 11 }}>{a.cluster}</Tag>
                          <Tag color={a.status === 'ACTIVE' ? 'success' : 'default'} style={{ borderRadius: 8, fontSize: 11 }}>{a.status}</Tag>
                        </Space>
                        {a.target_classes && a.target_classes.length > 0 && (
                          <Space wrap size={4} style={{ marginTop: 2 }}>
                            <Text style={{ fontSize: 11, color: COLORS.muted }}>Lớp:</Text>
                            {a.target_classes.map(tc => <Tag key={tc} color="purple" style={{ borderRadius: 6, fontSize: 10 }}>{tc}</Tag>)}
                          </Space>
                        )}
                        {!a.target_classes?.length && <Text style={{ fontSize: 11, color: COLORS.muted }}>Tất cả lớp</Text>}
                      </Space>
                      <Space>
                        <Button size="small" icon={<TeamOutlined />} onClick={() => void loadAdminEnrollments(a)} style={{ borderRadius: 8 }}>
                          DS đăng ký
                        </Button>
                        <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => { setAdminActivity(a); setShowRecord(true); recordForm.resetFields() }} style={{ borderRadius: 8 }}>
                          Ghi nhận
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Spin>

          {/* Enrollment management for selected ACTIVITY */}
          {adminActivity && adminActivity.cluster === 'ACTIVITY' && (
            <>
              <Divider style={{ margin: '24px 0 16px' }} />
              <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 14, flexWrap: 'wrap' }}>
                <Space direction="vertical" size={2}>
                  <Text strong style={{ fontSize: 15 }}>{adminActivity.title}</Text>
                  <Text style={{ fontSize: 12, color: COLORS.muted }}>Danh sách đăng ký: {adminEnrollments.length} sinh viên</Text>
                </Space>
              </Space>
              <Spin spinning={recLoading}>
                {adminEnrollments.length === 0 && !recLoading ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sinh viên đăng ký" style={{ padding: 32 }} />
                ) : (
                  <Row gutter={[12, 12]}>
                    {adminEnrollments.map((e) => {
                      const es = ENROLLMENT_STATUS_CONFIG[e.status as keyof typeof ENROLLMENT_STATUS_CONFIG]
                      const alreadyEvaluated = actRecords.some((r) => r.student_address === e.student_address)
                      const eventEnded = adminActivity?.event_ends_at ? new Date(adminActivity.event_ends_at) <= new Date() : false
                      return (
                        <Col xs={24} md={12} key={e.id}>
                          <Card style={{ borderRadius: 14, border: `1px solid ${COLORS.border}`, height: '100%' }} styles={{ body: { padding: '14px 18px' } }}>
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
                                <Space>
                                  <UserOutlined style={{ color: COLORS.muted }} />
                                  <Text style={{ fontSize: 13, fontFamily: 'monospace' }}>{shortAddr(e.student_address)}</Text>
                                  <Tag style={{ borderRadius: 8, background: es?.bg, color: es?.color, border: 'none', fontWeight: 600, fontSize: 11 }}>{es?.label ?? e.status}</Tag>
                                </Space>
                                {!alreadyEvaluated && e.status === 'REGISTERED' && (
                                  <Tooltip title={eventEnded ? '' : 'Chỉ đánh giá được sau khi sự kiện kết thúc'}>
                                    <Button
                                      size="small" type="primary" icon={<StarOutlined />}
                                      disabled={!eventEnded}
                                      onClick={() => { setEvalTarget(e); evalForm.resetFields(); setShowEval(true) }}
                                      style={{ borderRadius: 8, background: COLORS.secondary, border: 'none', fontWeight: 600 }}
                                    >
                                      Đánh giá
                                    </Button>
                                  </Tooltip>
                                )}
                                {alreadyEvaluated && <Tag color="success" style={{ borderRadius: 8, fontSize: 11 }}>Đã đánh giá</Tag>}
                              </Space>
                              <Text style={{ fontSize: 11, color: COLORS.muted, display: 'block' }}>Đăng ký: {new Date(e.enrolled_at).toLocaleDateString('vi-VN')}</Text>
                            </Space>
                          </Card>
                        </Col>
                      )
                    })}
                  </Row>
                )}
              </Spin>

              {/* Records for this activity — split pending/history */}
              {actRecords.length > 0 && (
                <>
                  {/* Pending (chờ xác nhận) */}
                  {actRecords.filter(r => r.status === 'PENDING').length > 0 && (
                    <>
                      <Divider style={{ margin: '16px 0 12px' }}><Text style={{ fontSize: 13, color: COLORS.warning, fontWeight: 600 }}>Chờ xác nhận</Text></Divider>
                      <Row gutter={[12, 12]}>
                        {actRecords.filter(r => r.status === 'PENDING').map((r) => (
                          <Col xs={24} md={12} key={r.record_id}>
                            <RecordCard record={r} showEdit onEdit={(rec) => { setEditTarget(rec); editForm.setFieldsValue({ rating: rec.rating }); setShowEdit(true) }} />
                          </Col>
                        ))}
                      </Row>
                    </>
                  )}
                  {/* Confirmed / Locked history */}
                  {actRecords.filter(r => r.status !== 'PENDING').length > 0 && (
                    <>
                      <Divider style={{ margin: '16px 0 12px' }}><Text style={{ fontSize: 13, color: COLORS.muted }}>Lịch sử đã ghi nhận</Text></Divider>
                      <Row gutter={[12, 12]}>
                        {actRecords.filter(r => r.status !== 'PENDING').map((r) => (
                          <Col xs={24} md={12} key={r.record_id}>
                            <RecordCard record={r} />
                          </Col>
                        ))}
                      </Row>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      ),
    }] : []),
  ]

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '0 4px' }}>
      <style>{ACT_STYLES}</style>
      {/* Hero Header */}
      <div style={{ borderRadius: 24, marginBottom: 22, padding: '26px 32px 22px', background: 'linear-gradient(135deg, #0F0E2B 0%, #1E1A5C 50%, #312E81 100%)', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -45, right: -45, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
        <div style={{ position: 'absolute', bottom: -25, right: 120, width: 110, height: 110, borderRadius: '50%', background: 'rgba(99,102,241,.22)' }} />
        <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', rowGap: 12 }}>
          <Space direction="vertical" size={6}>
            <Space align="center" size={10}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎓</div>
              <Title level={3} style={{ margin: 0, color: '#fff', fontWeight: 800, letterSpacing: -0.3 }}>Học tập & Hoạt động</Title>
            </Space>
            <Text style={{ color: 'rgba(255,255,255,.68)', fontSize: 13, paddingLeft: 54 }}>
              {isLecturer ? 'Tạo & quản lý nội dung — Ghi nhận điểm rèn luyện' : 'Học tập, tích lũy điểm & đăng ký hoạt động ngoại khóa'}
            </Text>
          </Space>
          {isLecturer && (
            <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)} style={{ borderRadius: 12, height: 40, fontWeight: 700, background: 'rgba(255,255,255,.11)', border: '1.5px solid rgba(255,255,255,.3)', color: '#fff' }}>
              Tạo hoạt động
            </Button>
          )}
        </Space>
      </div>

      {/* Stats row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Đang mở',       val: activeActs.length,                       color: COLORS.primary,   icon: <FireOutlined /> },
          { label: 'Đã tham gia',   val: myRecords.length + myEnrollments.length, color: COLORS.success,   icon: <CheckCircleOutlined /> },
          { label: 'Điểm chờ',      val: pendingPts,                              color: COLORS.warning,   icon: <ClockCircleOutlined /> },
          { label: 'Điểm xác nhận', val: confirmedPts,                            color: COLORS.secondary, icon: <TrophyOutlined /> },
        ].map((s) => (
          <Col xs={12} sm={6} key={s.label}>
            <StatCard label={s.label} value={s.val} color={s.color} icon={s.icon} />
          </Col>
        ))}
      </Row>

      {/* Main tabs */}
      <Card style={{ borderRadius: 20, border: `1px solid ${COLORS.border}`, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }} styles={{ body: { padding: 0 } }}>
        {/* Custom pill tab navigation */}
        <div style={{ padding: '14px 16px 0', borderBottom: '1px solid #F3F4F6' }}>
          <Space size={4} wrap>
            {tabItems.map((tab) => {
              const on = activeTab === tab.key
              return (
                <button key={tab.key} className="act-tab"
                  onClick={() => {
                    setActiveTab(tab.key)
                    if (tab.key === 'ranking' && ranking.length === 0) {
                      void loadRanking(1)
                    }
                  }}
                  style={{
                    padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13,
                    background: on ? COLORS.primary : 'transparent',
                    color: on ? '#fff' : COLORS.muted,
                    boxShadow: on ? `0 4px 12px ${COLORS.primary}40` : 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  {tab.label}
                </button>
              )
            })}
          </Space>
        </div>
        <div style={{ padding: '16px 16px 4px' }}>
          {tabItems.find((t) => t.key === activeTab)?.children}
        </div>
      </Card>

      {/* ── Learning Modal ── */}
      <LearningModal
        activity={learningActivity}
        onClose={() => setLearningActivity(null)}
        onDone={() => { void loadAll() }}
      />

      {/* ── Task Detail Modal ── */}
      <TaskDetailModal
        activity={taskDetailActivity}
        onClose={() => setTaskDetailActivity(null)}
        onStart={(a) => { setTaskDetailActivity(null); setLearningActivity(a) }}
      />

      {/* ── Event Detail Modal ── */}
      <EventDetailModal
        activity={eventDetail}
        myEnrollment={eventDetail ? getMyEnrollment(eventDetail.id) : undefined}
        onClose={() => setEventDetail(null)}
        onEnrolled={() => { void loadAll() }}
      />

      {/* ── Evaluate Enrollment Modal ── */}
      <Modal
        title={<Space><StarOutlined style={{ color: COLORS.secondary }} /><span>Đánh giá &amp; Phát Token</span></Space>}
        open={showEval}
        onCancel={() => { setShowEval(false); evalForm.resetFields() }}
        onOk={() => evalForm.submit()}
        confirmLoading={evalSaving}
        okText="💳 Đánh giá &amp; gửi Token" cancelText="Hủy"
        okButtonProps={{ style: { borderRadius: 10, background: GRADIENT.hero, border: 'none', fontWeight: 600 } }}
      >
        {evalTarget && (
          <Alert type="info" showIcon message={<>Sinh viên: <strong style={{ fontFamily: 'monospace' }}>{shortAddr(evalTarget.student_address)}</strong></>} style={{ marginBottom: 16, borderRadius: 10 }} />
        )}
        <Alert type="warning" showIcon message="Sau khi xác nhận, token thưởng sẽ được gửi tự động về ví sinh viên." style={{ marginBottom: 16, borderRadius: 10 }} />
        <Form form={evalForm} layout="vertical" onFinish={handleEvaluate} requiredMark="optional">
          <Form.Item name="rating" label="Xếp loại" rules={[{ required: true, message: 'Chọn xếp loại' }]}>
            <Select size="large" options={[
              { value: 'GOOD',    label: <Space><span style={{ color: COLORS.success }}>★★★</span><span>Tốt — {adminActivity?.points_per_rating.good} điểm</span></Space> },
              { value: 'AVERAGE', label: <Space><span style={{ color: COLORS.accent }}>★★</span><span>Khá — {adminActivity?.points_per_rating.average} điểm</span></Space> },
              { value: 'POOR',    label: <Space><span style={{ color: COLORS.warning }}>★</span><span>Trung bình — {adminActivity?.points_per_rating.poor} điểm</span></Space> },
            ]} placeholder="Chọn xếp loại" style={{ borderRadius: 10 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Create Activity Modal ── */}
      <Modal
        title={<Space><PlusOutlined /><span>Tạo hoạt động mới</span></Space>}
        open={showCreate}
        onCancel={() => { setShowCreate(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        confirmLoading={saving}
        okText="Tạo hoạt động" cancelText="Hủy"
        width={640}
        styles={{ body: { padding: '20px 0 0', maxHeight: '72vh', overflowY: 'auto' } }}
        okButtonProps={{ style: { borderRadius: 10, background: GRADIENT.hero, border: 'none', fontWeight: 600 } }}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} requiredMark="optional">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="title" label="Tên hoạt động" rules={[{ required: true }]}>
                <Input size="large" placeholder="VD: Đọc tài liệu Blockchain cơ bản" style={{ borderRadius: 10 }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Mô tả" rules={[{ required: true }]}>
                <TextArea rows={3} placeholder="Mô tả chi tiết nội dung..." style={{ borderRadius: 10 }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="cluster" label="Nhóm" rules={[{ required: true }]}>
            <Select
              size="large" options={CLUSTER_OPTIONS} placeholder="Chọn nhóm" style={{ borderRadius: 10 }}
              onChange={() => createForm.setFieldsValue({ activity_type: undefined, content_url: undefined, min_time_seconds: undefined, min_quiz_score: undefined, expires_at: undefined, event_ends_at: undefined, quiz_questions: undefined, max_slots: undefined })}
            />
          </Form.Item>

          <Form.Item name="target_classes" label={<span>Đối tượng lớp <span style={{ color: COLORS.muted, fontWeight: 400, fontSize: 12 }}>(để trống = tất cả lớp)</span></span>}>
            <Select
              mode="tags" tokenSeparators={[',']} placeholder="Nhập tên lớp rồi Enter, VD: CNTT-K2024"
              style={{ borderRadius: 10 }}
              options={[
                { value: 'CNTT-K2021', label: 'CNTT-K2021' },
                { value: 'CNTT-K2022', label: 'CNTT-K2022' },
                { value: 'CNTT-K2023', label: 'CNTT-K2023' },
                { value: 'CNTT-K2024', label: 'CNTT-K2024' },
                { value: 'CNTT-K2025', label: 'CNTT-K2025' },
              ]}
            />
          </Form.Item>

          {/* LEARNING: loại + cấu hình chi tiết */}
          {selectedCluster === 'LEARNING' && (
            <>
              <Form.Item name="activity_type" label="Loại nội dung" rules={[{ required: true, message: 'Chọn loại nội dung' }]}>
                <Select size="large" options={TYPE_OPTIONS} placeholder="Chọn loại" onChange={() => createForm.setFieldsValue({ content_url: undefined, min_time_seconds: undefined, min_quiz_score: undefined, expires_at: undefined, quiz_questions: undefined })} />
              </Form.Item>
            </>
          )}

          <Divider style={{ fontSize: 13, color: COLORS.muted, margin: '4px 0 16px' }}>Điểm thưởng theo xếp loại</Divider>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="points_poor" label={<span style={{ color: COLORS.warning }}>★ Trung bình</span>}>
                <InputNumber min={0} style={{ width: '100%', borderRadius: 10 }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="points_average" label={<span style={{ color: COLORS.accent }}>★★ Khá</span>} rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%', borderRadius: 10 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="points_good" label={<span style={{ color: COLORS.success }}>★★★ Tốt</span>} rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%', borderRadius: 10 }} />
              </Form.Item>
            </Col>
          </Row>

          {/* LEARNING: loại-specific fields */}
          {selectedCluster === 'LEARNING' && <TypeSpecificFields activityType={selectedType} />}

          {/* ACTIVITY: chỉ cần số lượng, URL thông tin, hạn đăng ký và kết thúc sự kiện */}
          {selectedCluster === 'ACTIVITY' && (
            <>
              <Divider style={{ fontSize: 13, color: COLORS.muted, margin: '4px 0 16px' }}>
                <Space><CalendarOutlined />Cấu hình sự kiện ngoại khóa</Space>
              </Divider>
              <div style={{ borderRadius: 12, padding: '14px 16px', marginBottom: 16, background: '#ECFDF5', border: '1px solid #6EE7B733', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: COLORS.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}><CalendarOutlined /></div>
                <div>
                  <div style={{ fontWeight: 700, color: COLORS.success, fontSize: 14, marginBottom: 2 }}>Hoạt động ngoại khóa</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>Sinh viên tự đăng ký online. Sau sự kiện, admin đánh giá từng người và cấp điểm thưởng.</div>
                </div>
              </div>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="max_slots" label={<><NumberOutlined /> Số lượng tối đa</>}>
                    <InputNumber min={1} style={{ width: '100%', borderRadius: 10 }} placeholder="Không giới hạn" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="expires_at" label={<><CalendarOutlined /> Hạn đăng ký</>} rules={[{ required: true, message: 'Chọn hạn đăng ký' }]}>
                    <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%', borderRadius: 10 }} placeholder="Chọn ngày giờ" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="event_ends_at"
                label={<><CalendarOutlined /> Kết thúc sự kiện</>}
                dependencies={['expires_at']}
                rules={[
                  { required: true, message: 'Chọn thời gian kết thúc sự kiện' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const regDeadline = getFieldValue('expires_at') as ReturnType<typeof dayjs> | undefined
                      if (!value || !regDeadline || (value as ReturnType<typeof dayjs>).isAfter(regDeadline)) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('Kết thúc sự kiện phải sau hạn đăng ký'))
                    },
                  }),
                ]}
              >
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%', borderRadius: 10 }} placeholder="Chọn ngày giờ" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
              </Form.Item>
              <Form.Item name="content_url" label="URL thông tin sự kiện (tuỳ chọn)" extra="Link fanpage, Google Form, hoặc trang sự kiện">
                <Input placeholder="https://..." prefix={<GlobalOutlined style={{ color: COLORS.muted }} />} style={{ borderRadius: 10 }} />
              </Form.Item>
            </>
          )}

          {!selectedCluster && (
            <Alert type="info" showIcon message="Chọn nhóm để hiển thị cấu hình phù hợp" style={{ borderRadius: 10, marginTop: 8 }} />
          )}
        </Form>
      </Modal>

      {/* ── Record Activity Modal ── */}
      <Modal
        title={<Space><SafetyCertificateOutlined /><span>Ghi nhận tham gia</span>{adminActivity && <Text style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>{adminActivity.title}</Text>}</Space>}
        open={showRecord}
        onCancel={() => { setShowRecord(false); recordForm.resetFields() }}
        onOk={() => recordForm.submit()}
        confirmLoading={saving}
        okText="Ghi nhận" cancelText="Hủy"
        okButtonProps={{ style: { borderRadius: 10, background: GRADIENT.hero, border: 'none', fontWeight: 600 } }}
      >
        <Form form={recordForm} layout="vertical" onFinish={handleRecord} requiredMark="optional" style={{ paddingTop: 12 }}>
          <Form.Item name="student_address" label="Địa chỉ ví sinh viên" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ ví' }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Địa chỉ không hợp lệ' }]}>
            <Input placeholder="0x1234...abcd" style={{ borderRadius: 10 }} prefix={<UserOutlined style={{ color: COLORS.muted }} />} />
          </Form.Item>
          <Form.Item name="rating" label="Xếp loại" rules={[{ required: true, message: 'Chọn xếp loại' }]}>
            <Select options={[
              { value: 'GOOD',    label: '★★★ Tốt' },
              { value: 'AVERAGE', label: '★★ Khá' },
              { value: 'POOR',    label: '★ Trung bình' },
            ]} placeholder="Chọn xếp loại" style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú (tuỳ chọn)">
            <TextArea rows={2} placeholder="Nhận xét về quá trình tham gia..." style={{ borderRadius: 10 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit Record Modal ── */}
      <Modal
        title={<Space><EditOutlined /><span>Chỉnh sửa ghi nhận</span></Space>}
        open={showEdit}
        onCancel={() => { setShowEdit(false); editForm.resetFields(); setEditTarget(null) }}
        onOk={() => editForm.submit()}
        confirmLoading={saving}
        okText="Cập nhật" cancelText="Hủy"
        okButtonProps={{ style: { borderRadius: 10, background: GRADIENT.hero, border: 'none', fontWeight: 600 } }}
      >
        {editTarget?.can_edit && (
          <Alert type="warning" showIcon message={<>Còn <CountdownTimer seconds={editTarget.time_remaining} /> để chỉnh sửa.</>} style={{ marginBottom: 16, borderRadius: 10 }} />
        )}
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark="optional" style={{ paddingTop: 8 }}>
          <Form.Item name="rating" label="Xếp loại mới" rules={[{ required: true, message: 'Chọn xếp loại' }]}>
            <Select options={[{ value: 'GOOD', label: '★★★ Tốt' }, { value: 'AVERAGE', label: '★★ Khá' }, { value: 'POOR', label: '★ Trung bình' }]} style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <TextArea rows={2} style={{ borderRadius: 10 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ActivitiesPage
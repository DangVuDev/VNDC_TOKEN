import { useState } from 'react'
import {
  Table, Tag, Button, Popconfirm, Tooltip, Typography, Badge, Space,
} from 'antd'
import {
  DesktopOutlined, MobileOutlined, GlobalOutlined,
  DeleteOutlined, SafetyOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Session } from '../../hooks/useAuth'

const { Text } = Typography

interface SessionsTableProps {
  sessions: Session[]
  currentSessionId?: string   // highlight current session if known
  loading?: boolean
  onRevoke: (id: string) => Promise<void>
}

function deviceIcon(device: string) {
  const d = device.toLowerCase()
  if (d.includes('mobile') || d.includes('android') || d.includes('iphone') || d.includes('ios')) {
    return <MobileOutlined style={{ color: '#8B5CF6' }} />
  }
  return <DesktopOutlined style={{ color: '#3B82F6' }} />
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function timeAgo(iso?: string | null) {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins} phút trước`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} giờ trước`
    return `${Math.floor(hrs / 24)} ngày trước`
  } catch {
    return iso ?? '—'
  }
}

export function SessionsTable({ sessions, currentSessionId, loading, onRevoke }: SessionsTableProps) {
  const [revoking, setRevoking] = useState<Set<string>>(new Set())

  async function handleRevoke(id: string) {
    setRevoking((s) => new Set(s).add(id))
    try {
      await onRevoke(id)
    } finally {
      setRevoking((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const columns: ColumnsType<Session> = [
    {
      title: 'Thiết bị',
      key: 'device',
      render: (_, rec) => (
        <Space size={8}>
          {deviceIcon(rec.device)}
          <div>
            <Text style={{ fontSize: 13, fontWeight: 500 }}>
              {rec.device || 'Thiết bị không xác định'}
            </Text>
            {rec.id === currentSessionId && (
              <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>
                <SafetyOutlined /> Hiện tại
              </Tag>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (ip: string) => (
        <Space size={4}>
          <GlobalOutlined style={{ color: '#9CA3AF', fontSize: 12 }} />
          <Text style={{ fontSize: 13, fontFamily: 'monospace' }}>{ip || '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'Bắt đầu',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => (
        <Tooltip title={formatDate(val)}>
          <Text style={{ fontSize: 13 }}>{timeAgo(val)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Lần cuối',
      dataIndex: 'last_used',
      key: 'last_used',
      render: (val: string) => (
        <Tooltip title={formatDate(val)}>
          <Text style={{ fontSize: 13 }}>{timeAgo(val)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, rec) => (
        <Badge
          status={rec.id === currentSessionId ? 'processing' : 'success'}
          text={
            <Text style={{ fontSize: 12 }}>
              {rec.id === currentSessionId ? 'Đang hoạt động' : 'Hoạt động'}
            </Text>
          }
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      render: (_, rec) => (
        rec.id === currentSessionId ? (
          <Text type="secondary" style={{ fontSize: 12 }}>Session hiện tại</Text>
        ) : (
          <Popconfirm
            title="Thu hồi session này?"
            description="Thiết bị này sẽ bị đăng xuất ngay lập tức."
            onConfirm={() => handleRevoke(rec.id)}
            okText="Thu hồi"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={revoking.has(rec.id)}
            >
              Thu hồi
            </Button>
          </Popconfirm>
        )
      ),
    },
  ]

  return (
    <Table<Session>
      dataSource={sessions}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={false}
      locale={{ emptyText: 'Không có session nào' }}
      rowClassName={(rec) => rec.id === currentSessionId ? 'ant-table-row-selected' : ''}
    />
  )
}

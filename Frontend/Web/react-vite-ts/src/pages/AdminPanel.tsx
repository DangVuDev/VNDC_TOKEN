import { useEffect, useState } from 'react'
import {
  Tabs, Card, Row, Col, Button, Space, Statistic, Badge,
  Table, Form, Input, InputNumber, Modal, message as antMessage,
  Tag, Progress, Typography, Empty, Spin,
} from 'antd'
import {
  DashboardOutlined, FileTextOutlined, BellOutlined, ToolOutlined,
  CheckCircleOutlined, CloseCircleOutlined, PlusOutlined,
  ReloadOutlined, DownloadOutlined, CalendarOutlined, ApartmentOutlined,
} from '@ant-design/icons'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

// ─── Types ──────────────────────────────────────────────────────

interface ContractStats {
  totalSupply: string
  currentBalance: string
  paused: boolean
  owner: string
}

interface AdminStats {
  totalUsers: number
  kycVerified: number
  activeToday: number
  totalTransactions: number
  pendingTransactions: number
  totalRevenue: string
}

interface SystemNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: string
  read: boolean
}

// ─── Contract Management Tab ────────────────────────────────────

function ContractManagementTab() {
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mintForm] = Form.useForm()
  const [showMintModal, setShowMintModal] = useState(false)
  const [minting, setMinting] = useState(false)

  useEffect(() => {
    // Simulate fetching contract stats
    setLoading(true)
    setTimeout(() => {
      setStats({
        totalSupply: '1000000000000000000000000000', // 1B * 1e18
        currentBalance: '100000000000000000000000000',
        paused: false,
        owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })
      setLoading(false)
    }, 500)
  }, [])

  const handleMint = async (values: any) => {
    setMinting(true)
    try {
      // Call mint API
      console.log('Minting:', values)
      antMessage.success(`Đã mint thành công ${values.amount} VNDC`)
      mintForm.resetFields()
      setShowMintModal(false)
    } catch (err) {
      antMessage.error('Lỗi khi mint token')
    } finally {
      setMinting(false)
    }
  }

  const formatWei = (wei: string) => {
    try {
      const n = BigInt(wei)
      const whole = n / BigInt('1000000000000000000')
      const frac = n % BigInt('1000000000000000000')
      const result = Number(whole) + Number(frac) / 1e18
      return result.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
    } catch {
      return '0.00'
    }
  }

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* Contract Status */}
        <Card title="Trạng Thái Hợp Đồng VNDCToken" extra={<ReloadOutlined style={{ cursor: 'pointer' }} />}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Tổng Cung"
                value={formatWei(stats?.totalSupply || '0')}
                suffix="VNDC"
                valueStyle={{ color: '#1890ff', fontSize: 18 }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Số Dư Hợp Đồng"
                value={formatWei(stats?.currentBalance || '0')}
                suffix="VNDC"
                valueStyle={{ color: '#52c41a', fontSize: 18 }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Trạng Thái"
                value={stats?.paused ? 'Tạm Dừng' : 'Hoạt Động'}
                valueStyle={{ color: stats?.paused ? '#ff4d4f' : '#52c41a' }}
                prefix={stats?.paused ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Owner: {stats?.owner?.slice(0, 10)}...{stats?.owner?.slice(-8)}
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Quick Actions */}
        <Card title="Quản Lý Hợp Đồng">
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowMintModal(true)}
            >
              Mint Token
            </Button>
            <Button danger>Pause Contract</Button>
            <Button>Unpause Contract</Button>
            <Button icon={<DownloadOutlined />}>Xuất Logs</Button>
          </Space>
        </Card>

        {/* Mint Modal */}
        <Modal
          title="Mint VNDC Token"
          open={showMintModal}
          onCancel={() => setShowMintModal(false)}
          footer={null}
          width={500}
        >
          <Form
            form={mintForm}
            layout="vertical"
            onFinish={handleMint}
          >
            <Form.Item
              label="Địa Chỉ Ví Nhận"
              name="recipient"
              rules={[{ required: true, message: 'Nhập địa chỉ ví' }]}
            >
              <Input placeholder="0x..." />
            </Form.Item>
            <Form.Item
              label="Số Lượng VNDC"
              name="amount"
              rules={[{ required: true, message: 'Nhập số lượng' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                placeholder="1000000"
              />
            </Form.Item>
            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setShowMintModal(false)}>Hủy</Button>
                <Button type="primary" htmlType="submit" loading={minting}>
                  Mint Ngay
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Recent Mint History */}
        <Card title="Lịch Sử Mint Gần Đây" size="small">
          <Table
            columns={[
              { title: 'Thời Gian', dataIndex: 'time', key: 'time', width: 150 },
              { title: 'Địa Chỉ Nhận', dataIndex: 'recipient', key: 'recipient', render: (v: string) => `${v.slice(0, 10)}...${v.slice(-8)}` },
              { title: 'Số Lượng', dataIndex: 'amount', key: 'amount', render: (v: string) => `${v} VNDC` },
              { title: 'TX Hash', dataIndex: 'hash', key: 'hash', render: (v: string) => <code style={{ fontSize: 11 }}>{v?.slice(0, 16)}...</code> },
            ]}
            dataSource={[]}
            pagination={false}
            locale={{ emptyText: 'Chưa có dữ liệu' }}
          />
        </Card>
      </Space>
    </Spin>
  )
}

// ─── Offchain Administration Tab ─────────────────────────────────

function OffchainAdminTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setTimeout(() => {
      setStats({
        totalUsers: 156,
        kycVerified: 124,
        activeToday: 45,
        totalTransactions: 2341,
        pendingTransactions: 12,
        totalRevenue: '50000000000000000000000', // 50k VNDC in wei
      })
      setLoading(false)
    }, 500)
  }, [])

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* System Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Tổng Người Dùng"
                value={stats?.totalUsers}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="KYC Đã Xác Thực"
                value={stats?.kycVerified}
                suffix={`/ ${stats?.totalUsers}`}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Hoạt Động Hôm Nay"
                value={stats?.activeToday}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Giao Dịch Đang Chờ"
                value={stats?.pendingTransactions}
                valueStyle={{ color: stats!.pendingTransactions > 0 ? '#faad14' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* KYC Verification Progress */}
        <Card title="Tiến Độ Xác Thực KYC">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Level 1 (Cơ Bản)</Text>
                <Text strong>{Math.round((stats?.kycVerified || 0) / (stats?.totalUsers || 1) * 100)}%</Text>
              </div>
              <Progress percent={Math.round((stats?.kycVerified || 0) / (stats?.totalUsers || 1) * 100)} status="active" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Level 2 (Nâng Cao)</Text>
                <Text strong>28%</Text>
              </div>
              <Progress percent={28} />
            </div>
          </Space>
        </Card>

        {/* User Management */}
        <Card title="Quản Lý Người Dùng">
          <Space wrap>
            <Button icon={<FileTextOutlined />}>Xuất Danh Sách Users</Button>
            <Button>Quản Lý Roles</Button>
            <Button danger>Khóa Tài Khoản</Button>
          </Space>
        </Card>

        {/* Transaction Management */}
        <Card title="Quản Lý Giao Dịch" size="small">
          <Table
            columns={[
              { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (v: string) => <code>{v?.slice(0, 12)}...</code> },
              { title: 'Loại', dataIndex: 'type', key: 'type', width: 100 },
              { title: 'Người Gửi', dataIndex: 'from', key: 'from', render: (v: string) => `${v.slice(0, 8)}...` },
              { title: 'Số Lượng', dataIndex: 'amount', key: 'amount', render: (v: string) => `${v} VNDC` },
              { title: 'Trạng Thái', dataIndex: 'status', key: 'status', render: (status: string) => (
                <Tag color={status === 'PENDING' ? 'orange' : 'green'}>{status}</Tag>
              )},
            ]}
            dataSource={[]}
            pagination={false}
            locale={{ emptyText: 'Chưa có giao dịch' }}
          />
        </Card>
      </Space>
    </Spin>
  )
}

// ─── Analytics & Reports Tab ────────────────────────────────────

function AnalyticsTab() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Feature Clusters */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card title={<Space><CalendarOutlined /><span>Module Sự kiện - Vé</span></Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Tổng Sản Phẩm</Text>
                <Text strong>47</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Đã Bán</Text>
                <Text strong>234 vé</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Doanh Thu</Text>
                <Text strong>23,400 VNDC</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={<Space><ApartmentOutlined /><span>Module DAO & Voting</span></Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Tổng DAOs</Text>
                <Text strong>8</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Đề Xuất Hoạt Động</Text>
                <Text strong>12</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Tỷ Lệ Tham Gia</Text>
                <Text strong>64%</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={<Space><ToolOutlined /><span>Module Nhiệm vụ</span></Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Tổng Nhiệm Vụ</Text>
                <Text strong>23</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Hoàn Thành</Text>
                <Text strong>156 lần</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Phần Thưởng Đã Cấp</Text>
                <Text strong>15,600 VNDC</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="🛍️ Module Marketplace">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Tổng Listings</Text>
                <Text strong>89</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Giao Dịch</Text>
                <Text strong>34</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Giá Trị</Text>
                <Text strong>45,600 VNDC</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Export Reports */}
      <Card title="Xuất Báo Cáo">
        <Space wrap>
          <Button icon={<DownloadOutlined />}>Báo Cáo Người Dùng</Button>
          <Button icon={<DownloadOutlined />}>Báo Cáo Giao Dịch</Button>
          <Button icon={<DownloadOutlined />}>Báo Cáo Doanh Thu</Button>
          <Button icon={<DownloadOutlined />}>Báo Cáo Chi Tiết</Button>
        </Space>
      </Card>
    </Space>
  )
}

// ─── Notifications Tab ──────────────────────────────────────────

function NotificationsTab() {
  const [notifications, setNotifications] = useState<SystemNotification[]>([
    {
      id: '1',
      title: 'Hệ Thống Cảnh Báo',
      message: 'Phát hiện 12 giao dịch chờ xử lý quá 1 giờ',
      type: 'warning',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      read: false,
    },
    {
      id: '2',
      title: 'Mint Token Thành Công',
      message: 'Đã mint 1,000,000 VNDC tới 0xf39F...',
      type: 'success',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      read: false,
    },
    {
      id: '3',
      title: 'Bảo Trì Hệ Thống',
      message: 'Hãy lưu ý: Bảo trì dự kiến vào 22h hôm nay',
      type: 'info',
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      read: true,
    },
  ])

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const clearAll = () => {
    setNotifications([])
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Badge count={notifications.filter(n => !n.read).length} />
          <Text style={{ marginLeft: 8 }}>
            {notifications.filter(n => !n.read).length} thông báo chưa đọc
          </Text>
        </div>
        <Button size="small" onClick={clearAll} danger>Xóa Tất Cả</Button>
      </div>

      {notifications.length === 0 ? (
        <Empty description="Không có thông báo" style={{ padding: 40 }} />
      ) : (
        notifications.map(notif => (
          <Card
            key={notif.id}
            size="small"
            style={{
              opacity: notif.read ? 0.6 : 1,
              borderLeft: `4px solid ${
                notif.type === 'success' ? '#52c41a' :
                notif.type === 'warning' ? '#faad14' :
                notif.type === 'error' ? '#ff4d4f' :
                '#1890ff'
              }`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text strong>{notif.title}</Text>
                  <Tag color={notif.type}>{notif.type.toUpperCase()}</Tag>
                </div>
                <Paragraph style={{ margin: 0, marginBottom: 8 }}>{notif.message}</Paragraph>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(notif.timestamp).toLocaleString('vi-VN')}
                </Text>
              </div>
              {!notif.read && (
                <Button size="small" onClick={() => markAsRead(notif.id)}>
                  Đánh Dấu Đã Đọc
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
    </Space>
  )
}

// ─── Main Admin Panel ────────────────────────────────────────────

export interface AdminPanelProps {
  user?: AuthUser
}

export function AdminPanelLegacy(_: AdminPanelProps) {
  const tabItems = [
    {
      key: 'contracts',
      label: (
        <Space>
          <ToolOutlined />
          Hợp Đồng
        </Space>
      ),
      children: <ContractManagementTab />,
    },
    {
      key: 'offchain',
      label: (
        <Space>
          <DashboardOutlined />
          Offchain
        </Space>
      ),
      children: <OffchainAdminTab />,
    },
    {
      key: 'analytics',
      label: (
        <Space>
          <FileTextOutlined />
          Báo Cáo
        </Space>
      ),
      children: <AnalyticsTab />,
    },
    {
      key: 'notifications',
      label: (
        <Space>
          <BellOutlined />
          Thông Báo
        </Space>
      ),
      children: <NotificationsTab />,
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>🛡️ Bảng Điều Khiển Admin</Title>
        <Text type="secondary">Quản lý hợp đồng, hệ thống và báo cáo</Text>
      </div>
      <Tabs items={tabItems} defaultActiveKey="contracts" />
    </div>
  )
}

export function AdminPanel(_: AdminPanelProps) {
  const tabItems = [
    {
      key: 'contracts',
      label: (
        <Space>
          <ToolOutlined />
          Hợp đồng
        </Space>
      ),
      children: <ContractManagementTab />,
    },
    {
      key: 'offchain',
      label: (
        <Space>
          <DashboardOutlined />
          Offchain
        </Space>
      ),
      children: <OffchainAdminTab />,
    },
    {
      key: 'analytics',
      label: (
        <Space>
          <FileTextOutlined />
          Báo cáo
        </Space>
      ),
      children: <AnalyticsTab />,
    },
    {
      key: 'notifications',
      label: (
        <Space>
          <BellOutlined />
          Thông báo
        </Space>
      ),
      children: <NotificationsTab />,
    },
  ]

  return (
    <div className="admin-page" style={{ padding: 18 }}>
      <div className="admin-hero" style={{ marginBottom: 24, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div className="vndc-hero-icon"><ToolOutlined /></div>
        <div>
          <div className="vndc-hero-kicker">Quản trị hệ thống</div>
          <Title level={3} className="vndc-hero-title" style={{ margin: 0, fontWeight: 800 }}>Bảng điều khiển Admin</Title>
          <Text className="vndc-hero-desc">Quản lý hợp đồng, off-chain jobs, thông báo và báo cáo vận hành</Text>
        </div>
      </div>
      <Tabs items={tabItems} defaultActiveKey="contracts" />
    </div>
  )
}

import { useState } from 'react'
import { Layout, Avatar, Dropdown, Badge, Button, Space, Popover, List, Typography, Empty, Spin, Tag } from 'antd'
import {
  DashboardOutlined,
  WalletOutlined,
  FireOutlined,
  ApartmentOutlined,
  ShopOutlined,
  FundOutlined,
  CalendarOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { AuthUser } from '../../hooks/useAuth'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { getMyNotifications, type AppNotification, type AppNotificationType } from '../../lib/services'

const { Header, Sider, Content } = Layout
const { Text } = Typography

dayjs.extend(relativeTime)

interface AppLayoutProps {
  children: React.ReactNode
  user?: AuthUser
  onLogout?: () => void
}

function shortenAddr(addr: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** University crest logo */
function VNDCCrest({ collapsed }: { collapsed: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10 }}>
      <svg width={36} height={36} viewBox="0 0 40 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        {/* Shield */}
        <path d="M20 2L4 9V22C4 31.5 11.5 39 20 42C28.5 39 36 31.5 36 22V9L20 2Z"
          fill="url(#cg)" stroke="#818CF8" strokeWidth="0.8" />
        {/* V letter */}
        <text x="12" y="28" fontFamily="Georgia, serif" fontSize="17" fontWeight="700" fill="#FFFFFF">V</text>
        {/* Stars row */}
        <circle cx="14" cy="9" r="1.3" fill="#FCD34D" />
        <circle cx="20" cy="7" r="1.3" fill="#FCD34D" />
        <circle cx="26" cy="9" r="1.3" fill="#FCD34D" />
        <defs>
          <linearGradient id="cg" x1="4" y1="2" x2="36" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4338CA" />
            <stop offset="1" stopColor="#1A1744" />
          </linearGradient>
        </defs>
      </svg>
      {!collapsed && (
        <div style={{ lineHeight: 1 }}>
          <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15, fontFamily: 'Georgia, serif', letterSpacing: 0.5 }}>
            VNDC
          </div>
          <div style={{ color: '#818CF8', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 1 }}>
            Giáo dục
          </div>
        </div>
      )}
    </div>
  )
}

const navItems = [
  { key: '/dashboard',  icon: <DashboardOutlined />, label: 'Bảng điều khiển' },
  { key: '/tokens',     icon: <WalletOutlined />,    label: 'Token & Ví' },
  { key: '/activities', icon: <FireOutlined />,      label: 'Hoạt động' },
  { key: '/dao',        icon: <ApartmentOutlined />, label: 'Bầu cử & DAO' },
  { key: '/marketplace',icon: <ShopOutlined />,      label: 'Chợ giao dịch' },
  { key: '/campaigns',  icon: <FundOutlined />,      label: 'Gây quỹ' },
  { key: '/events',     icon: <CalendarOutlined />,  label: 'Sự kiện' },
]

export function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifItems, setNotifItems] = useState<AppNotification[]>([])
  const navigate  = useNavigate()
  const location  = useLocation()

  const walletAddr  = user?.wallet_address ?? ''
  const displayName = user?.full_name || user?.username || shortenAddr(walletAddr)
  const isAdmin     = user?.roles?.includes('admin') || user?.roles?.includes('ADMIN')
  const isLecturer  = user?.roles?.includes('LECTURER') || user?.roles?.includes('lecturer')

  const roleLabel  = isAdmin ? 'Quản trị viên' : isLecturer ? 'Giảng viên' : 'Sinh viên'
  const roleColor  = isAdmin ? '#D97706' : isLecturer ? '#6366F1' : '#059669'
  const roleBorder = isAdmin ? '#D97706' : isLecturer ? '#6366F1' : '#059669'

  const allNavItems = [
    ...navItems,
    ...(isAdmin ? [{ key: '/admin', icon: <SettingOutlined />, label: 'Quản trị' }] : []),
  ]

  const dropdownItems = [
    { key: 'profile', icon: <UserOutlined />,   label: 'Hồ sơ & Bảo mật', onClick: () => navigate('/profile') },
    { key: 'copy',    icon: <CopyOutlined />,   label: 'Sao chép địa chỉ ví', onClick: () => { void navigator.clipboard.writeText(walletAddr) } },
    { type: 'divider' as const },
    { key: 'logout',  icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: onLogout },
  ]

  const sidebarW = collapsed ? 72 : 224

  async function loadHeaderNotifications() {
    setNotifLoading(true)
    try {
      const result = await getMyNotifications(1, 12)
      setNotifItems(result.items)
    } catch {
      setNotifItems([])
    } finally {
      setNotifLoading(false)
    }
  }

  function iconByNotifType(type: AppNotificationType) {
    switch (type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />
    }
  }

  const notificationPopover = (
    <div style={{ width: 360, maxHeight: 430, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>Thông báo</Text>
        <Button type="link" size="small" onClick={() => navigate('/profile')}>
          Cài đặt
        </Button>
      </div>
      {notifLoading ? (
        <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
      ) : notifItems.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo" />
      ) : (
        <List
          size="small"
          dataSource={notifItems}
          renderItem={(item) => (
            <List.Item style={{ alignItems: 'flex-start' }}>
              <Space align="start" size={10} style={{ width: '100%' }}>
                <span style={{ fontSize: 16, marginTop: 2 }}>{iconByNotifType(item.type)}</span>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                    <Tag color={item.type} style={{ margin: 0 }}>{item.source || 'Hệ thống'}</Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(item.created_at).fromNow()}
                    </Text>
                  </div>
                </div>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* -- Sidebar ---------------------------------- */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={sidebarW}
        collapsedWidth={72}
        style={{
          background: 'var(--sidebar-bg, #1A1744)',
          position: 'fixed',
          left: 0, top: 0, bottom: 0,
          zIndex: 100,
          overflow: 'hidden auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0' : '0 18px',
            borderBottom: '1px solid rgba(99,102,241,0.25)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => navigate('/dashboard')}
        >
          <VNDCCrest collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '10px 0' }}>
          {allNavItems.map((item) => {
            const active = location.pathname === item.key
            return (
              <div
                key={item.key}
                role="menuitem"
                tabIndex={0}
                onClick={() => navigate(item.key)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: collapsed ? '13px 0' : '11px 18px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  cursor: 'pointer',
                  borderLeft: active ? '3px solid #818CF8' : '3px solid transparent',
                  background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                  color: active ? '#C7D2FE' : '#94A3B8',
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.18s ease',
                  margin: '1px 0',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(99,102,241,0.10)'
                    e.currentTarget.style.color = '#C7D2FE'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#94A3B8'
                  }
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, opacity: active ? 1 : 0.75 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </div>
            )
          })}
        </nav>

        {/* Wallet chip at bottom */}
        {!collapsed && walletAddr && (
          <div style={{
            borderTop: '1px solid rgba(99,102,241,0.18)',
            padding: '14px 18px',
            background: 'rgba(0,0,0,0.18)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 9, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Ví kết nối
            </div>
            <div
              style={{ color: '#A5B4FC', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer', marginBottom: 6 }}
              onClick={() => void navigator.clipboard.writeText(walletAddr)}
              title="Sao chép địa chỉ"
            >
              {shortenAddr(walletAddr)}
            </div>
            <div style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 600,
              color: roleColor,
              border: `1px solid ${roleBorder}55`,
              borderRadius: 4,
              padding: '2px 8px',
            }}>
              {roleLabel}
            </div>
          </div>
        )}
      </Sider>

      {/* -- Main area -------------------------------- */}
      <Layout style={{ marginLeft: sidebarW, transition: 'margin-left 0.2s ease' }}>
        {/* Top bar */}
        <Header style={{
          background: '#FFFFFF',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E8E6F0',
          boxShadow: '0 1px 4px rgba(67,56,202,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          height: 64,
        }}>
          {/* Collapse toggle */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, color: '#6B7280' }}
          />

          {/* Right actions */}
          <Space size={8}>
            <Popover
              content={notificationPopover}
              trigger="click"
              open={notifOpen}
              onOpenChange={(open) => {
                setNotifOpen(open)
                if (open) {
                  void loadHeaderNotifications()
                }
              }}
              placement="bottomRight"
            >
              <Badge count={notifItems.length} size="small" color="#4338CA">
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18, color: '#6B7280' }} />} />
              </Badge>
            </Popover>

            <div style={{ width: 1, height: 24, background: '#E5E7EB' }} />

            <Dropdown menu={{ items: dropdownItems }} placement="bottomRight" trigger={['click']}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', padding: '6px 10px', borderRadius: 8,
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0EFF8' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Avatar
                  style={{ background: 'linear-gradient(135deg, #4338CA, #6366F1)', flexShrink: 0 }}
                  icon={<UserOutlined />}
                  size={32}
                />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1744' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: roleColor }}>{roleLabel}</div>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Page content */}
        <Content style={{
          padding: 28,
          background: 'var(--bg, #F4F3EF)',
          minHeight: 'calc(100vh - 64px)',
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

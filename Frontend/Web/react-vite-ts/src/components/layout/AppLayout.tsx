import { useEffect, useState } from 'react'
import {
  Layout,
  Avatar,
  Dropdown,
  Badge,
  Button,
  Space,
  Popover,
  List,
  Typography,
  Empty,
  Spin,
  Tag,
  Drawer,
  Tooltip,
  Grid,
} from 'antd'
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
const { useBreakpoint } = Grid

dayjs.extend(relativeTime)

interface AppLayoutProps {
  children: React.ReactNode
  user?: AuthUser
  onLogout?: () => void
}

interface NavItem {
  key: string
  icon: React.ReactNode
  label: string
}

function shortenAddr(addr: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function VNDCCrest({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={collapsed ? 'app-brand is-collapsed' : 'app-brand'}>
      <span className="vndc-mark">V</span>
      {!collapsed && (
        <div className="app-brand-text">
          <div className="app-brand-name">VNDC</div>
          <div className="app-brand-caption">Campus chain</div>
        </div>
      )}
    </div>
  )
}

const navItems: NavItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Bảng điều khiển' },
  { key: '/tokens', icon: <WalletOutlined />, label: 'Token và ví' },
  { key: '/activities', icon: <FireOutlined />, label: 'Hoạt động' },
  { key: '/dao', icon: <ApartmentOutlined />, label: 'Bầu cử và DAO' },
  { key: '/marketplace', icon: <ShopOutlined />, label: 'Chợ giao dịch' },
  { key: '/campaigns', icon: <FundOutlined />, label: 'Gây quỹ' },
  { key: '/events', icon: <CalendarOutlined />, label: 'Sự kiện' },
]

export function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifItems, setNotifItems] = useState<AppNotification[]>([])
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isDesktop = Boolean(screens.md)

  const walletAddr = user?.wallet_address ?? ''
  const displayName = user?.full_name || user?.username || shortenAddr(walletAddr)
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('ADMIN')
  const isLecturer = user?.roles?.includes('LECTURER') || user?.roles?.includes('lecturer')

  const roleLabel = isAdmin ? 'Quản trị viên' : isLecturer ? 'Giảng viên' : 'Sinh viên'
  const roleColor = isAdmin ? '#D97706' : isLecturer ? '#2563EB' : '#059669'

  const allNavItems: NavItem[] = [
    ...navItems,
    ...(isAdmin ? [{ key: '/admin', icon: <SettingOutlined />, label: 'Quản trị' }] : []),
  ]
  const currentNav = allNavItems.find((item) => item.key === location.pathname) ?? allNavItems[0]

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const dropdownItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ và bảo mật', onClick: () => navigate('/profile') },
    { key: 'copy', icon: <CopyOutlined />, label: 'Sao chép địa chỉ ví', onClick: () => { void navigator.clipboard.writeText(walletAddr) } },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: onLogout },
  ]

  const sidebarW = collapsed ? 76 : 248

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
        return <CheckCircleOutlined style={{ color: '#059669' }} />
      case 'warning':
        return <WarningOutlined style={{ color: '#D97706' }} />
      case 'error':
        return <CloseCircleOutlined style={{ color: '#DC2626' }} />
      default:
        return <InfoCircleOutlined style={{ color: '#2563EB' }} />
    }
  }

  function renderNavItem(item: NavItem, navCollapsed: boolean) {
    const active = location.pathname === item.key
    const node = (
      <button
        key={item.key}
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => navigate(item.key)}
        className={[
          'app-nav-item',
          active ? 'is-active' : '',
          navCollapsed ? 'is-collapsed' : '',
        ].join(' ')}
      >
        <span className="app-nav-icon">{item.icon}</span>
        {!navCollapsed && <span>{item.label}</span>}
      </button>
    )
    return navCollapsed ? (
      <Tooltip key={item.key} title={item.label} placement="right">
        {node}
      </Tooltip>
    ) : node
  }

  function SidebarContent({ navCollapsed }: { navCollapsed: boolean }) {
    return (
      <div className="app-sidebar-inner">
        <div onClick={() => navigate('/dashboard')}>
          <VNDCCrest collapsed={navCollapsed} />
        </div>

        <nav className="app-nav" aria-label="Điều hướng chính">
          {allNavItems.map((item) => renderNavItem(item, navCollapsed))}
        </nav>

        {!navCollapsed && walletAddr && (
          <div className="app-wallet-card">
            <div className="app-wallet-label">Ví kết nối</div>
            <div
              className="app-wallet-address"
              onClick={() => void navigator.clipboard.writeText(walletAddr)}
              title="Sao chép địa chỉ"
            >
              {shortenAddr(walletAddr)}
            </div>
            <span className="app-role-chip">{roleLabel}</span>
          </div>
        )}
      </div>
    )
  }

  const notificationPopover = (
    <div className="notification-panel">
      <div className="notification-heading">
        <Text strong>Thông báo</Text>
        <Button type="link" size="small" onClick={() => navigate('/profile')}>
          Cài đặt
        </Button>
      </div>
      {notifLoading ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="small" />
        </div>
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
    <Layout className="app-layout">
      {isDesktop && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={sidebarW}
          collapsedWidth={76}
          className="app-sidebar"
        >
          <SidebarContent navCollapsed={collapsed} />
        </Sider>
      )}

      <Drawer
        open={!isDesktop && mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        placement="left"
        width={288}
        closable={false}
        className="app-mobile-drawer"
      >
        <SidebarContent navCollapsed={false} />
      </Drawer>

      <Layout className="app-main" style={{ marginLeft: isDesktop ? sidebarW : 0 }}>
        <Header className="app-header">
          <div className="app-header-left">
            <Button
              type="text"
              icon={isDesktop ? (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />) : <MenuUnfoldOutlined />}
              onClick={() => {
                if (isDesktop) setCollapsed(!collapsed)
                else setMobileNavOpen(true)
              }}
              aria-label="Mở điều hướng"
            />
            <div className="app-current-page">
              <div className="app-current-title">{currentNav?.label ?? 'VNDC'}</div>
              <div className="app-current-subtitle">Local chain 31337</div>
            </div>
          </div>

          <div className="app-header-actions">
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
              <Badge count={notifItems.length} size="small" color="#2563EB">
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} aria-label="Thông báo" />
              </Badge>
            </Popover>

            <div className="app-divider" />

            <Dropdown menu={{ items: dropdownItems }} placement="bottomRight" trigger={['click']}>
              <div className="app-user-trigger">
                <Avatar
                  style={{ background: '#2563EB', flexShrink: 0 }}
                  icon={<UserOutlined />}
                  size={32}
                />
                <div className="app-user-meta">
                  <div className="app-user-name">{displayName}</div>
                  <div className="app-user-role" style={{ color: roleColor }}>{roleLabel}</div>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="app-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

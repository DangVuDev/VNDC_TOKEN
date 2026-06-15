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
  LineChartOutlined,
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
      <img className="vndc-mark" src="/logo.png" alt="VNDC" />
      <div className="app-brand-text">
        <div className="app-brand-name">VNDC</div>
        <div className="app-brand-caption">Campus chain</div>
      </div>
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
    { key: '/markets', icon: <LineChartOutlined />, label: 'Thị trường crypto' },
]


const APP_LAYOUT_BACKGROUND_STYLES = `
.app-layout {
  --app-bg-ink: #07162f;
  --app-bg-muted: #52627a;
  --app-bg-blue: #0877e8;
  --app-bg-blue-strong: #005cc8;
  --app-bg-cyan: #17bde7;
  --app-bg-violet: #7c3aed;
  --app-bg-orange: #ffb020;
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  overflow-x: clip;
  color: var(--app-bg-ink);
  background:
    radial-gradient(880px 520px at 14% -4%, rgba(8, 119, 232, .18), transparent 68%),
    radial-gradient(900px 560px at 100% 8%, rgba(23, 189, 231, .18), transparent 70%),
    radial-gradient(760px 520px at 70% 62%, rgba(255, 176, 32, .10), transparent 72%),
    linear-gradient(180deg, #fafdff 0%, #eef8ff 38%, #f7fbff 72%, #ffffff 100%) !important;
}

.app-layout::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -4;
  pointer-events: none;
  background:
    linear-gradient(116deg, rgba(8,119,232,.08), transparent 26%, rgba(23,189,231,.08) 54%, transparent 82%),
    radial-gradient(circle at 18% 18%, rgba(255,255,255,.82), transparent 24%),
    radial-gradient(circle at 82% 34%, rgba(255,255,255,.62), transparent 24%);
}

.app-layout::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -3;
  pointer-events: none;
  opacity: .22;
  background-image:
    linear-gradient(rgba(8, 119, 232, .10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(8, 119, 232, .08) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent);
}

.app-background {
  position: fixed;
  inset: 0;
  z-index: -2;
  overflow: hidden;
  pointer-events: none;
}

.app-bg-ribbon,
.app-bg-orb,
.app-bg-noise {
  position: absolute;
  display: block;
  pointer-events: none;
}

.app-bg-ribbon {
  width: 112vw;
  height: 340px;
  left: -8vw;
  border-radius: 999px;
  filter: blur(34px);
  opacity: .55;
  transform-origin: center;
  animation: app-bg-wave 18s ease-in-out infinite;
}

.app-bg-ribbon-one {
  top: 120px;
  background: linear-gradient(90deg, transparent 0%, rgba(8,119,232,.22) 24%, rgba(23,189,231,.20) 50%, rgba(124,58,237,.12) 74%, transparent 100%);
  transform: rotate(-10deg) skewX(-12deg);
}

.app-bg-ribbon-two {
  top: 52%;
  left: -18vw;
  width: 126vw;
  height: 400px;
  opacity: .38;
  background: linear-gradient(90deg, transparent 0%, rgba(255,176,32,.18) 20%, rgba(8,119,232,.14) 48%, rgba(23,189,231,.18) 76%, transparent 100%);
  transform: rotate(9deg) skewX(14deg);
  animation-duration: 22s;
  animation-delay: -6s;
}

.app-bg-ribbon-three {
  bottom: -48px;
  left: -12vw;
  width: 120vw;
  height: 320px;
  opacity: .34;
  background: linear-gradient(90deg, transparent 0%, rgba(124,58,237,.14) 24%, rgba(23,189,231,.16) 52%, rgba(8,119,232,.14) 78%, transparent 100%);
  transform: rotate(-7deg) skewX(-9deg);
  animation-duration: 24s;
  animation-delay: -10s;
}

.app-bg-orb {
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), rgba(23,189,231,.20) 36%, rgba(8,119,232,.10) 68%, transparent 72%);
  filter: blur(10px);
  opacity: .52;
  animation: app-bg-float 13s ease-in-out infinite;
}

.app-bg-orb-one { right: 5vw; top: 112px; }
.app-bg-orb-two {
  left: 12vw;
  bottom: 5vh;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle at 36% 26%, rgba(255,255,255,.92), rgba(255,176,32,.16) 34%, rgba(124,58,237,.12) 66%, transparent 72%);
  animation-delay: -5s;
}

.app-bg-noise {
  inset: 0;
  opacity: .12;
  background-image: radial-gradient(rgba(7,22,47,.14) .7px, transparent .7px);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, transparent, #000 10%, #000 90%, transparent);
}

.app-layout .app-main,
.app-layout .app-content {
  position: relative;
  z-index: 1;
  background: transparent !important;
}

.app-layout .app-content {
  min-height: calc(100dvh - 72px);
  padding: clamp(16px, 2vw, 28px);
}

.app-layout .app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
  padding-inline: clamp(14px, 2vw, 24px);
  border-bottom: 1px solid rgba(255,255,255,.66);
  background: rgba(255,255,255,.72) !important;
  backdrop-filter: blur(22px) saturate(1.32);
  -webkit-backdrop-filter: blur(22px) saturate(1.32);
  box-shadow: 0 18px 44px rgba(8,53,120,.06);
}

.app-layout .app-sidebar {
  position: fixed !important;
  inset: 0 auto 0 0;
  z-index: 40;
  min-height: 100dvh;
  border-right: 1px solid rgba(255,255,255,.74);
  background:
    linear-gradient(180deg, rgba(255,255,255,.82), rgba(244,250,255,.58)),
    radial-gradient(260px 220px at 12% 10%, rgba(8,119,232,.16), transparent 70%) !important;
  backdrop-filter: blur(24px) saturate(1.28);
  -webkit-backdrop-filter: blur(24px) saturate(1.28);
  box-shadow: 18px 0 50px rgba(8,53,120,.08);
}

.app-layout .app-sidebar-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 18px 12px;
}

.app-layout .app-sidebar-inner::before {
  content: "";
  position: absolute;
  inset: 14px;
  z-index: -1;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(255,255,255,.36), rgba(255,255,255,.12));
  border: 1px solid rgba(255,255,255,.48);
}

.app-layout .app-brand,
.app-layout .app-user-trigger,
.app-layout .app-wallet-card,
.app-layout .app-nav-item,
.app-layout .notification-panel {
  backdrop-filter: blur(14px) saturate(1.18);
  -webkit-backdrop-filter: blur(14px) saturate(1.18);
}

.app-layout .app-wallet-card {
  margin-top: auto;
  border: 1px solid rgba(255,255,255,.74);
  background: rgba(255,255,255,.62);
  box-shadow: 0 18px 44px rgba(8,53,120,.08);
}

.app-layout .app-nav-item {
  border: 1px solid transparent;
  background: transparent;
}

.app-layout .app-nav-item.is-active {
  border-color: rgba(8,119,232,.18);
  background: linear-gradient(135deg, rgba(8,119,232,.14), rgba(23,189,231,.10));
  box-shadow: 0 14px 32px rgba(8,119,232,.12);
}

.app-layout .app-nav-item:hover {
  border-color: rgba(8,119,232,.16);
  background: rgba(255,255,255,.58);
}

.app-mobile-drawer .ant-drawer-content,
.app-mobile-drawer .ant-drawer-body {
  background: rgba(247,251,255,.92) !important;
  backdrop-filter: blur(20px) saturate(1.25);
  -webkit-backdrop-filter: blur(20px) saturate(1.25);
}

@keyframes app-bg-wave {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-9deg) skewX(-10deg) scale(1); }
  50% { transform: translate3d(3vw, -18px, 0) rotate(-5deg) skewX(-5deg) scale(1.04); }
}

@keyframes app-bg-float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(-18px, 22px, 0) scale(1.05); }
}

@media (max-width: 768px) {
  .app-layout .app-content {
    padding: 14px;
  }

  .app-bg-ribbon {
    height: 250px;
    filter: blur(26px);
  }

  .app-bg-orb-one {
    right: -120px;
    top: 90px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-bg-ribbon,
  .app-bg-orb {
    animation: none !important;
  }
}
`

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
        <span className="app-nav-label">{item.label}</span>
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

        {walletAddr && (
          <div className={navCollapsed ? 'app-wallet-card is-collapsed' : 'app-wallet-card'}>
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
      <style>{APP_LAYOUT_BACKGROUND_STYLES}</style>
      <div className="app-background" aria-hidden="true">
        <span className="app-bg-ribbon app-bg-ribbon-one" />
        <span className="app-bg-ribbon app-bg-ribbon-two" />
        <span className="app-bg-ribbon app-bg-ribbon-three" />
        <span className="app-bg-orb app-bg-orb-one" />
        <span className="app-bg-orb app-bg-orb-two" />
        <span className="app-bg-noise" />
      </div>
      {isDesktop && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={248}
          collapsedWidth={76}
          className={collapsed ? 'app-sidebar is-collapsed' : 'app-sidebar'}
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
                if (isDesktop) setCollapsed((value) => !value)
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

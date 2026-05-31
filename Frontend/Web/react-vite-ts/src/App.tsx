import { ConfigProvider } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import viVN from 'antd/locale/vi_VN'
import { antdTheme } from './theme'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { TokenPage } from './pages/TokenPage'
import { DAOPage } from './pages/DAOPage'
import MarketplacePage from './pages/MarketplacePage'
import { CampaignsPage } from './pages/CampaignsPage'
import EventsPage from './pages/EventsPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminPage } from './pages/AdminPage'

function ProtectedApp() {
  const auth = useAuthContext()

  if (!auth.isLoggedIn) {
    return (
      <LoginPage
        onGetChallenge={async (addr) => {
          const msg = await auth.getChallenge(addr)
          return { message: msg, nonce: '' }
        }}
        onLogin={async (addr, msg, sig) => {
          const result = await auth.login(addr, msg, sig)
          return result
        }}
        onComplete2FA={auth.complete2FA}
      />
    )
  }

  return (
    <AppLayout user={auth.user ?? undefined} onLogout={auth.logout}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage user={auth.user ?? undefined} />} />
        <Route path="/tokens" element={<TokenPage user={auth.user ?? undefined} />} />
        <Route path="/activities" element={<ActivitiesPage user={auth.user ?? undefined} />} />
        <Route path="/dao" element={<DAOPage user={auth.user ?? undefined} />} />
        <Route path="/marketplace" element={<MarketplacePage user={auth.user ?? undefined} />} />
        <Route path="/campaigns" element={<CampaignsPage user={auth.user ?? undefined} />} />
        <Route path="/events" element={<EventsPage user={auth.user ?? undefined} />} />
        <Route path="/profile" element={<ProfilePage user={auth.user ?? undefined} />} />
        <Route path="/admin" element={<AdminPage user={auth.user ?? undefined} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={viVN}>
      <BrowserRouter>
        <AuthProvider>
          <ProtectedApp />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}


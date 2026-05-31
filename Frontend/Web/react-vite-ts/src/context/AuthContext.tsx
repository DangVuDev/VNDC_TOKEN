import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTokenRefresh } from '../hooks/useTokenRefresh'
import { useWalletEvents } from '../hooks/useWalletEvents'

type AuthContextValue = ReturnType<typeof useAuth>

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

/**
 * AuthProvider wraps the entire app to provide centralized auth state.
 * - Auto-refreshes JWT 2 min before expiry
 * - Detects MetaMask wallet/chain changes and logs out automatically
 * - Single useAuth() instance — no duplicate state
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth()

  // Auto-refresh token 2 minutes before expiry
  useTokenRefresh(auth.tokens, auth.refresh, auth.logout)

  // Detect wallet account or chain changes
  useWalletEvents(auth.user?.wallet_address, auth.logout)

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

/**
 * useAuthContext — consume auth state and actions from AuthProvider.
 * Must be used inside <AuthProvider>.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>')
  return ctx
}

import { useState, useCallback, useRef } from 'react'
import { connectWallet, getEthereumChainId, signPersonalMessage } from '../lib/wallet'
import { createApiClient } from '../lib/api'

type WalletState = {
  address: string | null
  chainId: number | null
  connected: boolean
  connecting: boolean
  error: string | null
}

const initialState: WalletState = {
  address: null,
  chainId: null,
  connected: false,
  connecting: false,
  error: null,
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(initialState)

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }))
    try {
      const accounts = await connectWallet()
      const address = accounts[0] ?? null
      const chainId = await getEthereumChainId()
      setState({ address, chainId, connected: !!address, connecting: false, error: null })
      return address
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, connecting: false, error }))
      return null
    }
  }, [])

  const disconnect = useCallback(() => {
    setState(initialState)
  }, [])

  return { ...state, connect, disconnect, signPersonalMessage }
}

export type AuthTokens = {
  access_token: string
  refresh_token: string
  expires_at: string
  token_type: string
  user: AuthUser
}

export type AuthUser = {
  id: string
  wallet_address: string
  status: string
  roles: string[]
  two_factor_enabled?: boolean
  email?: string
  full_name?: string
  username?: string
}

export type LoginResult = AuthTokens | PendingTwoFactorResult

type PendingTwoFactorResult = {
  requires_2fa: true
  temp_token: string
  message?: string
}

function isPendingTwoFactorResult(value: LoginResult): value is PendingTwoFactorResult {
  return 'requires_2fa' in value && value.requires_2fa === true
}

export type Session = {
  id: string
  device: string
  ip: string
  created_at: string
  last_used: string
}

type AuthState = {
  tokens: AuthTokens | null
  sessions: Session[]
  loading: boolean
  twoFaRequired: boolean
  tempToken: string | null
}

type RawSession = {
  id: string
  device_name?: string
  device_os?: string
  ip_address?: string
  issued_at?: string
  last_used_at?: string
}

type SetupTwoFactorResponse = {
  secret: string
  otp_auth_uri: string
  backup_codes: string[]
}

const AUTH_STORAGE_KEY = 'vndc_auth_session'
const TOKEN_KEY = 'vndc_access_token'
const REFRESH_KEY = 'vndc_refresh_token'

function isAuthTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AuthTokens>
  return typeof candidate.access_token === 'string'
    && typeof candidate.refresh_token === 'string'
    && typeof candidate.expires_at === 'string'
    && typeof candidate.token_type === 'string'
    && !!candidate.user
}

function mapSession(session: RawSession): Session {
  return {
    id: session.id,
    device: session.device_name || session.device_os || 'Unknown device',
    ip: session.ip_address || 'Unknown IP',
    created_at: session.issued_at || new Date().toISOString(),
    last_used: session.last_used_at || session.issued_at || new Date().toISOString(),
  }
}

function loadStoredTokens(): AuthTokens | null {
  try {
    const storedSession = localStorage.getItem(AUTH_STORAGE_KEY)
    if (storedSession) {
      const parsed = JSON.parse(storedSession) as unknown
      if (isAuthTokens(parsed)) {
        return parsed
      }
    }

    const access = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
    const refresh = localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY)
    if (access && refresh) {
      return {
        access_token: access,
        refresh_token: refresh,
        expires_at: new Date(0).toISOString(),
        token_type: 'Bearer',
        user: {
          id: '',
          wallet_address: '',
          status: 'ACTIVE',
          roles: [],
        },
      }
    }
  } catch {}
  return null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    tokens: loadStoredTokens(),
    sessions: [],
    loading: false,
    twoFaRequired: false,
    tempToken: null,
  })

  const apiRef = useRef(
    createApiClient({
      getToken: () => state.tokens?.access_token ?? null,
    })
  )

  // Keep api reference in sync with latest token
  const getApi = useCallback(() => {
    return createApiClient({
      getToken: () => state.tokens?.access_token ?? null,
    })
  }, [state.tokens])

  function saveTokens(tokens: AuthTokens) {
    console.log("Save access_token: ", tokens.access_token);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens))
    localStorage.setItem(TOKEN_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
    setState((s) => ({ ...s, tokens, twoFaRequired: false, tempToken: null, loading: false }))
  }

  function clearTokens() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
    setState((s) => ({ ...s, tokens: null, twoFaRequired: false, tempToken: null, loading: false }))
  }

  const getChallenge = useCallback(async (wallet: string): Promise<string> => {
    const api = getApi()
    const resp = await api.request<unknown>({
      method: 'GET',
      path: '/auth/challenge',
      query: { wallet },
    })

    // Backend may return several shapes. Try to extract the message robustly.
    // Examples:
    // - { message: '...' }
    // - { data: { message: '...' } }
    // - the raw string (unlikely)
    if (!resp) throw new Error('Empty challenge response')
    if (typeof resp === 'string') return resp
    const anyResp = resp as any
    if (typeof anyResp.message === 'string') return anyResp.message
    if (anyResp.data && typeof anyResp.data.message === 'string') return anyResp.data.message
    // Try common capitalizations
    if (typeof anyResp.Message === 'string') return anyResp.Message
    if (anyResp.data && typeof anyResp.data.Message === 'string') return anyResp.data.Message

    throw new Error('Unexpected challenge response format')
  }, [getApi])

  const login = useCallback(async (wallet: string, message: string, signature: string): Promise<LoginResult> => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const api = getApi()
      const data = await api.request<LoginResult>({
        method: 'POST',
        path: '/auth/login',
        body: { wallet, message, signature, device_name: 'VNDC User App', device_os: navigator.userAgent },
      })
      if (isPendingTwoFactorResult(data) && data.temp_token) {
        setState((s) => ({
          ...s,
          twoFaRequired: true,
          tempToken: data.temp_token ?? null,
          loading: false,
        }))
      } else if (isAuthTokens(data)) {
        saveTokens(data)
      } else {
        throw new Error('Unexpected login response format')
      }
      return data
    } catch (e) {
      setState((s) => ({ ...s, loading: false }))
      throw e
    }
  }, [getApi])

  const complete2FA = useCallback(async (code: string) => {
    if (!state.tempToken) throw new Error('No pending 2FA session')
    setState((s) => ({ ...s, loading: true }))
    try {
      const api = getApi()
      const data = await api.request<AuthTokens>({
        method: 'POST',
        path: '/auth/2fa/complete',
        body: { temp_token: state.tempToken, code },
      })
      saveTokens(data)
      return data
    } catch (e) {
      setState((s) => ({ ...s, loading: false }))
      throw e
    }
  }, [state.tempToken, getApi])

  const refresh = useCallback(async () => {
    if (!state.tokens?.refresh_token) throw new Error('No refresh token')
    const api = getApi()
    const data = await api.request<AuthTokens>({
      method: 'POST',
      path: '/auth/refresh',
      body: { refresh_token: state.tokens.refresh_token },
    })
    saveTokens(data)
    return data
  }, [state.tokens, getApi])

  const logout = useCallback(async () => {
    try {
      const api = getApi()
      await api.request({ method: 'POST', path: '/auth/logout', auth: true })
    } finally {
      clearTokens()
    }
  }, [getApi])

  const logoutAll = useCallback(async () => {
    try {
      const api = getApi()
      await api.request({ method: 'POST', path: '/auth/logout-all', auth: true })
    } finally {
      clearTokens()
    }
  }, [getApi])

  const fetchSessions = useCallback(async () => {
    const api = getApi()
    const data = await api.request<RawSession[]>({
      method: 'GET',
      path: '/auth/sessions',
      auth: true,
    })
    const sessions = (data ?? []).map(mapSession)
    setState((s) => ({ ...s, sessions }))
    return sessions
  }, [getApi])

  const revokeSession = useCallback(async (id: string) => {
    const api = getApi()
    await api.request({ method: 'DELETE', path: `/auth/sessions/${id}`, auth: true })
    setState((s) => ({ ...s, sessions: s.sessions.filter((sess) => sess.id !== id) }))
  }, [getApi])

  const setup2FA = useCallback(async () => {
    const api = getApi()
    return api.request<SetupTwoFactorResponse>({
      method: 'POST',
      path: '/auth/2fa/setup',
      auth: true,
    })
  }, [getApi])

  const enable2FA = useCallback(async (code: string) => {
    const api = getApi()
    return api.request({ method: 'POST', path: '/auth/2fa/enable', body: { code }, auth: true })
  }, [getApi])

  const disable2FA = useCallback(async (code: string) => {
    const api = getApi()
    return api.request({ method: 'POST', path: '/auth/2fa/disable', body: { code }, auth: true })
  }, [getApi])

  apiRef.current = getApi()

  return {
    ...state,
    isLoggedIn: !!state.tokens,
    user: state.tokens?.user ?? null,
    getChallenge,
    login,
    complete2FA,
    refresh,
    logout,
    logoutAll,
    fetchSessions,
    revokeSession,
    setup2FA,
    enable2FA,
    disable2FA,
  }
}

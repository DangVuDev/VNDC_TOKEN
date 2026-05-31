import { useEffect, useRef } from 'react'
import type { AuthTokens } from './useAuth'

const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000 // refresh 2 minutes before expiry

/**
 * Automatically refreshes the JWT access token before it expires.
 * Calls onRefresh 2 minutes before expires_at.
 * Calls onExpired if the token is already expired when evaluated.
 */
export function useTokenRefresh(
  tokens: AuthTokens | null,
  onRefresh: () => Promise<unknown>,
  onExpired: () => void,
) {
  const onRefreshRef = useRef(onRefresh)
  const onExpiredRef = useRef(onExpired)
  onRefreshRef.current = onRefresh
  onExpiredRef.current = onExpired

  useEffect(() => {
    if (!tokens?.expires_at) return

    const expiresAt = new Date(tokens.expires_at).getTime()
    if (isNaN(expiresAt)) return

    const refreshAt = expiresAt - REFRESH_BEFORE_EXPIRY_MS
    const delay = refreshAt - Date.now()

    if (delay <= 0) {
      // Already expired or about to expire — check if truly expired
      if (Date.now() >= expiresAt) {
        onExpiredRef.current()
      } else {
        // Less than 2 min left — refresh immediately
        onRefreshRef.current().catch(() => onExpiredRef.current())
      }
      return
    }

    const timer = setTimeout(() => {
      onRefreshRef.current().catch(() => onExpiredRef.current())
    }, delay)

    return () => clearTimeout(timer)
  }, [tokens?.expires_at])
}

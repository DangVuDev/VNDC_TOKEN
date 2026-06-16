import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { toast } from '../ui/Toast'
import type { Session } from '../../hooks/useAuth'

interface SessionsPanelProps {
  onFetch: () => Promise<Session[]>
  onRevoke: (id: string) => Promise<void>
  onLogoutAll: () => Promise<void>
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function SessionsPanel({ onFetch, onRevoke, onLogoutAll }: SessionsPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [logoutBusy, setLogoutBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await onFetch()
      setSessions(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sessions')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRevoke(id: string) {
    setRevoking(id)
    try {
      await onRevoke(id)
      setSessions((s) => s.filter((sess) => sess.id !== id))
      toast.success('Session revoked')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke session')
    }
    setRevoking(null)
  }

  async function handleLogoutAll() {
    setLogoutBusy(true)
    try {
      await onLogoutAll()
      toast.success('Logged out from all devices')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to logout all')
    }
    setLogoutBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="info">{sessions.length}</Badge>
          <Button variant="danger" size="sm" onClick={handleLogoutAll} loading={logoutBusy}>
            Logout All
          </Button>
        </div>
      </CardHeader>

      {loading ? (
        <div className="text-sm text-blue-400 animate-pulse py-4 text-center">Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-blue-300 py-4 text-center">No active sessions</p>
      ) : (
        <div className="divide-y divide-blue-50">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900 truncate">{s.device || 'Unknown device'}</p>
                <p className="text-xs text-blue-400 truncate">{s.ip} · {timeAgo(s.last_used)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={revoking === s.id}
                onClick={() => handleRevoke(s.id)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-blue-50">
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>
    </Card>
  )
}

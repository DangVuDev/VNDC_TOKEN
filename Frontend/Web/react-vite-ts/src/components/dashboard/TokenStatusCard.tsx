import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { toast } from '../ui/Toast'
import { useState } from 'react'

interface TokenStatusCardProps {
  expiresAt: string | null
  onRefresh: () => Promise<unknown>
}

export function TokenStatusCard({ expiresAt, onRefresh }: TokenStatusCardProps) {
  const [busy, setBusy] = useState(false)

  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0
  const remainingMs = expiresAtMs - Date.now()
  const isValid = remainingMs > 0
  const mins = isValid ? Math.floor(remainingMs / 60000) : 0

  async function handleRefresh() {
    setBusy(true)
    try {
      await onRefresh()
      toast.success('Token refreshed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed')
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Token</CardTitle>
        <Badge variant={isValid ? 'success' : 'danger'} dot>
          {isValid ? 'Valid' : 'Expired'}
        </Badge>
      </CardHeader>
      <div className="space-y-3">
        {isValid && (
          <p className="text-sm text-blue-600">
            Expires in <span className="font-semibold">{mins} min</span>
          </p>
        )}
        {expiresAt && (
          <p className="text-xs text-blue-400">Expires at {new Date(expiresAt).toLocaleString()}</p>
        )}
        {!isValid && (
          <p className="text-sm text-red-500">Your session has expired. Please refresh.</p>
        )}
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={busy}>
          Refresh Token
        </Button>
      </div>
    </Card>
  )
}

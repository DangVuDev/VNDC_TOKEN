import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { toast } from '../ui/Toast'

interface SecurityPanelProps {
  onSetup2FA: () => Promise<{ secret: string; otp_auth_uri: string; backup_codes: string[] }>
  onEnable2FA: (code: string) => Promise<unknown>
  onDisable2FA: (code: string) => Promise<unknown>
}

type Mode = 'idle' | 'setup' | 'disable'

export function SecurityPanel({ onSetup2FA, onEnable2FA, onDisable2FA }: SecurityPanelProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [enabled, setEnabled] = useState(false)

  async function handleSetup() {
    setBusy(true)
    setError('')
    try {
      const data = await onSetup2FA()
      setSecret(data.secret)
      setQrCode(data.otp_auth_uri)
      setBackupCodes(data.backup_codes)
      setMode('setup')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Setup failed')
    }
    setBusy(false)
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter your 6-digit code'); return }
    setBusy(true)
    setError('')
    try {
      await onEnable2FA(code)
      setEnabled(true)
      setMode('idle')
      setCode('')
      toast.success('2FA enabled successfully')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid code'
      setError(msg)
    }
    setBusy(false)
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter your 6-digit code'); return }
    setBusy(true)
    setError('')
    try {
      await onDisable2FA(code)
      setEnabled(false)
      setMode('idle')
      setCode('')
      toast.success('2FA disabled')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid code'
      setError(msg)
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <Badge variant={enabled ? 'success' : 'neutral'} dot>
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </CardHeader>

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {!enabled && (
            <Button onClick={handleSetup} loading={busy} size="sm">
              Set Up 2FA
            </Button>
          )}
          {enabled && (
            <Button variant="danger" onClick={() => { setMode('disable'); setCode(''); setError('') }} size="sm">
              Disable 2FA
            </Button>
          )}
        </div>
      )}

      {mode === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-blue-600">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
          </p>
          {qrCode && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs text-blue-500 mb-1">Authenticator URI:</p>
              <code className="block break-all text-xs font-mono text-blue-800">{qrCode}</code>
            </div>
          )}
          {secret && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-500 mb-1">Manual entry key:</p>
              <code className="text-sm font-mono text-blue-800 select-all">{secret}</code>
            </div>
          )}
          {backupCodes.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium mb-2">⚠ Save these backup codes:</p>
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((bc) => (
                  <code key={bc} className="text-xs font-mono text-amber-800">{bc}</code>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={handleEnable} className="space-y-3">
            <Input
              label="Confirm with code from app"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              error={error}
            />
            <div className="flex gap-2">
              <Button type="submit" loading={busy} size="sm">Enable</Button>
              <Button variant="ghost" onClick={() => setMode('idle')} size="sm">Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {mode === 'disable' && (
        <form onSubmit={handleDisable} className="space-y-3">
          <p className="text-sm text-red-600">Enter your authenticator code to disable 2FA.</p>
          <Input
            label="Authentication Code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            error={error}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={busy} size="sm">Disable</Button>
            <Button variant="ghost" onClick={() => setMode('idle')} size="sm">Cancel</Button>
          </div>
        </form>
      )}
    </Card>
  )
}

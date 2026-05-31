import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { toast } from '../ui/Toast'

interface TwoFactorPromptProps {
  onComplete: (code: string) => Promise<unknown>
}

export function TwoFactorPrompt({ onComplete }: TwoFactorPromptProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Enter your 6-digit code')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onComplete(code)
      toast.success('2FA verified')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid code'
      setError(msg)
      toast.error(msg)
    }
    setBusy(false)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-blue-500">
          Enter the 6-digit code from your authenticator app.
        </p>
        <Input
          label="Authentication Code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          error={error}
        />
        <Button type="submit" loading={busy} className="w-full">
          Verify
        </Button>
      </form>
    </Card>
  )
}

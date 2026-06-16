import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { toast } from '../ui/Toast'
import { useWallet } from '../../hooks/useAuth'
import type { LoginResult } from '../../hooks/useAuth'
import { signPersonalMessage } from '../../lib/wallet'

interface LoginCardProps {
  onLogin: (wallet: string, message: string, signature: string) => Promise<LoginResult>
  onGetChallenge: (wallet: string) => Promise<string>
}

export function LoginCard({ onLogin, onGetChallenge }: LoginCardProps) {
  const wallet = useWallet()
  const [step, setStep] = useState<'idle' | 'busy' | 'done'>('idle')
  const [challenge, setChallenge] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function handleConnectAndSign() {
    setBusy(true)
    setStatus('Connecting wallet...')
    const address = await wallet.connect()
    if (address) {
      try {
        setStatus('Requesting challenge...')
        const msg = await onGetChallenge(address)
        if (!msg || typeof msg !== 'string') throw new Error('Invalid challenge message')
        setChallenge(msg)
        setStatus('Signing message...')
        const signature = await signPersonalMessage(window.ethereum, address, msg)
        if (!signature || typeof signature !== 'string') throw new Error('Empty signature from wallet')
        setStatus('Completing login...')
        await onLogin(address, msg, signature)
        setStep('done')
        toast.success('Wallet connected and signed in')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Sign in failed')
        setStep('idle')
      }
    } else {
      toast.error(wallet.error ?? 'Failed to connect wallet')
    }
    setBusy(false)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <Badge variant="info">SIWE</Badge>
      </CardHeader>

      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-700">
        One click connects your wallet, signs the challenge, and logs you in.
      </div>

      <div className="space-y-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">🦊</div>
          <p className="text-sm text-blue-600">
            Connect your MetaMask wallet and sign the challenge in one step.
          </p>
          <Button onClick={handleConnectAndSign} loading={busy} className="w-full">
            Connect & Sign In
          </Button>
        </div>

        {(status || challenge) && (
          <div className="space-y-2">
            {status && <p className="text-xs font-medium text-blue-500">{status}</p>}
            {challenge && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono max-h-40 overflow-auto whitespace-pre-wrap">
                {challenge}
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="text-center text-emerald-600 font-medium">
            ✓ Signed in successfully
          </div>
        )}
      </div>
    </Card>
  )
}

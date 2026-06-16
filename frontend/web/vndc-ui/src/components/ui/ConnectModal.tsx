import { LoginCard } from '../auth/LoginCard'
import { TwoFactorPrompt } from '../auth/TwoFactorPrompt'
import type { LoginResult } from '../../hooks/useAuth'

interface ConnectModalProps {
  open: boolean
  onClose: () => void
  twoFaRequired: boolean
  onGetChallenge: (wallet: string) => Promise<string>
  onLogin: (wallet: string, message: string, signature: string) => Promise<LoginResult>
  onComplete2FA: (code: string) => Promise<unknown>
}

export function ConnectModal({
  open,
  onClose,
  twoFaRequired,
  onGetChallenge,
  onLogin,
  onComplete2FA,
}: ConnectModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-2xl leading-none text-white/70 hover:text-white"
          aria-label="Close"
        >
          x
        </button>

        {twoFaRequired ? (
          <TwoFactorPrompt onComplete={onComplete2FA} />
        ) : (
          <LoginCard onLogin={onLogin} onGetChallenge={onGetChallenge} />
        )}
      </div>
    </div>
  )
}

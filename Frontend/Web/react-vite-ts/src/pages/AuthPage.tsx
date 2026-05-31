import { LoginCard } from '../components/auth/LoginCard'
import { TwoFactorPrompt } from '../components/auth/TwoFactorPrompt'
import type { LoginResult } from '../hooks/useAuth'

interface AuthPageProps {
  twoFaRequired: boolean
  onGetChallenge: (wallet: string) => Promise<string>
  onLogin: (wallet: string, message: string, signature: string) => Promise<LoginResult>
  onComplete2FA: (code: string) => Promise<unknown>
}

export function AuthPage({ twoFaRequired, onGetChallenge, onLogin, onComplete2FA }: AuthPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="text-2xl font-bold text-blue-900">VNDC</span>
        </div>
        <p className="text-blue-500 text-sm">Decentralized finance on your terms</p>
      </div>

      {twoFaRequired ? (
        <TwoFactorPrompt onComplete={onComplete2FA} />
      ) : (
        <LoginCard onLogin={onLogin} onGetChallenge={onGetChallenge} />
      )}
    </div>
  )
}

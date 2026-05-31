import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

interface WalletCardProps {
  address: string
  onLogout: () => Promise<void>
}

function maskAddress(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export function WalletCard({ address, onLogout }: WalletCardProps) {

  function copyAddress() {
    navigator.clipboard.writeText(address)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Wallet</CardTitle>
        <Badge variant="success" dot>Active</Badge>
      </CardHeader>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-mono font-medium text-blue-900 truncate cursor-pointer hover:text-blue-600"
              onClick={copyAddress}
              title="Click to copy"
            >
              {maskAddress(address)}
            </p>
            <p className="text-xs text-blue-400">Authenticated wallet</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onLogout} className="w-full">
          Sign Out
        </Button>
      </div>
    </Card>
  )
}

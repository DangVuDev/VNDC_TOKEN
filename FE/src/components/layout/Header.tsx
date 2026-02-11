import { Menu, Wallet, ExternalLink, ChevronDown } from 'lucide-react';
import { useWeb3 } from '@/contexts/Web3Context';
import { shortenAddress } from '@/lib/utils';
import { NETWORKS } from '@/contracts/addresses';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { address, balance, isConnecting, isConnected, connect, disconnect, chainId } = useWeb3();

  const chainName = chainId ? (NETWORKS[chainId]?.name || `Chain ${chainId}`) : '';

  return (
    <header className="h-16 border-b border-surface-800/60 bg-surface-950/70 backdrop-blur-2xl flex items-center justify-between px-4 sm:px-6 shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-xl text-surface-400 hover:text-white hover:bg-surface-800 transition-all">
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <h2 className="text-sm font-semibold text-white">Vietnamese Digital Campus</h2>
          <p className="text-[11px] text-surface-500">Nền tảng quản lý đại học phi tập trung</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {isConnected && chainId && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-800/50 border border-surface-700/40">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
            <span className="text-xs font-medium text-surface-300">{chainName}</span>
            <ChevronDown size={12} className="text-surface-500" />
          </div>
        )}

        {isConnected ? (
          <div className="flex items-center gap-2">
            <div className="hidden md:block text-right mr-1">
              <p className="text-xs font-mono text-surface-300">{parseFloat(balance).toFixed(4)} ETH</p>
            </div>
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-800/60 hover:bg-surface-700 border border-surface-700/50 transition-all group"
            >
              <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{address?.[2]?.toUpperCase()}</span>
              </div>
              <span className="font-mono text-xs text-surface-300 group-hover:text-white">{shortenAddress(address!)}</span>
              <ExternalLink size={11} className="text-surface-500" />
            </button>
          </div>
        ) : (
          <button onClick={connect} disabled={isConnecting} className="btn-primary btn-sm">
            <Wallet size={15} />
            {isConnecting ? 'Connecting...' : 'Kết nối ví'}
          </button>
        )}
      </div>
    </header>
  );
}

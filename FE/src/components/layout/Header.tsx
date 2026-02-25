import { Menu, Wallet, ExternalLink, ChevronDown, Sun, Moon } from 'lucide-react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useTheme } from '@/contexts/ThemeContext';
import { shortenAddress } from '@/lib/utils';
import { NETWORKS } from '@/contracts/addresses';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { address, balance, isConnecting, isConnected, connect, disconnect, chainId } = useWeb3();
  const { theme, toggle } = useTheme();

  const chainName = chainId ? (NETWORKS[chainId]?.name || `Chain ${chainId}`) : '';

  return (
    <header className="h-16 border-b border-surface-200 bg-surface-50 flex items-center justify-between px-4 sm:px-6 shrink-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-200 transition-all">
          <Menu size={20} />
        </button>
        <div className="hidden sm:block">
          <h2 className="text-sm font-semibold text-surface-800">Vietnamese Digital Campus</h2>
          <p className="text-[11px] text-surface-400">Nền tảng quản lý đại học phi tập trung</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-all"
          title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {isConnected && chainId && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-200">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-surface-600">{chainName}</span>
          </div>
        )}

        {isConnected ? (
          <div className="flex items-center gap-2">
            <div className="hidden md:block text-right mr-1">
              <p className="text-xs font-mono text-surface-500">{parseFloat(balance).toFixed(4)} ETH</p>
            </div>
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 hover:bg-surface-200 border border-surface-200 transition-all group"
            >
              <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{address?.[2]?.toUpperCase()}</span>
              </div>
              <span className="font-mono text-xs text-surface-600 group-hover:text-surface-800">{shortenAddress(address!)}</span>
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

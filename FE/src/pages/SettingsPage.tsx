import { useState } from 'react';
import { Settings as SettingsIcon, Globe, Wallet, Bell, Moon, Sun, Monitor } from 'lucide-react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useTheme } from '@/contexts/ThemeContext';
import { NETWORKS } from '@/contracts/addresses';
import { shortenAddress } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { address, chainId, switchNetwork, connect, disconnect } = useWeb3();
  const { theme, setTheme } = useTheme();
  const [rpcUrl, setRpcUrl] = useState('http://127.0.0.1:8545');
  const [notifications, setNotifications] = useState({ tx: true, governance: true, jobs: false, scholarship: true });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-200 flex items-center justify-center">
          <SettingsIcon size={20} className="text-surface-600" />
        </div>
        <h1 className="text-xl font-bold text-surface-800">Cài đặt</h1>
      </div>

      {/* Theme */}
      <section className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-4">Giao diện</h2>
        <div className="grid grid-cols-3 gap-3">
          {([
            { id: 'light', label: 'Sáng', Icon: Sun },
            { id: 'dark', label: 'Tối', Icon: Moon },
            { id: 'system', label: 'Hệ thống', Icon: Monitor },
          ] as const).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTheme(id)}
              className={`p-4 rounded-xl border text-center transition-all ${
                theme === id ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300'
              }`}>
              <Icon size={20} className={theme === id ? 'text-brand-600 mx-auto mb-1' : 'text-surface-400 mx-auto mb-1'} />
              <span className={`text-sm font-medium ${theme === id ? 'text-brand-700' : 'text-surface-600'}`}>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Network */}
      <section className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-4">Mạng</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {Object.entries(NETWORKS).map(([id, net]) => (
            <button key={id} onClick={() => switchNetwork(Number(id))}
              className={`p-3 rounded-xl border text-left transition-all ${
                chainId === Number(id) ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300'
              }`}>
              <div className="flex items-center gap-2">
                {chainId === Number(id) && <div className="w-2 h-2 rounded-full bg-success-500" />}
                <span className="text-sm font-medium text-surface-800">{net.name}</span>
              </div>
              <p className="text-xs text-surface-400 mt-0.5">Chain {id}</p>
            </button>
          ))}
        </div>
        <div>
          <label className="label">Custom RPC</label>
          <input className="input" value={rpcUrl} onChange={e => setRpcUrl(e.target.value)} />
        </div>
      </section>

      {/* Wallet */}
      <section className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-4">Ví</h2>
        {address ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                  {address.slice(2, 4).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-800">{shortenAddress(address)}</p>
                  <p className="text-xs text-surface-400">{NETWORKS[chainId as keyof typeof NETWORKS]?.name || 'Unknown'}</p>
                </div>
              </div>
              <span className="badge badge-success">Connected</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 btn-sm" onClick={() => navigator.clipboard.writeText(address).then(() => toast.success('Đã copy!'))}>Copy</button>
              <button className="btn-danger flex-1 btn-sm" onClick={disconnect}>Ngắt kết nối</button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Wallet size={28} className="text-surface-400 mx-auto mb-2" />
            <p className="text-sm text-surface-500 mb-3">Chưa kết nối ví</p>
            <button className="btn-primary btn-sm" onClick={connect}>Kết nối MetaMask</button>
          </div>
        )}
      </section>

      {/* Notifications */}
      <section className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-4">Thông báo</h2>
        <div className="space-y-2">
          {([
            { key: 'tx' as const, label: 'Giao dịch', desc: 'Thành công / thất bại' },
            { key: 'governance' as const, label: 'Governance', desc: 'Đề xuất & bỏ phiếu' },
            { key: 'jobs' as const, label: 'Việc làm', desc: 'Việc làm mới' },
            { key: 'scholarship' as const, label: 'Học bổng', desc: 'Học bổng mới' },
          ]).map(n => (
            <div key={n.key} className="flex items-center justify-between py-3 border-b border-surface-200 last:border-0">
              <div>
                <p className="text-sm font-medium text-surface-800">{n.label}</p>
                <p className="text-xs text-surface-400">{n.desc}</p>
              </div>
              <button onClick={() => setNotifications(p => ({ ...p, [n.key]: !p[n.key] }))}
                className={`toggle-track ${notifications[n.key] ? 'active' : ''}`}>
                <span className="toggle-thumb" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-3">Thông tin</h2>
        <div className="space-y-2 text-sm">
          {[
            ['Version', 'v1.0.0-beta'],
            ['Smart Contracts', '18 modules'],
            ['Frontend', 'Vite 6 + React 18 + Tailwind v4'],
            ['Web3', 'ethers.js v6'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5">
              <span className="text-surface-500">{k}</span>
              <span className="font-medium text-surface-800">{v}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

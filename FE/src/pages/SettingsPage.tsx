import { useState } from 'react';
import { Settings as SettingsIcon, Globe, Wallet, Palette, Shield, Bell, Save, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { useWeb3 } from '@/contexts/Web3Context';
import { NETWORKS } from '@/contracts/addresses';
import { shortenAddress } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { address, chainId, switchNetwork, connect, disconnect } = useWeb3();
  const [rpcUrl, setRpcUrl] = useState('http://127.0.0.1:8545');
  const [ipfsGateway, setIpfsGateway] = useState('https://gateway.pinata.cloud/ipfs/');
  const [notifications, setNotifications] = useState({ tx: true, governance: true, jobs: false, scholarship: true });

  const handleSave = () => toast.success('Cài đặt đã được lưu!');

  return (
    <div>
      <PageHeader title="Cài đặt" description="Cấu hình mạng, ví, giao diện và thông báo" lucideIcon={SettingsIcon} badge="Settings"
        action={<button className="btn-primary btn-sm" onClick={handleSave}><Save size={14} /> Lưu</button>}
      />

      <Tabs tabs={[
        { id: 'network', label: 'Mạng', icon: <Globe size={14} /> },
        { id: 'wallet', label: 'Ví', icon: <Wallet size={14} /> },
        { id: 'notifications', label: 'Thông báo', icon: <Bell size={14} /> },
        { id: 'about', label: 'Thông tin', icon: <Shield size={14} /> },
      ]}>
        {(active) => active === 'network' ? (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">Chọn mạng</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(NETWORKS).map(([id, net]) => (
                  <button key={id} onClick={() => switchNetwork(Number(id))}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      chainId === Number(id)
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-surface-700 bg-surface-800/30 hover:border-surface-600'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {chainId === Number(id) && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                      <span className="text-sm font-semibold text-white">{net.name}</span>
                    </div>
                    <p className="text-xs text-surface-400">Chain ID: {id}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">RPC & Gateway</h3>
              <div className="space-y-4">
                <div><label className="label">Custom RPC URL</label><input className="input" value={rpcUrl} onChange={e => setRpcUrl(e.target.value)} /></div>
                <div><label className="label">IPFS Gateway</label><input className="input" value={ipfsGateway} onChange={e => setIpfsGateway(e.target.value)} /></div>
              </div>
            </div>
          </div>
        ) : active === 'wallet' ? (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Quản lý ví</h3>
            {address ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white font-bold">
                        {address.slice(2, 4).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{shortenAddress(address)}</p>
                        <p className="text-xs text-surface-400">MetaMask • {NETWORKS[chainId as keyof typeof NETWORKS]?.name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs text-emerald-400">Connected</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => navigator.clipboard.writeText(address).then(() => toast.success('Đã copy!'))}>
                    Copy Address
                  </button>
                  <button className="btn-danger flex-1" onClick={disconnect}>Ngắt kết nối</button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Wallet size={32} className="text-surface-500 mx-auto mb-3" />
                <p className="text-sm text-surface-400 mb-4">Chưa kết nối ví</p>
                <button className="btn-primary" onClick={connect}>Kết nối MetaMask</button>
              </div>
            )}
          </div>
        ) : active === 'notifications' ? (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Cài đặt thông báo</h3>
            <div className="space-y-3">
              {[
                { key: 'tx' as const, label: 'Giao dịch', desc: 'Thông báo khi giao dịch thành công/thất bại' },
                { key: 'governance' as const, label: 'Governance', desc: 'Đề xuất mới, kết quả bỏ phiếu' },
                { key: 'jobs' as const, label: 'Việc làm', desc: 'Việc làm mới phù hợp với profile' },
                { key: 'scholarship' as const, label: 'Học bổng', desc: 'Học bổng mới và cập nhật' },
              ].map(n => (
                <div key={n.key} className="flex items-center justify-between p-4 rounded-xl bg-surface-800/30">
                  <div>
                    <p className="text-sm font-medium text-white">{n.label}</p>
                    <p className="text-xs text-surface-400">{n.desc}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={notifications[n.key]} onChange={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key] }))} />
                    <div className="w-10 h-5 bg-surface-700 rounded-full peer peer-checked:bg-brand-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Vietnamese Digital Campus</h3>
            <div className="space-y-3">
              {[
                { label: 'Version', value: 'v1.0.0-beta' },
                { label: 'Smart Contracts', value: '18 modules, 30+ contracts' },
                { label: 'Solidity', value: '^0.8.24' },
                { label: 'OpenZeppelin', value: '5.1.0' },
                { label: 'Frontend', value: 'Vite 6 + React 18 + TypeScript' },
                { label: 'Styling', value: 'Tailwind CSS v4' },
                { label: 'Web3', value: 'ethers.js v6' },
              ].map(i => (
                <div key={i.label} className="flex justify-between p-3 rounded-xl bg-surface-800/30">
                  <span className="text-sm text-surface-400">{i.label}</span>
                  <span className="text-sm font-medium text-white">{i.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <p className="text-sm text-brand-300 font-medium">VNDC - Vietnamese Digital Campus</p>
              <p className="text-xs text-surface-400 mt-1">Hệ thống giáo dục phi tập trung trên blockchain, tích hợp ERC-20, ERC-721, ERC-1155, Governance và nhiều tính năng khác.</p>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}

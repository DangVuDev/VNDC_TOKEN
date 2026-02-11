import { useState } from 'react';
import { Plug, ArrowRightLeft, CheckCircle, XCircle, RefreshCw, Database, Globe, Shield } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'pending';
  category: string;
  icon: typeof Plug;
}

const integrations: Integration[] = [
  { id: 'ipfs', name: 'IPFS / Pinata', description: 'Lưu trữ phi tập trung cho metadata, chứng chỉ', status: 'connected', category: 'Storage', icon: Database },
  { id: 'chainlink', name: 'Chainlink Oracle', description: 'Price feeds và VRF cho random', status: 'disconnected', category: 'Oracle', icon: Globe },
  { id: 'thegraph', name: 'The Graph', description: 'Indexing và query dữ liệu blockchain', status: 'pending', category: 'Indexer', icon: Database },
  { id: 'metamask', name: 'MetaMask', description: 'Kết nối ví Web3', status: 'connected', category: 'Wallet', icon: Shield },
  { id: 'polygon', name: 'Polygon Bridge', description: 'Bridge token cross-chain', status: 'disconnected', category: 'Bridge', icon: ArrowRightLeft },
  { id: 'openai', name: 'AI Matching', description: 'AI cho job/scholarship matching', status: 'pending', category: 'AI', icon: Globe },
];

export default function IntegrationPage() {
  const [filter, setFilter] = useState('all');

  const categories = ['all', ...new Set(integrations.map(i => i.category))];
  const filtered = filter === 'all' ? integrations : integrations.filter(i => i.category === filter);

  const statusIcon = (s: string) => s === 'connected' ? <CheckCircle size={16} className="text-emerald-400" /> : s === 'pending' ? <RefreshCw size={16} className="text-amber-400 animate-spin" /> : <XCircle size={16} className="text-red-400" />;
  const statusLabel = (s: string) => s === 'connected' ? 'Đã kết nối' : s === 'pending' ? 'Đang xử lý' : 'Chưa kết nối';

  return (
    <div>
      <PageHeader title="Tích hợp" description="Kết nối và quản lý các dịch vụ bên ngoài" lucideIcon={Plug} badge="Integration" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng tích hợp" value={integrations.length} icon={<Plug className="w-5 h-5" />} color="brand" />
        <StatCard label="Đã kết nối" value={integrations.filter(i => i.status === 'connected').length} icon={<CheckCircle className="w-5 h-5" />} color="success" />
        <StatCard label="Đang chờ" value={integrations.filter(i => i.status === 'pending').length} icon={<RefreshCw className="w-5 h-5" />} color="warning" />
        <StatCard label="Chưa kết nối" value={integrations.filter(i => i.status === 'disconnected').length} icon={<XCircle className="w-5 h-5" />} color="danger" />
      </div>

      <Tabs tabs={[
        { id: 'services', label: 'Dịch vụ', icon: <Plug size={14} /> },
        { id: 'migration', label: 'Data Migration', icon: <ArrowRightLeft size={14} /> },
      ]}>
        {(active) => active === 'services' ? (
          <div>
            <div className="flex gap-2 mb-6 flex-wrap">
              {categories.map(c => (
                <button key={c} className={`btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(c)}>
                  {c === 'all' ? 'Tất cả' : c}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(int => {
                const Icon = int.icon;
                return (
                  <div key={int.id} className="card card-hover">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                        <Icon size={20} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {statusIcon(int.status)}
                        <span className="text-xs text-surface-400">{statusLabel(int.status)}</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{int.name}</h3>
                    <p className="text-xs text-surface-400 mt-1">{int.description}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="badge badge-neutral">{int.category}</span>
                      <button className={int.status === 'connected' ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}>
                        {int.status === 'connected' ? 'Cấu hình' : 'Kết nối'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Data Migration</h3>
            <p className="text-sm text-surface-400 mb-6">Di chuyển dữ liệu giữa các contract hoặc từ hệ thống cũ sang blockchain.</p>
            <div className="space-y-4">
              {[
                { from: 'Legacy Database', to: 'StudentRecordManager', status: 'completed', records: 1500 },
                { from: 'CSV Import', to: 'CredentialNFT', status: 'in-progress', records: 350 },
                { from: 'Manual Entry', to: 'AlumniRegistry', status: 'pending', records: 0 },
              ].map((m, i) => (
                <div key={i} className="p-4 rounded-xl bg-surface-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-xs text-surface-500">Nguồn</p>
                      <p className="text-sm text-white font-medium">{m.from}</p>
                    </div>
                    <ArrowRightLeft size={16} className="text-brand-400" />
                    <div className="text-center">
                      <p className="text-xs text-surface-500">Đích</p>
                      <p className="text-sm text-white font-medium">{m.to}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-surface-400">{m.records} records</span>
                    <span className={m.status === 'completed' ? 'badge badge-success' : m.status === 'in-progress' ? 'badge badge-brand' : 'badge badge-neutral'}>
                      {m.status === 'completed' ? 'Hoàn thành' : m.status === 'in-progress' ? 'Đang chạy' : 'Chờ'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}

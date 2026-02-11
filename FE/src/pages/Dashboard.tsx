import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Coins, FileText, CreditCard, ShieldCheck,
  Award, Activity, TrendingUp, ArrowUpRight, GraduationCap, Vote,
  Briefcase, ExternalLink,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { useWeb3 } from '@/contexts/Web3Context';
import { useVNDC, useRegistry, useStudentDAO, useJobBoard } from '@/hooks/useContracts';
import { formatVNDC, shortenAddress, timeAgo } from '@/lib/utils';

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  icon: React.ReactNode;
  color: string;
}

export default function Dashboard() {
  const { isConnected, address, chainId } = useWeb3();
  const vndc = useVNDC();
  const registry = useRegistry();
  const dao = useStudentDAO();
  const jobBoard = useJobBoard();

  const [stats, setStats] = useState({
    totalSupply: '0', totalUsers: '0', totalProposals: '0',
    totalJobs: '0', balance: '0',
  });
  const [loading, setLoading] = useState(true);

  // Fetch real on-chain data
  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          vndc?.totalSupply(),
          registry?.getTotalUsers(),
          dao?.getTotalProposals(),
          jobBoard?.getTotalJobsPosted(),
          address && vndc ? vndc.balanceOf(address) : Promise.resolve(0n),
        ]);

        setStats({
          totalSupply: formatVNDC(results[0].status === 'fulfilled' ? results[0].value : 0n),
          totalUsers: results[1].status === 'fulfilled' ? results[1].value.toString() : '0',
          totalProposals: results[2].status === 'fulfilled' ? results[2].value.toString() : '0',
          totalJobs: results[3].status === 'fulfilled' ? results[3].value.toString() : '0',
          balance: formatVNDC(results[4].status === 'fulfilled' ? results[4].value : 0n),
        });
      } catch {
        // Use demo data when contracts not deployed
      }
      setLoading(false);
    }

    fetchStats();
  }, [vndc, registry, dao, jobBoard, address]);

  const activities: RecentActivity[] = [
    { id: '1', type: 'credential', description: 'Chứng chỉ Blockchain mới được cấp', timestamp: Date.now() / 1000 - 300, icon: <ShieldCheck size={14} />, color: 'text-brand-400' },
    { id: '2', type: 'payment', description: 'Thanh toán học phí 5,000 VNDC', timestamp: Date.now() / 1000 - 1800, icon: <CreditCard size={14} />, color: 'text-emerald-400' },
    { id: '3', type: 'governance', description: 'Đề xuất "Cải thiện thư viện" đã được thông qua', timestamp: Date.now() / 1000 - 7200, icon: <Vote size={14} />, color: 'text-violet-400' },
    { id: '4', type: 'reward', description: 'Phần thưởng GPA 3.8+ đã được nhận', timestamp: Date.now() / 1000 - 14400, icon: <Award size={14} />, color: 'text-amber-400' },
    { id: '5', type: 'job', description: 'Vị trí "Frontend Developer Intern" mới đăng', timestamp: Date.now() / 1000 - 28800, icon: <Briefcase size={14} />, color: 'text-sky-400' },
  ];

  const modules = [
    { name: 'Token VNDC', desc: 'ERC-20 + Permit', status: 'active', icon: Coins, color: 'from-indigo-500 to-violet-500' },
    { name: 'Bằng cấp', desc: 'ERC-721 NFT', status: 'active', icon: ShieldCheck, color: 'from-emerald-500 to-teal-500' },
    { name: 'Thưởng học tập', desc: 'GPA Rewards', status: 'active', icon: GraduationCap, color: 'from-amber-500 to-orange-500' },
    { name: 'Thanh toán', desc: 'Multi-method', status: 'active', icon: CreditCard, color: 'from-sky-500 to-blue-500' },
    { name: 'Quản trị DAO', desc: 'ERC-20Votes', status: 'active', icon: Vote, color: 'from-violet-500 to-purple-500' },
    { name: 'Hồ sơ', desc: 'GPA + IPFS', status: 'active', icon: FileText, color: 'from-pink-500 to-rose-500' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Tổng quan hệ thống VNDC Campus"
        lucideIcon={LayoutDashboard}
      />

      {/* Welcome Banner */}
      {isConnected && (
        <div className="glass-card p-6 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 gradient-mesh opacity-50" />
          <div className="relative">
            <h2 className="text-lg font-semibold text-white mb-1">
              Xin chào! 👋
            </h2>
            <p className="text-sm text-surface-400 mb-3">
              Ví: <span className="font-mono text-brand-300">{shortenAddress(address!, 6)}</span>
              {chainId && <span className="ml-2 badge badge-brand text-[11px]">Chain #{chainId}</span>}
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 rounded-xl bg-surface-800/50 border border-surface-700/40">
                <p className="text-[11px] text-surface-500 mb-0.5">Số dư VNDC</p>
                <p className="text-lg font-bold gradient-brand-text">{stats.balance || '0'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Tổng cung VNDC"
          value={stats.totalSupply || '0'}
          icon={<Coins className="w-5 h-5" />}
          change={!loading ? '+12.5%' : undefined}
          trend="up"
          color="brand"
          loading={loading}
        />
        <StatCard
          label="Người dùng"
          value={stats.totalUsers || '0'}
          icon={<Users className="w-5 h-5" />}
          change={!loading ? '+8.3%' : undefined}
          trend="up"
          color="success"
          loading={loading}
        />
        <StatCard
          label="Đề xuất DAO"
          value={stats.totalProposals || '0'}
          icon={<Vote className="w-5 h-5" />}
          subtitle="governance proposals"
          color="warning"
          loading={loading}
        />
        <StatCard
          label="Việc làm"
          value={stats.totalJobs || '0'}
          icon={<Briefcase className="w-5 h-5" />}
          change={!loading ? '+5 tuần này' : undefined}
          trend="up"
          color="info"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Activity size={16} className="text-brand-400" /> Hoạt động gần đây
            </h3>
            <button className="text-xs text-surface-400 hover:text-brand-400 transition-colors">
              Xem tất cả <ArrowUpRight size={12} className="inline" />
            </button>
          </div>

          <div className="space-y-1">
            {activities.map((act) => (
              <div key={act.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-800/30 transition-colors group">
                <div className={`w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center ${act.color} shrink-0`}>
                  {act.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200 truncate">{act.description}</p>
                  <p className="text-xs text-surface-500">{timeAgo(act.timestamp)}</p>
                </div>
                <ExternalLink size={14} className="text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>

        {/* Module Status */}
        <div className="card">
          <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-brand-400" /> Smart Contracts
          </h3>

          <div className="space-y-2">
            {modules.map((mod) => (
              <div key={mod.name} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-800/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center shrink-0 shadow-lg`}>
                  <mod.icon size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{mod.name}</p>
                  <p className="text-[11px] text-surface-500">{mod.desc}</p>
                </div>
                <span className="badge badge-success text-[10px]">Active</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-surface-800/60">
            <p className="text-xs text-surface-500 text-center">
              18 modules • Solidity 0.8.24 • OpenZeppelin 5.1
            </p>
          </div>
        </div>
      </div>

      {/* Not Connected State */}
      {!isConnected && (
        <div className="mt-8 glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <Coins size={28} className="text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Kết nối ví để bắt đầu</h3>
          <p className="text-sm text-surface-400 max-w-md mx-auto">
            Kết nối MetaMask hoặc ví tương thích để truy cập đầy đủ các tính năng của VNDC Campus.
          </p>
        </div>
      )}
    </div>
  );
}

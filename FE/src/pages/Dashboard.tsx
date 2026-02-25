import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Coins, Users, CreditCard, ShieldCheck, Vote, Briefcase,
  GraduationCap, Award, FileText, ArrowRight, Activity,
  Wallet, TrendingUp, IdCard,
} from 'lucide-react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useVNDC, useRegistry, useStudentDAO, useJobBoard } from '@/hooks/useContracts';
import { formatVNDC, shortenAddress, timeAgo } from '@/lib/utils';

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
      } catch {}
      setLoading(false);
    }
    fetchStats();
  }, [vndc, registry, dao, jobBoard, address]);

  const quickActions = [
    { label: 'Chuyển token', desc: 'Gửi VNDC', path: '/token', icon: Coins, color: 'text-brand-600 bg-brand-50' },
    { label: 'Bằng cấp', desc: 'Xác minh', path: '/credentials', icon: ShieldCheck, color: 'text-success-600 bg-success-50' },
    { label: 'Thanh toán', desc: 'Dịch vụ campus', path: '/payments', icon: CreditCard, color: 'text-info-600 bg-info-50' },
    { label: 'Quản trị DAO', desc: 'Bỏ phiếu', path: '/governance', icon: Vote, color: 'text-warning-600 bg-warning-50' },
    { label: 'Việc làm', desc: 'Tìm cơ hội', path: '/job-board', icon: Briefcase, color: 'text-danger-600 bg-danger-50' },
    { label: 'Học bổng', desc: 'Đăng ký', path: '/scholarship', icon: GraduationCap, color: 'text-brand-600 bg-brand-50' },
  ];

  const activities = [
    { id: '1', desc: 'Chứng chỉ Blockchain mới được cấp', time: Date.now() / 1000 - 300, icon: <ShieldCheck size={14} />, color: 'text-brand-600' },
    { id: '2', desc: 'Thanh toán học phí 5,000 VNDC', time: Date.now() / 1000 - 1800, icon: <CreditCard size={14} />, color: 'text-success-600' },
    { id: '3', desc: 'Đề xuất "Cải thiện thư viện" thông qua', time: Date.now() / 1000 - 7200, icon: <Vote size={14} />, color: 'text-warning-600' },
    { id: '4', desc: 'Phần thưởng GPA 3.8+ đã nhận', time: Date.now() / 1000 - 14400, icon: <Award size={14} />, color: 'text-info-600' },
  ];

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mb-6">
          <Wallet size={36} className="text-brand-600" />
        </div>
        <h1 className="text-2xl font-bold text-surface-800 mb-2">VNDC Campus</h1>
        <p className="text-surface-500 max-w-md mb-8">
          Kết nối ví MetaMask để truy cập hệ thống quản lý đại học phi tập trung — token, bằng cấp, thanh toán, quản trị DAO và nhiều hơn nữa.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg">
          {[
            { icon: Coins, label: 'Token VNDC' },
            { icon: ShieldCheck, label: 'Bằng cấp NFT' },
            { icon: Vote, label: 'Quản trị DAO' },
            { icon: CreditCard, label: 'Thanh toán' },
            { icon: IdCard, label: 'Thẻ sinh viên' },
            { icon: Briefcase, label: 'Việc làm' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 p-3 rounded-lg bg-surface-50 border border-surface-200 text-sm text-surface-600">
              <f.icon size={16} className="text-brand-600 shrink-0" /> {f.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance + Wallet Hero */}
      <div className="card p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="flex-1 p-6">
            <p className="text-sm text-surface-500 mb-1">Số dư VNDC</p>
            <p className="text-3xl font-bold text-surface-800 mb-1">
              {loading ? <span className="skeleton inline-block w-40 h-8" /> : stats.balance}
            </p>
            <p className="text-xs font-mono text-surface-400">{shortenAddress(address!, 8)}</p>
          </div>
          <div className="flex items-end gap-6 px-6 pb-6 sm:pt-6 text-sm">
            <div>
              <p className="text-surface-400 text-xs">Tổng cung</p>
              <p className="font-semibold text-surface-700">{loading ? '...' : stats.totalSupply}</p>
            </div>
            <div>
              <p className="text-surface-400 text-xs">Người dùng</p>
              <p className="font-semibold text-surface-700">{loading ? '...' : stats.totalUsers}</p>
            </div>
            <div>
              <p className="text-surface-400 text-xs">Đề xuất</p>
              <p className="font-semibold text-surface-700">{loading ? '...' : stats.totalProposals}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">Truy cập nhanh</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map(a => (
            <Link
              key={a.path}
              to={a.path}
              className="card card-hover p-4 flex flex-col items-center text-center gap-2 group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.color} transition-transform group-hover:scale-110`}>
                <a.icon size={20} />
              </div>
              <span className="text-sm font-medium text-surface-800">{a.label}</span>
              <span className="text-[11px] text-surface-400">{a.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Activity + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2">
              <Activity size={15} className="text-brand-600" /> Hoạt động gần đây
            </h3>
          </div>
          <div className="space-y-1">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100 transition-colors">
                <div className={`w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center ${a.color} shrink-0`}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-700 truncate">{a.desc}</p>
                  <p className="text-xs text-surface-400">{timeAgo(a.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {[
            { label: 'Tổng cung VNDC', value: stats.totalSupply, icon: Coins, color: 'text-brand-600 bg-brand-50' },
            { label: 'Đề xuất DAO', value: stats.totalProposals, icon: Vote, color: 'text-warning-600 bg-warning-50' },
            { label: 'Việc làm', value: stats.totalJobs, icon: Briefcase, color: 'text-info-600 bg-info-50' },
          ].map(s => (
            <div key={s.label} className="card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-surface-500">{s.label}</p>
                <p className="text-lg font-bold text-surface-800">{loading ? '...' : s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

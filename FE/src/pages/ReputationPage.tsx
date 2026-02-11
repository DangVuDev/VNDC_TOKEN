import { useState } from 'react';
import { Star, Trophy, TrendingUp, Award, Users, Shield } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import { useWeb3 } from '@/contexts/Web3Context';
import { useReputationBadge } from '@/hooks/useContracts';

const TIERS = [
  { name: 'Bronze', min: 0, max: 100, color: 'from-amber-700 to-amber-500', textColor: 'text-amber-400', bg: 'bg-amber-500/10' },
  { name: 'Silver', min: 100, max: 300, color: 'from-slate-400 to-slate-300', textColor: 'text-slate-300', bg: 'bg-slate-400/10' },
  { name: 'Gold', min: 300, max: 600, color: 'from-yellow-500 to-yellow-300', textColor: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { name: 'Platinum', min: 600, max: 1000, color: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { name: 'Diamond', min: 1000, max: Infinity, color: 'from-purple-400 to-pink-400', textColor: 'text-purple-400', bg: 'bg-purple-500/10' },
];

const demoLeaderboard = [
  { rank: 1, name: 'Nguyễn Minh Anh', score: 1250, tier: 'Diamond', badges: 15 },
  { rank: 2, name: 'Trần Đức Phong', score: 980, tier: 'Platinum', badges: 12 },
  { rank: 3, name: 'Lê Hoàng Nam', score: 750, tier: 'Gold', badges: 9 },
  { rank: 4, name: 'Phạm Thị Lan', score: 520, tier: 'Gold', badges: 7 },
  { rank: 5, name: 'Vũ Đình Khang', score: 340, tier: 'Gold', badges: 6 },
  { rank: 6, name: 'Hoàng Thị Mai', score: 210, tier: 'Silver', badges: 4 },
  { rank: 7, name: 'Đỗ Văn Hùng', score: 150, tier: 'Silver', badges: 3 },
  { rank: 8, name: 'Ngô Thanh Tùng', score: 80, tier: 'Bronze', badges: 2 },
];

export default function ReputationPage() {
  const { address } = useWeb3();
  const reputation = useReputationBadge();
  const userScore = 520;
  const userTier = TIERS.find(t => userScore >= t.min && userScore < t.max) || TIERS[0];

  return (
    <div>
      <PageHeader title="Danh tiếng" description="Điểm uy tín, huy hiệu và bảng xếp hạng" lucideIcon={Star} badge="Reputation" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Điểm của bạn" value={userScore} icon={<Star className="w-5 h-5" />} color="brand" />
        <StatCard label="Hạng" value={userTier.name} icon={<Trophy className="w-5 h-5" />} color="warning" />
        <StatCard label="Huy hiệu" value="7" icon={<Award className="w-5 h-5" />} color="success" />
        <StatCard label="Xếp hạng" value="#4" icon={<TrendingUp className="w-5 h-5" />} color="info" />
      </div>

      {/* Score Progress */}
      <div className="card mb-6">
        <h3 className="text-base font-semibold text-white mb-4">Tiến độ điểm uy tín</h3>
        <div className="flex items-center gap-2 mb-3">
          {TIERS.map((t, i) => (
            <div key={t.name} className="flex-1">
              <div className={`h-2 rounded-full ${userScore >= t.min ? `bg-gradient-to-r ${t.color}` : 'bg-surface-800'}`} />
              <p className={`text-[10px] mt-1 text-center ${userScore >= t.min ? t.textColor : 'text-surface-600'}`}>{t.name}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-surface-500">
          <span>Current: {userScore} pts</span>
          <span>Next tier: {userTier.max === Infinity ? 'Max' : `${userTier.max} pts`}</span>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'leaderboard', label: 'Bảng xếp hạng', icon: <Trophy size={14} /> },
        { id: 'badges', label: 'Huy hiệu', icon: <Award size={14} /> },
        { id: 'history', label: 'Lịch sử', icon: <TrendingUp size={14} /> },
      ]}>
        {(active) => active === 'leaderboard' ? (
          <div className="card p-0 overflow-hidden">
            <div className="table-container">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-800">
                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-3 w-16">#</th>
                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-3">Sinh viên</th>
                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-3">Tier</th>
                    <th className="text-right text-xs font-medium text-surface-400 px-4 py-3">Điểm</th>
                    <th className="text-right text-xs font-medium text-surface-400 px-4 py-3">Badges</th>
                  </tr>
                </thead>
                <tbody>
                  {demoLeaderboard.map(u => {
                    const tier = TIERS.find(t => t.name === u.tier) || TIERS[0];
                    return (
                      <tr key={u.rank} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                        <td className="px-4 py-3">
                          {u.rank <= 3 ? (
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                              u.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                              u.rank === 2 ? 'bg-slate-400/20 text-slate-300' :
                              'bg-amber-600/20 text-amber-500'
                            }`}>{u.rank}</span>
                          ) : (
                            <span className="text-sm text-surface-500 pl-2">{u.rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center text-white text-xs font-bold`}>
                              {u.name.charAt(0)}
                            </div>
                            <span className="text-sm text-white font-medium">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={`badge ${tier.bg} ${tier.textColor} border-0`}>{u.tier}</span></td>
                        <td className="px-4 py-3 text-right"><span className="text-sm font-semibold text-white">{u.score}</span></td>
                        <td className="px-4 py-3 text-right"><span className="text-sm text-surface-400">{u.badges}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : active === 'badges' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: 'Early Adopter', desc: 'Tham gia sớm', icon: Shield, earned: true },
              { name: 'GPA Master', desc: 'GPA > 3.5', icon: Star, earned: true },
              { name: 'Active Voter', desc: 'Vote 10 proposals', icon: Users, earned: true },
              { name: 'Mentor', desc: 'Trở thành mentor', icon: Award, earned: false },
              { name: 'Publisher', desc: 'Publish 3 papers', icon: Trophy, earned: false },
              { name: 'Top Contributor', desc: 'Top 3 leaderboard', icon: TrendingUp, earned: false },
            ].map(b => {
              const Icon = b.icon;
              return (
                <div key={b.name} className={`card text-center ${b.earned ? 'card-hover' : 'opacity-40'}`}>
                  <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center ${b.earned ? 'gradient-brand' : 'bg-surface-800'}`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{b.name}</h3>
                  <p className="text-xs text-surface-400 mt-1">{b.desc}</p>
                  {b.earned && <span className="badge badge-success mt-2">Đã đạt</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <div className="space-y-3">
              {[
                { action: '+50 pts', desc: 'Hoàn thành khóa Blockchain 101', time: '2 giờ trước' },
                { action: '+20 pts', desc: 'Vote proposal #12', time: '5 giờ trước' },
                { action: '+30 pts', desc: 'GPA semester 3.8', time: '1 ngày trước' },
                { action: '+10 pts', desc: 'Tham gia sự kiện Alumni', time: '3 ngày trước' },
              ].map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-800/30">
                  <div className="flex items-center gap-3">
                    <span className="badge badge-success">{h.action}</span>
                    <span className="text-sm text-white">{h.desc}</span>
                  </div>
                  <span className="text-xs text-surface-500">{h.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}

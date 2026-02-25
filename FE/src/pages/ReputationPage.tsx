import { useState } from 'react';
import { Star, Trophy, TrendingUp, Award, Users, Shield } from 'lucide-react';
import { useWeb3 } from '@/contexts/Web3Context';
import { useReputationBadge } from '@/hooks/useContracts';

const TIERS = [
  { name: 'Bronze', min: 0, max: 100, bg: 'bg-warning-100', text: 'text-warning-600' },
  { name: 'Silver', min: 100, max: 300, bg: 'bg-surface-200', text: 'text-surface-600' },
  { name: 'Gold', min: 300, max: 600, bg: 'bg-warning-100', text: 'text-warning-600' },
  { name: 'Platinum', min: 600, max: 1000, bg: 'bg-info-100', text: 'text-info-600' },
  { name: 'Diamond', min: 1000, max: Infinity, bg: 'bg-brand-100', text: 'text-brand-600' },
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <Star size={20} className="text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-800">Danh tiếng</h1>
          <p className="text-sm text-surface-500">{userScore} điểm · {userTier.name} · #4 xếp hạng</p>
        </div>
      </div>

      {/* Score Progress */}
      <div className="card">
        <h3 className="text-sm font-semibold text-surface-800 mb-3">Tiến độ</h3>
        <div className="flex items-center gap-1.5 mb-2">
          {TIERS.map(t => (
            <div key={t.name} className="flex-1">
              <div className={`h-2 rounded-full ${userScore >= t.min ? 'bg-brand-500' : 'bg-surface-100'}`} />
              <p className={`text-[10px] mt-1 text-center ${userScore >= t.min ? t.text : 'text-surface-400'}`}>{t.name}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-surface-500">Tiếp theo: {userTier.max === Infinity ? 'Max' : `${userTier.max} pts`}</p>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Bảng xếp hạng</h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left text-xs font-medium text-surface-500 px-4 py-3 w-12">#</th>
                <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Sinh viên</th>
                <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Tier</th>
                <th className="text-right text-xs font-medium text-surface-500 px-4 py-3">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {demoLeaderboard.map(u => {
                const tier = TIERS.find(t => t.name === u.tier) || TIERS[0];
                return (
                  <tr key={u.rank} className="border-b border-surface-200 last:border-0 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3">
                      {u.rank <= 3 ? (
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                          u.rank === 1 ? 'bg-warning-100 text-warning-600' :
                          u.rank === 2 ? 'bg-surface-200 text-surface-600' :
                          'bg-warning-100 text-warning-600'
                        }`}>{u.rank}</span>
                      ) : (
                        <span className="text-sm text-surface-500 pl-2">{u.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${tier.bg} flex items-center justify-center ${tier.text} text-xs font-bold`}>
                          {u.name.charAt(0)}
                        </div>
                        <span className="text-sm text-surface-800 font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`badge ${tier.bg} ${tier.text} border-0`}>{u.tier}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-sm font-semibold text-surface-800">{u.score}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Badges */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Huy hiệu</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
              <div key={b.name} className={`card text-center ${b.earned ? '' : 'opacity-40'}`}>
                <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${b.earned ? 'bg-brand-50' : 'bg-surface-100'}`}>
                  <Icon size={18} className={b.earned ? 'text-brand-600' : 'text-surface-400'} />
                </div>
                <h3 className="text-xs font-semibold text-surface-800">{b.name}</h3>
                <p className="text-[10px] text-surface-500">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Lịch sử điểm</h2>
        <div className="space-y-2">
          {[
            { action: '+50', desc: 'Hoàn thành khóa Blockchain 101', time: '2 giờ trước' },
            { action: '+20', desc: 'Vote proposal #12', time: '5 giờ trước' },
            { action: '+30', desc: 'GPA semester 3.8', time: '1 ngày trước' },
            { action: '+10', desc: 'Tham gia sự kiện Alumni', time: '3 ngày trước' },
          ].map((h, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-50">
              <div className="flex items-center gap-3">
                <span className="badge badge-success">{h.action}</span>
                <span className="text-sm text-surface-800">{h.desc}</span>
              </div>
              <span className="text-xs text-surface-500">{h.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

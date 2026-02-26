import { useState, useEffect, useCallback } from 'react';
import { Star, Trophy, TrendingUp, Award, Users, Shield, Loader2, Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useReputationBadge } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, timeAgo } from '@/lib/utils';

interface BadgeType { id: number; name: string; description: string; requiredPoints: number; category: string; iconURI: string; totalAwarded: number; }
interface LeaderboardEntry { address: string; points: number; }
interface TierInfo { minPoints: number; maxPoints: number; name: string; }
interface HistoryEntry { points: number; reason: string; timestamp: number; }

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  'Bronze': { bg: 'bg-warning-100', text: 'text-warning-600' },
  'Silver': { bg: 'bg-surface-200', text: 'text-surface-600' },
  'Gold': { bg: 'bg-warning-100', text: 'text-warning-600' },
  'Platinum': { bg: 'bg-info-100', text: 'text-info-600' },
  'Diamond': { bg: 'bg-brand-100', text: 'text-brand-600' },
};

export default function ReputationPage() {
  const { address } = useWeb3();
  const reputation = useReputationBadge();
  const { isLoading, execute } = useContractAction();

  const [userPoints, setUserPoints] = useState(0);
  const [userTier, setUserTier] = useState(0);
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [userBadgeIds, setUserBadgeIds] = useState<number[]>([]);
  const [badgeTypes, setBadgeTypes] = useState<BadgeType[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateBadge, setShowCreateBadge] = useState(false);
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [badgeForm, setBadgeForm] = useState({ name: '', description: '', requiredPoints: '', category: '', iconURI: '' });
  const [pointsForm, setPointsForm] = useState({ user: '', points: '', reason: '' });

  const loadData = useCallback(async () => {
    if (!reputation) return;
    setLoading(true);
    try {
      const [totalBadgeTypes, totalUsersRep] = await Promise.all([
        reputation.getTotalBadgeTypes().catch(() => 0n),
        reputation.getTotalUsersWithReputation().catch(() => 0n),
      ]);
      setTotalUsers(Number(totalUsersRep));

      // Load badge types
      const bTypes: BadgeType[] = [];
      for (let i = 1; i <= Number(totalBadgeTypes); i++) {
        try {
          const b = await reputation.getBadgeTypeInfo(i);
          bTypes.push({ id: i, name: b.name, description: b.description, requiredPoints: Number(b.requiredPoints), category: b.category, iconURI: b.iconURI, totalAwarded: Number(b.totalAwarded) });
        } catch {}
      }
      setBadgeTypes(bTypes);

      // Load tiers (0-4 typical)
      const tierList: TierInfo[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          const t = await reputation.getTierInfo(i);
          tierList.push({ minPoints: Number(t.minPoints), maxPoints: Number(t.maxPoints), name: t.name });
        } catch { break; }
      }
      setTiers(tierList);

      // Load leaderboard
      try {
        const lb = await reputation.getLeaderboard(10);
        const entries: LeaderboardEntry[] = [];
        for (let i = 0; i < lb.users.length; i++) {
          if (lb.users[i] !== '0x0000000000000000000000000000000000000000') {
            entries.push({ address: lb.users[i], points: Number(lb.points[i]) });
          }
        }
        setLeaderboard(entries);
      } catch {}

      // User-specific data
      if (address) {
        const [pts, tier, badges, achs] = await Promise.all([
          reputation.getUserReputationPoints(address).catch(() => 0n),
          reputation.getUserTier(address).catch(() => 0n),
          reputation.getUserBadges(address).catch(() => []),
          reputation.getUserAchievements(address).catch(() => []),
        ]);
        setUserPoints(Number(pts));
        setUserTier(Number(tier));
        setUserBadgeIds((badges as bigint[]).map(Number));
        setAchievements(achs as string[]);

        try {
          const hist = await reputation.getReputationHistory(address);
          const hList: HistoryEntry[] = [];
          for (let i = 0; i < hist.points.length; i++) {
            hList.push({ points: Number(hist.points[i]), reason: hist.reasons[i], timestamp: Number(hist.timestamps[i]) });
          }
          setHistory(hList.reverse());
        } catch {}
      }
    } catch {}
    setLoading(false);
  }, [reputation, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateBadge = () => execute(
    async () => {
      if (!reputation) throw new Error('Contract not available');
      return reputation.createBadgeType(badgeForm.name, badgeForm.description, Number(badgeForm.requiredPoints), badgeForm.category, badgeForm.iconURI);
    },
    { successMessage: 'Đã tạo huy hiệu!', onSuccess: () => { setShowCreateBadge(false); loadData(); } }
  );

  const handleAddPoints = () => execute(
    async () => {
      if (!reputation) throw new Error('Contract not available');
      return reputation.addReputationPoints(pointsForm.user, Number(pointsForm.points), pointsForm.reason);
    },
    { successMessage: 'Đã thêm điểm!', onSuccess: () => { setShowAddPoints(false); loadData(); } }
  );

  const currentTier = tiers[userTier] || { name: 'N/A', minPoints: 0, maxPoints: 100 };
  const nextTier = tiers[userTier + 1];
  const getTierColor = (name: string) => TIER_COLORS[name] || { bg: 'bg-surface-100', text: 'text-surface-500' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Star size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Danh tiếng</h1>
            <p className="text-sm text-surface-500">{userPoints} điểm · {currentTier.name} · {totalUsers} người dùng</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowAddPoints(true)}><Plus size={14} /> Thêm điểm</button>
          <button className="btn-primary btn-sm" onClick={() => setShowCreateBadge(true)}><Plus size={14} /> Tạo huy hiệu</button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : (
        <>
          {/* Tier Progress */}
          {tiers.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-surface-800 mb-3">Tiến độ</h3>
              <div className="flex items-center gap-1.5 mb-2">
                {tiers.map((t, i) => {
                  const color = getTierColor(t.name);
                  return (
                    <div key={i} className="flex-1">
                      <div className={`h-2 rounded-full ${userTier >= i ? 'bg-brand-500' : 'bg-surface-100'}`} />
                      <p className={`text-[10px] mt-1 text-center ${userTier >= i ? color.text : 'text-surface-400'}`}>{t.name}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-surface-500">Tiếp theo: {nextTier ? `${nextTier.minPoints} pts (${nextTier.name})` : 'Max'}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Điểm danh tiếng', value: userPoints, cls: 'text-brand-600' },
              { label: 'Huy hiệu', value: userBadgeIds.length, cls: 'text-success-600' },
              { label: 'Thành tựu', value: achievements.length, cls: 'text-info-600' },
              { label: 'Hạng', value: currentTier.name, cls: 'text-warning-600' },
            ].map(s => (
              <div key={s.label} className="card text-center py-3">
                <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-xs text-surface-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Leaderboard */}
          <div>
            <h2 className="text-base font-semibold text-surface-800 mb-3">Bảng xếp hạng</h2>
            {leaderboard.length === 0 ? (
              <EmptyState lucideIcon={Trophy} title="Chưa có dữ liệu" description="Bảng xếp hạng trống" />
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-200">
                      <th className="text-left text-xs font-medium text-surface-500 px-4 py-3 w-12">#</th>
                      <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Địa chỉ</th>
                      <th className="text-right text-xs font-medium text-surface-500 px-4 py-3">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((u, i) => (
                      <tr key={u.address} className="border-b border-surface-200 last:border-0 hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3">
                          {i < 3 ? (
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                              i === 0 ? 'bg-warning-100 text-warning-600' : i === 1 ? 'bg-surface-200 text-surface-600' : 'bg-warning-100 text-warning-600'
                            }`}>{i + 1}</span>
                          ) : (
                            <span className="text-sm text-surface-500 pl-2">{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${u.address === address ? 'text-brand-600' : 'text-surface-800'}`}>
                            {u.address === address ? 'Bạn' : shortenAddress(u.address)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right"><span className="text-sm font-semibold text-surface-800">{u.points}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Badge Types */}
          <div>
            <h2 className="text-base font-semibold text-surface-800 mb-3">Huy hiệu ({badgeTypes.length})</h2>
            {badgeTypes.length === 0 ? (
              <EmptyState lucideIcon={Award} title="Chưa có huy hiệu" description="Tạo huy hiệu đầu tiên" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {badgeTypes.map(b => {
                  const earned = userBadgeIds.includes(b.id);
                  return (
                    <div key={b.id} className={`card text-center ${earned ? '' : 'opacity-40'}`}>
                      <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${earned ? 'bg-brand-50' : 'bg-surface-100'}`}>
                        <Award size={18} className={earned ? 'text-brand-600' : 'text-surface-400'} />
                      </div>
                      <h3 className="text-xs font-semibold text-surface-800">{b.name}</h3>
                      <p className="text-[10px] text-surface-500">{b.description}</p>
                      <p className="text-[10px] text-surface-400 mt-1">{b.requiredPoints} pts · {b.totalAwarded} awarded</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Achievements */}
          {achievements.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-surface-800 mb-3">Thành tựu</h2>
              <div className="flex flex-wrap gap-2">
                {achievements.map((a, i) => (
                  <span key={i} className="badge badge-brand">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <h2 className="text-base font-semibold text-surface-800 mb-3">Lịch sử điểm</h2>
            {history.length === 0 ? (
              <p className="text-sm text-surface-500">Chưa có lịch sử.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 20).map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-50">
                    <div className="flex items-center gap-3">
                      <span className="badge badge-success">+{h.points}</span>
                      <span className="text-sm text-surface-800">{h.reason}</span>
                    </div>
                    <span className="text-xs text-surface-500">{h.timestamp ? timeAgo(h.timestamp) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Badge Modal */}
      <Modal open={showCreateBadge} onClose={() => setShowCreateBadge(false)} title="Tạo huy hiệu" size="lg"
        footer={<button className="btn-primary" onClick={handleCreateBadge} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên</label><input className="input" placeholder="GPA Master" value={badgeForm.name} onChange={e => setBadgeForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><input className="input" placeholder="GPA > 3.5" value={badgeForm.description} onChange={e => setBadgeForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Điểm yêu cầu</label><input className="input" type="number" placeholder="100" value={badgeForm.requiredPoints} onChange={e => setBadgeForm(f => ({ ...f, requiredPoints: e.target.value }))} /></div>
            <div><label className="label">Danh mục</label><input className="input" placeholder="Academic" value={badgeForm.category} onChange={e => setBadgeForm(f => ({ ...f, category: e.target.value }))} /></div>
          </div>
          <div><label className="label">Icon URI</label><input className="input" placeholder="ipfs://..." value={badgeForm.iconURI} onChange={e => setBadgeForm(f => ({ ...f, iconURI: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Add Points Modal */}
      <Modal open={showAddPoints} onClose={() => setShowAddPoints(false)} title="Thêm điểm danh tiếng"
        footer={<button className="btn-primary" onClick={handleAddPoints} disabled={isLoading}>{isLoading ? 'Đang thêm...' : 'Thêm điểm'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ</label><input className="input" placeholder="0x..." value={pointsForm.user} onChange={e => setPointsForm(f => ({ ...f, user: e.target.value }))} /></div>
          <div><label className="label">Số điểm</label><input className="input" type="number" placeholder="50" value={pointsForm.points} onChange={e => setPointsForm(f => ({ ...f, points: e.target.value }))} /></div>
          <div><label className="label">Lý do</label><input className="input" placeholder="Hoàn thành khóa học" value={pointsForm.reason} onChange={e => setPointsForm(f => ({ ...f, reason: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

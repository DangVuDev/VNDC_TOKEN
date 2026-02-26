import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Plus, Trophy, Gift, Settings, Shield, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useAcademicReward } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, formatDate, formatGPA, formatVNDC } from '@/lib/utils';

interface RewardTier {
  tierId: number;
  name: string;
  minGPA: number;
  vncdAmount: number;
  badgeTokenId: number;
  active: boolean;
}

interface Reward {
  rewardId: number;
  student: string;
  gpa: number;
  tierId: number;
  issuedAt: number;
  claimed: boolean;
  tierName?: string;
}

export default function AcademicRewardsPage() {
  const { address } = useWeb3();
  const reward = useAcademicReward();
  const { isLoading, execute } = useContractAction();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalAwarded: 0, totalClaimed: 0 });
  const [tiers, setTiers] = useState<RewardTier[]>([]);
  const [myRewards, setMyRewards] = useState<Reward[]>([]);
  const [claimedRewardIds, setClaimedRewardIds] = useState<number[]>([]);
  const [isIssuer, setIsIssuer] = useState(false);

  const [showAward, setShowAward] = useState(false);
  const [showSetTier, setShowSetTier] = useState(false);
  const [showIssuer, setShowIssuer] = useState(false);
  const [issuerAddr, setIssuerAddr] = useState('');

  const [form, setForm] = useState({ student: '', gpa: '' });
  const [tierForm, setTierForm] = useState({ tierId: '', name: '', minGPA: '', vncdAmount: '', badgeTokenId: '0' });

  const tierEmojis = ['🏆', '🥇', '🥈', '🥉', '⭐', '🎖️'];

  const loadData = useCallback(async () => {
    if (!reward) return;
    setLoading(true);
    try {
      const s = await reward.getStats().catch(() => [0n, 0n]);
      setStats({ totalAwarded: Number(s[0]), totalClaimed: Number(s[1]) });

      // Load tiers (try IDs 0-9)
      const tierList: RewardTier[] = [];
      for (let i = 0; i <= 9; i++) {
        try {
          const t = await reward.getRewardTier(i);
          const name = t[0] || t.name || '';
          if (name) {
            tierList.push({
              tierId: i,
              name,
              minGPA: Number(t[1] || t.minGPA || 0),
              vncdAmount: Number(t[2] || t.vncdAmount || 0),
              badgeTokenId: Number(t[3] || t.badgeTokenId || 0),
              active: t[4] ?? t.active ?? true,
            });
          }
        } catch { break; }
      }
      setTiers(tierList);

      if (address) {
        // Load student rewards
        try {
          const rewardIds = await reward.getStudentRewards(address);
          const rewards: Reward[] = [];
          for (const id of rewardIds) {
            try {
              const r = await reward.getReward(Number(id));
              const tierId = Number(r[2] || r.tierId || 0);
              const tier = tierList.find(t => t.tierId === tierId);
              rewards.push({
                rewardId: Number(id),
                student: r[0] || r.student || '',
                gpa: Number(r[1] || r.gpa || 0),
                tierId,
                issuedAt: Number(r[3] || r.issuedAt || 0),
                claimed: r[4] ?? r.claimed ?? false,
                tierName: tier?.name || `Tier ${tierId}`,
              });
            } catch {}
          }
          setMyRewards(rewards);
        } catch { setMyRewards([]); }

        // Load claimed rewards
        try {
          const claimed = await reward.getClaimedRewards(address);
          setClaimedRewardIds(claimed.map((id: bigint) => Number(id)));
        } catch { setClaimedRewardIds([]); }

        // Check if issuer
        try {
          const v = await reward.isIssuer(address);
          setIsIssuer(v);
        } catch { setIsIssuer(false); }
      }
    } catch {}
    setLoading(false);
  }, [reward, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAward = () => execute(
    async () => {
      if (!reward) throw new Error('Contract not available');
      return reward.awardStudent(form.student, Math.round(parseFloat(form.gpa) * 100));
    },
    { successMessage: 'Đã cấp phần thưởng!', onSuccess: () => { setShowAward(false); loadData(); } }
  );

  const handleClaim = (rewardId: number) => execute(
    async () => {
      if (!reward) throw new Error('Contract not available');
      return reward.claimReward(rewardId);
    },
    { successMessage: 'Đã nhận phần thưởng!', onSuccess: loadData }
  );

  const handleSetTier = () => execute(
    async () => {
      if (!reward) throw new Error('Contract not available');
      return reward.setRewardTier(
        Number(tierForm.tierId),
        tierForm.name,
        Math.round(parseFloat(tierForm.minGPA) * 100),
        Math.round(parseFloat(tierForm.vncdAmount) * 1e6),
        Number(tierForm.badgeTokenId)
      );
    },
    { successMessage: 'Đã cài đặt tier!', onSuccess: () => { setShowSetTier(false); loadData(); } }
  );

  const handleDeactivateTier = (tierId: number) => execute(
    async () => {
      if (!reward) throw new Error('Contract not available');
      return reward.deactivateTier(tierId);
    },
    { successMessage: 'Đã vô hiệu hóa tier!', onSuccess: loadData }
  );

  const handleAddIssuer = () => execute(
    async () => {
      if (!reward) throw new Error('Contract not available');
      return reward.addIssuer(issuerAddr);
    },
    { successMessage: 'Đã thêm issuer!', onSuccess: () => { setShowIssuer(false); setIssuerAddr(''); } }
  );

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center">
            <GraduationCap size={20} className="text-warning-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Thưởng học tập</h1>
            <p className="text-sm text-surface-500">{stats.totalAwarded} phát thưởng · {stats.totalClaimed} đã nhận</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowIssuer(true)}><Shield size={14} /></button>
          <button className="btn-secondary btn-sm" onClick={() => setShowSetTier(true)}><Settings size={14} /> Cài tier</button>
          <button className="btn-primary btn-sm" onClick={() => setShowAward(true)}><Plus size={14} /> Cấp thưởng</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-brand-600">{stats.totalAwarded}</p>
          <p className="text-xs text-surface-500 mt-1">Tổng phát thưởng</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-success-600">{stats.totalClaimed}</p>
          <p className="text-xs text-surface-500 mt-1">Đã nhận</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-warning-600">{stats.totalAwarded - stats.totalClaimed}</p>
          <p className="text-xs text-surface-500 mt-1">Chờ nhận</p>
        </div>
      </div>

      {isIssuer && <p className="text-xs text-success-600"><Shield size={12} className="inline mr-1" />Bạn là Authorized Issuer</p>}

      {/* Reward Tiers (from contract) */}
      {tiers.length > 0 ? (
        <div>
          <h2 className="text-base font-semibold text-surface-800 mb-3">Bậc thưởng</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((t, i) => (
              <div key={t.tierId} className={`card text-center py-5 ${!t.active ? 'opacity-50' : ''}`}>
                <span className="text-3xl mb-2 block">{tierEmojis[i] || '🎯'}</span>
                <h3 className="text-sm font-semibold text-surface-800">{t.name}</h3>
                <p className="text-xs text-surface-500 mt-0.5">GPA ≥ {formatGPA(t.minGPA)}</p>
                <p className="text-sm font-bold text-brand-600 mt-2">{formatVNDC(BigInt(t.vncdAmount))}</p>
                {!t.active && <span className="badge badge-danger text-xs mt-1">Đã vô hiệu</span>}
                {t.active && (
                  <button className="btn-ghost btn-sm text-xs text-danger-500 mt-2" onClick={() => handleDeactivateTier(t.tierId)}>Vô hiệu hóa</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-6">
          <Settings size={24} className="text-surface-400 mx-auto mb-2" />
          <p className="text-sm text-surface-500">Chưa có bậc thưởng. Hãy cài đặt tier đầu tiên.</p>
          <button className="btn-secondary btn-sm mt-2" onClick={() => setShowSetTier(true)}><Plus size={14} /> Tạo tier</button>
        </div>
      )}

      {/* My Rewards */}
      {myRewards.length > 0 ? (
        <div>
          <h2 className="text-base font-semibold text-surface-800 mb-3">Phần thưởng của tôi</h2>
          <div className="space-y-2">
            {myRewards.map(r => {
              const tier = tiers.find(t => t.tierId === r.tierId);
              return (
                <div key={r.rewardId} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center">
                      <Trophy size={18} className="text-warning-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-surface-800">{r.tierName}</p>
                      <p className="text-xs text-surface-500">GPA: {formatGPA(r.gpa)} · {formatDate(r.issuedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {tier && <span className="text-sm font-bold text-brand-600">{formatVNDC(BigInt(tier.vncdAmount))}</span>}
                    {r.claimed ? (
                      <span className="badge badge-success">Đã nhận</span>
                    ) : (
                      <button className="btn-primary btn-sm" onClick={() => handleClaim(r.rewardId)} disabled={isLoading}>
                        <Gift size={12} /> Nhận
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState lucideIcon={Trophy} title="Chưa có phần thưởng" description="Phần thưởng sẽ xuất hiện khi bạn được cấp" />
      )}

      {/* Award Modal */}
      <Modal open={showAward} onClose={() => setShowAward(false)} title="Cấp phần thưởng"
        footer={<button className="btn-primary" onClick={handleAward} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Cấp thưởng'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ sinh viên</label><input className="input" placeholder="0x..." value={form.student} onChange={e => setForm(f => ({ ...f, student: e.target.value }))} /></div>
          <div><label className="label">GPA (0-4)</label><input className="input" type="number" step="0.01" min="0" max="4" placeholder="3.50" value={form.gpa} onChange={e => setForm(f => ({ ...f, gpa: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Set Tier Modal */}
      <Modal open={showSetTier} onClose={() => setShowSetTier(false)} title="Cài đặt bậc thưởng"
        footer={<button className="btn-primary" onClick={handleSetTier} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Lưu'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tier ID</label><input className="input" type="number" min="0" placeholder="0" value={tierForm.tierId} onChange={e => setTierForm(f => ({ ...f, tierId: e.target.value }))} /></div>
          <div><label className="label">Tên bậc</label><input className="input" placeholder="Xuất sắc" value={tierForm.name} onChange={e => setTierForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">GPA tối thiểu</label><input className="input" type="number" step="0.01" min="0" max="4" placeholder="3.60" value={tierForm.minGPA} onChange={e => setTierForm(f => ({ ...f, minGPA: e.target.value }))} /></div>
            <div><label className="label">Thưởng VNDC</label><input className="input" type="number" placeholder="500" value={tierForm.vncdAmount} onChange={e => setTierForm(f => ({ ...f, vncdAmount: e.target.value }))} /></div>
          </div>
          <div><label className="label">Badge Token ID</label><input className="input" type="number" min="0" value={tierForm.badgeTokenId} onChange={e => setTierForm(f => ({ ...f, badgeTokenId: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Add Issuer Modal */}
      <Modal open={showIssuer} onClose={() => setShowIssuer(false)} title="Quản lý Issuer"
        footer={<button className="btn-primary" onClick={handleAddIssuer} disabled={isLoading || !issuerAddr}>{isLoading ? 'Đang xử lý...' : 'Thêm Issuer'}</button>}>
        <div><label className="label">Địa chỉ Issuer</label><input className="input" placeholder="0x..." value={issuerAddr} onChange={e => setIssuerAddr(e.target.value)} /></div>
      </Modal>
    </div>
  );
}

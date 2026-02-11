import { useState, useEffect } from 'react';
import { GraduationCap, Gift, Trophy, Star, Plus, Award } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useAcademicReward } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, formatGPA } from '@/lib/utils';

export default function AcademicRewardsPage() {
  const { address } = useWeb3();
  const reward = useAcademicReward();
  const { isLoading, execute } = useContractAction();
  const [stats, setStats] = useState({ totalAwarded: 0, totalClaimed: 0 });
  const [showAward, setShowAward] = useState(false);
  const [form, setForm] = useState({ student: '', gpa: '' });

  useEffect(() => {
    async function load() {
      if (!reward) return;
      try {
        const s = await reward.getStats();
        setStats({ totalAwarded: Number(s[0]), totalClaimed: Number(s[1]) });
      } catch {}
    }
    load();
  }, [reward]);

  const handleAward = () => execute(
    async () => {
      if (!reward) throw new Error('Contract not available');
      const gpaValue = Math.round(parseFloat(form.gpa) * 100);
      return reward.awardStudent(form.student, gpaValue);
    },
    { successMessage: 'Đã cấp phần thưởng!', onSuccess: () => setShowAward(false) }
  );

  const tiers = [
    { name: 'Xuất sắc', minGPA: '3.60', reward: '500 VNDC', badge: '🏆', color: 'from-amber-400 to-amber-600' },
    { name: 'Giỏi', minGPA: '3.20', reward: '300 VNDC', badge: '🥇', color: 'from-sky-400 to-sky-600' },
    { name: 'Khá', minGPA: '2.50', reward: '150 VNDC', badge: '🥈', color: 'from-violet-400 to-violet-600' },
    { name: 'Trung bình', minGPA: '2.00', reward: '50 VNDC', badge: '🥉', color: 'from-emerald-400 to-emerald-600' },
  ];

  return (
    <div>
      <PageHeader title="Thưởng học tập" description="Phần thưởng dựa trên GPA — Tự động phát thưởng khi đạt ngưỡng" lucideIcon={GraduationCap} badge="Rewards"
        action={<button className="btn-primary btn-sm" onClick={() => setShowAward(true)}><Plus size={14} /> Cấp thưởng</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Đã phát thưởng" value={stats.totalAwarded} icon={<Gift className="w-5 h-5" />} color="brand" />
        <StatCard label="Đã nhận thưởng" value={stats.totalClaimed} icon={<Trophy className="w-5 h-5" />} color="success" />
        <StatCard label="GPA cao nhất" value="4.00" icon={<Star className="w-5 h-5" />} color="warning" />
        <StatCard label="Bậc thưởng" value="4" icon={<Award className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'tiers', label: 'Bậc thưởng', icon: <Trophy size={14} /> },
        { id: 'history', label: 'Lịch sử', icon: <Gift size={14} /> },
      ]}>
        {(active) => active === 'tiers' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tiers.map((tier) => (
              <div key={tier.name} className="card card-hover">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-2xl shadow-lg`}>
                    {tier.badge}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                    <p className="text-sm text-surface-400">GPA ≥ {tier.minGPA}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-surface-800/40">
                  <span className="text-sm text-surface-400">Phần thưởng</span>
                  <span className="text-sm font-bold gradient-brand-text">{tier.reward}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState lucideIcon={Gift} title="Chưa có lịch sử" description="Lịch sử phần thưởng sẽ hiển thị ở đây sau khi cấp" />
        )}
      </Tabs>

      <Modal open={showAward} onClose={() => setShowAward(false)} title="Cấp phần thưởng học tập" description="Nhập GPA để sinh viên tự động nhận phần thưởng theo bậc"
        footer={<button className="btn-primary" onClick={handleAward} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Cấp thưởng'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ sinh viên</label><input className="input" placeholder="0x..." value={form.student} onChange={e => setForm(f => ({ ...f, student: e.target.value }))} /></div>
          <div><label className="label">GPA (0.00 - 4.00)</label><input className="input" type="number" step="0.01" min="0" max="4" placeholder="3.50" value={form.gpa} onChange={e => setForm(f => ({ ...f, gpa: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

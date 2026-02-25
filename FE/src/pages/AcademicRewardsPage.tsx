import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Trophy } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useAcademicReward } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

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
      return reward.awardStudent(form.student, Math.round(parseFloat(form.gpa) * 100));
    },
    { successMessage: 'Đã cấp phần thưởng!', onSuccess: () => setShowAward(false) }
  );

  const tiers = [
    { name: 'Xuất sắc', gpa: '≥ 3.60', reward: '500 VNDC', emoji: '🏆' },
    { name: 'Giỏi', gpa: '≥ 3.20', reward: '300 VNDC', emoji: '🥇' },
    { name: 'Khá', gpa: '≥ 2.50', reward: '150 VNDC', emoji: '🥈' },
    { name: 'TB', gpa: '≥ 2.00', reward: '50 VNDC', emoji: '🥉' },
  ];

  return (
    <div className="space-y-6">
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
        <button className="btn-primary btn-sm" onClick={() => setShowAward(true)}><Plus size={14} /> Cấp thưởng</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map(t => (
          <div key={t.name} className="card text-center py-5">
            <span className="text-3xl mb-2 block">{t.emoji}</span>
            <h3 className="text-sm font-semibold text-surface-800">{t.name}</h3>
            <p className="text-xs text-surface-500 mt-0.5">GPA {t.gpa}</p>
            <p className="text-sm font-bold text-brand-600 mt-2">{t.reward}</p>
          </div>
        ))}
      </div>

      <EmptyState lucideIcon={Trophy} title="Chưa có lịch sử" description="Cấp phần thưởng đầu tiên" />

      <Modal open={showAward} onClose={() => setShowAward(false)} title="Cấp phần thưởng"
        footer={<button className="btn-primary" onClick={handleAward} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Cấp thưởng'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ sinh viên</label><input className="input" placeholder="0x..." value={form.student} onChange={e => setForm(f => ({ ...f, student: e.target.value }))} /></div>
          <div><label className="label">GPA (0-4)</label><input className="input" type="number" step="0.01" min="0" max="4" placeholder="3.50" value={form.gpa} onChange={e => setForm(f => ({ ...f, gpa: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { Trophy, Plus, Users2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useExtracurricularReward } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

export default function ExtracurricularPage() {
  const extContract = useExtracurricularReward();
  const { isLoading, execute } = useContractAction();
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({ name: '', reward: '' });

  const handleRegister = () => execute(
    async () => {
      if (!extContract) throw new Error('Contract not available');
      return extContract.registerActivity(form.name, form.reward);
    },
    { successMessage: 'Đã đăng ký hoạt động!', onSuccess: () => setShowRegister(false) }
  );

  const activities = [
    { name: 'CLB Lập trình', type: 'Câu lạc bộ', members: 45, reward: '50 VNDC' },
    { name: 'Thể thao đại học', type: 'Thể thao', members: 120, reward: '30 VNDC' },
    { name: 'Tình nguyện cộng đồng', type: 'Tình nguyện', members: 80, reward: '40 VNDC' },
    { name: 'Hội thảo Blockchain', type: 'Sự kiện', members: 200, reward: '100 VNDC' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Trophy size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Hoạt động ngoại khóa</h1>
            <p className="text-sm text-surface-500">{activities.length} hoạt động · 445 thành viên</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowRegister(true)}><Plus size={14} /> Đăng ký</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {activities.map(a => (
          <div key={a.name} className="card card-hover">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-surface-800">{a.name}</h3>
                <p className="text-xs text-surface-400">{a.type}</p>
              </div>
              <span className="badge badge-brand">{a.reward}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-500"><Users2 size={14} className="inline mr-1" />{a.members} thành viên</span>
              <button className="btn-ghost btn-sm">Tham gia</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Đăng ký hoạt động"
        footer={<button className="btn-primary" onClick={handleRegister} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Đăng ký'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên hoạt động</label><input className="input" placeholder="CLB AI & ML" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Phần thưởng (VNDC)</label><input className="input" type="number" placeholder="50" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

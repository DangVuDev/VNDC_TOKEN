import { Trophy, Plus, Medal, Calendar, Users2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import { useExtracurricularReward } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';

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
    { name: 'CLB Lập trình', type: 'Câu lạc bộ', members: 45, reward: '50 VNDC', color: 'from-violet-500 to-purple-500' },
    { name: 'Thể thao đại học', type: 'Thể thao', members: 120, reward: '30 VNDC', color: 'from-emerald-500 to-teal-500' },
    { name: 'Tình nguyện cộng đồng', type: 'Tình nguyện', members: 80, reward: '40 VNDC', color: 'from-amber-500 to-orange-500' },
    { name: 'Hội thảo Blockchain', type: 'Sự kiện', members: 200, reward: '100 VNDC', color: 'from-sky-500 to-blue-500' },
  ];

  return (
    <div>
      <PageHeader title="Hoạt động ngoại khóa" description="Quản lý và thưởng cho hoạt động ngoại khóa — Tích điểm tự động" lucideIcon={Trophy} badge="Activities"
        action={<button className="btn-primary btn-sm" onClick={() => setShowRegister(true)}><Plus size={14} /> Đăng ký mới</button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Hoạt động" value={activities.length} icon={<Trophy className="w-5 h-5" />} color="brand" />
        <StatCard label="Thành viên" value="445" icon={<Users2 className="w-5 h-5" />} color="success" />
        <StatCard label="Phần thưởng" value="220 VNDC" icon={<Medal className="w-5 h-5" />} color="warning" />
        <StatCard label="Sự kiện tháng" value="8" icon={<Calendar className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[{ id: 'activities', label: 'Hoạt động', icon: <Trophy size={14} /> }, { id: 'history', label: 'Lịch sử', icon: <Calendar size={14} /> }]}>
        {(active) => active === 'activities' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activities.map(a => (
              <div key={a.name} className="card card-hover">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-lg`}>
                    <Trophy size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white">{a.name}</h3>
                    <p className="text-xs text-surface-400">{a.type}</p>
                  </div>
                  <span className="badge badge-brand">{a.reward}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-400"><Users2 size={14} className="inline mr-1" />{a.members} thành viên</span>
                  <button className="btn-ghost btn-sm">Tham gia</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState lucideIcon={Calendar} title="Chưa có lịch sử" description="Tham gia hoạt động để xem lịch sử" />
        )}
      </Tabs>

      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Đăng ký hoạt động ngoại khóa"
        footer={<button className="btn-primary" onClick={handleRegister} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Đăng ký'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên hoạt động</label><input className="input" placeholder="VD: CLB AI & ML" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Phần thưởng (VNDC)</label><input className="input" type="number" placeholder="50" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

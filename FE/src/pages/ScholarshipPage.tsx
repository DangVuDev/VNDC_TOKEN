import { useState, useEffect } from 'react';
import { GraduationCap, Plus, DollarSign, Gift, Users, Clock, CheckCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useScholarshipManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC } from '@/lib/utils';
import { parseUnits } from 'ethers';

interface Scholarship {
  id: number;
  name: string;
  description: string;
  amount: string;
  maxAwards: number;
  awarded: number;
  deadline: string;
  status: 'active' | 'closed' | 'funded';
}

const demoScholarships: Scholarship[] = [
  { id: 1, name: 'Học bổng Xuất sắc', description: 'Dành cho sinh viên GPA >= 3.6', amount: '5000', maxAwards: 10, awarded: 3, deadline: '2025-06-30', status: 'active' },
  { id: 2, name: 'Học bổng STEM', description: 'Cho sinh viên ngành CNTT, AI, Blockchain', amount: '3000', maxAwards: 20, awarded: 12, deadline: '2025-05-15', status: 'funded' },
  { id: 3, name: 'Học bổng Khởi nghiệp', description: 'Hỗ trợ sinh viên có dự án startup', amount: '10000', maxAwards: 5, awarded: 5, deadline: '2025-03-01', status: 'closed' },
];

export default function ScholarshipPage() {
  const { address } = useWeb3();
  const scholarship = useScholarshipManager();
  const { isLoading, execute } = useContractAction();

  const [showCreate, setShowCreate] = useState(false);
  const [showApply, setShowApply] = useState<Scholarship | null>(null);
  const [form, setForm] = useState({ name: '', description: '', amount: '', maxAwards: '', duration: '' });

  const handleCreate = () => execute(
    async () => {
      if (!scholarship) throw new Error('Contract not available');
      const amount = parseUnits(form.amount, 18);
      const duration = Number(form.duration) * 86400;
      return scholarship.createScholarship(form.name, form.description, amount, Number(form.maxAwards), '', duration);
    },
    { successMessage: 'Học bổng đã được tạo!', onSuccess: () => setShowCreate(false) }
  );

  const handleAward = (id: number, recipient: string) => execute(
    async () => {
      if (!scholarship) throw new Error('Contract not available');
      return scholarship.awardScholarship(id, recipient);
    },
    { successMessage: 'Đã trao học bổng!' }
  );

  return (
    <div>
      <PageHeader title="Học bổng" description="Tạo, quản lý và trao học bổng trên blockchain" lucideIcon={GraduationCap} badge="Scholarship"
        action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo học bổng</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng học bổng" value={demoScholarships.length} icon={<GraduationCap className="w-5 h-5" />} color="brand" />
        <StatCard label="Đang mở" value={demoScholarships.filter(s => s.status === 'active').length} icon={<Clock className="w-5 h-5" />} color="success" />
        <StatCard label="Đã trao" value={demoScholarships.reduce((a, s) => a + s.awarded, 0)} icon={<Gift className="w-5 h-5" />} color="warning" />
        <StatCard label="Tổng giá trị" value="18,000 VNDC" icon={<DollarSign className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'all', label: 'Tất cả', icon: <GraduationCap size={14} />, count: demoScholarships.length },
        { id: 'active', label: 'Đang mở', icon: <Clock size={14} /> },
        { id: 'my', label: 'Của tôi', icon: <Users size={14} /> },
      ]}>
        {(active) => (
          <div className="space-y-4">
            {demoScholarships
              .filter(s => active === 'all' || (active === 'active' && s.status === 'active'))
              .map(s => (
                <div key={s.id} className="card card-hover">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center shrink-0">
                        <GraduationCap size={24} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-white">{s.name}</h3>
                          <span className={s.status === 'active' ? 'badge badge-success' : s.status === 'funded' ? 'badge badge-brand' : 'badge badge-neutral'}>{s.status === 'active' ? 'Đang mở' : s.status === 'funded' ? 'Đã fund' : 'Đã đóng'}</span>
                        </div>
                        <p className="text-sm text-surface-400">{s.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-surface-500">
                          <span><DollarSign size={12} className="inline" /> {s.amount} VNDC</span>
                          <span><Users size={12} className="inline" /> {s.awarded}/{s.maxAwards} suất</span>
                          <span><Clock size={12} className="inline" /> Hạn: {s.deadline}</span>
                        </div>
                        <div className="mt-3 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                          <div className="h-full gradient-brand rounded-full transition-all" style={{ width: `${(s.awarded / s.maxAwards) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {s.status === 'active' && (
                        <button className="btn-primary btn-sm" onClick={() => setShowApply(s)}>Ứng tuyển</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Tabs>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo học bổng mới" size="lg"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo học bổng'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên học bổng</label><input className="input" placeholder="Học bổng Xuất sắc" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Điều kiện, yêu cầu..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Giá trị (VNDC)</label><input className="input" type="number" placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="label">Số suất</label><input className="input" type="number" placeholder="10" value={form.maxAwards} onChange={e => setForm(f => ({ ...f, maxAwards: e.target.value }))} /></div>
          </div>
          <div><label className="label">Thời hạn (ngày)</label><input className="input" type="number" placeholder="90" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={!!showApply} onClose={() => setShowApply(null)} title={`Ứng tuyển: ${showApply?.name || ''}`}
        footer={<button className="btn-primary" disabled={isLoading}>Gửi đơn ứng tuyển</button>}>
        {showApply && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <div className="flex justify-between mb-2"><span className="text-sm text-surface-400">Giá trị</span><span className="text-sm font-semibold text-white">{showApply.amount} VNDC</span></div>
              <div className="flex justify-between mb-2"><span className="text-sm text-surface-400">Còn lại</span><span className="text-sm font-semibold text-white">{showApply.maxAwards - showApply.awarded} suất</span></div>
              <div className="flex justify-between"><span className="text-sm text-surface-400">Hạn nộp</span><span className="text-sm font-semibold text-white">{showApply.deadline}</span></div>
            </div>
            <div><label className="label">Lý do ứng tuyển</label><textarea className="textarea" rows={3} placeholder="Trình bày lý do..." /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

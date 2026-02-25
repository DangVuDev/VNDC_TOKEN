import { useState } from 'react';
import { GraduationCap, Plus, DollarSign, Users, Clock } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useWeb3 } from '@/contexts/Web3Context';
import { useScholarshipManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { parseUnits } from 'ethers';

interface Scholarship {
  id: number; name: string; description: string; amount: string;
  maxAwards: number; awarded: number; deadline: string;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <GraduationCap size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Học bổng</h1>
            <p className="text-sm text-surface-500">{demoScholarships.length} học bổng · {demoScholarships.filter(s => s.status === 'active').length} đang mở</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo học bổng</button>
      </div>

      {/* Scholarship cards */}
      <div className="space-y-3">
        {demoScholarships.map(s => (
          <div key={s.id} className="card card-hover">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-surface-800">{s.name}</h3>
                  <span className={s.status === 'active' ? 'badge badge-success' : s.status === 'funded' ? 'badge badge-brand' : 'badge badge-neutral'}>
                    {s.status === 'active' ? 'Đang mở' : s.status === 'funded' ? 'Đã fund' : 'Đã đóng'}
                  </span>
                </div>
                <p className="text-sm text-surface-500">{s.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                  <span><DollarSign size={12} className="inline" /> {s.amount} VNDC</span>
                  <span><Users size={12} className="inline" /> {s.awarded}/{s.maxAwards} suất</span>
                  <span><Clock size={12} className="inline" /> Hạn: {s.deadline}</span>
                </div>
                <div className="mt-2 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(s.awarded / s.maxAwards) * 100}%` }} />
                </div>
              </div>
              {s.status === 'active' && (
                <button className="btn-primary btn-sm shrink-0" onClick={() => setShowApply(s)}>Ứng tuyển</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo học bổng" size="lg"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên học bổng</label><input className="input" placeholder="Học bổng Xuất sắc" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Giá trị (VNDC)</label><input className="input" type="number" placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="label">Số suất</label><input className="input" type="number" placeholder="10" value={form.maxAwards} onChange={e => setForm(f => ({ ...f, maxAwards: e.target.value }))} /></div>
          </div>
          <div><label className="label">Thời hạn (ngày)</label><input className="input" type="number" placeholder="90" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={!!showApply} onClose={() => setShowApply(null)} title={`Ứng tuyển: ${showApply?.name || ''}`}
        footer={<button className="btn-primary" disabled={isLoading}>Gửi đơn</button>}>
        {showApply && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Giá trị</p><p className="text-sm font-semibold text-surface-800">{showApply.amount} VNDC</p></div>
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Còn</p><p className="text-sm font-semibold text-surface-800">{showApply.maxAwards - showApply.awarded} suất</p></div>
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Hạn</p><p className="text-sm font-semibold text-surface-800">{showApply.deadline}</p></div>
            </div>
            <div><label className="label">Lý do ứng tuyển</label><textarea className="textarea" rows={3} placeholder="Trình bày lý do..." /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

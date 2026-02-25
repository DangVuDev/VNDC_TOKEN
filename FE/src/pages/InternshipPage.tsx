import { useState } from 'react';
import { GraduationCap, Plus, Building, Clock, Users, CheckCircle, MapPin } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useInternshipManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

interface Internship {
  id: number;
  title: string;
  company: string;
  location: string;
  duration: string;
  mentor: string;
  spots: number;
  applied: number;
  status: 'open' | 'in-progress' | 'completed';
}

const demoInternships: Internship[] = [
  { id: 1, title: 'Blockchain Intern', company: 'VNDC Labs', location: 'HCM', duration: '3 tháng', mentor: 'Dr. Nguyễn Văn A', spots: 5, applied: 12, status: 'open' },
  { id: 2, title: 'Smart Contract Research Intern', company: 'TomoChain', location: 'Hà Nội', duration: '6 tháng', mentor: 'Prof. Trần Minh', spots: 3, applied: 8, status: 'open' },
  { id: 3, title: 'DeFi Product Intern', company: 'Kyber Network', location: 'Remote', duration: '4 tháng', mentor: 'Phạm Thị C', spots: 2, applied: 15, status: 'in-progress' },
];

export default function InternshipPage() {
  const internship = useInternshipManager();
  const { isLoading, execute } = useContractAction();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', duration: '', mentor: '', spots: '' });

  const handleCreate = () => execute(
    async () => {
      if (!internship) throw new Error('Contract not available');
      return internship.createProgram(form.title, form.company, form.location, Number(form.duration), form.mentor, Number(form.spots));
    },
    { successMessage: 'Chương trình thực tập đã được tạo!', onSuccess: () => setShowCreate(false) }
  );

  const handleApply = (id: number) => execute(
    async () => {
      if (!internship) throw new Error('Contract not available');
      return internship.applyForInternship(id);
    },
    { successMessage: 'Đã nộp đơn thực tập!' }
  );

  const statusBadge = (s: string) => s === 'open' ? <span className="badge badge-success">Đang mở</span> : s === 'in-progress' ? <span className="badge badge-brand">Đang diễn ra</span> : <span className="badge badge-neutral">Hoàn thành</span>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <GraduationCap size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Thực tập</h1>
            <p className="text-sm text-surface-500">{demoInternships.length} chương trình · {demoInternships.filter(i => i.status === 'open').length} đang mở</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo chương trình</button>
      </div>

      {/* Programs */}
      <div className="space-y-3">
        {demoInternships.map(intern => (
          <div key={intern.id} className="card card-hover">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                  <Building size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-surface-800">{intern.title}</h3>
                    {statusBadge(intern.status)}
                  </div>
                  <p className="text-xs text-surface-500">{intern.company}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 flex-wrap">
                    <span><MapPin size={10} className="inline" /> {intern.location}</span>
                    <span><Clock size={10} className="inline" /> {intern.duration}</span>
                    <span><Users size={10} className="inline" /> {intern.applied}/{intern.spots}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min((intern.applied / intern.spots) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
              {intern.status === 'open' && (
                <button className="btn-primary btn-sm shrink-0" onClick={() => handleApply(intern.id)}>Ứng tuyển</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Tiến độ thực tập</h2>
        <div className="card">
          <div className="space-y-3">
            {['Tuần 1-2: Onboarding & Training', 'Tuần 3-4: Dự án nhỏ', 'Tuần 5-8: Dự án chính', 'Tuần 9-10: Review & Presentation', 'Tuần 11-12: Final Report'].map((phase, i) => (
              <div key={phase} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i < 2 ? 'bg-success-100 text-success-600' : 'bg-surface-100 text-surface-500'}`}>{i + 1}</div>
                <p className={`text-sm flex-1 ${i < 2 ? 'text-surface-800 font-medium' : 'text-surface-500'}`}>{phase}</p>
                {i < 2 && <CheckCircle size={16} className="text-success-600" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo chương trình thực tập" size="lg"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo chương trình'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="Blockchain Intern" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Công ty</label><input className="input" placeholder="VNDC Labs" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            <div><label className="label">Địa điểm</label><input className="input" placeholder="HCM / Remote" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Thời lượng (ngày)</label><input className="input" type="number" placeholder="90" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
            <div><label className="label">Số suất</label><input className="input" type="number" placeholder="5" value={form.spots} onChange={e => setForm(f => ({ ...f, spots: e.target.value }))} /></div>
          </div>
          <div><label className="label">Mentor</label><input className="input" placeholder="Dr. Nguyễn Văn A" value={form.mentor} onChange={e => setForm(f => ({ ...f, mentor: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

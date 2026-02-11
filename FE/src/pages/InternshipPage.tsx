import { useState } from 'react';
import { GraduationCap, Plus, Building, Clock, Users, CheckCircle, MapPin } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
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
    <div>
      <PageHeader title="Thực tập" description="Quản lý chương trình thực tập và tiến độ" lucideIcon={GraduationCap} badge="Internship"
        action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo chương trình</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Chương trình" value={demoInternships.length} icon={<GraduationCap className="w-5 h-5" />} color="brand" />
        <StatCard label="Đang mở" value={demoInternships.filter(i => i.status === 'open').length} icon={<Clock className="w-5 h-5" />} color="success" />
        <StatCard label="Đang thực tập" value={demoInternships.filter(i => i.status === 'in-progress').length} icon={<Building className="w-5 h-5" />} color="warning" />
        <StatCard label="Ứng viên" value={demoInternships.reduce((a, i) => a + i.applied, 0)} icon={<Users className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'programs', label: 'Chương trình', icon: <GraduationCap size={14} />, count: demoInternships.length },
        { id: 'progress', label: 'Tiến độ', icon: <CheckCircle size={14} /> },
      ]}>
        {(active) => active === 'programs' ? (
          <div className="space-y-4">
            {demoInternships.map(intern => (
              <div key={intern.id} className="card card-hover">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center text-white shrink-0">
                      <Building size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white">{intern.title}</h3>
                        {statusBadge(intern.status)}
                      </div>
                      <p className="text-sm text-surface-400">{intern.company}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-surface-500 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin size={12} /> {intern.location}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {intern.duration}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {intern.applied}/{intern.spots} ứng viên</span>
                      </div>
                      <div className="mt-3 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                        <div className="h-full gradient-brand rounded-full transition-all" style={{ width: `${Math.min((intern.applied / intern.spots) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {intern.status === 'open' && (
                      <button className="btn-primary btn-sm" onClick={() => handleApply(intern.id)}>Ứng tuyển</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Tiến độ thực tập</h3>
            <div className="space-y-4">
              {['Tuần 1-2: Onboarding & Training', 'Tuần 3-4: Dự án nhỏ', 'Tuần 5-8: Dự án chính', 'Tuần 9-10: Review & Presentation', 'Tuần 11-12: Final Report'].map((phase, i) => (
                <div key={phase} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i < 2 ? 'gradient-brand text-white' : 'bg-surface-800 text-surface-500'}`}>{i + 1}</div>
                  <div className="flex-1">
                    <p className={`text-sm ${i < 2 ? 'text-white font-medium' : 'text-surface-500'}`}>{phase}</p>
                  </div>
                  {i < 2 && <CheckCircle size={16} className="text-emerald-400" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </Tabs>

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

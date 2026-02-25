import { useState } from 'react';
import { Briefcase, Plus, MapPin, Clock, DollarSign, Search, Building, Users } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useJobBoard } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  skills: string[];
  posted: string;
  applications: number;
  status: 'open' | 'closed';
}

const demoJobs: Job[] = [
  { id: 1, title: 'Blockchain Developer', company: 'VNDC Labs', location: 'Remote', type: 'Full-time', salary: '2000-4000 VNDC', skills: ['Solidity', 'Hardhat', 'React'], posted: '2 ngày', applications: 12, status: 'open' },
  { id: 2, title: 'Smart Contract Auditor', company: 'CertiK Vietnam', location: 'HCM', type: 'Full-time', salary: '3000-5000 VNDC', skills: ['Solidity', 'Security', 'Auditing'], posted: '5 ngày', applications: 8, status: 'open' },
  { id: 3, title: 'Frontend Developer (Web3)', company: 'Axie Infinity', location: 'Hà Nội', type: 'Full-time', salary: '2500-4500 VNDC', skills: ['React', 'TypeScript', 'ethers.js'], posted: '1 tuần', applications: 20, status: 'open' },
  { id: 4, title: 'DeFi Research Analyst', company: 'Kyber Network', location: 'Remote', type: 'Part-time', salary: '1500-2500 VNDC', skills: ['DeFi', 'Research', 'Analytics'], posted: '3 ngày', applications: 6, status: 'open' },
];

export default function JobBoardPage() {
  const jobBoard = useJobBoard();
  const { isLoading, execute } = useContractAction();

  const [search, setSearch] = useState('');
  const [showPost, setShowPost] = useState(false);
  const [showDetail, setShowDetail] = useState<Job | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', location: '', type: 'fulltime', salary: '', skills: '' });

  const handlePost = () => execute(
    async () => {
      if (!jobBoard) throw new Error('Contract not available');
      const skills = form.skills.split(',').map(s => s.trim());
      return jobBoard.postJob(form.title, form.description, form.category, form.location, form.type, form.salary, skills);
    },
    { successMessage: 'Đã đăng việc làm!', onSuccess: () => setShowPost(false) }
  );

  const handleApply = (jobId: number) => execute(
    async () => {
      if (!jobBoard) throw new Error('Contract not available');
      return jobBoard.applyForJob(jobId);
    },
    { successMessage: 'Đã ứng tuyển!' }
  );

  const filtered = demoJobs.filter(j => !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.company.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Briefcase size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Việc làm</h1>
            <p className="text-sm text-surface-500">{demoJobs.length} vị trí · {demoJobs.filter(j => j.status === 'open').length} đang tuyển</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowPost(true)}><Plus size={14} /> Đăng tuyển</button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input className="input pl-10" placeholder="Tìm kiếm việc làm..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Job list */}
      <div className="space-y-3">
        {filtered.map(job => (
          <div key={job.id} className="card card-hover cursor-pointer" onClick={() => setShowDetail(job)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                  <Building size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-surface-800">{job.title}</h3>
                  <p className="text-xs text-surface-500">{job.company}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 flex-wrap">
                    <span><MapPin size={10} className="inline" /> {job.location}</span>
                    <span><Clock size={10} className="inline" /> {job.type}</span>
                    <span><DollarSign size={10} className="inline" /> {job.salary}</span>
                    <span><Users size={10} className="inline" /> {job.applications}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {job.skills.map(s => <span key={s} className="badge badge-brand text-[10px]">{s}</span>)}
                  </div>
                </div>
              </div>
              <button className="btn-primary btn-sm shrink-0" onClick={e => { e.stopPropagation(); handleApply(job.id); }}>Ứng tuyển</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showPost} onClose={() => setShowPost(false)} title="Đăng tuyển việc làm" size="lg"
        footer={<button className="btn-primary" onClick={handlePost} disabled={isLoading}>{isLoading ? 'Đang đăng...' : 'Đăng tuyển'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="Blockchain Developer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Mô tả công việc..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Địa điểm</label><input className="input" placeholder="Remote / HCM" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><label className="label">Loại hình</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="fulltime">Full-time</option><option value="parttime">Part-time</option>
                <option value="contract">Contract</option><option value="internship">Internship</option>
              </select>
            </div>
          </div>
          <div><label className="label">Mức lương (VNDC)</label><input className="input" placeholder="2000-4000" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} /></div>
          <div><label className="label">Kỹ năng (phân cách bằng dấu phẩy)</label><input className="input" placeholder="Solidity, React, TypeScript" value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.title || ''} size="lg"
        footer={<button className="btn-primary" onClick={() => showDetail && handleApply(showDetail.id)} disabled={isLoading}>Ứng tuyển ngay</button>}>
        {showDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600"><Building size={24} /></div>
              <div>
                <h3 className="text-base font-semibold text-surface-800">{showDetail.company}</h3>
                <p className="text-sm text-surface-500"><MapPin size={12} className="inline" /> {showDetail.location} · {showDetail.type}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Mức lương</p><p className="text-sm font-semibold text-surface-800">{showDetail.salary}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Ứng viên</p><p className="text-sm font-semibold text-surface-800">{showDetail.applications}</p></div>
            </div>
            <div>
              <p className="text-xs text-surface-500 mb-2">Kỹ năng yêu cầu</p>
              <div className="flex flex-wrap gap-1.5">{showDetail.skills.map(s => <span key={s} className="badge badge-brand">{s}</span>)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

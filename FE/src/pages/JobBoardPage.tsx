import { useState } from 'react';
import { Briefcase, Plus, MapPin, Clock, DollarSign, Search, Filter, Building, Users } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
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
    <div>
      <PageHeader title="Việc làm" description="Đăng tuyển, tìm kiếm và ứng tuyển việc làm Web3" lucideIcon={Briefcase} badge="Job Board"
        action={<button className="btn-primary btn-sm" onClick={() => setShowPost(true)}><Plus size={14} /> Đăng tuyển</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Việc làm" value={demoJobs.length} icon={<Briefcase className="w-5 h-5" />} color="brand" />
        <StatCard label="Đang tuyển" value={demoJobs.filter(j => j.status === 'open').length} icon={<Clock className="w-5 h-5" />} color="success" />
        <StatCard label="Ứng tuyển" value={demoJobs.reduce((a, j) => a + j.applications, 0)} icon={<Users className="w-5 h-5" />} color="warning" />
        <StatCard label="Công ty" value="4" icon={<Building className="w-5 h-5" />} color="info" />
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input className="input pl-10" placeholder="Tìm kiếm việc làm..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary"><Filter size={14} /> Lọc</button>
      </div>

      <Tabs tabs={[
        { id: 'all', label: 'Tất cả', icon: <Briefcase size={14} />, count: filtered.length },
        { id: 'applied', label: 'Đã ứng tuyển', icon: <Users size={14} /> },
        { id: 'saved', label: 'Đã lưu', icon: <Clock size={14} /> },
      ]}>
        {() => (
          <div className="space-y-4">
            {filtered.map(job => (
              <div key={job.id} className="card card-hover cursor-pointer" onClick={() => setShowDetail(job)}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 shrink-0">
                      <Building size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white">{job.title}</h3>
                      <p className="text-sm text-surface-400">{job.company}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-surface-500 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {job.type}</span>
                        <span className="flex items-center gap-1"><DollarSign size={12} /> {job.salary}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {job.applications} ứng viên</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.skills.map(s => <span key={s} className="badge badge-brand">{s}</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <span className="text-xs text-surface-500">{job.posted}</span>
                    <button className="btn-primary btn-sm" onClick={e => { e.stopPropagation(); handleApply(job.id); }}>Ứng tuyển</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Tabs>

      <Modal open={showPost} onClose={() => setShowPost(false)} title="Đăng tuyển việc làm" size="lg"
        footer={<button className="btn-primary" onClick={handlePost} disabled={isLoading}>{isLoading ? 'Đang đăng...' : 'Đăng tuyển'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="Blockchain Developer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Mô tả công việc..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Địa điểm</label><input className="input" placeholder="Remote / HCM" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><label className="label">Loại hình</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="fulltime">Full-time</option>
                <option value="parttime">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
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
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400"><Building size={28} /></div>
              <div>
                <h3 className="text-lg font-semibold text-white">{showDetail.company}</h3>
                <div className="flex items-center gap-3 text-sm text-surface-400">
                  <span><MapPin size={14} className="inline" /> {showDetail.location}</span>
                  <span><Clock size={14} className="inline" /> {showDetail.type}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Mức lương</p><p className="text-sm font-semibold text-white">{showDetail.salary}</p></div>
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Ứng viên</p><p className="text-sm font-semibold text-white">{showDetail.applications}</p></div>
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

import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, MapPin, Clock, DollarSign, Search, Building, Users, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useJobBoard } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { parseUnits } from 'ethers';
import { shortenAddress, formatVNDC, timeAgo } from '@/lib/utils';

interface Job {
  id: number; title: string; description: string; employer: string; category: string;
  location: string; jobType: string; minSalary: bigint; maxSalary: bigint;
  requiredSkills: string; status: string; postedAt: number; applicationCount: number;
}

interface Application {
  id: number; applicant: string; jobId: number; coverLetter: string;
  status: string; submittedAt: number;
}

export default function JobBoardPage() {
  const { address } = useWeb3();
  const jobBoard = useJobBoard();
  const { isLoading, execute } = useContractAction();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [totalApps, setTotalApps] = useState(0);
  const [totalEmployers, setTotalEmployers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showPost, setShowPost] = useState(false);
  const [showDetail, setShowDetail] = useState<Job | null>(null);
  const [showRegisterEmployer, setShowRegisterEmployer] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [employerForm, setEmployerForm] = useState({ companyName: '', companyURI: '' });
  const [form, setForm] = useState({ title: '', description: '', category: '', location: '', type: 'fulltime', minSalary: '', maxSalary: '', skills: '' });

  const loadData = useCallback(async () => {
    if (!jobBoard) return;
    setLoading(true);
    try {
      const [totalJobs, totalApplications, totalEmps] = await Promise.all([
        jobBoard.getTotalJobsPosted().catch(() => 0n),
        jobBoard.getTotalApplications().catch(() => 0n),
        jobBoard.getTotalEmployers().catch(() => 0n),
      ]);
      setTotalApps(Number(totalApplications));
      setTotalEmployers(Number(totalEmps));

      const list: Job[] = [];
      for (let i = 1; i <= Number(totalJobs); i++) {
        try {
          const j = await jobBoard.getJobDetails(i);
          list.push({ id: i, title: j.title, description: j.description, employer: j.employer, category: j.category, location: j.location, jobType: j.jobType, minSalary: j.minSalary, maxSalary: j.maxSalary, requiredSkills: j.requiredSkills, status: j.status, postedAt: Number(j.postedAt), applicationCount: Number(j.applicationCount) });
        } catch {}
      }
      setJobs(list);

      if (address) {
        const appIds: bigint[] = await jobBoard.getStudentApplications(address).catch(() => []);
        const apps: Application[] = [];
        for (const id of appIds) {
          try {
            const a = await jobBoard.getApplicationDetails(Number(id));
            apps.push({ id: Number(id), applicant: a.applicant, jobId: Number(a.jobId), coverLetter: a.coverLetter, status: a.status, submittedAt: Number(a.submittedAt) });
          } catch {}
        }
        setMyApplications(apps);
      }
    } catch {}
    setLoading(false);
  }, [jobBoard, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePost = () => execute(
    async () => {
      if (!jobBoard) throw new Error('Contract not available');
      const minSalary = parseUnits(form.minSalary || '0', 18);
      const maxSalary = parseUnits(form.maxSalary || '0', 18);
      return jobBoard.postJob(form.title, form.description, form.category, form.location, form.type, minSalary, maxSalary, form.skills);
    },
    { successMessage: 'Đã đăng việc làm!', onSuccess: () => { setShowPost(false); loadData(); } }
  );

  const handleApply = (jobId: number) => execute(
    async () => {
      if (!jobBoard) throw new Error('Contract not available');
      return jobBoard.applyForJob(jobId, coverLetter);
    },
    { successMessage: 'Đã ứng tuyển!', onSuccess: () => { setShowDetail(null); setCoverLetter(''); loadData(); } }
  );

  const handleRegisterEmployer = () => execute(
    async () => {
      if (!jobBoard) throw new Error('Contract not available');
      return jobBoard.registerEmployer(employerForm.companyName, employerForm.companyURI);
    },
    { successMessage: 'Đã đăng ký nhà tuyển dụng!', onSuccess: () => { setShowRegisterEmployer(false); loadData(); } }
  );

  const openJobs = jobs.filter(j => j.status === 'open' || j.status === '');
  const filtered = jobs.filter(j => !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Briefcase size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Việc làm</h1>
            <p className="text-sm text-surface-500">{jobs.length} vị trí · {openJobs.length} đang tuyển</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowRegisterEmployer(true)}><Building size={14} /> Đăng ký NTD</button>
          <button className="btn-primary btn-sm" onClick={() => setShowPost(true)}><Plus size={14} /> Đăng tuyển</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng việc làm', value: jobs.length, cls: 'text-brand-600' },
          { label: 'Đang tuyển', value: openJobs.length, cls: 'text-success-600' },
          { label: 'Tổng ứng tuyển', value: totalApps, cls: 'text-info-600' },
          { label: 'Nhà tuyển dụng', value: totalEmployers, cls: 'text-warning-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
        <input className="input pl-10" placeholder="Tìm kiếm việc làm..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : filtered.length === 0 ? (
        <EmptyState lucideIcon={Briefcase} title="Chưa có việc làm" description="Đăng tuyển vị trí đầu tiên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowPost(true)}><Plus size={14} /> Đăng tuyển</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(job => (
            <div key={job.id} className="card card-hover cursor-pointer" onClick={() => setShowDetail(job)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0"><Building size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-surface-800">{job.title}</h3>
                      <span className={job.status === 'open' || job.status === '' ? 'badge badge-success' : 'badge badge-neutral'}>{job.status || 'Đang tuyển'}</span>
                    </div>
                    <p className="text-xs text-surface-500">{shortenAddress(job.employer)} · {job.category}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 flex-wrap">
                      <span><MapPin size={10} className="inline" /> {job.location}</span>
                      <span><Clock size={10} className="inline" /> {job.jobType}</span>
                      <span><DollarSign size={10} className="inline" /> {formatVNDC(job.minSalary)} - {formatVNDC(job.maxSalary)} VNDC</span>
                      <span><Users size={10} className="inline" /> {job.applicationCount} ứng viên</span>
                    </div>
                    {job.requiredSkills && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.requiredSkills.split(',').map(s => <span key={s} className="badge badge-brand text-[10px]">{s.trim()}</span>)}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-primary btn-sm shrink-0" onClick={e => { e.stopPropagation(); setShowDetail(job); }}>Chi tiết</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Applications section */}
      {myApplications.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-surface-800 mb-3">Đơn ứng tuyển của tôi ({myApplications.length})</h2>
          <div className="space-y-2">
            {myApplications.map(app => {
              const job = jobs.find(j => j.id === app.jobId);
              return (
                <div key={app.id} className="card flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-surface-800">{job?.title || `Job #${app.jobId}`}</h3>
                    <p className="text-xs text-surface-500">{app.submittedAt ? timeAgo(app.submittedAt) : ''}</p>
                  </div>
                  <span className={`badge ${app.status === 'accepted' ? 'badge-success' : app.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>{app.status || 'Đang chờ'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post Job Modal */}
      <Modal open={showPost} onClose={() => setShowPost(false)} title="Đăng tuyển việc làm" size="lg"
        footer={<button className="btn-primary" onClick={handlePost} disabled={isLoading}>{isLoading ? 'Đang đăng...' : 'Đăng tuyển'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="Blockchain Developer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Mô tả công việc..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Danh mục</label><input className="input" placeholder="Blockchain" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div><label className="label">Địa điểm</label><input className="input" placeholder="Remote / HCM" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Loại hình</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="fulltime">Full-time</option><option value="parttime">Part-time</option>
                <option value="contract">Contract</option><option value="internship">Internship</option>
              </select>
            </div>
            <div><label className="label">Lương tối thiểu</label><input className="input" type="number" placeholder="2000" value={form.minSalary} onChange={e => setForm(f => ({ ...f, minSalary: e.target.value }))} /></div>
            <div><label className="label">Lương tối đa</label><input className="input" type="number" placeholder="4000" value={form.maxSalary} onChange={e => setForm(f => ({ ...f, maxSalary: e.target.value }))} /></div>
          </div>
          <div><label className="label">Kỹ năng (phân cách bằng dấu phẩy)</label><input className="input" placeholder="Solidity, React, TypeScript" value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Register Employer Modal */}
      <Modal open={showRegisterEmployer} onClose={() => setShowRegisterEmployer(false)} title="Đăng ký Nhà tuyển dụng"
        footer={<button className="btn-primary" onClick={handleRegisterEmployer} disabled={isLoading}>{isLoading ? 'Đang đăng ký...' : 'Đăng ký'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên công ty</label><input className="input" placeholder="VNDC Labs" value={employerForm.companyName} onChange={e => setEmployerForm(f => ({ ...f, companyName: e.target.value }))} /></div>
          <div><label className="label">Company URI</label><input className="input" placeholder="https://..." value={employerForm.companyURI} onChange={e => setEmployerForm(f => ({ ...f, companyURI: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Job Detail Modal */}
      <Modal open={!!showDetail} onClose={() => { setShowDetail(null); setCoverLetter(''); }} title={showDetail?.title || ''} size="lg"
        footer={<button className="btn-primary" onClick={() => showDetail && handleApply(showDetail.id)} disabled={isLoading}>{isLoading ? 'Đang gửi...' : 'Ứng tuyển'}</button>}>
        {showDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600"><Building size={24} /></div>
              <div>
                <h3 className="text-base font-semibold text-surface-800">{shortenAddress(showDetail.employer)}</h3>
                <p className="text-sm text-surface-500"><MapPin size={12} className="inline" /> {showDetail.location} · {showDetail.jobType}</p>
              </div>
            </div>
            <p className="text-sm text-surface-600">{showDetail.description}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Mức lương</p><p className="text-sm font-semibold text-surface-800">{formatVNDC(showDetail.minSalary)} - {formatVNDC(showDetail.maxSalary)}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Ứng viên</p><p className="text-sm font-semibold text-surface-800">{showDetail.applicationCount}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Đăng</p><p className="text-sm font-semibold text-surface-800">{showDetail.postedAt ? timeAgo(showDetail.postedAt) : 'N/A'}</p></div>
            </div>
            {showDetail.requiredSkills && (
              <div>
                <p className="text-xs text-surface-500 mb-2">Kỹ năng yêu cầu</p>
                <div className="flex flex-wrap gap-1.5">{showDetail.requiredSkills.split(',').map(s => <span key={s} className="badge badge-brand">{s.trim()}</span>)}</div>
              </div>
            )}
            <div><label className="label">Cover Letter</label><textarea className="textarea" rows={4} placeholder="Trình bày về bản thân..." value={coverLetter} onChange={e => setCoverLetter(e.target.value)} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

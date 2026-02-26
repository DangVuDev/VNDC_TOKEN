import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Plus, Building, Clock, Users, CheckCircle, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useInternshipManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatDate, shortenAddress, formatGPA } from '@/lib/utils';

interface Internship {
  id: number; title: string; description: string; company: string; startDate: number;
  endDate: number; mentorRequired: boolean; minGPA: number; maxPositions: number;
  filledPositions: number; status: string;
}

interface Application {
  id: number; intern: string; internshipId: number; status: string;
  submittedAt: number; offerExpiry: number;
}

interface InternProgress {
  applicationId: number; mentor: string; performanceScore: number;
  milestonesCount: number; evaluationFeedback: string; certificateURI: string;
}

export default function InternshipPage() {
  const { address } = useWeb3();
  const internship = useInternshipManager();
  const { isLoading, execute } = useContractAction();

  const [internships, setInternships] = useState<Internship[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [myProgress, setMyProgress] = useState<InternProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showApply, setShowApply] = useState<Internship | null>(null);
  const [motivationLetter, setMotivationLetter] = useState('');
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', mentorRequired: true, minGPA: '', maxPositions: '' });

  const loadData = useCallback(async () => {
    if (!internship) return;
    setLoading(true);
    try {
      const total = await internship.getTotalInternships().catch(() => 0n);

      const list: Internship[] = [];
      for (let i = 1; i <= Number(total); i++) {
        try {
          const d = await internship.getInternshipDetails(i);
          list.push({ id: i, title: d.title, description: d.description, company: d.company, startDate: Number(d.startDate), endDate: Number(d.endDate), mentorRequired: d.mentorRequired, minGPA: Number(d.minGPA), maxPositions: Number(d.maxPositions), filledPositions: Number(d.filledPositions), status: d.status });
        } catch {}
      }
      setInternships(list);

      if (address) {
        const appIds: bigint[] = await internship.getInternApplications(address).catch(() => []);
        const apps: Application[] = [];
        const progress: InternProgress[] = [];
        for (const id of appIds) {
          try {
            const a = await internship.getApplicationStatus(Number(id));
            apps.push({ id: Number(id), intern: a.intern, internshipId: Number(a.internshipId), status: a.status, submittedAt: Number(a.submittedAt), offerExpiry: Number(a.offerExpiry) });
            try {
              const p = await internship.getInternProgress(Number(id));
              progress.push({ applicationId: Number(id), mentor: p.mentor, performanceScore: Number(p.performanceScore), milestonesCount: Number(p.milestonesCount), evaluationFeedback: p.evaluationFeedback, certificateURI: p.certificateURI });
            } catch {}
          } catch {}
        }
        setMyApplications(apps);
        setMyProgress(progress);
      }
    } catch {}
    setLoading(false);
  }, [internship, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => execute(
    async () => {
      if (!internship) throw new Error('Contract not available');
      const startDate = Math.floor(new Date(form.startDate).getTime() / 1000);
      const endDate = Math.floor(new Date(form.endDate).getTime() / 1000);
      const minGPA = Number(form.minGPA) * 100; // scale to integer
      return internship.createInternship(form.title, form.description, startDate, endDate, form.mentorRequired, minGPA, Number(form.maxPositions));
    },
    { successMessage: 'Chương trình thực tập đã được tạo!', onSuccess: () => { setShowCreate(false); loadData(); } }
  );

  const handleApply = () => execute(
    async () => {
      if (!internship || !showApply) throw new Error('Contract not available');
      return internship.applyForInternship(showApply.id, motivationLetter);
    },
    { successMessage: 'Đã nộp đơn thực tập!', onSuccess: () => { setShowApply(null); setMotivationLetter(''); loadData(); } }
  );

  const handleAcceptOffer = (appId: number) => execute(
    async () => {
      if (!internship) throw new Error('Contract not available');
      return internship.acceptOffer(appId);
    },
    { successMessage: 'Đã chấp nhận offer!', onSuccess: loadData }
  );

  const openInternships = internships.filter(i => i.status === 'open' || i.status === '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><GraduationCap size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Thực tập</h1>
            <p className="text-sm text-surface-500">{internships.length} chương trình · {openInternships.length} đang mở</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo chương trình</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng chương trình', value: internships.length, cls: 'text-brand-600' },
          { label: 'Đang mở', value: openInternships.length, cls: 'text-success-600' },
          { label: 'Đơn của tôi', value: myApplications.length, cls: 'text-info-600' },
          { label: 'Tổng vị trí', value: internships.reduce((s, i) => s + i.maxPositions, 0), cls: 'text-warning-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : internships.length === 0 ? (
        <EmptyState lucideIcon={GraduationCap} title="Chưa có chương trình" description="Tạo chương trình thực tập đầu tiên" />
      ) : (
        <div className="space-y-3">
          {internships.map(intern => (
            <div key={intern.id} className="card card-hover">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0"><Building size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-surface-800">{intern.title}</h3>
                      <span className={intern.status === 'open' || intern.status === '' ? 'badge badge-success' : intern.status === 'active' ? 'badge badge-brand' : 'badge badge-neutral'}>
                        {intern.status || 'Đang mở'}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500">{intern.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 flex-wrap">
                      <span><Building size={10} className="inline" /> {shortenAddress(intern.company)}</span>
                      <span><Clock size={10} className="inline" /> {formatDate(intern.startDate)} - {formatDate(intern.endDate)}</span>
                      <span><Users size={10} className="inline" /> {intern.filledPositions}/{intern.maxPositions} vị trí</span>
                      {intern.minGPA > 0 && <span>GPA ≥ {formatGPA(intern.minGPA)}</span>}
                      {intern.mentorRequired && <span className="badge badge-brand text-[10px]">Có Mentor</span>}
                    </div>
                    <div className="mt-2 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${intern.maxPositions ? (intern.filledPositions / intern.maxPositions) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
                {(intern.status === 'open' || intern.status === '') && (
                  <button className="btn-primary btn-sm shrink-0" onClick={() => { setShowApply(intern); setMotivationLetter(''); }}>Ứng tuyển</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Applications */}
      {myApplications.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-surface-800 mb-3">Đơn ứng tuyển ({myApplications.length})</h2>
          <div className="space-y-2">
            {myApplications.map(app => {
              const intern = internships.find(i => i.id === app.internshipId);
              const prog = myProgress.find(p => p.applicationId === app.id);
              return (
                <div key={app.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-surface-800">{intern?.title || `#${app.internshipId}`}</h3>
                    <span className={`badge ${app.status === 'accepted' || app.status === 'offered' ? 'badge-success' : app.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>{app.status || 'Đang chờ'}</span>
                  </div>
                  {app.status === 'offered' && (
                    <button className="btn-primary btn-sm mt-1" onClick={() => handleAcceptOffer(app.id)}>Chấp nhận Offer</button>
                  )}
                  {prog && prog.milestonesCount > 0 && (
                    <div className="mt-2 text-xs text-surface-500">
                      <span>Performance: {prog.performanceScore}/100</span> · <span>Milestones: {prog.milestonesCount}</span>
                      {prog.evaluationFeedback && <span> · {prog.evaluationFeedback}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo chương trình thực tập" size="lg"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo chương trình'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="Blockchain Intern" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Ngày bắt đầu</label><input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div><label className="label">Ngày kết thúc</label><input className="input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">GPA tối thiểu</label><input className="input" type="number" step="0.1" placeholder="3.0" value={form.minGPA} onChange={e => setForm(f => ({ ...f, minGPA: e.target.value }))} /></div>
            <div><label className="label">Số vị trí</label><input className="input" type="number" placeholder="5" value={form.maxPositions} onChange={e => setForm(f => ({ ...f, maxPositions: e.target.value }))} /></div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.mentorRequired} onChange={e => setForm(f => ({ ...f, mentorRequired: e.target.checked }))} className="w-4 h-4 rounded border-surface-300" />
                <span className="text-sm text-surface-800">Cần Mentor</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Apply Modal */}
      <Modal open={!!showApply} onClose={() => setShowApply(null)} title={`Ứng tuyển: ${showApply?.title || ''}`}
        footer={<button className="btn-primary" onClick={handleApply} disabled={isLoading}>{isLoading ? 'Đang gửi...' : 'Nộp đơn'}</button>}>
        {showApply && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Vị trí</p><p className="text-sm font-semibold text-surface-800">{showApply.maxPositions - showApply.filledPositions} còn trống</p></div>
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">GPA yêu cầu</p><p className="text-sm font-semibold text-surface-800">{showApply.minGPA > 0 ? formatGPA(showApply.minGPA) : 'Không'}</p></div>
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Thời gian</p><p className="text-sm font-semibold text-surface-800">{formatDate(showApply.startDate)}</p></div>
            </div>
            <div><label className="label">Thư động lực</label><textarea className="textarea" rows={4} placeholder="Trình bày lý do muốn thực tập..." value={motivationLetter} onChange={e => setMotivationLetter(e.target.value)} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Users, FileText, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useResearchPlatform } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatDate, shortenAddress } from '@/lib/utils';

interface Project {
  id: number; title: string; description: string; pi: string; startDate: number;
  endDate: number; status: string; teamSize: number;
}

interface Paper { title: string; hash: string; publishedDate: number; }
interface ResearcherStats { totalProjects: number; completedProjects: number; publishedPapers: number; deliverables: number; }

export default function ResearchPage() {
  const { address } = useWeb3();
  const research = useResearchPlatform();
  const { isLoading, execute } = useContractAction();

  const [projects, setProjects] = useState<Project[]>([]);
  const [myProjectIds, setMyProjectIds] = useState<number[]>([]);
  const [myStats, setMyStats] = useState<ResearcherStats | null>(null);
  const [papers, setPapers] = useState<Record<number, Paper[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Project | null>(null);
  const [showPublish, setShowPublish] = useState<Project | null>(null);
  const [showMilestone, setShowMilestone] = useState<Project | null>(null);
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', teamSize: '' });
  const [publishForm, setPublishForm] = useState({ title: '', hash: '' });
  const [milestoneForm, setMilestoneForm] = useState({ name: '', description: '' });
  const [memberAddr, setMemberAddr] = useState('');

  const loadData = useCallback(async () => {
    if (!research) return;
    setLoading(true);
    try {
      const total = await research.getTotalProjects().catch(() => 0n);

      const list: Project[] = [];
      const allPapers: Record<number, Paper[]> = {};
      for (let i = 1; i <= Number(total); i++) {
        try {
          const d = await research.getProjectDetails(i);
          list.push({ id: i, title: d.title, description: d.description, pi: d.principalInvestigator, startDate: Number(d.startDate), endDate: Number(d.endDate), status: d.status, teamSize: Number(d.teamSize) });
          try {
            const p = await research.getProjectPapers(i);
            const pp: Paper[] = [];
            for (let j = 0; j < p.titles.length; j++) {
              pp.push({ title: p.titles[j], hash: p.hashes[j], publishedDate: Number(p.publishedDates[j]) });
            }
            if (pp.length > 0) allPapers[i] = pp;
          } catch {}
        } catch {}
      }
      setProjects(list);
      setPapers(allPapers);

      if (address) {
        const myIds: bigint[] = await research.getResearcherProjects(address).catch(() => []);
        setMyProjectIds(myIds.map(Number));
        try {
          const stats = await research.getResearcherStats(address);
          setMyStats({ totalProjects: Number(stats.totalProjects), completedProjects: Number(stats.completedProjects), publishedPapers: Number(stats.publishedPapers), deliverables: Number(stats.deliverables) });
        } catch {}
      }
    } catch {}
    setLoading(false);
  }, [research, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => execute(
    async () => {
      if (!research) throw new Error('Contract not available');
      const startDate = Math.floor(new Date(form.startDate).getTime() / 1000);
      const endDate = Math.floor(new Date(form.endDate).getTime() / 1000);
      return research.createResearchProject(form.title, form.description, startDate, endDate, Number(form.teamSize));
    },
    { successMessage: 'Dự án nghiên cứu đã được tạo!', onSuccess: () => { setShowCreate(false); loadData(); } }
  );

  const handleAddMember = (projectId: number) => execute(
    async () => {
      if (!research) throw new Error('Contract not available');
      return research.addTeamMember(projectId, memberAddr);
    },
    { successMessage: 'Đã thêm thành viên!', onSuccess: () => { setMemberAddr(''); loadData(); } }
  );

  const handlePublishPaper = () => execute(
    async () => {
      if (!research || !showPublish) throw new Error('Contract not available');
      return research.publishPaper(showPublish.id, publishForm.title, publishForm.hash);
    },
    { successMessage: 'Đã công bố bài báo!', onSuccess: () => { setShowPublish(null); loadData(); } }
  );

  const handleSubmitMilestone = () => execute(
    async () => {
      if (!research || !showMilestone) throw new Error('Contract not available');
      return research.submitMilestone(showMilestone.id, milestoneForm.name, milestoneForm.description);
    },
    { successMessage: 'Đã ghi nhận milestone!', onSuccess: () => { setShowMilestone(null); loadData(); } }
  );

  const handleComplete = (projectId: number) => execute(
    async () => {
      if (!research) throw new Error('Contract not available');
      return research.completeProject(projectId);
    },
    { successMessage: 'Dự án hoàn thành!', onSuccess: loadData }
  );

  const statusBadge = (s: string) => s === 'active' || s === '' ? <span className="badge badge-success">Đang nghiên cứu</span> : s === 'completed' ? <span className="badge badge-brand">Hoàn thành</span> : <span className="badge badge-neutral">{s}</span>;
  const totalPapers = Object.values(papers).flat().length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><BookOpen size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Nghiên cứu</h1>
            <p className="text-sm text-surface-500">{projects.length} dự án · {totalPapers} công bố</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo dự án</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng dự án', value: projects.length, cls: 'text-brand-600' },
          { label: 'Dự án tôi', value: myProjectIds.length, cls: 'text-info-600' },
          { label: 'Bài báo', value: totalPapers, cls: 'text-success-600' },
          { label: 'Hoàn thành', value: projects.filter(p => p.status === 'completed').length, cls: 'text-warning-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : projects.length === 0 ? (
        <EmptyState lucideIcon={BookOpen} title="Chưa có dự án" description="Tạo dự án nghiên cứu đầu tiên" />
      ) : (
        <div className="space-y-3">
          {projects.map(proj => (
            <div key={proj.id} className="card card-hover cursor-pointer" onClick={() => setShowDetail(proj)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-surface-800">{proj.title}</h3>
                    {statusBadge(proj.status)}
                  </div>
                  <p className="text-xs text-surface-500">{proj.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
                    <span>PI: {shortenAddress(proj.pi)}</span>
                    <span><Users size={10} className="inline" /> {proj.teamSize}</span>
                    <span><FileText size={10} className="inline" /> {(papers[proj.id] || []).length} papers</span>
                    <span>{formatDate(proj.startDate)} - {formatDate(proj.endDate)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button className="btn-ghost btn-sm text-xs" onClick={e => { e.stopPropagation(); setShowPublish(proj); setPublishForm({ title: '', hash: '' }); }}>Publish</button>
                  <button className="btn-ghost btn-sm text-xs" onClick={e => { e.stopPropagation(); setShowMilestone(proj); setMilestoneForm({ name: '', description: '' }); }}>Milestone</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Papers */}
      {totalPapers > 0 && (
        <div>
          <h2 className="text-base font-semibold text-surface-800 mb-3">Công bố khoa học ({totalPapers})</h2>
          <div className="space-y-2">
            {Object.entries(papers).flatMap(([projId, pps]) => pps.map((pub, i) => {
              const proj = projects.find(p => p.id === Number(projId));
              return (
                <div key={`${projId}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-surface-800">{pub.title}</h4>
                    <p className="text-xs text-surface-500">{proj?.title || ''} · {pub.publishedDate ? formatDate(pub.publishedDate) : ''}</p>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* My Stats */}
      {myStats && (
        <div>
          <h2 className="text-base font-semibold text-surface-800 mb-3">Thống kê của tôi</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Dự án', value: myStats.totalProjects },
              { label: 'Hoàn thành', value: myStats.completedProjects },
              { label: 'Bài báo', value: myStats.publishedPapers },
              { label: 'Deliverables', value: myStats.deliverables },
            ].map(s => (
              <div key={s.label} className="card text-center py-3">
                <p className="text-lg font-bold text-brand-600">{s.value}</p>
                <p className="text-xs text-surface-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo dự án nghiên cứu" size="lg"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo dự án'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên dự án</label><input className="input" placeholder="Zero-Knowledge Proofs..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Ngày bắt đầu</label><input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div><label className="label">Ngày kết thúc</label><input className="input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <div><label className="label">Quy mô nhóm</label><input className="input" type="number" placeholder="5" value={form.teamSize} onChange={e => setForm(f => ({ ...f, teamSize: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.title || ''} size="lg"
        footer={showDetail && showDetail.status !== 'completed' ? <button className="btn-primary" onClick={() => handleComplete(showDetail.id)} disabled={isLoading}>Hoàn thành dự án</button> : undefined}>
        {showDetail && (
          <div className="space-y-4">
            <p className="text-sm text-surface-600">{showDetail.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">PI</p><p className="text-sm font-semibold text-surface-800">{shortenAddress(showDetail.pi)}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Trạng thái</p><div className="mt-1">{statusBadge(showDetail.status)}</div></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Team</p><p className="text-sm font-semibold text-surface-800">{showDetail.teamSize}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Thời gian</p><p className="text-sm font-semibold text-surface-800">{formatDate(showDetail.startDate)} - {formatDate(showDetail.endDate)}</p></div>
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="0x... (thêm thành viên)" value={memberAddr} onChange={e => setMemberAddr(e.target.value)} />
              <button className="btn-primary btn-sm" onClick={() => handleAddMember(showDetail.id)} disabled={isLoading}>Thêm</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Publish Paper Modal */}
      <Modal open={!!showPublish} onClose={() => setShowPublish(null)} title="Công bố bài báo"
        footer={<button className="btn-primary" onClick={handlePublishPaper} disabled={isLoading}>{isLoading ? 'Đang gửi...' : 'Publish'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="ZK-Proofs in Education..." value={publishForm.title} onChange={e => setPublishForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">IPFS Hash</label><input className="input" placeholder="QmXyz..." value={publishForm.hash} onChange={e => setPublishForm(f => ({ ...f, hash: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Milestone Modal */}
      <Modal open={!!showMilestone} onClose={() => setShowMilestone(null)} title="Ghi nhận Milestone"
        footer={<button className="btn-primary" onClick={handleSubmitMilestone} disabled={isLoading}>{isLoading ? 'Đang gửi...' : 'Ghi nhận'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên milestone</label><input className="input" placeholder="Phase 1 Complete" value={milestoneForm.name} onChange={e => setMilestoneForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} value={milestoneForm.description} onChange={e => setMilestoneForm(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

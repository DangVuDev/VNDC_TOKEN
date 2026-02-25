import { useState } from 'react';
import { BookOpen, Plus, Users, DollarSign, FileText, Link, ExternalLink } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useResearchPlatform } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

interface Research {
  id: number;
  title: string;
  lead: string;
  contributors: number;
  funding: string;
  status: 'active' | 'completed' | 'review';
  publications: number;
  ipfsHash?: string;
}

const demoProjects: Research[] = [
  { id: 1, title: 'Zero-Knowledge Proofs cho xác minh học vấn', lead: 'GS. Nguyễn Minh', contributors: 5, funding: '15000 VNDC', status: 'active', publications: 2 },
  { id: 2, title: 'Tokenomics mô hình giáo dục phi tập trung', lead: 'TS. Trần Hương', contributors: 3, funding: '8000 VNDC', status: 'active', publications: 1 },
  { id: 3, title: 'Cross-chain credential verification', lead: 'PGS. Lê Thành', contributors: 4, funding: '12000 VNDC', status: 'review', publications: 3, ipfsHash: 'QmXyz123' },
  { id: 4, title: 'AI-powered student matching', lead: 'TS. Phạm Duy', contributors: 6, funding: '20000 VNDC', status: 'completed', publications: 5, ipfsHash: 'QmAbc456' },
];

export default function ResearchPage() {
  const research = useResearchPlatform();
  const { isLoading, execute } = useContractAction();

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Research | null>(null);
  const [form, setForm] = useState({ title: '', description: '', lead: '', funding: '' });

  const handleCreate = () => execute(
    async () => {
      if (!research) throw new Error('Contract not available');
      return research.createProject(form.title, form.description, form.lead);
    },
    { successMessage: 'Dự án nghiên cứu đã được tạo!', onSuccess: () => setShowCreate(false) }
  );

  const statusBadge = (s: string) => s === 'active' ? <span className="badge badge-success">Đang nghiên cứu</span> : s === 'review' ? <span className="badge badge-warning">Đang review</span> : <span className="badge badge-brand">Hoàn thành</span>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <BookOpen size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Nghiên cứu</h1>
            <p className="text-sm text-surface-500">{demoProjects.length} dự án · {demoProjects.reduce((a, p) => a + p.publications, 0)} công bố</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo dự án</button>
      </div>

      {/* Projects */}
      <div className="space-y-3">
        {demoProjects.map(proj => (
          <div key={proj.id} className="card card-hover cursor-pointer" onClick={() => setShowDetail(proj)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-surface-800">{proj.title}</h3>
                  {statusBadge(proj.status)}
                </div>
                <p className="text-xs text-surface-500">PI: {proj.lead}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
                  <span><Users size={10} className="inline" /> {proj.contributors}</span>
                  <span><FileText size={10} className="inline" /> {proj.publications} papers</span>
                  <span><DollarSign size={10} className="inline" /> {proj.funding}</span>
                </div>
                {proj.ipfsHash && <span className="badge badge-info text-[10px] mt-1.5"><Link size={10} /> IPFS: {proj.ipfsHash.slice(0, 10)}...</span>}
              </div>
              <ExternalLink size={14} className="text-surface-400 shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Publications */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Công bố khoa học</h2>
        <div className="space-y-2">
          {[
            { title: 'ZK-Proofs in Educational Credential Verification', journal: 'IEEE Blockchain 2025', date: '2025-03', citations: 12 },
            { title: 'Tokenomics for Decentralized Education', journal: 'ACM DeFi', date: '2025-01', citations: 8 },
            { title: 'Cross-chain Bridge Protocols', journal: 'Crypto Economics', date: '2024-11', citations: 25 },
          ].map((pub, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
              <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-surface-800">{pub.title}</h4>
                <p className="text-xs text-surface-500">{pub.journal} · {pub.date} · {pub.citations} citations</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Funding */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Tài trợ nghiên cứu</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {demoProjects.map(proj => (
            <div key={proj.id} className="card">
              <h4 className="text-sm font-medium text-surface-800 mb-2 truncate">{proj.title}</h4>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-surface-500">Tài trợ</span>
                <span className="text-surface-800 font-semibold">{proj.funding}</span>
              </div>
              <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: proj.status === 'completed' ? '100%' : proj.status === 'review' ? '80%' : '45%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo dự án nghiên cứu" size="lg"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo dự án'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên dự án</label><input className="input" placeholder="Zero-Knowledge Proofs..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Mô tả nghiên cứu..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Trưởng nhóm (PI)</label><input className="input" placeholder="GS. Nguyễn Minh" value={form.lead} onChange={e => setForm(f => ({ ...f, lead: e.target.value }))} /></div>
          <div><label className="label">Tài trợ đề xuất (VNDC)</label><input className="input" type="number" placeholder="15000" value={form.funding} onChange={e => setForm(f => ({ ...f, funding: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.title || ''} size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Trưởng nhóm</p><p className="text-sm font-semibold text-surface-800">{showDetail.lead}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Trạng thái</p><div className="mt-1">{statusBadge(showDetail.status)}</div></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Contributors</p><p className="text-sm font-semibold text-surface-800">{showDetail.contributors}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Tài trợ</p><p className="text-sm font-semibold text-surface-800">{showDetail.funding}</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

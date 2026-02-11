import { useState } from 'react';
import { BookOpen, Plus, Users, DollarSign, FileText, Link, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
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
    <div>
      <PageHeader title="Nghiên cứu" description="Quản lý dự án nghiên cứu, công bố khoa học và tài trợ" lucideIcon={BookOpen} badge="Research"
        action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo dự án</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Dự án" value={demoProjects.length} icon={<BookOpen className="w-5 h-5" />} color="brand" />
        <StatCard label="Nhà nghiên cứu" value={demoProjects.reduce((a, p) => a + p.contributors, 0)} icon={<Users className="w-5 h-5" />} color="success" />
        <StatCard label="Công bố" value={demoProjects.reduce((a, p) => a + p.publications, 0)} icon={<FileText className="w-5 h-5" />} color="warning" />
        <StatCard label="Tổng tài trợ" value="55,000 VNDC" icon={<DollarSign className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'projects', label: 'Dự án', icon: <BookOpen size={14} />, count: demoProjects.length },
        { id: 'publications', label: 'Công bố', icon: <FileText size={14} /> },
        { id: 'funding', label: 'Tài trợ', icon: <DollarSign size={14} /> },
      ]}>
        {(active) => active === 'projects' ? (
          <div className="space-y-4">
            {demoProjects.map(proj => (
              <div key={proj.id} className="card card-hover cursor-pointer" onClick={() => setShowDetail(proj)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-white">{proj.title}</h3>
                      {statusBadge(proj.status)}
                    </div>
                    <p className="text-sm text-surface-400">PI: {proj.lead}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                      <span><Users size={12} className="inline" /> {proj.contributors} contributors</span>
                      <span><FileText size={12} className="inline" /> {proj.publications} publications</span>
                      <span><DollarSign size={12} className="inline" /> {proj.funding}</span>
                    </div>
                    {proj.ipfsHash && (
                      <div className="mt-2"><span className="badge badge-info text-[10px]"><Link size={10} /> IPFS: {proj.ipfsHash.slice(0, 10)}...</span></div>
                    )}
                  </div>
                  <ExternalLink size={16} className="text-surface-500 shrink-0 mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : active === 'publications' ? (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Công bố khoa học gần đây</h3>
            <div className="space-y-3">
              {[
                { title: 'ZK-Proofs in Educational Credential Verification', journal: 'IEEE Blockchain 2025', date: '2025-03', citations: 12 },
                { title: 'Tokenomics for Decentralized Education', journal: 'ACM DeFi', date: '2025-01', citations: 8 },
                { title: 'Cross-chain Bridge Protocols', journal: 'Crypto Economics', date: '2024-11', citations: 25 },
              ].map((pub, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-800/30 hover:bg-surface-800/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white">{pub.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                      <span>{pub.journal}</span>
                      <span>{pub.date}</span>
                      <span>{pub.citations} citations</span>
                    </div>
                  </div>
                  <button className="btn-ghost btn-sm btn-icon"><ExternalLink size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Quỹ tài trợ nghiên cứu</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {demoProjects.map(proj => (
                <div key={proj.id} className="p-4 rounded-xl bg-surface-800/30">
                  <h4 className="text-sm font-medium text-white mb-2">{proj.title}</h4>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-surface-400">Tài trợ</span>
                    <span className="text-white font-semibold">{proj.funding}</span>
                  </div>
                  <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div className="h-full gradient-brand rounded-full" style={{ width: proj.status === 'completed' ? '100%' : proj.status === 'review' ? '80%' : '45%' }} />
                  </div>
                  <p className="text-[10px] text-surface-500 mt-1 text-right">{proj.status === 'completed' ? '100%' : proj.status === 'review' ? '80%' : '45%'} sử dụng</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Tabs>

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
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Trưởng nhóm</p><p className="text-sm font-semibold text-white">{showDetail.lead}</p></div>
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Trạng thái</p><div className="mt-1">{statusBadge(showDetail.status)}</div></div>
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Contributors</p><p className="text-sm font-semibold text-white">{showDetail.contributors}</p></div>
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Tài trợ</p><p className="text-sm font-semibold text-white">{showDetail.funding}</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

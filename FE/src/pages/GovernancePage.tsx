import { useState, useEffect } from 'react';
import { Vote, Plus, Users, FileCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentDAO, useGovernanceToken } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC } from '@/lib/utils';

const PROPOSAL_TYPES = ['General', 'Budget', 'Policy', 'Emergency'];

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  status: number;
  forVotes: bigint;
  againstVotes: bigint;
  startTime: number;
  endTime: number;
}

export default function GovernancePage() {
  const { address } = useWeb3();
  const dao = useStudentDAO();
  const govToken = useGovernanceToken();
  const { isLoading, execute } = useContractAction();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [votingPower, setVotingPower] = useState('0');
  const [showCreate, setShowCreate] = useState(false);
  const [showVote, setShowVote] = useState<Proposal | null>(null);
  const [form, setForm] = useState({ title: '', description: '', type: '0' });

  useEffect(() => {
    async function load() {
      if (!dao || !govToken || !address) return;
      try {
        const [members, power] = await Promise.all([
          dao.getTotalMembers().catch(() => 0),
          govToken.balanceOf(address).catch(() => 0n),
        ]);
        setTotalMembers(Number(members));
        setVotingPower(formatVNDC(power));
      } catch {}
    }
    load();
  }, [dao, govToken, address]);

  const handleCreate = () => execute(
    async () => {
      if (!dao) throw new Error('Contract not available');
      return dao.createProposal(form.title, form.description, Number(form.type), '0x');
    },
    { successMessage: 'Đề xuất đã được tạo!', onSuccess: () => setShowCreate(false) }
  );

  const handleVote = (support: boolean) => execute(
    async () => {
      if (!dao || !showVote) throw new Error('Contract not available');
      return dao.vote(showVote.id, support);
    },
    { successMessage: 'Đã bỏ phiếu!', onSuccess: () => setShowVote(null) }
  );

  const statusBadge = (s: number) => {
    const map: Record<number, { cls: string; label: string }> = {
      0: { cls: 'badge-neutral', label: 'Chờ duyệt' },
      1: { cls: 'badge-brand', label: 'Đang bỏ phiếu' },
      2: { cls: 'badge-success', label: 'Đã thông qua' },
      3: { cls: 'badge-danger', label: 'Bị từ chối' },
      4: { cls: 'badge-info', label: 'Đã thực thi' },
      5: { cls: 'badge-warning', label: 'Đã hủy' },
    };
    const { cls, label } = map[s] || map[0];
    return <span className={cls}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Vote size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Quản trị DAO</h1>
            <p className="text-sm text-surface-500">{totalMembers} thành viên · Voting power: {votingPower}</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo đề xuất</button>
      </div>

      {/* Governance process */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Plus, label: 'Tạo đề xuất', desc: 'Đề xuất ý tưởng' },
          { icon: Clock, label: 'Bỏ phiếu', desc: 'Cộng đồng vote' },
          { icon: CheckCircle, label: 'Thông qua', desc: 'Đạt đa số' },
          { icon: FileCheck, label: 'Thực thi', desc: 'On-chain' },
        ].map(({ icon: Ic, label, desc }) => (
          <div key={label} className="text-center p-4 rounded-xl bg-surface-50 border border-surface-200">
            <Ic size={18} className="text-brand-600 mx-auto mb-1.5" />
            <p className="text-sm font-medium text-surface-800">{label}</p>
            <p className="text-xs text-surface-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* Proposals */}
      {proposals.length === 0 ? (
        <EmptyState lucideIcon={Vote} title="Chưa có đề xuất" description="Tạo đề xuất đầu tiên để cộng đồng bỏ phiếu"
          action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo đề xuất</button>} />
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <div key={p.id} className="card card-hover cursor-pointer" onClick={() => setShowVote(p)}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold text-surface-800">{p.title}</h3>
                  <p className="text-sm text-surface-500 mt-1 line-clamp-2">{p.description}</p>
                </div>
                {statusBadge(p.status)}
              </div>
              <div className="flex items-center gap-6 text-xs text-surface-500">
                <span className="flex items-center gap-1"><CheckCircle size={12} className="text-success-600" /> {p.forVotes.toString()} Ủng hộ</span>
                <span className="flex items-center gap-1"><XCircle size={12} className="text-danger-600" /> {p.againstVotes.toString()} Phản đối</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo đề xuất"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="Tên đề xuất" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Loại</label>
            <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {PROPOSAL_TYPES.map((t, i) => <option key={i} value={i}>{t}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <Modal open={!!showVote} onClose={() => setShowVote(null)} title={showVote?.title || ''} size="lg"
        footer={
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => handleVote(true)} disabled={isLoading}><CheckCircle size={14} /> Ủng hộ</button>
            <button className="btn-danger" onClick={() => handleVote(false)} disabled={isLoading}><XCircle size={14} /> Phản đối</button>
          </div>
        }>
        {showVote && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">{showVote.description}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-success-50 border border-success-200 text-center">
                <p className="text-2xl font-bold text-success-600">{showVote.forVotes.toString()}</p>
                <p className="text-xs text-success-600">Ủng hộ</p>
              </div>
              <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-center">
                <p className="text-2xl font-bold text-danger-600">{showVote.againstVotes.toString()}</p>
                <p className="text-xs text-danger-600">Phản đối</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

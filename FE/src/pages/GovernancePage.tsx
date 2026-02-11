import { useState, useEffect } from 'react';
import { Vote, Plus, Users, FileCheck, Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentDAO, useGovernanceToken } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, timeAgo } from '@/lib/utils';

const PROPOSAL_TYPES = ['General', 'Budget', 'Policy', 'Emergency'];
const PROPOSAL_STATUS = ['Pending', 'Active', 'Passed', 'Rejected', 'Executed', 'Cancelled'];

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
    <div>
      <PageHeader title="Quản trị DAO" description="Hệ thống đề xuất và bỏ phiếu phi tập trung" lucideIcon={Vote} badge="Governance"
        action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo đề xuất</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Đề xuất" value={proposals.length} icon={<FileCheck className="w-5 h-5" />} color="brand" />
        <StatCard label="Thành viên" value={totalMembers} icon={<Users className="w-5 h-5" />} color="success" />
        <StatCard label="Voting Power" value={votingPower} icon={<Vote className="w-5 h-5" />} color="warning" />
        <StatCard label="Đã thực thi" value="0" icon={<CheckCircle className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'active', label: 'Đang hoạt động', icon: <Timer size={14} /> },
        { id: 'all', label: 'Tất cả', icon: <FileCheck size={14} /> },
        { id: 'my', label: 'Của tôi', icon: <Users size={14} /> },
      ]}>
        {(active) => (
          <div>
            {proposals.length === 0 ? (
              <EmptyState lucideIcon={Vote} title="Chưa có đề xuất"
                description="Tạo đề xuất đầu tiên để cộng đồng bỏ phiếu"
                action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo đề xuất</button>} />
            ) : (
              <div className="space-y-4">
                {proposals.map(p => (
                  <div key={p.id} className="card card-hover cursor-pointer" onClick={() => setShowVote(p)}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">{p.title}</h3>
                        <p className="text-sm text-surface-400 mt-1 line-clamp-2">{p.description}</p>
                      </div>
                      {statusBadge(p.status)}
                    </div>
                    <div className="flex items-center gap-6 text-xs text-surface-500">
                      <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> {p.forVotes.toString()} Ủng hộ</span>
                      <span className="flex items-center gap-1"><XCircle size={12} className="text-red-400" /> {p.againstVotes.toString()} Phản đối</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 card">
              <h3 className="text-sm font-semibold text-white mb-3">Quy trình Governance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  { icon: Plus, label: 'Tạo đề xuất', desc: 'Đề xuất ý tưởng mới' },
                  { icon: Clock, label: 'Bỏ phiếu', desc: 'Cộng đồng vote' },
                  { icon: CheckCircle, label: 'Thông qua', desc: 'Đạt đa số phiếu' },
                  { icon: FileCheck, label: 'Thực thi', desc: 'Triển khai on-chain' },
                ].map(({ icon: Ic, label, desc }) => (
                  <div key={label} className="text-center p-4 rounded-xl bg-surface-800/30">
                    <Ic size={20} className="text-brand-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-surface-500">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Tabs>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo đề xuất mới"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo đề xuất'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tiêu đề</label><input className="input" placeholder="Tên đề xuất..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={4} placeholder="Mô tả chi tiết..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Loại đề xuất</label>
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
            <p className="text-sm text-surface-300">{showVote.description}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-2xl font-bold text-green-400">{showVote.forVotes.toString()}</p>
                <p className="text-xs text-green-300">Ủng hộ</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-2xl font-bold text-red-400">{showVote.againstVotes.toString()}</p>
                <p className="text-xs text-red-300">Phản đối</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

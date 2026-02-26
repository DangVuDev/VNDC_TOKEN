import { useState, useEffect, useCallback } from 'react';
import { Vote, Plus, Users, FileCheck, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentDAO, useGovernanceToken } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, shortenAddress, formatDate } from '@/lib/utils';

const PROPOSAL_TYPES = ['General', 'Budget', 'Policy', 'Emergency'];

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  forVotes: bigint;
  againstVotes: bigint;
  executed: boolean;
  cancelled: boolean;
  votingEndTime: number;
  proposalType: string;
  createdAt: number;
}

export default function GovernancePage() {
  const { address } = useWeb3();
  const dao = useStudentDAO();
  const govToken = useGovernanceToken();
  const { isLoading, execute } = useContractAction();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [votingPower, setVotingPower] = useState('0');
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showVote, setShowVote] = useState<Proposal | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: '0' });
  const [memberForm, setMemberForm] = useState({ address: '', votingPower: '' });

  const loadData = useCallback(async () => {
    if (!dao || !govToken) return;
    setLoading(true);
    try {
      const [members, totalProposals] = await Promise.all([
        dao.getTotalMembers().catch(() => 0n),
        dao.getTotalProposals().catch(() => 0n),
      ]);
      setTotalMembers(Number(members));

      const list: Proposal[] = [];
      for (let i = 1; i <= Number(totalProposals); i++) {
        try {
          const p = await dao.getProposal(i);
          list.push({
            id: Number(p.proposalId), title: p.title, description: p.description,
            proposer: p.proposer, forVotes: p.votesFor, againstVotes: p.votesAgainst,
            executed: p.executed, cancelled: p.cancelled,
            votingEndTime: Number(p.votingEndTime), proposalType: p.proposalType,
            createdAt: Number(p.createdAt),
          });
        } catch {}
      }
      setProposals(list);

      if (address) {
        const [power, member] = await Promise.all([
          govToken.balanceOf(address).catch(() => 0n),
          dao.isMember(address).catch(() => false),
        ]);
        setVotingPower(formatVNDC(power));
        setIsMember(member);
      }
    } catch {}
    setLoading(false);
  }, [dao, govToken, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => execute(
    async () => {
      if (!dao) throw new Error('Contract not available');
      return dao.createProposal(form.title, form.description, PROPOSAL_TYPES[Number(form.type)], '0x');
    },
    { successMessage: 'Đề xuất đã được tạo!', onSuccess: () => { setShowCreate(false); loadData(); } }
  );

  const handleVote = (support: boolean) => execute(
    async () => {
      if (!dao || !showVote) throw new Error('Contract not available');
      return dao.vote(showVote.id, support);
    },
    { successMessage: 'Đã bỏ phiếu!', onSuccess: () => { setShowVote(null); loadData(); } }
  );

  const handleExecute = (id: number) => execute(
    async () => { if (!dao) throw new Error('Contract not available'); return dao.executeProposal(id); },
    { successMessage: 'Đề xuất đã thực thi!', onSuccess: loadData }
  );

  const handleCancel = (id: number) => execute(
    async () => { if (!dao) throw new Error('Contract not available'); return dao.cancelProposal(id); },
    { successMessage: 'Đề xuất đã hủy!', onSuccess: loadData }
  );

  const handleAddMember = () => execute(
    async () => {
      if (!dao) throw new Error('Contract not available');
      return dao.addMember(memberForm.address, Number(memberForm.votingPower));
    },
    { successMessage: 'Đã thêm thành viên!', onSuccess: () => { setShowAddMember(false); loadData(); } }
  );

  const getStatus = (p: Proposal) => {
    if (p.cancelled) return 5;
    if (p.executed) return 4;
    const now = Math.floor(Date.now() / 1000);
    if (now < p.votingEndTime) return 1;
    const totalVotes = p.forVotes + p.againstVotes;
    if (totalVotes > 0n && p.forVotes > p.againstVotes) return 2;
    return 3;
  };

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
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowAddMember(true)}><Users size={14} /> Thêm TV</button>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo đề xuất</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Thành viên', value: totalMembers, cls: 'text-brand-600' },
          { label: 'Đề xuất', value: proposals.length, cls: 'text-info-600' },
          { label: 'Đang vote', value: proposals.filter(p => getStatus(p) === 1).length, cls: 'text-warning-600' },
          { label: 'Đã thực thi', value: proposals.filter(p => p.executed).length, cls: 'text-success-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {isMember && <div className="p-3 rounded-xl bg-success-50 border border-success-200 text-sm text-success-700">Bạn là thành viên DAO</div>}

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : proposals.length === 0 ? (
        <EmptyState lucideIcon={Vote} title="Chưa có đề xuất" description="Tạo đề xuất đầu tiên để cộng đồng bỏ phiếu"
          action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo đề xuất</button>} />
      ) : (
        <div className="space-y-3">
          {proposals.map(p => {
            const s = getStatus(p);
            return (
              <div key={p.id} className="card card-hover cursor-pointer" onClick={() => setShowVote(p)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-base font-semibold text-surface-800">{p.title}</h3>
                    <p className="text-sm text-surface-500 mt-1 line-clamp-2">{p.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                      <span>{shortenAddress(p.proposer)}</span>
                      <span>{p.proposalType}</span>
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(s)}
                    {s === 2 && !p.executed && <button className="btn-primary btn-sm text-xs" onClick={e => { e.stopPropagation(); handleExecute(p.id); }}>Thực thi</button>}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs text-surface-500">
                  <span className="flex items-center gap-1"><CheckCircle size={12} className="text-success-600" /> {p.forVotes.toString()} Ủng hộ</span>
                  <span className="flex items-center gap-1"><XCircle size={12} className="text-danger-600" /> {p.againstVotes.toString()} Phản đối</span>
                </div>
              </div>
            );
          })}
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
          showVote && !showVote.executed && !showVote.cancelled ? (
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => handleVote(true)} disabled={isLoading}><CheckCircle size={14} /> Ủng hộ</button>
              <button className="btn-danger" onClick={() => handleVote(false)} disabled={isLoading}><XCircle size={14} /> Phản đối</button>
              <button className="btn-ghost" onClick={() => { handleCancel(showVote.id); setShowVote(null); }} disabled={isLoading}>Hủy</button>
            </div>
          ) : undefined
        }>
        {showVote && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">{showVote.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Người đề xuất</p><p className="text-sm font-semibold text-surface-800">{shortenAddress(showVote.proposer)}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Loại</p><p className="text-sm font-semibold text-surface-800">{showVote.proposalType}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Ngày tạo</p><p className="text-sm font-semibold text-surface-800">{formatDate(showVote.createdAt)}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Kết thúc vote</p><p className="text-sm font-semibold text-surface-800">{formatDate(showVote.votingEndTime)}</p></div>
            </div>
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

      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Thêm thành viên DAO"
        footer={<button className="btn-primary" onClick={handleAddMember} disabled={isLoading}>{isLoading ? 'Đang thêm...' : 'Thêm'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ</label><input className="input" placeholder="0x..." value={memberForm.address} onChange={e => setMemberForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="label">Voting Power</label><input className="input" type="number" placeholder="100" value={memberForm.votingPower} onChange={e => setMemberForm(f => ({ ...f, votingPower: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

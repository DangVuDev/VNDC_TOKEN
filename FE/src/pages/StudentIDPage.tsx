import { useState, useEffect } from 'react';
import { CreditCard, Plus, Ban, RefreshCw, XCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentID } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

export default function StudentIDPage() {
  const { address } = useWeb3();
  const studentId = useStudentID();
  const { isLoading, execute } = useContractAction();

  const [totalIssued, setTotalIssued] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [showIssue, setShowIssue] = useState(false);
  const [manageId, setManageId] = useState('');
  const [form, setForm] = useState({ to: '', name: '', program: '', enrollmentDate: '', metadataURI: '' });

  useEffect(() => {
    async function load() {
      if (!studentId) return;
      try {
        const [issued, active] = await Promise.all([
          studentId.getTotalIssued().catch(() => 0),
          studentId.getTotalActive().catch(() => 0),
        ]);
        setTotalIssued(Number(issued));
        setTotalActive(Number(active));
      } catch {}
    }
    load();
  }, [studentId]);

  const handleIssue = () => execute(
    async () => {
      if (!studentId) throw new Error('Contract not available');
      const enrollTs = Math.floor(new Date(form.enrollmentDate).getTime() / 1000);
      return studentId.issueStudentID(form.to, form.name, form.program, enrollTs, form.metadataURI);
    },
    { successMessage: 'Thẻ sinh viên đã được phát hành!', onSuccess: () => setShowIssue(false) }
  );

  const handleAction = (action: string, tokenId: string) => execute(
    async () => {
      if (!studentId) throw new Error('Contract not available');
      switch (action) {
        case 'suspend': return studentId.suspendStudentID(tokenId);
        case 'revoke': return studentId.revokeStudentID(tokenId);
        case 'reactivate': return studentId.reactivateStudentID(tokenId);
        default: throw new Error('Unknown action');
      }
    },
    { successMessage: `Đã ${action === 'suspend' ? 'tạm ngưng' : action === 'revoke' ? 'thu hồi' : 'kích hoạt lại'} thẻ!` }
  );

  const suspended = totalIssued - totalActive;
  const rate = totalIssued ? Math.round(totalActive / totalIssued * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <CreditCard size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Thẻ sinh viên</h1>
            <p className="text-sm text-surface-500">NFT ERC-721 · {totalIssued} phát hành · {totalActive} hoạt động</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}>
          <Plus size={14} /> Phát hành
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Phát hành', value: totalIssued, cls: 'text-brand-600' },
          { label: 'Hoạt động', value: totalActive, cls: 'text-success-600' },
          { label: 'Tạm ngưng', value: suspended, cls: 'text-warning-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Student ID Cards */}
      {totalIssued > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 1, name: 'Nguyễn Văn A', program: 'Khoa học máy tính', status: 'active' },
            { id: 2, name: 'Trần Thị B', program: 'Kỹ thuật phần mềm', status: 'active' },
            { id: 3, name: 'Lê Văn C', program: 'An toàn thông tin', status: 'suspended' },
          ].map(card => (
            <div key={card.id} className="card card-hover relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-12 bg-brand-600/10 rounded-t-xl" />
              <div className="relative pt-2">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
                    {card.name.charAt(0)}
                  </div>
                  <span className={card.status === 'active' ? 'badge badge-success' : 'badge badge-warning'}>
                    {card.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-surface-800">{card.name}</h3>
                <p className="text-sm text-surface-500">{card.program}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-200">
                  <span className="font-mono text-xs text-surface-400">ID #{card.id}</span>
                  {card.status === 'active' ? (
                    <button className="btn-ghost btn-sm text-warning-600" onClick={() => handleAction('suspend', card.id.toString())}>
                      <Ban size={12} /> Tạm ngưng
                    </button>
                  ) : (
                    <button className="btn-ghost btn-sm text-brand-600" onClick={() => handleAction('reactivate', card.id.toString())}>
                      <RefreshCw size={12} /> Kích hoạt
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState lucideIcon={CreditCard} title="Chưa có thẻ sinh viên"
          description="Phát hành thẻ sinh viên NFT đầu tiên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Phát hành</button>}
        />
      )}

      {/* Admin: Manage by Token ID */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-badge">Admin</span>
          <p className="text-sm text-surface-500">Quản lý trạng thái thẻ theo Token ID</p>
        </div>
        <div className="flex gap-2 mt-3">
          <input className="input flex-1" type="number" placeholder="Token ID..." value={manageId} onChange={e => setManageId(e.target.value)} />
          <button className="btn-secondary btn-sm" disabled={!manageId} onClick={() => handleAction('suspend', manageId)}><Ban size={14} /></button>
          <button className="btn-danger btn-sm" disabled={!manageId} onClick={() => handleAction('revoke', manageId)}><XCircle size={14} /></button>
          <button className="btn-primary btn-sm" disabled={!manageId} onClick={() => handleAction('reactivate', manageId)}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Issue Modal */}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Phát hành thẻ sinh viên"
        footer={<button className="btn-primary" onClick={handleIssue} disabled={isLoading}>{isLoading ? 'Đang phát hành...' : 'Phát hành'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ ví</label><input className="input" placeholder="0x..." value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} /></div>
          <div><label className="label">Họ tên</label><input className="input" placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Chương trình</label><input className="input" placeholder="Khoa học máy tính" value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} /></div>
          <div><label className="label">Ngày nhập học</label><input className="input" type="date" value={form.enrollmentDate} onChange={e => setForm(f => ({ ...f, enrollmentDate: e.target.value }))} /></div>
          <div><label className="label">Metadata URI</label><input className="input" placeholder="ipfs://..." value={form.metadataURI} onChange={e => setForm(f => ({ ...f, metadataURI: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

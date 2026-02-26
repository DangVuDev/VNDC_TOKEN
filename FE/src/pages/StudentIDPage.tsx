import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Plus, Ban, RefreshCw, XCircle, Eye, Shield, Edit, Loader2, Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentID } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, formatDate } from '@/lib/utils';

interface StudentCard {
  tokenId: number;
  studentAddr: string;
  studentName: string;
  program: string;
  enrollmentDate: number;
  issuedAt: number;
  isSuspended: boolean;
  isRevoked: boolean;
}

interface StudentDetail {
  metadataURI: string;
  suspensionReason: string;
  revocationReason: string;
}

export default function StudentIDPage() {
  const { address } = useWeb3();
  const studentId = useStudentID();
  const { isLoading, execute } = useContractAction();

  const [loading, setLoading] = useState(true);
  const [totalIssued, setTotalIssued] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [totalSuspended, setTotalSuspended] = useState(0);
  const [totalRevoked, setTotalRevoked] = useState(0);
  const [cards, setCards] = useState<StudentCard[]>([]);
  const [myActiveIds, setMyActiveIds] = useState<number[]>([]);
  const [isVerifier, setIsVerifier] = useState(false);

  const [showIssue, setShowIssue] = useState(false);
  const [showDetail, setShowDetail] = useState<StudentCard | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [showAction, setShowAction] = useState<{ action: string; tokenId: number } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [showVerifier, setShowVerifier] = useState(false);
  const [verifierAddr, setVerifierAddr] = useState('');
  const [showUpdateURI, setShowUpdateURI] = useState<number | null>(null);
  const [newURI, setNewURI] = useState('');
  const [searchId, setSearchId] = useState('');

  const [form, setForm] = useState({ to: '', name: '', program: '', enrollmentDate: '', metadataURI: '' });

  const loadData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const [total, active, suspended, revoked] = await Promise.all([
        studentId.getTotalStudentIDs().catch(() => 0n),
        studentId.getTotalActiveStudentIDs().catch(() => 0n),
        studentId.getTotalSuspendedStudentIDs().catch(() => 0n),
        studentId.getTotalRevokedStudentIDs().catch(() => 0n),
      ]);
      setTotalIssued(Number(total));
      setTotalActive(Number(active));
      setTotalSuspended(Number(suspended));
      setTotalRevoked(Number(revoked));

      const list: StudentCard[] = [];
      for (let i = 1; i <= Number(total); i++) {
        try {
          const info = await studentId.getStudentInfo(i);
          list.push({
            tokenId: i,
            studentAddr: info[0],
            studentName: info[1],
            program: info[2],
            enrollmentDate: Number(info[3]),
            issuedAt: Number(info[4]),
            isSuspended: info[5],
            isRevoked: info[6],
          });
        } catch {}
      }
      setCards(list);

      if (address) {
        try {
          const ids = await studentId.getActiveStudentIDs(address);
          setMyActiveIds(ids.map((id: bigint) => Number(id)));
        } catch { setMyActiveIds([]); }
        try {
          const v = await studentId.isAuthorizedVerifier(address);
          setIsVerifier(v);
        } catch { setIsVerifier(false); }
      }
    } catch {}
    setLoading(false);
  }, [studentId, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = async (card: StudentCard) => {
    setShowDetail(card);
    setDetail(null);
    if (!studentId) return;
    try {
      const d = await studentId.getStudentIDDetails(card.tokenId);
      setDetail({ metadataURI: d[0], suspensionReason: d[1], revocationReason: d[2] });
    } catch {}
  };

  const handleIssue = () => execute(
    async () => {
      if (!studentId) throw new Error('Contract not available');
      const enrollTs = Math.floor(new Date(form.enrollmentDate).getTime() / 1000);
      return studentId.issueStudentID(form.to, form.name, form.program, enrollTs, form.metadataURI);
    },
    { successMessage: 'Thẻ sinh viên đã được phát hành!', onSuccess: () => { setShowIssue(false); loadData(); } }
  );

  const handleAction = (action: string, tokenId: number, reason?: string) => execute(
    async () => {
      if (!studentId) throw new Error('Contract not available');
      switch (action) {
        case 'suspend': return studentId.suspendStudentID(tokenId, reason || 'Admin action');
        case 'revoke': return studentId.revokeStudentID(tokenId, reason || 'Admin action');
        case 'reactivate': return studentId.reactivateStudentID(tokenId);
        default: throw new Error('Unknown action');
      }
    },
    { successMessage: `Đã ${action === 'suspend' ? 'tạm ngưng' : action === 'revoke' ? 'thu hồi' : 'kích hoạt lại'} thẻ!`, onSuccess: () => { setShowAction(null); setActionReason(''); loadData(); } }
  );

  const handleAuthorizeVerifier = () => execute(
    async () => {
      if (!studentId) throw new Error('Contract not available');
      return studentId.authorizeVerifier(verifierAddr);
    },
    { successMessage: 'Đã ủy quyền xác minh!', onSuccess: () => { setShowVerifier(false); setVerifierAddr(''); } }
  );

  const handleUpdateURI = (tokenId: number) => execute(
    async () => {
      if (!studentId) throw new Error('Contract not available');
      return studentId.updateMetadataURI(tokenId, newURI);
    },
    { successMessage: 'Đã cập nhật metadata URI!', onSuccess: () => { setShowUpdateURI(null); setNewURI(''); loadData(); } }
  );

  const handleSearchById = async () => {
    if (!studentId || !searchId) return;
    const id = Number(searchId);
    try {
      const info = await studentId.getStudentInfo(id);
      const card: StudentCard = {
        tokenId: id,
        studentAddr: info[0],
        studentName: info[1],
        program: info[2],
        enrollmentDate: Number(info[3]),
        issuedAt: Number(info[4]),
        isSuspended: info[5],
        isRevoked: info[6],
      };
      loadDetail(card);
    } catch {
      alert('Không tìm thấy thẻ sinh viên với ID này');
    }
  };

  const getStatus = (c: StudentCard) => c.isRevoked ? 'revoked' : c.isSuspended ? 'suspended' : 'active';
  const getStatusLabel = (s: string) => s === 'active' ? 'Hoạt động' : s === 'suspended' ? 'Tạm ngưng' : 'Đã thu hồi';
  const getStatusBadge = (s: string) => s === 'active' ? 'badge badge-success' : s === 'suspended' ? 'badge badge-warning' : 'badge badge-danger';

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;

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
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setShowVerifier(true)}><Shield size={14} /> Verifier</button>
          <button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Phát hành</button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tổng phát hành', value: totalIssued, cls: 'text-brand-600' },
          { label: 'Hoạt động', value: totalActive, cls: 'text-success-600' },
          { label: 'Tạm ngưng', value: totalSuspended, cls: 'text-warning-600' },
          { label: 'Đã thu hồi', value: totalRevoked, cls: 'text-danger-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* My Student IDs */}
      {address && myActiveIds.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-700 mb-2">Thẻ của tôi</h3>
          <div className="flex flex-wrap gap-2">
            {myActiveIds.map(id => (
              <span key={id} className="badge badge-brand cursor-pointer" onClick={() => {
                const c = cards.find(c => c.tokenId === id);
                if (c) loadDetail(c);
              }}>ID #{id}</span>
            ))}
          </div>
          {isVerifier && <p className="text-xs text-success-600 mt-2"><Shield size={12} className="inline mr-1" />Bạn là Authorized Verifier</p>}
        </div>
      )}

      {/* Search by Token ID */}
      <div className="flex gap-2">
        <input className="input flex-1" type="number" placeholder="Tìm theo Token ID..." min={1} value={searchId} onChange={e => setSearchId(e.target.value)} />
        <button className="btn-secondary btn-sm" onClick={handleSearchById} disabled={!searchId}><Search size={14} /> Tìm</button>
      </div>

      {/* Student ID Cards */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => {
            const status = getStatus(card);
            return (
              <div key={card.tokenId} className="card card-hover relative overflow-hidden cursor-pointer" onClick={() => loadDetail(card)}>
                <div className={`absolute top-0 left-0 right-0 h-12 rounded-t-xl ${status === 'active' ? 'bg-brand-600/10' : status === 'suspended' ? 'bg-warning-500/10' : 'bg-danger-500/10'}`} />
                <div className="relative pt-2">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
                      {card.studentName.charAt(0)}
                    </div>
                    <span className={getStatusBadge(status)}>{getStatusLabel(status)}</span>
                  </div>
                  <h3 className="text-base font-semibold text-surface-800">{card.studentName}</h3>
                  <p className="text-sm text-surface-500">{card.program}</p>
                  <p className="text-xs text-surface-400 mt-1">{shortenAddress(card.studentAddr)}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-200">
                    <span className="font-mono text-xs text-surface-400">ID #{card.tokenId}</span>
                    <div className="flex gap-1">
                      <button className="btn-ghost btn-sm text-surface-500" onClick={e => { e.stopPropagation(); loadDetail(card); }}><Eye size={12} /></button>
                      {status === 'active' && (
                        <button className="btn-ghost btn-sm text-warning-600" onClick={e => { e.stopPropagation(); setShowAction({ action: 'suspend', tokenId: card.tokenId }); }}><Ban size={12} /></button>
                      )}
                      {status === 'suspended' && (
                        <button className="btn-ghost btn-sm text-brand-600" onClick={e => { e.stopPropagation(); handleAction('reactivate', card.tokenId); }}><RefreshCw size={12} /></button>
                      )}
                      {!card.isRevoked && (
                        <button className="btn-ghost btn-sm text-danger-600" onClick={e => { e.stopPropagation(); setShowAction({ action: 'revoke', tokenId: card.tokenId }); }}><XCircle size={12} /></button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState lucideIcon={CreditCard} title="Chưa có thẻ sinh viên"
          description="Phát hành thẻ sinh viên NFT đầu tiên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Phát hành</button>}
        />
      )}

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

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Thẻ sinh viên #${showDetail?.tokenId}`}>
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-surface-500">Họ tên:</span><p className="font-medium">{showDetail.studentName}</p></div>
              <div><span className="text-surface-500">Chương trình:</span><p className="font-medium">{showDetail.program}</p></div>
              <div><span className="text-surface-500">Địa chỉ:</span><p className="font-mono text-xs">{showDetail.studentAddr}</p></div>
              <div><span className="text-surface-500">Trạng thái:</span><p><span className={getStatusBadge(getStatus(showDetail))}>{getStatusLabel(getStatus(showDetail))}</span></p></div>
              <div><span className="text-surface-500">Ngày nhập học:</span><p>{formatDate(showDetail.enrollmentDate)}</p></div>
              <div><span className="text-surface-500">Ngày phát hành:</span><p>{formatDate(showDetail.issuedAt)}</p></div>
            </div>
            {detail && (
              <div className="space-y-2 text-sm border-t pt-3">
                {detail.metadataURI && <div><span className="text-surface-500">Metadata URI:</span><p className="font-mono text-xs break-all">{detail.metadataURI}</p></div>}
                {detail.suspensionReason && <div><span className="text-surface-500">Lý do tạm ngưng:</span><p className="text-warning-600">{detail.suspensionReason}</p></div>}
                {detail.revocationReason && <div><span className="text-surface-500">Lý do thu hồi:</span><p className="text-danger-600">{detail.revocationReason}</p></div>}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary btn-sm" onClick={() => { setShowUpdateURI(showDetail.tokenId); setShowDetail(null); }}><Edit size={12} /> Cập nhật URI</button>
              {!showDetail.isSuspended && !showDetail.isRevoked && (
                <button className="btn-warning btn-sm" onClick={() => { setShowAction({ action: 'suspend', tokenId: showDetail.tokenId }); setShowDetail(null); }}><Ban size={12} /> Tạm ngưng</button>
              )}
              {showDetail.isSuspended && !showDetail.isRevoked && (
                <button className="btn-primary btn-sm" onClick={() => { handleAction('reactivate', showDetail.tokenId); setShowDetail(null); }}><RefreshCw size={12} /> Kích hoạt lại</button>
              )}
              {!showDetail.isRevoked && (
                <button className="btn-danger btn-sm" onClick={() => { setShowAction({ action: 'revoke', tokenId: showDetail.tokenId }); setShowDetail(null); }}><XCircle size={12} /> Thu hồi</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Action Modal (suspend/revoke with reason) */}
      <Modal open={!!showAction} onClose={() => { setShowAction(null); setActionReason(''); }}
        title={showAction?.action === 'suspend' ? `Tạm ngưng thẻ #${showAction?.tokenId}` : `Thu hồi thẻ #${showAction?.tokenId}`}
        footer={<button className={showAction?.action === 'suspend' ? 'btn-warning' : 'btn-danger'}
          onClick={() => showAction && handleAction(showAction.action, showAction.tokenId, actionReason)} disabled={isLoading || !actionReason}>
          {isLoading ? 'Đang xử lý...' : showAction?.action === 'suspend' ? 'Tạm ngưng' : 'Thu hồi'}
        </button>}>
        <div><label className="label">Lý do</label><textarea className="input" rows={3} placeholder="Nhập lý do..." value={actionReason} onChange={e => setActionReason(e.target.value)} /></div>
      </Modal>

      {/* Update URI Modal */}
      <Modal open={showUpdateURI !== null} onClose={() => setShowUpdateURI(null)} title={`Cập nhật URI thẻ #${showUpdateURI}`}
        footer={<button className="btn-primary" onClick={() => showUpdateURI !== null && handleUpdateURI(showUpdateURI)} disabled={isLoading || !newURI}>
          {isLoading ? 'Đang cập nhật...' : 'Cập nhật'}
        </button>}>
        <div><label className="label">Metadata URI mới</label><input className="input" placeholder="ipfs://..." value={newURI} onChange={e => setNewURI(e.target.value)} /></div>
      </Modal>

      {/* Authorize Verifier Modal */}
      <Modal open={showVerifier} onClose={() => setShowVerifier(false)} title="Ủy quyền Verifier"
        footer={<button className="btn-primary" onClick={handleAuthorizeVerifier} disabled={isLoading || !verifierAddr}>
          {isLoading ? 'Đang xử lý...' : 'Ủy quyền'}
        </button>}>
        <div><label className="label">Địa chỉ Verifier</label><input className="input" placeholder="0x..." value={verifierAddr} onChange={e => setVerifierAddr(e.target.value)} /></div>
      </Modal>
    </div>
  );
}

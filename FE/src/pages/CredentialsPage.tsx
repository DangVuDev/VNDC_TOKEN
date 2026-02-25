import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, XCircle, CheckCircle, Clock, Eye } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useCredentialVerification } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, formatDate } from '@/lib/utils';

interface Credential {
  tokenId: string; name: string; level: string;
  issuer: string; issuedAt: number; expiresAt: number; revoked: boolean;
}

export default function CredentialsPage() {
  const { address } = useWeb3();
  const credContract = useCredentialVerification();
  const { isLoading, execute } = useContractAction();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showDetail, setShowDetail] = useState<Credential | null>(null);
  const [form, setForm] = useState({ student: '', name: '', level: 'Bachelor', expDays: '365', ipfs: '' });

  useEffect(() => {
    async function load() {
      if (!credContract || !address) return;
      setLoading(true);
      try {
        const tokenIds = await credContract.getCredentialsByUser(address);
        const creds: Credential[] = [];
        for (const id of tokenIds) {
          const c = await credContract.getCredential(id);
          creds.push({ tokenId: id.toString(), name: c.name, level: c.level,
            issuer: c.issuer, issuedAt: Number(c.issuedAt), expiresAt: Number(c.expiresAt), revoked: c.revoked });
        }
        setCredentials(creds);
      } catch {}
      setLoading(false);
    }
    load();
  }, [credContract, address]);

  const handleIssue = () => execute(
    async () => {
      if (!credContract) throw new Error('Contract not available');
      return credContract.issueCredential(form.student, form.name, form.level, Number(form.expDays), form.ipfs);
    },
    { successMessage: 'Chứng chỉ đã được cấp!', onSuccess: () => setShowIssue(false) }
  );

  const handleRevoke = (tokenId: string) => execute(
    async () => {
      if (!credContract) throw new Error('Contract not available');
      return credContract.revokeCredential(tokenId);
    },
    { successMessage: 'Chứng chỉ đã bị thu hồi' }
  );

  const now = Math.floor(Date.now() / 1000);
  const active = credentials.filter(c => !c.revoked && c.expiresAt > now);
  const revoked = credentials.filter(c => c.revoked);

  function statusBadge(c: Credential) {
    if (c.revoked) return <span className="badge badge-danger"><XCircle size={12} /> Thu hồi</span>;
    if (c.expiresAt <= now) return <span className="badge badge-warning"><Clock size={12} /> Hết hạn</span>;
    return <span className="badge badge-success"><CheckCircle size={12} /> Hợp lệ</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center">
            <ShieldCheck size={20} className="text-success-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Bằng cấp & Chứng chỉ</h1>
            <p className="text-sm text-surface-500">{credentials.length} chứng chỉ · {active.length} hợp lệ</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}>
          <Plus size={14} /> Cấp mới
        </button>
      </div>

      {/* Credential Cards */}
      {credentials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {credentials.map(c => (
            <div key={c.tokenId} className="card card-hover cursor-pointer" onClick={() => setShowDetail(c)}>
              <div className="flex items-start justify-between mb-3">
                <span className="font-mono text-xs text-brand-600">#{c.tokenId}</span>
                {statusBadge(c)}
              </div>
              <h3 className="text-base font-semibold text-surface-800 mb-1">{c.name}</h3>
              <p className="text-sm text-surface-500 mb-3">{c.level}</p>
              <div className="flex items-center justify-between text-xs text-surface-400 pt-3 border-t border-surface-200">
                <span>Cấp: {formatDate(c.issuedAt)}</span>
                <span>Hết hạn: {formatDate(c.expiresAt)}</span>
              </div>
              {!c.revoked && (
                <button className="btn-danger btn-sm w-full mt-3" onClick={e => { e.stopPropagation(); handleRevoke(c.tokenId); }}>
                  <XCircle size={12} /> Thu hồi
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState lucideIcon={ShieldCheck} title="Chưa có chứng chỉ"
          description="Kết nối ví và cấp chứng chỉ đầu tiên cho sinh viên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>}
        />
      )}

      {/* Issue Modal */}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Cấp chứng chỉ mới"
        footer={<button className="btn-primary" onClick={handleIssue} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Cấp chứng chỉ'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ sinh viên</label>
            <input className="input" placeholder="0x..." value={form.student} onChange={e => setForm(f => ({ ...f, student: e.target.value }))} /></div>
          <div><label className="label">Tên chứng chỉ</label>
            <input className="input" placeholder="Chứng chỉ Blockchain" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Cấp độ</label>
              <select className="select" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                <option>Certificate</option><option>Bachelor</option><option>Master</option><option>PhD</option>
              </select></div>
            <div><label className="label">Hiệu lực (ngày)</label>
              <input className="input" type="number" value={form.expDays} onChange={e => setForm(f => ({ ...f, expDays: e.target.value }))} /></div>
          </div>
          <div><label className="label">IPFS URI</label>
            <input className="input" placeholder="ipfs://..." value={form.ipfs} onChange={e => setForm(f => ({ ...f, ipfs: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title="Chi tiết chứng chỉ">
        {showDetail && (
          <div className="space-y-3">
            {[
              { label: 'Token ID', value: `#${showDetail.tokenId}` },
              { label: 'Tên', value: showDetail.name },
              { label: 'Cấp độ', value: showDetail.level },
              { label: 'Người cấp', value: shortenAddress(showDetail.issuer) },
              { label: 'Ngày cấp', value: formatDate(showDetail.issuedAt) },
              { label: 'Hết hạn', value: formatDate(showDetail.expiresAt) },
            ].map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-surface-200 last:border-0">
                <span className="text-sm text-surface-500">{r.label}</span>
                <span className="text-sm font-medium text-surface-800">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

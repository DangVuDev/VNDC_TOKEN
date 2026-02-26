import { useState, useEffect, useCallback } from 'react';
import { Award, Plus, CheckCircle, FileText, Layers, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useCertificationSystem } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatDate, shortenAddress } from '@/lib/utils';

interface CertType { id: number; name: string; description: string; metadataURI: string; createdAt: number; totalIssued: number; }
interface Certificate { tokenId: number; student: string; certificateTypeId: number; issuedAt: number; expiryDate: number; isRevoked: boolean; isVerified: boolean; metadataURI: string; }

export default function CertificationPage() {
  const { address } = useWeb3();
  const cert = useCertificationSystem();
  const { isLoading, execute } = useContractAction();

  const [certTypes, setCertTypes] = useState<CertType[]>([]);
  const [myCerts, setMyCerts] = useState<Certificate[]>([]);
  const [stats, setStats] = useState({ totalTypes: 0, totalIssued: 0, totalActive: 0, totalRevoked: 0, totalVerified: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateType, setShowCreateType] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Certificate | null>(null);
  const [verifyTokenId, setVerifyTokenId] = useState('');
  const [typeForm, setTypeForm] = useState({ name: '', description: '', metadataURI: '' });
  const [issueForm, setIssueForm] = useState({ to: '', typeId: '', metadataURI: '', expiryDays: '365' });

  const loadData = useCallback(async () => {
    if (!cert) return;
    setLoading(true);
    try {
      const [totalTypes, totalIssued, totalActive, totalRevoked, totalVerified] = await Promise.all([
        cert.getTotalCertificateTypes().catch(() => 0n),
        cert.getTotalCertificatesIssued().catch(() => 0n),
        cert.getTotalActiveCertificates().catch(() => 0n),
        cert.getTotalRevokedCertificates().catch(() => 0n),
        cert.getTotalVerifiedCertificates().catch(() => 0n),
      ]);
      setStats({ totalTypes: Number(totalTypes), totalIssued: Number(totalIssued), totalActive: Number(totalActive), totalRevoked: Number(totalRevoked), totalVerified: Number(totalVerified) });

      const types: CertType[] = [];
      for (let i = 1; i <= Number(totalTypes); i++) {
        try {
          const ct = await cert.getCertificateType(i);
          types.push({ id: i, name: ct.name, description: ct.description, metadataURI: ct.metadataURI, createdAt: Number(ct.createdAt), totalIssued: Number(ct.totalIssued) });
        } catch {}
      }
      setCertTypes(types);

      if (address) {
        const tokenIds: bigint[] = await cert.getStudentCertificates(address).catch(() => []);
        const certs: Certificate[] = [];
        for (const tid of tokenIds) {
          try {
            const c = await cert.getCertificateDetails(tid);
            certs.push({ tokenId: Number(tid), student: c.student, certificateTypeId: Number(c.certificateTypeId), issuedAt: Number(c.issuedAt), expiryDate: Number(c.expiryDate), isRevoked: c.isRevoked, isVerified: c.isVerified, metadataURI: c.metadataURI });
          } catch {}
        }
        setMyCerts(certs);
      }
    } catch {}
    setLoading(false);
  }, [cert, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateType = () => execute(
    async () => {
      if (!cert) throw new Error('Contract not available');
      return cert.createCertificateType(typeForm.name, typeForm.description, typeForm.metadataURI);
    },
    { successMessage: 'Đã tạo loại chứng chỉ!', onSuccess: () => { setShowCreateType(false); loadData(); } }
  );

  const handleIssue = () => execute(
    async () => {
      if (!cert) throw new Error('Contract not available');
      const expiry = Math.floor(Date.now() / 1000) + Number(issueForm.expiryDays) * 86400;
      return cert.issueCertificate(issueForm.to, Number(issueForm.typeId), issueForm.metadataURI, expiry);
    },
    { successMessage: 'Đã cấp chứng chỉ!', onSuccess: () => { setShowIssue(false); loadData(); } }
  );

  const handleRevoke = (tokenId: number) => execute(
    async () => {
      if (!cert) throw new Error('Contract not available');
      return cert.revokeCertificate(tokenId, 'Admin revoked');
    },
    { successMessage: 'Đã thu hồi chứng chỉ!', onSuccess: loadData }
  );

  const handleVerifyAction = (tokenId: number) => execute(
    async () => {
      if (!cert) throw new Error('Contract not available');
      return cert.verifyCertificate(tokenId);
    },
    { successMessage: 'Đã xác minh chứng chỉ!', onSuccess: loadData }
  );

  const doVerifyLookup = async () => {
    if (!cert || !verifyTokenId) return;
    try {
      const c = await cert.getCertificateDetails(Number(verifyTokenId));
      setVerifyResult({ tokenId: Number(verifyTokenId), student: c.student, certificateTypeId: Number(c.certificateTypeId), issuedAt: Number(c.issuedAt), expiryDate: Number(c.expiryDate), isRevoked: c.isRevoked, isVerified: c.isVerified, metadataURI: c.metadataURI });
    } catch { setVerifyResult(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Award size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Chứng chỉ số</h1>
            <p className="text-sm text-surface-500">{stats.totalIssued} chứng chỉ · {stats.totalTypes} loại</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setShowCreateType(true)}><Layers size={14} /> Tạo loại</button>
          <button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Loại', value: stats.totalTypes, cls: 'text-brand-600' },
          { label: 'Đã cấp', value: stats.totalIssued, cls: 'text-info-600' },
          { label: 'Còn hiệu lực', value: stats.totalActive, cls: 'text-success-600' },
          { label: 'Đã xác minh', value: stats.totalVerified, cls: 'text-warning-600' },
          { label: 'Đã thu hồi', value: stats.totalRevoked, cls: 'text-danger-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : (
        <>
          {certTypes.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-surface-800 mb-3">Loại chứng chỉ</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {certTypes.map(ct => (
                  <div key={ct.id} className="card card-hover cursor-pointer" onClick={() => { setIssueForm(f => ({ ...f, typeId: ct.id.toString() })); setShowIssue(true); }}>
                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-2"><FileText size={20} /></div>
                    <h3 className="text-sm font-semibold text-surface-800">{ct.name}</h3>
                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{ct.description || 'Không có mô tả'}</p>
                    <p className="text-xs text-surface-500 mt-1">{ct.totalIssued} đã cấp</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {myCerts.length > 0 ? (
            <div>
              <h2 className="text-base font-semibold text-surface-800 mb-3">Chứng chỉ của bạn</h2>
              <div className="space-y-2">
                {myCerts.map(c => {
                  const ct = certTypes.find(t => t.id === c.certificateTypeId);
                  return (
                    <div key={c.tokenId} className="card flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-surface-800">{ct?.name || `Loại #${c.certificateTypeId}`}</h4>
                          {c.isRevoked ? <span className="badge badge-danger">Thu hồi</span> :
                           c.isVerified ? <span className="badge badge-success">Xác minh</span> :
                           <span className="badge badge-warning">Chờ xác minh</span>}
                        </div>
                        <p className="text-xs text-surface-500">Token #{c.tokenId} · Cấp: {formatDate(c.issuedAt)} · Hết hạn: {c.expiryDate ? formatDate(c.expiryDate) : 'Vĩnh viễn'}</p>
                      </div>
                      <div className="flex gap-1">
                        {!c.isVerified && !c.isRevoked && <button className="btn-ghost btn-sm text-success-600" onClick={() => handleVerifyAction(c.tokenId)}><CheckCircle size={14} /></button>}
                        {!c.isRevoked && <button className="btn-ghost btn-sm text-danger-600" onClick={() => handleRevoke(c.tokenId)}><XCircle size={14} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState lucideIcon={Award} title="Chưa có chứng chỉ" description="Cấp chứng chỉ đầu tiên cho sinh viên"
              action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>} />
          )}
        </>
      )}

      {/* Verify Section */}
      <div className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-3">Xác minh chứng chỉ</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1"><label className="label">Token ID</label><input className="input" type="number" placeholder="1" value={verifyTokenId} onChange={e => setVerifyTokenId(e.target.value)} /></div>
          <button className="btn-primary" onClick={doVerifyLookup}><ShieldCheck size={14} /> Kiểm tra</button>
        </div>
        {verifyResult && (
          <div className="mt-4 p-4 rounded-xl bg-surface-50 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-surface-500">Trạng thái:</span>
              {verifyResult.isRevoked ? <span className="badge badge-danger">Đã thu hồi</span> :
               verifyResult.isVerified ? <span className="badge badge-success">Hợp lệ & đã xác minh</span> :
               <span className="badge badge-warning">Chưa xác minh</span>}
            </div>
            <p className="text-xs text-surface-500">Sinh viên: {shortenAddress(verifyResult.student)}</p>
            <p className="text-xs text-surface-500">Loại: {certTypes.find(t => t.id === verifyResult.certificateTypeId)?.name || `#${verifyResult.certificateTypeId}`}</p>
            <p className="text-xs text-surface-500">Cấp: {formatDate(verifyResult.issuedAt)} · Hết hạn: {verifyResult.expiryDate ? formatDate(verifyResult.expiryDate) : 'Vĩnh viễn'}</p>
          </div>
        )}
      </div>

      {/* Create Type Modal */}
      <Modal open={showCreateType} onClose={() => setShowCreateType(false)} title="Tạo loại chứng chỉ"
        footer={<button className="btn-primary" onClick={handleCreateType} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên loại</label><input className="input" placeholder="Chứng chỉ Blockchain" value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Metadata URI</label><input className="input" placeholder="ipfs://..." value={typeForm.metadataURI} onChange={e => setTypeForm(f => ({ ...f, metadataURI: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Issue Modal */}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Cấp chứng chỉ" size="lg"
        footer={<button className="btn-primary" onClick={handleIssue} disabled={isLoading}>{isLoading ? 'Đang cấp...' : 'Cấp'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ nhận</label><input className="input" placeholder="0x..." value={issueForm.to} onChange={e => setIssueForm(f => ({ ...f, to: e.target.value }))} /></div>
          <div><label className="label">Loại chứng chỉ</label>
            <select className="select" value={issueForm.typeId} onChange={e => setIssueForm(f => ({ ...f, typeId: e.target.value }))}>
              <option value="">Chọn loại...</option>
              {certTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
            </select>
          </div>
          <div><label className="label">Metadata URI</label><input className="input" placeholder="ipfs://..." value={issueForm.metadataURI} onChange={e => setIssueForm(f => ({ ...f, metadataURI: e.target.value }))} /></div>
          <div><label className="label">Thời hạn (ngày)</label><input className="input" type="number" placeholder="365" value={issueForm.expiryDays} onChange={e => setIssueForm(f => ({ ...f, expiryDays: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

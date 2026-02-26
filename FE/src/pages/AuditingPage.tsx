import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, Eye, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useAuditingSystem } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatDate, shortenAddress } from '@/lib/utils';

interface Audit {
  id: number; contractAddress: string; auditor: string; status: string;
  auditDate: number; critical: number; medium: number; low: number;
}
interface AuditReport { reportHash: string; findings: string; timestamp: number; }

export default function AuditingPage() {
  const { address } = useWeb3();
  const auditing = useAuditingSystem();
  const { isLoading, execute } = useContractAction();

  const [audits, setAudits] = useState<Audit[]>([]);
  const [reports, setReports] = useState<Record<number, AuditReport>>({});
  const [myAuditIds, setMyAuditIds] = useState<number[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Audit | null>(null);
  const [showReport, setShowReport] = useState<Audit | null>(null);
  const [showAuthorize, setShowAuthorize] = useState(false);
  const [form, setForm] = useState({ contractAddress: '', critical: '', medium: '', low: '' });
  const [reportForm, setReportForm] = useState({ reportHash: '', findings: '' });
  const [authorizeAddr, setAuthorizeAddr] = useState('');

  const loadData = useCallback(async () => {
    if (!auditing) return;
    setLoading(true);
    try {
      const total = await auditing.getTotalAudits().catch(() => 0n);
      const list: Audit[] = [];
      const allReports: Record<number, AuditReport> = {};
      for (let i = 1; i <= Number(total); i++) {
        try {
          const d = await auditing.getAuditDetails(i);
          list.push({ id: i, contractAddress: d.contractAddress, auditor: d.auditor, status: d.status, auditDate: Number(d.auditDate), critical: Number(d.critical), medium: Number(d.medium), low: Number(d.low) });
          try {
            const r = await auditing.getAuditReport(i);
            if (r.reportHash) allReports[i] = { reportHash: r.reportHash, findings: r.findings, timestamp: Number(r.timestamp) };
          } catch {}
        } catch {}
      }
      setAudits(list);
      setReports(allReports);
      if (address) {
        const myIds: bigint[] = await auditing.getAuditorAudits(address).catch(() => []);
        setMyAuditIds(myIds.map(Number));
        const auth = await auditing.isAuthorizedAuditor(address).catch(() => false);
        setIsAuthorized(auth);
      }
    } catch {}
    setLoading(false);
  }, [auditing, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => execute(
    async () => {
      if (!auditing) throw new Error('Contract not available');
      return auditing.createAudit(form.contractAddress, Number(form.critical), Number(form.medium), Number(form.low));
    },
    { successMessage: 'Audit đã được tạo!', onSuccess: () => { setShowCreate(false); loadData(); } }
  );

  const handleSubmitReport = () => execute(
    async () => {
      if (!auditing || !showReport) throw new Error('Contract not available');
      return auditing.submitReport(showReport.id, reportForm.reportHash, reportForm.findings);
    },
    { successMessage: 'Báo cáo đã nộp!', onSuccess: () => { setShowReport(null); loadData(); } }
  );

  const handleApprove = (auditId: number) => execute(
    async () => { if (!auditing) throw new Error('Contract not available'); return auditing.approveAudit(auditId); },
    { successMessage: 'Audit đã được duyệt!', onSuccess: loadData }
  );

  const handleReject = (auditId: number) => execute(
    async () => { if (!auditing) throw new Error('Contract not available'); return auditing.rejectAudit(auditId); },
    { successMessage: 'Audit bị từ chối!', onSuccess: loadData }
  );

  const handleAuthorize = () => execute(
    async () => { if (!auditing) throw new Error('Contract not available'); return auditing.authorizeAuditor(authorizeAddr); },
    { successMessage: 'Auditor đã được ủy quyền!', onSuccess: () => { setShowAuthorize(false); setAuthorizeAddr(''); loadData(); } }
  );

  const severityColor = (c: number, m: number) => c > 0 ? 'text-danger-600' : m > 0 ? 'text-warning-600' : 'text-info-600';
  const statusBadge = (s: string) => {
    const m: Record<string, { cls: string; label: string }> = { pending: { cls: 'badge-neutral', label: 'Chờ' }, approved: { cls: 'badge-success', label: 'Đã duyệt' }, rejected: { cls: 'badge-danger', label: 'Từ chối' } };
    const d = m[s] || { cls: 'badge-brand', label: s };
    return <span className={d.cls}>{d.label}</span>;
  };
  const totalFindings = audits.reduce((a, d) => a + d.critical + d.medium + d.low, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><ShieldCheck size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Kiểm toán</h1>
            <p className="text-sm text-surface-500">{audits.length} audit · {totalFindings} findings</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowAuthorize(true)}>Authorize</button>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo audit</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng audit', value: audits.length, cls: 'text-brand-600' },
          { label: 'Audit tôi', value: myAuditIds.length, cls: 'text-info-600' },
          { label: 'Đã duyệt', value: audits.filter(a => a.status === 'approved').length, cls: 'text-success-600' },
          { label: 'Critical', value: audits.reduce((a, d) => a + d.critical, 0), cls: 'text-danger-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {isAuthorized && <div className="p-3 rounded-xl bg-success-50 border border-success-200 text-sm text-success-700">Bạn là Authorized Auditor</div>}

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : audits.length === 0 ? (
        <EmptyState lucideIcon={ShieldCheck} title="Chưa có audit" description="Tạo audit đầu tiên" />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Contract</th>
                  <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Auditor</th>
                  <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Issues</th>
                  <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Ngày</th>
                  <th className="text-right text-xs font-medium text-surface-500 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {audits.map(audit => (
                  <tr key={audit.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3"><span className="text-sm text-surface-800 font-medium">{shortenAddress(audit.contractAddress)}</span></td>
                    <td className="px-4 py-3 text-sm text-surface-500">{shortenAddress(audit.auditor)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${severityColor(audit.critical, audit.medium)}`}>
                        C:{audit.critical} M:{audit.medium} L:{audit.low}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(audit.status)}</td>
                    <td className="px-4 py-3 text-sm text-surface-500">{audit.auditDate ? formatDate(audit.auditDate) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn-ghost btn-sm btn-icon" onClick={() => setShowDetail(audit)}><Eye size={14} /></button>
                        <button className="btn-ghost btn-sm text-xs" onClick={() => { setShowReport(audit); setReportForm({ reportHash: '', findings: '' }); }}>Report</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Completed Reports */}
      {Object.keys(reports).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-500 mb-3">Báo cáo đã nộp ({Object.keys(reports).length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(reports).map(([auditId, r]) => {
              const audit = audits.find(a => a.id === Number(auditId));
              return (
                <div key={auditId} className="card card-hover">
                  <div className="flex items-start gap-3 mb-3">
                    <ShieldCheck size={20} className="text-success-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-surface-800">{audit ? shortenAddress(audit.contractAddress) : `Audit #${auditId}`}</h3>
                      <p className="text-xs text-surface-500">{r.timestamp ? formatDate(r.timestamp) : ''}</p>
                    </div>
                  </div>
                  <p className="text-xs text-surface-600 mb-2">{r.findings}</p>
                  <p className="text-[10px] text-surface-400 break-all">Hash: {r.reportHash}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Audit Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo Audit"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo audit'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Contract Address</label><input className="input" placeholder="0x..." value={form.contractAddress} onChange={e => setForm(f => ({ ...f, contractAddress: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Critical</label><input className="input" type="number" placeholder="0" value={form.critical} onChange={e => setForm(f => ({ ...f, critical: e.target.value }))} /></div>
            <div><label className="label">Medium</label><input className="input" type="number" placeholder="0" value={form.medium} onChange={e => setForm(f => ({ ...f, medium: e.target.value }))} /></div>
            <div><label className="label">Low</label><input className="input" type="number" placeholder="0" value={form.low} onChange={e => setForm(f => ({ ...f, low: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Audit #${showDetail?.id || ''}`} size="lg"
        footer={showDetail && showDetail.status === 'pending' ? (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => handleApprove(showDetail.id)} disabled={isLoading}>Duyệt</button>
            <button className="btn-danger" onClick={() => handleReject(showDetail.id)} disabled={isLoading}>Từ chối</button>
          </div>
        ) : undefined}>
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Contract</p><p className="text-sm font-semibold text-surface-800 break-all">{showDetail.contractAddress}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Auditor</p><p className="text-sm font-semibold text-surface-800 break-all">{showDetail.auditor}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Ngày</p><p className="text-sm font-semibold text-surface-800">{showDetail.auditDate ? formatDate(showDetail.auditDate) : '-'}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Status</p><div className="mt-1">{statusBadge(showDetail.status)}</div></div>
            </div>
            <div className="p-4 rounded-xl bg-warning-50 border border-warning-200">
              <h4 className="text-sm font-medium text-warning-600 mb-2">Issues</h4>
              <div className="flex gap-4 text-sm">
                <span className="text-danger-600 font-bold">Critical: {showDetail.critical}</span>
                <span className="text-warning-600 font-bold">Medium: {showDetail.medium}</span>
                <span className="text-info-600 font-bold">Low: {showDetail.low}</span>
              </div>
            </div>
            {reports[showDetail.id] && (
              <div className="p-4 rounded-xl bg-surface-50">
                <h4 className="text-sm font-medium text-surface-800 mb-2">Report</h4>
                <p className="text-xs text-surface-600 mb-1">{reports[showDetail.id].findings}</p>
                <p className="text-[10px] text-surface-400 break-all">Hash: {reports[showDetail.id].reportHash}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Submit Report Modal */}
      <Modal open={!!showReport} onClose={() => setShowReport(null)} title="Nộp báo cáo audit"
        footer={<button className="btn-primary" onClick={handleSubmitReport} disabled={isLoading}>{isLoading ? 'Đang gửi...' : 'Nộp báo cáo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Report Hash (IPFS)</label><input className="input" placeholder="QmXyz..." value={reportForm.reportHash} onChange={e => setReportForm(f => ({ ...f, reportHash: e.target.value }))} /></div>
          <div><label className="label">Findings</label><textarea className="textarea" rows={4} placeholder="Summary of findings..." value={reportForm.findings} onChange={e => setReportForm(f => ({ ...f, findings: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Authorize Auditor Modal */}
      <Modal open={showAuthorize} onClose={() => setShowAuthorize(false)} title="Ủy quyền Auditor"
        footer={<button className="btn-primary" onClick={handleAuthorize} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Ủy quyền'}</button>}>
        <div><label className="label">Địa chỉ Auditor</label><input className="input" placeholder="0x..." value={authorizeAddr} onChange={e => setAuthorizeAddr(e.target.value)} /></div>
      </Modal>
    </div>
  );
}

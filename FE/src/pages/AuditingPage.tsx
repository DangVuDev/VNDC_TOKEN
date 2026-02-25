import { useState } from 'react';
import { ShieldCheck, FileSearch, CheckCircle, AlertTriangle, Clock, Plus, Eye, FileText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useAuditingSystem } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

interface AuditJob {
  id: number;
  contract: string;
  auditor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'disputed';
  findings: number;
  date: string;
}

const demoAudits: AuditJob[] = [
  { id: 1, contract: 'VNDCToken.sol', auditor: 'Auditor A', severity: 'low', status: 'completed', findings: 2, date: '2025-01-15' },
  { id: 2, contract: 'PaymentProcessor.sol', auditor: 'Auditor B', severity: 'medium', status: 'completed', findings: 5, date: '2025-02-01' },
  { id: 3, contract: 'StudentDAO.sol', auditor: 'Auditor A', severity: 'high', status: 'in-progress', findings: 3, date: '2025-03-10' },
  { id: 4, contract: 'ScholarshipManager.sol', auditor: 'Auditor C', severity: 'low', status: 'pending', findings: 0, date: '2025-04-01' },
];

export default function AuditingPage() {
  const auditing = useAuditingSystem();
  const { isLoading, execute } = useContractAction();

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<AuditJob | null>(null);
  const [form, setForm] = useState({ contract: '', description: '' });

  const handleCreate = () => execute(
    async () => {
      if (!auditing) throw new Error('Contract not available');
      return auditing.createAuditJob(form.contract, form.description);
    },
    { successMessage: 'Audit job đã được tạo!', onSuccess: () => setShowCreate(false) }
  );

  const severityBadge = (s: string) => {
    const map: Record<string, string> = { low: 'badge-info', medium: 'badge-warning', high: 'badge-danger', critical: 'badge-danger' };
    return <span className={map[s] || 'badge-neutral'}>{s.toUpperCase()}</span>;
  };
  const statusBadge = (s: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      'pending': { cls: 'badge-neutral', label: 'Chờ' },
      'in-progress': { cls: 'badge-brand', label: 'Đang audit' },
      'completed': { cls: 'badge-success', label: 'Hoàn thành' },
      'disputed': { cls: 'badge-danger', label: 'Tranh chấp' },
    };
    const { cls, label } = map[s] || map['pending'];
    return <span className={cls}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <ShieldCheck size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Kiểm toán</h1>
            <p className="text-sm text-surface-500">{demoAudits.length} audit · {demoAudits.reduce((a, d) => a + d.findings, 0)} findings</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo audit</button>
      </div>

      {/* Audit Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Contract</th>
                <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Auditor</th>
                <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Severity</th>
                <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-surface-500 px-4 py-3">Findings</th>
                <th className="text-right text-xs font-medium text-surface-500 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {demoAudits.map(audit => (
                <tr key={audit.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors">
                  <td className="px-4 py-3"><span className="text-sm text-surface-800 font-medium">{audit.contract}</span></td>
                  <td className="px-4 py-3 text-sm text-surface-500">{audit.auditor}</td>
                  <td className="px-4 py-3">{severityBadge(audit.severity)}</td>
                  <td className="px-4 py-3">{statusBadge(audit.status)}</td>
                  <td className="px-4 py-3 text-right text-sm text-surface-800">{audit.findings}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost btn-sm btn-icon" onClick={() => setShowDetail(audit)}><Eye size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reports */}
      <div>
        <h3 className="text-sm font-semibold text-surface-500 mb-3">Báo cáo hoàn thành</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {demoAudits.filter(a => a.status === 'completed').map(a => (
            <div key={a.id} className="card card-hover">
              <div className="flex items-start gap-3 mb-3">
                <ShieldCheck size={20} className="text-success-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-surface-800">{a.contract}</h3>
                  <p className="text-xs text-surface-500">{a.auditor} • {a.date}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">{severityBadge(a.severity)}<span className="badge badge-neutral">{a.findings} findings</span></div>
                <button className="btn-ghost btn-sm"><Eye size={12} /> View</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo Audit Job"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo audit'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Smart Contract</label><input className="input" placeholder="VNDCToken.sol" value={form.contract} onChange={e => setForm(f => ({ ...f, contract: e.target.value }))} /></div>
          <div><label className="label">Mô tả yêu cầu</label><textarea className="textarea" rows={3} placeholder="Yêu cầu audit..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Audit: ${showDetail?.contract || ''}`} size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Auditor</p><p className="text-sm font-semibold text-surface-800">{showDetail.auditor}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Ngày</p><p className="text-sm font-semibold text-surface-800">{showDetail.date}</p></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Severity</p><div className="mt-1">{severityBadge(showDetail.severity)}</div></div>
              <div className="p-3 rounded-xl bg-surface-50"><p className="text-xs text-surface-500">Status</p><div className="mt-1">{statusBadge(showDetail.status)}</div></div>
            </div>
            <div className="p-4 rounded-xl bg-warning-50 border border-warning-200">
              <h4 className="text-sm font-medium text-warning-600 mb-2">Findings ({showDetail.findings})</h4>
              <p className="text-xs text-surface-500">Chi tiết findings sẽ được lưu trên IPFS và hiển thị tại đây.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

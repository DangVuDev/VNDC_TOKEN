import { useState } from 'react';
import { ShieldCheck, FileSearch, CheckCircle, AlertTriangle, Clock, Plus, Eye, FileText } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
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
    <div>
      <PageHeader title="Kiểm toán" description="Audit smart contract, báo cáo bảo mật và voting on-chain" lucideIcon={ShieldCheck} badge="Auditing"
        action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo audit</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng audit" value={demoAudits.length} icon={<ShieldCheck className="w-5 h-5" />} color="brand" />
        <StatCard label="Hoàn thành" value={demoAudits.filter(a => a.status === 'completed').length} icon={<CheckCircle className="w-5 h-5" />} color="success" />
        <StatCard label="Findings" value={demoAudits.reduce((a, d) => a + d.findings, 0)} icon={<AlertTriangle className="w-5 h-5" />} color="warning" />
        <StatCard label="Đang audit" value={demoAudits.filter(a => a.status === 'in-progress').length} icon={<Clock className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'audits', label: 'Audit Jobs', icon: <FileSearch size={14} />, count: demoAudits.length },
        { id: 'reports', label: 'Báo cáo', icon: <FileText size={14} /> },
      ]}>
        {(active) => active === 'audits' ? (
          <div className="card p-0 overflow-hidden">
            <div className="table-container">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-800">
                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-3">Contract</th>
                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-3">Auditor</th>
                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-3">Severity</th>
                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-surface-400 px-4 py-3">Findings</th>
                    <th className="text-right text-xs font-medium text-surface-400 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {demoAudits.map(audit => (
                    <tr key={audit.id} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-3"><span className="text-sm text-white font-medium">{audit.contract}</span></td>
                      <td className="px-4 py-3 text-sm text-surface-400">{audit.auditor}</td>
                      <td className="px-4 py-3">{severityBadge(audit.severity)}</td>
                      <td className="px-4 py-3">{statusBadge(audit.status)}</td>
                      <td className="px-4 py-3 text-right text-sm text-white">{audit.findings}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="btn-ghost btn-sm btn-icon" onClick={() => setShowDetail(audit)}><Eye size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {demoAudits.filter(a => a.status === 'completed').map(a => (
              <div key={a.id} className="card card-hover">
                <div className="flex items-start gap-3 mb-3">
                  <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{a.contract}</h3>
                    <p className="text-xs text-surface-400">{a.auditor} • {a.date}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">{severityBadge(a.severity)}<span className="badge badge-neutral">{a.findings} findings</span></div>
                  <button className="btn-ghost btn-sm"><Eye size={12} /> View</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Tabs>

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
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Auditor</p><p className="text-sm font-semibold text-white">{showDetail.auditor}</p></div>
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Ngày</p><p className="text-sm font-semibold text-white">{showDetail.date}</p></div>
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Severity</p><div className="mt-1">{severityBadge(showDetail.severity)}</div></div>
              <div className="p-3 rounded-xl bg-surface-800/30"><p className="text-xs text-surface-500">Status</p><div className="mt-1">{statusBadge(showDetail.status)}</div></div>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <h4 className="text-sm font-medium text-amber-300 mb-2">Findings ({showDetail.findings})</h4>
              <p className="text-xs text-surface-400">Chi tiết findings sẽ được lưu trên IPFS và hiển thị tại đây.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

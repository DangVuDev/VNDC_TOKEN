import { useState, useEffect } from 'react';
import { Award, Plus, CheckCircle, FileText, Layers } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useCertificationSystem } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

const certTypes = [
  { id: 'course', label: 'Hoàn thành khóa học', icon: FileText, count: 12 },
  { id: 'skill', label: 'Chứng nhận kỹ năng', icon: Award, count: 8 },
  { id: 'achievement', label: 'Thành tích nổi bật', icon: CheckCircle, count: 5 },
  { id: 'professional', label: 'Chứng chỉ chuyên nghiệp', icon: Layers, count: 3 },
];

export default function CertificationPage() {
  const { address } = useWeb3();
  const cert = useCertificationSystem();
  const { isLoading, execute } = useContractAction();

  const [totalCerts, setTotalCerts] = useState(0);
  const [showIssue, setShowIssue] = useState(false);
  const [form, setForm] = useState({ to: '', certType: '', name: '', issuer: '', metadataURI: '', amount: '1' });

  useEffect(() => {
    async function load() {
      if (!cert) return;
      try { setTotalCerts(Number(await cert.getTotalCertificates())); } catch {}
    }
    load();
  }, [cert]);

  const handleIssue = () => execute(
    async () => {
      if (!cert) throw new Error('Contract not available');
      return cert.issueCertificate(form.to, form.certType, form.name, form.issuer, form.metadataURI);
    },
    { successMessage: 'Chứng chỉ đã được cấp!', onSuccess: () => setShowIssue(false) }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Award size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Chứng chỉ số</h1>
            <p className="text-sm text-surface-500">{totalCerts} chứng chỉ · ERC-1155</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>
      </div>

      {/* Cert types grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {certTypes.map(ct => {
          const Icon = ct.icon;
          return (
            <div key={ct.id} className="card card-hover cursor-pointer" onClick={() => { setForm(f => ({ ...f, certType: ct.id })); setShowIssue(true); }}>
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
                <Icon size={20} />
              </div>
              <h3 className="text-sm font-semibold text-surface-800">{ct.label}</h3>
              <p className="text-xs text-surface-500 mt-1">{ct.count} đã cấp</p>
            </div>
          );
        })}
      </div>

      {/* Issued certs */}
      <EmptyState lucideIcon={Award} title="Chưa có chứng chỉ" description="Cấp chứng chỉ đầu tiên cho sinh viên"
        action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>} />

      {/* Verify section */}
      <div className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-3">Xác minh chứng chỉ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div><label className="label">Token ID</label><input className="input" type="number" placeholder="1" /></div>
          <div><label className="label">Địa chỉ ví</label><input className="input" placeholder="0x..." /></div>
          <button className="btn-primary"><CheckCircle size={14} /> Xác minh</button>
        </div>
      </div>

      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Cấp chứng chỉ" size="lg"
        footer={<button className="btn-primary" onClick={handleIssue} disabled={isLoading}>{isLoading ? 'Đang cấp...' : 'Cấp'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ nhận</label><input className="input" placeholder="0x..." value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} /></div>
          <div><label className="label">Loại</label>
            <select className="select" value={form.certType} onChange={e => setForm(f => ({ ...f, certType: e.target.value }))}>
              <option value="">Chọn loại...</option>
              {certTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.label}</option>)}
            </select>
          </div>
          <div><label className="label">Tên chứng chỉ</label><input className="input" placeholder="Certificate of Completion" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Đơn vị cấp</label><input className="input" placeholder="VNDC University" value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} /></div>
          <div><label className="label">Metadata URI</label><input className="input" placeholder="ipfs://..." value={form.metadataURI} onChange={e => setForm(f => ({ ...f, metadataURI: e.target.value }))} /></div>
          <div><label className="label">Số lượng</label><input className="input" type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

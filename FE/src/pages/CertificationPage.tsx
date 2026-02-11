import { useState, useEffect } from 'react';
import { Award, Plus, Download, CheckCircle, FileText, Layers } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useCertificationSystem } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

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
      try {
        const total = await cert.getTotalCertificates();
        setTotalCerts(Number(total));
      } catch {}
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

  const certTypes = [
    { id: 'course', label: 'Hoàn thành khóa học', icon: FileText, color: 'brand', count: 12 },
    { id: 'skill', label: 'Chứng nhận kỹ năng', icon: Award, color: 'success', count: 8 },
    { id: 'achievement', label: 'Thành tích nổi bật', icon: CheckCircle, color: 'warning', count: 5 },
    { id: 'professional', label: 'Chứng chỉ chuyên nghiệp', icon: Layers, color: 'info', count: 3 },
  ];

  return (
    <div>
      <PageHeader title="Chứng chỉ số" description="Cấp phát và quản lý chứng chỉ ERC-1155 trên blockchain" lucideIcon={Award} badge="Certification"
        action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng chứng chỉ" value={totalCerts} icon={<Award className="w-5 h-5" />} color="brand" />
        <StatCard label="Loại chứng chỉ" value={certTypes.length} icon={<Layers className="w-5 h-5" />} color="success" />
        <StatCard label="Đã xác minh" value="0" icon={<CheckCircle className="w-5 h-5" />} color="warning" />
        <StatCard label="Batch issued" value="0" icon={<FileText className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'types', label: 'Loại chứng chỉ', icon: <Layers size={14} /> },
        { id: 'issued', label: 'Đã cấp', icon: <Award size={14} /> },
        { id: 'verify', label: 'Xác minh', icon: <CheckCircle size={14} /> },
      ]}>
        {(active) => active === 'types' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {certTypes.map(ct => {
              const Icon = ct.icon;
              return (
                <div key={ct.id} className="card card-hover">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      ct.color === 'brand' ? 'bg-brand-500/10 text-brand-400' :
                      ct.color === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                      ct.color === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-sky-500/10 text-sky-400'
                    }`}>
                      <Icon size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white">{ct.label}</h3>
                      <p className="text-sm text-surface-400 mt-1">ERC-1155 Token Standard</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-surface-500">{ct.count} đã cấp</span>
                        <button className="btn-secondary btn-sm" onClick={() => { setForm(f => ({ ...f, certType: ct.id })); setShowIssue(true); }}>
                          Cấp mới
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : active === 'issued' ? (
          <EmptyState lucideIcon={Award} title="Chưa có chứng chỉ"
            description="Cấp chứng chỉ đầu tiên cho sinh viên"
            action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>} />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Xác minh chứng chỉ</h3>
            <div className="space-y-4">
              <div><label className="label">Token ID</label><input className="input" type="number" placeholder="Nhập Token ID..." /></div>
              <div><label className="label">Địa chỉ ví</label><input className="input" placeholder="0x..." /></div>
              <button className="btn-primary"><CheckCircle size={14} /> Xác minh</button>
            </div>
          </div>
        )}
      </Tabs>

      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Cấp chứng chỉ mới" size="lg"
        footer={<button className="btn-primary" onClick={handleIssue} disabled={isLoading}>{isLoading ? 'Đang cấp...' : 'Cấp chứng chỉ'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ nhận</label><input className="input" placeholder="0x..." value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} /></div>
          <div><label className="label">Loại chứng chỉ</label>
            <select className="select" value={form.certType} onChange={e => setForm(f => ({ ...f, certType: e.target.value }))}>
              <option value="">Chọn loại...</option>
              {certTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.label}</option>)}
            </select>
          </div>
          <div><label className="label">Tên chứng chỉ</label><input className="input" placeholder="Certificate of Completion..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Đơn vị cấp</label><input className="input" placeholder="VNDC University" value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} /></div>
          <div><label className="label">Metadata URI</label><input className="input" placeholder="ipfs://..." value={form.metadataURI} onChange={e => setForm(f => ({ ...f, metadataURI: e.target.value }))} /></div>
          <div><label className="label">Số lượng (ERC-1155)</label><input className="input" type="number" min="1" placeholder="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

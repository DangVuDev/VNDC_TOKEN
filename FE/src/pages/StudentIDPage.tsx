import { useState, useEffect } from 'react';
import { CreditCard, Plus, Ban, RefreshCw, Shield, Users } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentID } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress } from '@/lib/utils';

export default function StudentIDPage() {
  const { address } = useWeb3();
  const studentId = useStudentID();
  const { isLoading, execute } = useContractAction();

  const [totalIssued, setTotalIssued] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [showIssue, setShowIssue] = useState(false);
  const [showAction, setShowAction] = useState<{ type: string; tokenId: string } | null>(null);
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

  return (
    <div>
      <PageHeader title="Thẻ sinh viên NFT" description="Phát hành và quản lý thẻ sinh viên dạng ERC-721" lucideIcon={CreditCard} badge="Student ID"
        action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Phát hành thẻ</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Đã phát hành" value={totalIssued} icon={<CreditCard className="w-5 h-5" />} color="brand" />
        <StatCard label="Đang hoạt động" value={totalActive} icon={<Shield className="w-5 h-5" />} color="success" />
        <StatCard label="Tạm ngưng" value={totalIssued - totalActive} icon={<Ban className="w-5 h-5" />} color="warning" />
        <StatCard label="Tỷ lệ active" value={totalIssued ? `${Math.round(totalActive / totalIssued * 100)}%` : '0%'} icon={<Users className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'cards', label: 'Thẻ sinh viên', icon: <CreditCard size={14} /> },
        { id: 'manage', label: 'Quản lý', icon: <Shield size={14} /> },
      ]}>
        {(active) => active === 'cards' ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[
                { id: 1, name: 'Nguyễn Văn A', program: 'Khoa học máy tính', status: 'active' },
                { id: 2, name: 'Trần Thị B', program: 'Kỹ thuật phần mềm', status: 'active' },
                { id: 3, name: 'Lê Văn C', program: 'An toàn thông tin', status: 'suspended' },
              ].map(card => (
                <div key={card.id} className="card card-hover relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-16 gradient-brand opacity-20 rounded-t-xl" />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-lg">
                        {card.name.charAt(0)}
                      </div>
                      <span className={card.status === 'active' ? 'badge badge-success' : 'badge badge-warning'}>
                        {card.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white">{card.name}</h3>
                    <p className="text-sm text-surface-400">{card.program}</p>
                    <p className="text-xs text-surface-500 mt-1">Token ID: #{card.id}</p>
                    <div className="flex gap-2 mt-4">
                      {card.status === 'active' ? (
                        <button className="btn-secondary btn-sm" onClick={() => handleAction('suspend', card.id.toString())}><Ban size={12} /> Tạm ngưng</button>
                      ) : (
                        <button className="btn-primary btn-sm" onClick={() => handleAction('reactivate', card.id.toString())}><RefreshCw size={12} /> Kích hoạt</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalIssued === 0 && (
              <EmptyState lucideIcon={CreditCard} title="Chưa có thẻ sinh viên"
                description="Phát hành thẻ sinh viên NFT đầu tiên"
                action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Phát hành</button>} />
            )}
          </div>
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Quản lý trạng thái thẻ</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-surface-800/30">
                <label className="label">Token ID</label>
                <div className="flex gap-2">
                  <input className="input flex-1" type="number" placeholder="Nhập Token ID..." value={showAction?.tokenId || ''} onChange={e => setShowAction({ type: '', tokenId: e.target.value })} />
                  <button className="btn-secondary btn-sm" onClick={() => showAction && handleAction('suspend', showAction.tokenId)}><Ban size={14} /> Tạm ngưng</button>
                  <button className="btn-danger btn-sm" onClick={() => showAction && handleAction('revoke', showAction.tokenId)}>Thu hồi</button>
                  <button className="btn-primary btn-sm" onClick={() => showAction && handleAction('reactivate', showAction.tokenId)}><RefreshCw size={14} /> Kích hoạt</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Tabs>

      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Phát hành thẻ sinh viên" size="lg"
        footer={<button className="btn-primary" onClick={handleIssue} disabled={isLoading}>{isLoading ? 'Đang phát hành...' : 'Phát hành thẻ'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ ví sinh viên</label><input className="input" placeholder="0x..." value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} /></div>
          <div><label className="label">Họ tên</label><input className="input" placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Chương trình đào tạo</label><input className="input" placeholder="Khoa học máy tính" value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} /></div>
          <div><label className="label">Ngày nhập học</label><input className="input" type="date" value={form.enrollmentDate} onChange={e => setForm(f => ({ ...f, enrollmentDate: e.target.value }))} /></div>
          <div><label className="label">Metadata URI (IPFS)</label><input className="input" placeholder="ipfs://..." value={form.metadataURI} onChange={e => setForm(f => ({ ...f, metadataURI: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

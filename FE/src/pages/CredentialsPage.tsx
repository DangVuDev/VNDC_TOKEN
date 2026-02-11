import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Eye, XCircle, CheckCircle, Clock, User, Calendar, Hash } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import DataTable from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useCredentialVerification } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, formatDate } from '@/lib/utils';

interface Credential {
  tokenId: string;
  name: string;
  level: string;
  issuer: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
}

export default function CredentialsPage() {
  const { address, isConnected } = useWeb3();
  const credContract = useCredentialVerification();
  const { isLoading, execute } = useContractAction();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, revoked: 0, expired: 0 });
  const [showIssue, setShowIssue] = useState(false);
  const [showDetail, setShowDetail] = useState<Credential | null>(null);
  const [form, setForm] = useState({ student: '', name: '', level: 'Bachelor', expDays: '365', ipfs: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!credContract || !address) return;
      setLoading(true);
      try {
        const tokenIds = await credContract.getCredentialsByUser(address);
        const creds: Credential[] = [];
        for (const id of tokenIds) {
          const c = await credContract.getCredential(id);
          creds.push({
            tokenId: id.toString(),
            name: c.name, level: c.level,
            issuer: c.issuer, issuedAt: Number(c.issuedAt),
            expiresAt: Number(c.expiresAt), revoked: c.revoked,
          });
        }
        setCredentials(creds);
        const now = Math.floor(Date.now() / 1000);
        setStats({
          total: creds.length,
          active: creds.filter(c => !c.revoked && c.expiresAt > now).length,
          revoked: creds.filter(c => c.revoked).length,
          expired: creds.filter(c => !c.revoked && c.expiresAt <= now).length,
        });
      } catch { /* contracts not deployed */ }
      setLoading(false);
    }
    load();
  }, [credContract, address]);

  const handleIssue = () => execute(
    async () => {
      if (!credContract) throw new Error('Contract not available');
      return credContract.issueCredential(form.student, form.name, form.level, Number(form.expDays), form.ipfs);
    },
    { successMessage: 'Chứng chỉ đã được cấp thành công!', onSuccess: () => setShowIssue(false) }
  );

  const handleRevoke = (tokenId: string) => execute(
    async () => {
      if (!credContract) throw new Error('Contract not available');
      return credContract.revokeCredential(tokenId);
    },
    { successMessage: 'Chứng chỉ đã bị thu hồi' }
  );

  const columns = [
    { key: 'tokenId', header: 'ID', render: (c: Credential) => <span className="font-mono text-xs text-brand-300">#{c.tokenId}</span> },
    { key: 'name', header: 'Tên chứng chỉ', render: (c: Credential) => <span className="font-medium text-white">{c.name}</span> },
    { key: 'level', header: 'Cấp độ', render: (c: Credential) => <span className="badge badge-brand">{c.level}</span> },
    { key: 'issuer', header: 'Người cấp', render: (c: Credential) => <span className="font-mono text-xs">{shortenAddress(c.issuer)}</span> },
    { key: 'issuedAt', header: 'Ngày cấp', render: (c: Credential) => <span className="text-xs">{formatDate(c.issuedAt)}</span> },
    {
      key: 'status', header: 'Trạng thái', render: (c: Credential) => {
        const now = Math.floor(Date.now() / 1000);
        if (c.revoked) return <span className="badge badge-danger"><XCircle size={12} /> Thu hồi</span>;
        if (c.expiresAt <= now) return <span className="badge badge-warning"><Clock size={12} /> Hết hạn</span>;
        return <span className="badge badge-success"><CheckCircle size={12} /> Hợp lệ</span>;
      },
    },
    {
      key: 'actions', header: '', render: (c: Credential) => (
        <div className="flex gap-1">
          <button className="btn-ghost btn-sm btn-icon" onClick={() => setShowDetail(c)}><Eye size={14} /></button>
          {!c.revoked && <button className="btn-ghost btn-sm btn-icon text-red-400" onClick={() => handleRevoke(c.tokenId)}><XCircle size={14} /></button>}
        </div>
      ),
    },
  ];

  const tabs = [
    { id: 'all', label: 'Tất cả', count: stats.total },
    { id: 'active', label: 'Hợp lệ', count: stats.active },
    { id: 'revoked', label: 'Thu hồi', count: stats.revoked },
  ];

  return (
    <div>
      <PageHeader
        title="Bằng cấp & Chứng chỉ"
        description="Quản lý chứng chỉ NFT (ERC-721) — Cấp, xác minh, và thu hồi"
        lucideIcon={ShieldCheck}
        badge="ERC-721"
        action={
          <button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}>
            <Plus size={14} /> Cấp chứng chỉ
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng chứng chỉ" value={stats.total} icon={<ShieldCheck className="w-5 h-5" />} color="brand" />
        <StatCard label="Hợp lệ" value={stats.active} icon={<CheckCircle className="w-5 h-5" />} color="success" />
        <StatCard label="Thu hồi" value={stats.revoked} icon={<XCircle className="w-5 h-5" />} color="danger" />
        <StatCard label="Hết hạn" value={stats.expired} icon={<Clock className="w-5 h-5" />} color="warning" />
      </div>

      <Tabs tabs={tabs}>
        {(active) => {
          const now = Math.floor(Date.now() / 1000);
          let filtered = credentials;
          if (active === 'active') filtered = credentials.filter(c => !c.revoked && c.expiresAt > now);
          if (active === 'revoked') filtered = credentials.filter(c => c.revoked);

          return filtered.length > 0 ? (
            <DataTable columns={columns} data={filtered} loading={loading} />
          ) : (
            <EmptyState
              lucideIcon={ShieldCheck}
              title="Chưa có chứng chỉ"
              description="Kết nối ví và cấp chứng chỉ đầu tiên cho sinh viên"
              action={<button className="btn-primary btn-sm" onClick={() => setShowIssue(true)}><Plus size={14} /> Cấp chứng chỉ</button>}
            />
          );
        }}
      </Tabs>

      {/* Issue Modal */}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Cấp chứng chỉ mới"
        description="Tạo chứng chỉ NFT cho sinh viên"
        footer={<button className="btn-primary" onClick={handleIssue} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Cấp chứng chỉ'}</button>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Địa chỉ sinh viên</label>
            <input className="input" placeholder="0x..." value={form.student} onChange={(e) => setForm(f => ({ ...f, student: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tên chứng chỉ</label>
            <input className="input" placeholder="Chứng chỉ Công nghệ Blockchain" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cấp độ</label>
              <select className="select" value={form.level} onChange={(e) => setForm(f => ({ ...f, level: e.target.value }))}>
                <option>Certificate</option><option>Bachelor</option><option>Master</option><option>PhD</option>
              </select>
            </div>
            <div>
              <label className="label">Hiệu lực (ngày)</label>
              <input className="input" type="number" value={form.expDays} onChange={(e) => setForm(f => ({ ...f, expDays: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">IPFS Metadata URI</label>
            <input className="input" placeholder="ipfs://..." value={form.ipfs} onChange={(e) => setForm(f => ({ ...f, ipfs: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title="Chi tiết chứng chỉ">
        {showDetail && (
          <div className="space-y-3">
            {[
              { label: 'Token ID', value: `#${showDetail.tokenId}`, icon: Hash },
              { label: 'Tên', value: showDetail.name, icon: ShieldCheck },
              { label: 'Cấp độ', value: showDetail.level, icon: Calendar },
              { label: 'Người cấp', value: shortenAddress(showDetail.issuer), icon: User },
              { label: 'Ngày cấp', value: formatDate(showDetail.issuedAt), icon: Calendar },
              { label: 'Hết hạn', value: formatDate(showDetail.expiresAt), icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-surface-800/30">
                <div className="flex items-center gap-2 text-surface-400"><Icon size={14} /> <span className="text-sm">{label}</span></div>
                <span className="text-sm font-medium text-white">{value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Plus, DollarSign, Users, Clock, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useScholarshipManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { parseUnits } from 'ethers';
import { formatVNDC, formatDate } from '@/lib/utils';

interface Scholarship {
  id: number; name: string; description: string; funder: string; totalAmount: bigint;
  distributedAmount: bigint; maxAwards: number; awardsGiven: number; createdAt: number;
  endsAt: number; status: string;
}

export default function ScholarshipPage() {
  const { address } = useWeb3();
  const scholarship = useScholarshipManager();
  const { isLoading, execute } = useContractAction();

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [myScholarships, setMyScholarships] = useState<number[]>([]);
  const [totalFunds, setTotalFunds] = useState('0');
  const [totalDistributed, setTotalDistributed] = useState('0');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showApply, setShowApply] = useState<Scholarship | null>(null);
  const [showDeposit, setShowDeposit] = useState<Scholarship | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [form, setForm] = useState({ name: '', description: '', amount: '', maxAwards: '', duration: '', requirements: '' });

  const loadData = useCallback(async () => {
    if (!scholarship) return;
    setLoading(true);
    try {
      const [total, funds, distributed] = await Promise.all([
        scholarship.getTotalScholarships().catch(() => 0n),
        scholarship.getTotalFundsInScholarships().catch(() => 0n),
        scholarship.getTotalFundsDistributed().catch(() => 0n),
      ]);
      setTotalFunds(formatVNDC(funds));
      setTotalDistributed(formatVNDC(distributed));

      const list: Scholarship[] = [];
      for (let i = 1; i <= Number(total); i++) {
        try {
          const s = await scholarship.getScholarshipInfo(i);
          list.push({ id: i, name: s.name, description: s.description, funder: s.funder, totalAmount: s.totalAmount, distributedAmount: s.distributedAmount, maxAwards: Number(s.maxAwards), awardsGiven: Number(s.awardsGiven), createdAt: Number(s.createdAt), endsAt: Number(s.endsAt), status: s.status });
        } catch {}
      }
      setScholarships(list);

      if (address) {
        const myIds: bigint[] = await scholarship.getStudentScholarships(address).catch(() => []);
        setMyScholarships(myIds.map(Number));
      }
    } catch {}
    setLoading(false);
  }, [scholarship, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => execute(
    async () => {
      if (!scholarship) throw new Error('Contract not available');
      const amount = parseUnits(form.amount, 18);
      const duration = Number(form.duration) * 86400;
      return scholarship.createScholarship(form.name, form.description, amount, Number(form.maxAwards), form.requirements, duration);
    },
    { successMessage: 'Học bổng đã được tạo!', onSuccess: () => { setShowCreate(false); loadData(); } }
  );

  const handleDeposit = () => execute(
    async () => {
      if (!scholarship || !showDeposit) throw new Error('Contract not available');
      return scholarship.depositFunds(showDeposit.id, parseUnits(depositAmount, 18));
    },
    { successMessage: 'Đã nạp quỹ!', onSuccess: () => { setShowDeposit(null); loadData(); } }
  );

  const handleClaim = (id: number) => execute(
    async () => {
      if (!scholarship) throw new Error('Contract not available');
      return scholarship.claimScholarship(id);
    },
    { successMessage: 'Đã nhận học bổng!', onSuccess: loadData }
  );

  const activeScholarships = scholarships.filter(s => s.status !== 'closed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><GraduationCap size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Học bổng</h1>
            <p className="text-sm text-surface-500">{scholarships.length} học bổng · {activeScholarships.length} đang mở</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo học bổng</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng học bổng', value: scholarships.length, cls: 'text-brand-600' },
          { label: 'Đang mở', value: activeScholarships.length, cls: 'text-success-600' },
          { label: 'Tổng quỹ', value: totalFunds + ' VNDC', cls: 'text-info-600' },
          { label: 'Đã phát', value: totalDistributed + ' VNDC', cls: 'text-warning-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : scholarships.length === 0 ? (
        <EmptyState lucideIcon={GraduationCap} title="Chưa có học bổng" description="Tạo học bổng đầu tiên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo học bổng</button>} />
      ) : (
        <div className="space-y-3">
          {scholarships.map(s => (
            <div key={s.id} className="card card-hover">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-surface-800">{s.name}</h3>
                    <span className={s.status === 'open' || s.status === '' ? 'badge badge-success' : s.status === 'funded' ? 'badge badge-brand' : 'badge badge-neutral'}>
                      {s.status || 'Đang mở'}
                    </span>
                  </div>
                  <p className="text-sm text-surface-500">{s.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                    <span><DollarSign size={12} className="inline" /> {formatVNDC(s.totalAmount)} VNDC</span>
                    <span><Users size={12} className="inline" /> {s.awardsGiven}/{s.maxAwards} suất</span>
                    <span><Clock size={12} className="inline" /> Hạn: {s.endsAt ? formatDate(s.endsAt) : 'N/A'}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${s.maxAwards ? (s.awardsGiven / s.maxAwards) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {myScholarships.includes(s.id) ? (
                    <button className="btn-primary btn-sm" onClick={() => handleClaim(s.id)}>Nhận</button>
                  ) : (
                    <button className="btn-primary btn-sm" onClick={() => setShowApply(s)}>Ứng tuyển</button>
                  )}
                  <button className="btn-ghost btn-sm" onClick={() => { setShowDeposit(s); setDepositAmount(''); }}>Nạp quỹ</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo học bổng" size="lg"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên học bổng</label><input className="input" placeholder="Học bổng Xuất sắc" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Giá trị (VNDC)</label><input className="input" type="number" placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="label">Số suất</label><input className="input" type="number" placeholder="10" value={form.maxAwards} onChange={e => setForm(f => ({ ...f, maxAwards: e.target.value }))} /></div>
          </div>
          <div><label className="label">Thời hạn (ngày)</label><input className="input" type="number" placeholder="90" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
          <div><label className="label">Yêu cầu</label><input className="input" placeholder="GPA >= 3.6, ngành CNTT" value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={!!showDeposit} onClose={() => setShowDeposit(null)} title={`Nạp quỹ: ${showDeposit?.name || ''}`}
        footer={<button className="btn-primary" onClick={handleDeposit} disabled={isLoading}>{isLoading ? 'Đang nạp...' : 'Nạp quỹ'}</button>}>
        <div className="space-y-4">
          {showDeposit && <p className="text-sm text-surface-500">Quỹ hiện tại: {formatVNDC(showDeposit.totalAmount)} VNDC</p>}
          <div><label className="label">Số tiền (VNDC)</label><input className="input" type="number" placeholder="1000" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} /></div>
        </div>
      </Modal>

      <Modal open={!!showApply} onClose={() => setShowApply(null)} title={`Ứng tuyển: ${showApply?.name || ''}`}
        footer={<button className="btn-primary" disabled={isLoading}>Gửi đơn</button>}>
        {showApply && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Giá trị</p><p className="text-sm font-semibold text-surface-800">{formatVNDC(showApply.totalAmount)} VNDC</p></div>
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Còn</p><p className="text-sm font-semibold text-surface-800">{showApply.maxAwards - showApply.awardsGiven} suất</p></div>
              <div className="p-3 rounded-xl bg-surface-50 text-center"><p className="text-xs text-surface-500">Hạn</p><p className="text-sm font-semibold text-surface-800">{showApply.endsAt ? formatDate(showApply.endsAt) : 'N/A'}</p></div>
            </div>
            <div><label className="label">Lý do ứng tuyển</label><textarea className="textarea" rows={3} placeholder="Trình bày lý do..." /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Plus, Users2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useExtracurricularReward } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, formatDate } from '@/lib/utils';

interface Activity {
  id: number; name: string; description: string; rewardAmount: bigint;
  badgeTokenId: number; maxClaimsPerStudent: number; active: boolean; createdAt: number;
}
interface ActivityRecord {
  id: number; student: string; activityId: number; timestamp: number; rewarded: boolean; metadata: string;
}

export default function ExtracurricularPage() {
  const { address } = useWeb3();
  const extContract = useExtracurricularReward();
  const { isLoading, execute } = useContractAction();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [myRecords, setMyRecords] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showLog, setShowLog] = useState<Activity | null>(null);
  const [form, setForm] = useState({ name: '', description: '', reward: '', badgeTokenId: '0', maxClaims: '5' });
  const [logForm, setLogForm] = useState({ student: '', metadata: '' });

  const loadData = useCallback(async () => {
    if (!extContract) return;
    setLoading(true);
    try {
      const activityIds: bigint[] = await extContract.getActivities().catch(() => []);
      const acts: Activity[] = [];
      for (const id of activityIds) {
        try {
          const a = await extContract.getActivity(id);
          acts.push({ id: Number(id), name: a.name, description: a.description, rewardAmount: a.rewardAmount, badgeTokenId: Number(a.badgeTokenId), maxClaimsPerStudent: Number(a.maxClaimsPerStudent), active: a.active, createdAt: Number(a.createdAt) });
        } catch {}
      }
      setActivities(acts);
      if (address) {
        const recordIds: bigint[] = await extContract.getStudentActivities(address).catch(() => []);
        const recs: ActivityRecord[] = [];
        for (const rid of recordIds) {
          try {
            const r = await extContract.getActivityRecord(rid);
            recs.push({ id: Number(rid), student: r.student, activityId: Number(r.activityId), timestamp: Number(r.timestamp), rewarded: r.rewarded, metadata: r.metadata });
          } catch {}
        }
        setMyRecords(recs);
      }
    } catch {}
    setLoading(false);
  }, [extContract, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRegister = () => execute(
    async () => {
      if (!extContract) throw new Error('Contract not available');
      return extContract.registerActivity(form.name, form.description, BigInt(Math.round(parseFloat(form.reward) * 1e18)), Number(form.badgeTokenId), Number(form.maxClaims));
    },
    { successMessage: 'Đã tạo hoạt động!', onSuccess: () => { setShowRegister(false); loadData(); } }
  );

  const handleLog = () => execute(
    async () => {
      if (!extContract || !showLog) throw new Error('Contract not available');
      return extContract.logActivity(logForm.student || address, showLog.id, logForm.metadata);
    },
    { successMessage: 'Đã ghi nhận!', onSuccess: () => { setShowLog(null); loadData(); } }
  );

  const handleClaim = (recordId: number) => execute(
    async () => {
      if (!extContract) throw new Error('Contract not available');
      return extContract.claimActivity(recordId);
    },
    { successMessage: 'Đã nhận thưởng!', onSuccess: loadData }
  );

  const handleDeactivate = (activityId: number) => execute(
    async () => {
      if (!extContract) throw new Error('Contract not available');
      return extContract.deactivateActivity(activityId);
    },
    { successMessage: 'Đã vô hiệu hóa!', onSuccess: loadData }
  );

  const activeCount = activities.filter(a => a.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Trophy size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Hoạt động ngoại khóa</h1>
            <p className="text-sm text-surface-500">{activities.length} hoạt động · {activeCount} đang mở</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowRegister(true)}><Plus size={14} /> Tạo hoạt động</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng hoạt động', value: activities.length, cls: 'text-brand-600' },
          { label: 'Đang mở', value: activeCount, cls: 'text-success-600' },
          { label: 'Ghi nhận của bạn', value: myRecords.length, cls: 'text-info-600' },
          { label: 'Đã nhận thưởng', value: myRecords.filter(r => r.rewarded).length, cls: 'text-warning-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : activities.length === 0 ? (
        <EmptyState lucideIcon={Trophy} title="Chưa có hoạt động" description="Tạo hoạt động ngoại khóa đầu tiên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowRegister(true)}><Plus size={14} /> Tạo hoạt động</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activities.map(a => (
            <div key={a.id} className="card card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-surface-800 truncate">{a.name}</h3>
                    <span className={a.active ? 'badge badge-success' : 'badge badge-neutral'}>{a.active ? 'Mở' : 'Tắt'}</span>
                  </div>
                  <p className="text-xs text-surface-500 line-clamp-2">{a.description || 'Không có mô tả'}</p>
                </div>
                <span className="badge badge-brand shrink-0 ml-2">{formatVNDC(a.rewardAmount)} VNDC</span>
              </div>
              <div className="flex items-center justify-between text-xs text-surface-500">
                <span><Users2 size={12} className="inline mr-1" />Max {a.maxClaimsPerStudent} lần/SV</span>
                <span>{formatDate(a.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {a.active && <button className="btn-primary btn-sm flex-1" onClick={() => { setShowLog(a); setLogForm({ student: '', metadata: '' }); }}>Ghi nhận</button>}
                {a.active && <button className="btn-ghost btn-sm text-danger-600" onClick={() => handleDeactivate(a.id)}><XCircle size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {myRecords.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-surface-800 mb-3">Hoạt động của bạn</h2>
          <div className="space-y-2">
            {myRecords.map(r => {
              const act = activities.find(a => a.id === r.activityId);
              return (
                <div key={r.id} className="card flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-surface-800">{act?.name || `Activity #${r.activityId}`}</h4>
                    <p className="text-xs text-surface-500">{formatDate(r.timestamp)} · {r.metadata || 'Không có ghi chú'}</p>
                  </div>
                  {r.rewarded ? (
                    <span className="badge badge-success"><CheckCircle size={12} /> Đã nhận</span>
                  ) : (
                    <button className="btn-primary btn-sm" onClick={() => handleClaim(r.id)} disabled={isLoading}>Nhận thưởng</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Tạo hoạt động ngoại khóa" size="lg"
        footer={<button className="btn-primary" onClick={handleRegister} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên hoạt động</label><input className="input" placeholder="CLB AI & ML" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Mô tả chi tiết..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Thưởng (VNDC)</label><input className="input" type="number" placeholder="50" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} /></div>
            <div><label className="label">Badge Token ID</label><input className="input" type="number" placeholder="0" value={form.badgeTokenId} onChange={e => setForm(f => ({ ...f, badgeTokenId: e.target.value }))} /></div>
            <div><label className="label">Max lần/SV</label><input className="input" type="number" placeholder="5" value={form.maxClaims} onChange={e => setForm(f => ({ ...f, maxClaims: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>

      <Modal open={!!showLog} onClose={() => setShowLog(null)} title={`Ghi nhận: ${showLog?.name || ''}`}
        footer={<button className="btn-primary" onClick={handleLog} disabled={isLoading}>{isLoading ? 'Đang ghi...' : 'Ghi nhận'}</button>}>
        <div className="space-y-4">
          {showLog && (
            <div className="p-3 rounded-xl bg-surface-50">
              <p className="text-sm text-surface-800 font-medium">{showLog.name}</p>
              <p className="text-xs text-surface-500">Thưởng: {formatVNDC(showLog.rewardAmount)} VNDC · Max {showLog.maxClaimsPerStudent} lần/SV</p>
            </div>
          )}
          <div><label className="label">Địa chỉ sinh viên (trống = bạn)</label><input className="input" placeholder="0x..." value={logForm.student} onChange={e => setLogForm(f => ({ ...f, student: e.target.value }))} /></div>
          <div><label className="label">Ghi chú</label><input className="input" placeholder="Ghi chú..." value={logForm.metadata} onChange={e => setLogForm(f => ({ ...f, metadata: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Plus, FileText, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useAnalyticsDashboard } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatDate, formatNumber, shortenAddress } from '@/lib/utils';

interface Metrics { totalUsers: number; totalTransactions: number; totalVolume: number; metricTimestamp: number; }
interface UserAnalytics { activityScore: number; engagementLevel: number; lastActivityTime: number; }
interface Report { id: number; reportType: string; dataHash: string; generatedAt: number; }

export default function AnalyticsPage() {
  const { address } = useWeb3();
  const analytics = useAnalyticsDashboard();
  const { isLoading, execute } = useContractAction();

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showTrack, setShowTrack] = useState(false);
  const [genForm, setGenForm] = useState({ reportType: '', dataHash: '' });
  const [updateForm, setUpdateForm] = useState({ totalUsers: '', totalTransactions: '', totalVolume: '' });
  const [trackForm, setTrackForm] = useState({ user: '', activityScore: '', engagementLevel: '' });

  const loadData = useCallback(async () => {
    if (!analytics) return;
    setLoading(true);
    try {
      try {
        const m = await analytics.getLatestMetrics();
        setMetrics({ totalUsers: Number(m.totalUsers), totalTransactions: Number(m.totalTransactions), totalVolume: Number(m.totalVolume), metricTimestamp: Number(m.metricTimestamp) });
      } catch {}

      if (address) {
        try {
          const ua = await analytics.getUserAnalytics(address);
          setUserAnalytics({ activityScore: Number(ua.activityScore), engagementLevel: Number(ua.engagementLevel), lastActivityTime: Number(ua.lastActivityTime) });
        } catch {}
      }

      const totalReports = await analytics.getTotalReports().catch(() => 0n);
      const rList: Report[] = [];
      for (let i = 1; i <= Number(totalReports); i++) {
        try {
          const r = await analytics.getReportDetails(i);
          rList.push({ id: i, reportType: r.reportType, dataHash: r.dataHash, generatedAt: Number(r.generatedAt) });
        } catch {}
      }
      setReports(rList);
    } catch {}
    setLoading(false);
  }, [analytics, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = () => execute(
    async () => {
      if (!analytics) throw new Error('Contract not available');
      return analytics.generateReport(genForm.reportType, genForm.dataHash);
    },
    { successMessage: 'Báo cáo đã được tạo!', onSuccess: () => { setShowGenerate(false); loadData(); } }
  );

  const handleUpdate = () => execute(
    async () => {
      if (!analytics) throw new Error('Contract not available');
      return analytics.updateMetrics(Number(updateForm.totalUsers), Number(updateForm.totalTransactions), Number(updateForm.totalVolume));
    },
    { successMessage: 'Metrics đã cập nhật!', onSuccess: () => { setShowUpdate(false); loadData(); } }
  );

  const handleTrack = () => execute(
    async () => {
      if (!analytics) throw new Error('Contract not available');
      return analytics.trackUserActivity(trackForm.user, Number(trackForm.activityScore), Number(trackForm.engagementLevel));
    },
    { successMessage: 'Activity đã ghi nhận!', onSuccess: () => { setShowTrack(false); loadData(); } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><BarChart3 size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Phân tích</h1>
            <p className="text-sm text-surface-500">Thống kê hệ thống & báo cáo on-chain</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowUpdate(true)}>Cập nhật</button>
          <button className="btn-ghost btn-sm" onClick={() => setShowTrack(true)}>Track</button>
          <button className="btn-primary btn-sm" onClick={() => setShowGenerate(true)}><Plus size={14} /> Tạo báo cáo</button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : (
        <>
          {/* System Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Người dùng', value: metrics ? formatNumber(metrics.totalUsers) : '0', cls: 'text-brand-600' },
              { label: 'Giao dịch', value: metrics ? formatNumber(metrics.totalTransactions) : '0', cls: 'text-info-600' },
              { label: 'Volume', value: metrics ? formatNumber(metrics.totalVolume) : '0', cls: 'text-success-600' },
              { label: 'Cập nhật lần cuối', value: metrics && metrics.metricTimestamp ? formatDate(metrics.metricTimestamp) : '-', cls: 'text-warning-600' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-surface-500">{s.label}</p>
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* User Analytics */}
          {userAnalytics && (
            <div>
              <h2 className="text-base font-semibold text-surface-800 mb-3">Phân tích người dùng</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center py-4">
                  <p className="text-2xl font-bold text-brand-600">{userAnalytics.activityScore}</p>
                  <p className="text-xs text-surface-500">Activity Score</p>
                </div>
                <div className="card text-center py-4">
                  <p className="text-2xl font-bold text-info-600">{userAnalytics.engagementLevel}</p>
                  <p className="text-xs text-surface-500">Engagement Level</p>
                </div>
                <div className="card text-center py-4">
                  <p className="text-lg font-bold text-success-600">{userAnalytics.lastActivityTime ? formatDate(userAnalytics.lastActivityTime) : '-'}</p>
                  <p className="text-xs text-surface-500">Last Activity</p>
                </div>
              </div>
            </div>
          )}

          {/* Reports */}
          <div>
            <h2 className="text-base font-semibold text-surface-800 mb-3">Báo cáo ({reports.length})</h2>
            {reports.length === 0 ? (
              <EmptyState lucideIcon={FileText} title="Chưa có báo cáo" description="Tạo báo cáo phân tích đầu tiên" />
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="card card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-surface-800">#{r.id} — {r.reportType}</h3>
                        <p className="text-xs text-surface-500">{r.generatedAt ? formatDate(r.generatedAt) : ''}</p>
                      </div>
                      <p className="text-[10px] text-surface-400 break-all max-w-[200px]">{r.dataHash}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Generate Report Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Tạo báo cáo"
        footer={<button className="btn-primary" onClick={handleGenerate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo báo cáo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Loại báo cáo</label><input className="input" placeholder="monthly, quarterly..." value={genForm.reportType} onChange={e => setGenForm(f => ({ ...f, reportType: e.target.value }))} /></div>
          <div><label className="label">Data Hash (IPFS)</label><input className="input" placeholder="QmXyz..." value={genForm.dataHash} onChange={e => setGenForm(f => ({ ...f, dataHash: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Update Metrics Modal */}
      <Modal open={showUpdate} onClose={() => setShowUpdate(false)} title="Cập nhật Metrics"
        footer={<button className="btn-primary" onClick={handleUpdate} disabled={isLoading}>{isLoading ? 'Đang cập nhật...' : 'Cập nhật'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Total Users</label><input className="input" type="number" placeholder="200" value={updateForm.totalUsers} onChange={e => setUpdateForm(f => ({ ...f, totalUsers: e.target.value }))} /></div>
          <div><label className="label">Total Transactions</label><input className="input" type="number" placeholder="8000" value={updateForm.totalTransactions} onChange={e => setUpdateForm(f => ({ ...f, totalTransactions: e.target.value }))} /></div>
          <div><label className="label">Total Volume</label><input className="input" type="number" placeholder="1200000" value={updateForm.totalVolume} onChange={e => setUpdateForm(f => ({ ...f, totalVolume: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Track User Activity Modal */}
      <Modal open={showTrack} onClose={() => setShowTrack(false)} title="Ghi nhận hoạt động"
        footer={<button className="btn-primary" onClick={handleTrack} disabled={isLoading}>{isLoading ? 'Đang ghi...' : 'Ghi nhận'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ người dùng</label><input className="input" placeholder="0x..." value={trackForm.user} onChange={e => setTrackForm(f => ({ ...f, user: e.target.value }))} /></div>
          <div><label className="label">Activity Score</label><input className="input" type="number" placeholder="100" value={trackForm.activityScore} onChange={e => setTrackForm(f => ({ ...f, activityScore: e.target.value }))} /></div>
          <div><label className="label">Engagement Level</label><input className="input" type="number" placeholder="5" value={trackForm.engagementLevel} onChange={e => setTrackForm(f => ({ ...f, engagementLevel: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

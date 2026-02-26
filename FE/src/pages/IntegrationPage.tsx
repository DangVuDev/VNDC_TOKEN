import { useState, useEffect, useCallback } from 'react';
import { Plug, ArrowRightLeft, Plus, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useDataMigration } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress } from '@/lib/utils';

interface MigrationTask { id: number; status: string; progress: number; }

export default function IntegrationPage() {
  const { address } = useWeb3();
  const migration = useDataMigration();
  const { isLoading, execute } = useContractAction();

  const [tasks, setTasks] = useState<MigrationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [showAuthorize, setShowAuthorize] = useState(false);
  const [taskForm, setTaskForm] = useState({ dataType: '', destinationSystem: '', recordCount: '' });
  const [mapForm, setMapForm] = useState({ sourceField: '', destinationField: '', transformationRules: '' });
  const [authAddr, setAuthAddr] = useState('');

  const loadData = useCallback(async () => {
    if (!migration) return;
    setLoading(true);
    try {
      const total = await migration.getTotalTasks().catch(() => 0n);
      const list: MigrationTask[] = [];
      for (let i = 1; i <= Number(total); i++) {
        try {
          const ms = await migration.getMigrationStatus(i);
          list.push({ id: i, status: ms.status, progress: Number(ms.progress) });
        } catch {}
      }
      setTasks(list);
    } catch {}
    setLoading(false);
  }, [migration]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateTask = () => execute(
    async () => {
      if (!migration) throw new Error('Contract not available');
      return migration.createMigrationTask(taskForm.dataType, taskForm.destinationSystem, Number(taskForm.recordCount));
    },
    { successMessage: 'Migration task đã tạo!', onSuccess: () => { setShowCreate(false); loadData(); } }
  );

  const handleComplete = (taskId: number) => execute(
    async () => { if (!migration) throw new Error('Contract not available'); return migration.completeMigration(taskId); },
    { successMessage: 'Migration hoàn thành!', onSuccess: loadData }
  );

  const handleVerify = (taskId: number) => execute(
    async () => { if (!migration) throw new Error('Contract not available'); return migration.verifyIntegration(taskId); },
    { successMessage: 'Integration verified!', onSuccess: loadData }
  );

  const handleCreateMapping = () => execute(
    async () => {
      if (!migration) throw new Error('Contract not available');
      return migration.createMapping(mapForm.sourceField, mapForm.destinationField, mapForm.transformationRules);
    },
    { successMessage: 'Mapping đã tạo!', onSuccess: () => setShowMapping(false) }
  );

  const handleAuthorize = () => execute(
    async () => { if (!migration) throw new Error('Contract not available'); return migration.authorizeSystem(authAddr); },
    { successMessage: 'System đã được ủy quyền!', onSuccess: () => { setShowAuthorize(false); setAuthAddr(''); } }
  );

  const statusBadge = (s: string) => s === 'completed' ? <span className="badge badge-success">Hoàn thành</span> : s === 'pending' ? <span className="badge badge-neutral">Chờ</span> : <span className="badge badge-brand">{s}</span>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Plug size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Tích hợp & Migration</h1>
            <p className="text-sm text-surface-500">{tasks.length} tasks · {tasks.filter(t => t.status === 'completed').length} hoàn thành</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowAuthorize(true)}>Authorize</button>
          <button className="btn-ghost btn-sm" onClick={() => setShowMapping(true)}>Mapping</button>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo task</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tổng tasks', value: tasks.length, cls: 'text-brand-600' },
          { label: 'Hoàn thành', value: tasks.filter(t => t.status === 'completed').length, cls: 'text-success-600' },
          { label: 'Đang chờ', value: tasks.filter(t => t.status === 'pending').length, cls: 'text-warning-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : tasks.length === 0 ? (
        <EmptyState lucideIcon={ArrowRightLeft} title="Chưa có migration task" description="Tạo task đầu tiên để bắt đầu" />
      ) : (
        <div className="space-y-3">
          {tasks.map(t => (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-surface-800">Task #{t.id}</h3>
                  <p className="text-xs text-surface-500">{t.progress} records</p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(t.status)}
                  {t.status === 'pending' && (
                    <button className="btn-primary btn-sm" onClick={() => handleComplete(t.id)} disabled={isLoading}>Complete</button>
                  )}
                  {t.status === 'completed' && (
                    <button className="btn-ghost btn-sm" onClick={() => handleVerify(t.id)} disabled={isLoading}>Verify</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo Migration Task"
        footer={<button className="btn-primary" onClick={handleCreateTask} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo task'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Loại dữ liệu</label><input className="input" placeholder="student_records, credentials..." value={taskForm.dataType} onChange={e => setTaskForm(f => ({ ...f, dataType: e.target.value }))} /></div>
          <div><label className="label">Destination System (address)</label><input className="input" placeholder="0x..." value={taskForm.destinationSystem} onChange={e => setTaskForm(f => ({ ...f, destinationSystem: e.target.value }))} /></div>
          <div><label className="label">Số lượng records</label><input className="input" type="number" placeholder="1000" value={taskForm.recordCount} onChange={e => setTaskForm(f => ({ ...f, recordCount: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Create Mapping Modal */}
      <Modal open={showMapping} onClose={() => setShowMapping(false)} title="Tạo Integration Mapping"
        footer={<button className="btn-primary" onClick={handleCreateMapping} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo mapping'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Source Field</label><input className="input" placeholder="legacy_student_id" value={mapForm.sourceField} onChange={e => setMapForm(f => ({ ...f, sourceField: e.target.value }))} /></div>
          <div><label className="label">Destination Field</label><input className="input" placeholder="blockchain_address" value={mapForm.destinationField} onChange={e => setMapForm(f => ({ ...f, destinationField: e.target.value }))} /></div>
          <div><label className="label">Transformation Rules</label><textarea className="textarea" rows={3} placeholder="JSON transform rules..." value={mapForm.transformationRules} onChange={e => setMapForm(f => ({ ...f, transformationRules: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Authorize System Modal */}
      <Modal open={showAuthorize} onClose={() => setShowAuthorize(false)} title="Ủy quyền System"
        footer={<button className="btn-primary" onClick={handleAuthorize} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Ủy quyền'}</button>}>
        <div><label className="label">Địa chỉ System</label><input className="input" placeholder="0x..." value={authAddr} onChange={e => setAuthAddr(e.target.value)} /></div>
      </Modal>
    </div>
  );
}

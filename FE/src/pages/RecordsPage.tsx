import { useState, useEffect } from 'react';
import { FileText, Calculator, Plus, Upload } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentRecordManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

export default function RecordsPage() {
  const { address } = useWeb3();
  const records = useStudentRecordManager();
  const { isLoading, execute } = useContractAction();

  const [totalRecords, setTotalRecords] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', studentId: '', transcript: '' });
  const [gradeForm, setGradeForm] = useState({ recordId: '', subject: '', grade: '', credits: '' });

  useEffect(() => {
    async function load() {
      if (!records) return;
      try { setTotalRecords(Number(await records.getTotalRecords())); } catch {}
    }
    load();
  }, [records]);

  const handleCreate = () => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.createRecord(createForm.name, createForm.studentId, createForm.transcript);
    },
    { successMessage: 'Hồ sơ đã được tạo!', onSuccess: () => setShowCreate(false) }
  );

  const handleAddGrade = () => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.addGrade(gradeForm.recordId, gradeForm.subject, Number(gradeForm.grade), Number(gradeForm.credits));
    },
    { successMessage: 'Đã thêm điểm!', onSuccess: () => setShowGrade(false) }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <FileText size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Hồ sơ học tập</h1>
            <p className="text-sm text-surface-500">{totalRecords} hồ sơ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setShowGrade(true)}><Calculator size={14} /> Thêm điểm</button>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo hồ sơ</button>
        </div>
      </div>

      {/* Grades preview */}
      <div className="card">
        <h2 className="text-base font-semibold text-surface-800 mb-3">Bảng điểm</h2>
        <div className="space-y-2">
          {['Toán cao cấp', 'Lập trình C++', 'Cấu trúc dữ liệu', 'Blockchain Fundamentals'].map((subject, i) => (
            <div key={subject} className="flex items-center justify-between py-2 border-b border-surface-200 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <span className="text-sm text-surface-800">{subject}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-400">3 TC</span>
                <span className="badge badge-success">A</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-surface-200 flex justify-between items-center">
          <span className="text-sm text-surface-500">GPA tạm tính</span>
          <span className="text-lg font-bold text-brand-600">3.75</span>
        </div>
      </div>

      {/* Records */}
      {totalRecords === 0 && (
        <EmptyState lucideIcon={FileText} title="Chưa có hồ sơ" description="Tạo hồ sơ học tập đầu tiên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo hồ sơ</button>} />
      )}

      {/* Upload IPFS */}
      <div className="card text-center py-8">
        <Upload size={28} className="text-surface-400 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-surface-800">Cấp bảng điểm IPFS</h3>
        <p className="text-xs text-surface-500 mt-1 mb-3">Lưu trữ vĩnh viễn trên IPFS</p>
        <button className="btn-secondary btn-sm"><Upload size={14} /> Upload</button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo hồ sơ"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Họ tên</label><input className="input" placeholder="Nguyễn Văn A" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mã SV</label><input className="input" placeholder="SV2024001" value={createForm.studentId} onChange={e => setCreateForm(f => ({ ...f, studentId: e.target.value }))} /></div>
          <div><label className="label">Ghi chú</label><textarea className="textarea" value={createForm.transcript} onChange={e => setCreateForm(f => ({ ...f, transcript: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={showGrade} onClose={() => setShowGrade(false)} title="Thêm điểm"
        footer={<button className="btn-primary" onClick={handleAddGrade} disabled={isLoading}>{isLoading ? 'Đang thêm...' : 'Thêm'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Record ID</label><input className="input" type="number" placeholder="1" value={gradeForm.recordId} onChange={e => setGradeForm(f => ({ ...f, recordId: e.target.value }))} /></div>
          <div><label className="label">Môn học</label><input className="input" placeholder="Toán cao cấp" value={gradeForm.subject} onChange={e => setGradeForm(f => ({ ...f, subject: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Điểm (0-100)</label><input className="input" type="number" value={gradeForm.grade} onChange={e => setGradeForm(f => ({ ...f, grade: e.target.value }))} /></div>
            <div><label className="label">Tín chỉ</label><input className="input" type="number" value={gradeForm.credits} onChange={e => setGradeForm(f => ({ ...f, credits: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

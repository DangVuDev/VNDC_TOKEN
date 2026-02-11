import { useState, useEffect } from 'react';
import { FileText, BookOpen, Calculator, Plus, CheckCircle, Clock, Upload } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentRecordManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatGPA } from '@/lib/utils';

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
      try {
        const total = await records.getTotalRecords();
        setTotalRecords(Number(total));
      } catch {}
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
    <div>
      <PageHeader title="Hồ sơ học tập" description="Quản lý bảng điểm, tính GPA, cấp bảng điểm IPFS" lucideIcon={FileText} badge="Records"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setShowGrade(true)}><Calculator size={14} /> Thêm điểm</button>
            <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo hồ sơ</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng hồ sơ" value={totalRecords} icon={<FileText className="w-5 h-5" />} color="brand" />
        <StatCard label="Đã xác minh" value="0" icon={<CheckCircle className="w-5 h-5" />} color="success" />
        <StatCard label="GPA trung bình" value="0.00" icon={<Calculator className="w-5 h-5" />} color="warning" />
        <StatCard label="Bảng điểm IPFS" value="0" icon={<Upload className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'records', label: 'Hồ sơ', icon: <FileText size={14} /> },
        { id: 'grades', label: 'Bảng điểm', icon: <BookOpen size={14} /> },
        { id: 'transcript', label: 'Transcript', icon: <Upload size={14} /> },
      ]}>
        {(active) => active === 'records' ? (
          <EmptyState lucideIcon={FileText} title="Chưa có hồ sơ"
            description="Tạo hồ sơ học tập đầu tiên cho sinh viên"
            action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo hồ sơ</button>} />
        ) : active === 'grades' ? (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Cấu trúc bảng điểm</h3>
            <div className="space-y-3">
              {['Toán cao cấp', 'Lập trình C++', 'Cấu trúc dữ liệu', 'Blockchain Fundamentals'].map((subject, i) => (
                <div key={subject} className="flex items-center justify-between p-3 rounded-xl bg-surface-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    <span className="text-sm text-white">{subject}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-surface-400">3 tín chỉ</span>
                    <span className="badge badge-success">A</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-brand-300">GPA tạm tính</span>
                <span className="text-lg font-bold gradient-brand-text">3.75 / 4.00</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card text-center py-12">
            <Upload size={32} className="text-surface-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">Cấp bảng điểm IPFS</h3>
            <p className="text-sm text-surface-400 mb-4">Upload bảng điểm lên IPFS để lưu trữ vĩnh viễn</p>
            <button className="btn-primary btn-sm"><Upload size={14} /> Upload Transcript</button>
          </div>
        )}
      </Tabs>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo hồ sơ học tập"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo hồ sơ'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Họ tên sinh viên</label><input className="input" placeholder="Nguyễn Văn A" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mã sinh viên</label><input className="input" placeholder="SV2024001" value={createForm.studentId} onChange={e => setCreateForm(f => ({ ...f, studentId: e.target.value }))} /></div>
          <div><label className="label">Ghi chú</label><textarea className="textarea" placeholder="Ghi chú..." value={createForm.transcript} onChange={e => setCreateForm(f => ({ ...f, transcript: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={showGrade} onClose={() => setShowGrade(false)} title="Thêm điểm môn học"
        footer={<button className="btn-primary" onClick={handleAddGrade} disabled={isLoading}>{isLoading ? 'Đang thêm...' : 'Thêm điểm'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Record ID</label><input className="input" type="number" placeholder="1" value={gradeForm.recordId} onChange={e => setGradeForm(f => ({ ...f, recordId: e.target.value }))} /></div>
          <div><label className="label">Tên môn học</label><input className="input" placeholder="Toán cao cấp" value={gradeForm.subject} onChange={e => setGradeForm(f => ({ ...f, subject: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Điểm (0-100)</label><input className="input" type="number" min="0" max="100" placeholder="85" value={gradeForm.grade} onChange={e => setGradeForm(f => ({ ...f, grade: e.target.value }))} /></div>
            <div><label className="label">Số tín chỉ</label><input className="input" type="number" min="1" max="10" placeholder="3" value={gradeForm.credits} onChange={e => setGradeForm(f => ({ ...f, credits: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { FileText, Calculator, Plus, Upload, CheckCircle, Eye, Shield, Edit, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStudentRecordManager } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, formatDate, formatGPA } from '@/lib/utils';

interface Grade {
  subject: string;
  grade: number;
  credits: number;
  timestamp: number;
}

interface Semester {
  semesterIndex: number;
  grades: Grade[];
  gpa: number;
  totalCredits: number;
  timestamp: number;
  isCompleted: boolean;
}

interface StudentRecord {
  recordId: number;
  student: string;
  name: string;
  studentId: string;
  enrollmentDate: number;
  totalCredits: number;
  cumulativeGpa: number;
  semesters: Semester[];
  isVerified: boolean;
  verifier: string;
  verificationDate: number;
  transcriptIPFS: string;
}

export default function RecordsPage() {
  const { address } = useWeb3();
  const records = useStudentRecordManager();
  const { isLoading, execute } = useContractAction();

  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [allRecords, setAllRecords] = useState<StudentRecord[]>([]);
  const [myRecordIds, setMyRecordIds] = useState<number[]>([]);
  const [isVerifier, setIsVerifier] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const [showDetail, setShowDetail] = useState<StudentRecord | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptForm, setTranscriptForm] = useState({ recordId: '', ipfsHash: '' });
  const [showVerifier, setShowVerifier] = useState(false);
  const [verifierAddr, setVerifierAddr] = useState('');
  const [showUpdate, setShowUpdate] = useState<StudentRecord | null>(null);
  const [updateForm, setUpdateForm] = useState({ name: '', transcript: '' });

  const [createForm, setCreateForm] = useState({ name: '', studentId: '', transcript: '' });
  const [gradeForm, setGradeForm] = useState({ recordId: '', subject: '', grade: '', credits: '' });

  const parseSemesters = (rawSemesters: any[]): Semester[] => {
    if (!rawSemesters || !Array.isArray(rawSemesters)) return [];
    return rawSemesters.map((s: any) => ({
      semesterIndex: Number(s.semesterIndex || s[0] || 0),
      grades: (s.grades || s[1] || []).map((g: any) => ({
        subject: g.subject || g[0] || '',
        grade: Number(g.grade || g[1] || 0),
        credits: Number(g.credits || g[2] || 0),
        timestamp: Number(g.timestamp || g[3] || 0),
      })),
      gpa: Number(s.gpa || s[2] || 0),
      totalCredits: Number(s.totalCredits || s[3] || 0),
      timestamp: Number(s.timestamp || s[4] || 0),
      isCompleted: s.isCompleted ?? s[5] ?? false,
    }));
  };

  const parseRecord = (r: any): StudentRecord => ({
    recordId: Number(r.recordId || r[0] || 0),
    student: r.student || r[1] || '',
    name: r.name || r[2] || '',
    studentId: r.studentId || r[3] || '',
    enrollmentDate: Number(r.enrollmentDate || r[4] || 0),
    totalCredits: Number(r.totalCredits || r[5] || 0),
    cumulativeGpa: Number(r.cumulativeGpa || r[6] || 0),
    semesters: parseSemesters(r.semesters || r[7] || []),
    isVerified: r.isVerified ?? r[8] ?? false,
    verifier: r.verifier || r[9] || '',
    verificationDate: Number(r.verificationDate || r[10] || 0),
    transcriptIPFS: r.transcriptIPFS || r[11] || '',
  });

  const loadData = useCallback(async () => {
    if (!records) return;
    setLoading(true);
    try {
      const total = await records.getTotalRecords().catch(() => 0n);
      setTotalRecords(Number(total));

      const list: StudentRecord[] = [];
      for (let i = 1; i <= Number(total); i++) {
        try {
          const r = await records.getRecord(i);
          list.push(parseRecord(r));
        } catch {}
      }
      setAllRecords(list);

      if (address) {
        try {
          const ids = await records.getStudentRecords(address);
          setMyRecordIds(ids.map((id: bigint) => Number(id)));
        } catch { setMyRecordIds([]); }
        try {
          const v = await records.isAuthorizedVerifier(address);
          setIsVerifier(v);
        } catch { setIsVerifier(false); }
      }
    } catch {}
    setLoading(false);
  }, [records, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.createRecord(createForm.name, createForm.studentId, createForm.transcript);
    },
    { successMessage: 'Hồ sơ đã được tạo!', onSuccess: () => { setShowCreate(false); loadData(); } }
  );

  const handleAddGrade = () => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.addGrade(gradeForm.recordId, gradeForm.subject, Number(gradeForm.grade), Number(gradeForm.credits));
    },
    { successMessage: 'Đã thêm điểm!', onSuccess: () => { setShowGrade(false); loadData(); } }
  );

  const handleCompleteSemester = (recordId: number, semesterIndex: number) => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.completeSemester(recordId, semesterIndex);
    },
    { successMessage: 'Đã hoàn thành học kỳ!', onSuccess: loadData }
  );

  const handleVerify = (recordId: number) => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.verifyRecord(recordId);
    },
    { successMessage: 'Đã xác minh hồ sơ!', onSuccess: loadData }
  );

  const handleIssueTranscript = () => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.issueTranscript(transcriptForm.recordId, transcriptForm.ipfsHash);
    },
    { successMessage: 'Đã cấp bảng điểm IPFS!', onSuccess: () => { setShowTranscript(false); loadData(); } }
  );

  const handleUpdateRecord = (recordId: number) => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.updateRecord(recordId, updateForm.name, updateForm.transcript);
    },
    { successMessage: 'Đã cập nhật hồ sơ!', onSuccess: () => { setShowUpdate(null); loadData(); } }
  );

  const handleAuthorizeVerifier = () => execute(
    async () => {
      if (!records) throw new Error('Contract not available');
      return records.authorizeVerifier(verifierAddr);
    },
    { successMessage: 'Đã ủy quyền verifier!', onSuccess: () => { setShowVerifier(false); setVerifierAddr(''); } }
  );

  const gradeToLetter = (g: number) => g >= 90 ? 'A+' : g >= 85 ? 'A' : g >= 80 ? 'B+' : g >= 70 ? 'B' : g >= 60 ? 'C' : g >= 50 ? 'D' : 'F';
  const gradeColor = (g: number) => g >= 80 ? 'badge-success' : g >= 60 ? 'badge-warning' : 'badge-danger';

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;

  const myRecords = allRecords.filter(r => myRecordIds.includes(r.recordId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <FileText size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Hồ sơ học tập</h1>
            <p className="text-sm text-surface-500">{totalRecords} hồ sơ · {allRecords.filter(r => r.isVerified).length} đã xác minh</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowVerifier(true)}><Shield size={14} /></button>
          <button className="btn-secondary btn-sm" onClick={() => setShowGrade(true)}><Calculator size={14} /> Thêm điểm</button>
          <button className="btn-secondary btn-sm" onClick={() => setShowTranscript(true)}><Upload size={14} /> Cấp IPFS</button>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo hồ sơ</button>
        </div>
      </div>

      {/* My Records Quick Access */}
      {address && myRecords.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-700 mb-2">Hồ sơ của tôi</h3>
          <div className="space-y-2">
            {myRecords.map(r => (
              <div key={r.recordId} className="flex items-center justify-between p-2 rounded-lg bg-surface-50 cursor-pointer hover:bg-surface-100" onClick={() => setShowDetail(r)}>
                <div>
                  <p className="text-sm font-medium text-surface-800">{r.name} ({r.studentId})</p>
                  <p className="text-xs text-surface-500">{r.totalCredits} TC · GPA: {formatGPA(r.cumulativeGpa)} · {r.semesters.length} HK</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.isVerified && <CheckCircle size={14} className="text-success-600" />}
                  <span className="badge badge-brand">#{r.recordId}</span>
                </div>
              </div>
            ))}
          </div>
          {isVerifier && <p className="text-xs text-success-600 mt-2"><Shield size={12} className="inline mr-1" />Bạn là Authorized Verifier</p>}
        </div>
      )}

      {/* All Records List */}
      {allRecords.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-surface-800">Tất cả hồ sơ</h2>
          {allRecords.map(rec => (
            <div key={rec.recordId} className="card card-hover cursor-pointer" onClick={() => setShowDetail(rec)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-sm">
                    #{rec.recordId}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-800">{rec.name}</h3>
                    <p className="text-xs text-surface-500">MSV: {rec.studentId} · {shortenAddress(rec.student)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-brand-600">{formatGPA(rec.cumulativeGpa)}</p>
                    <p className="text-xs text-surface-400">{rec.totalCredits} TC · {rec.semesters.length} HK</p>
                  </div>
                  {rec.isVerified ? (
                    <span className="badge badge-success"><CheckCircle size={10} /> Xác minh</span>
                  ) : (
                    <span className="badge badge-warning">Chờ xác minh</span>
                  )}
                </div>
              </div>
              {/* Latest semester grades preview */}
              {rec.semesters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-200">
                  <p className="text-xs text-surface-400 mb-2">HK {rec.semesters[rec.semesters.length - 1].semesterIndex + 1} · {rec.semesters[rec.semesters.length - 1].grades.length} môn</p>
                  <div className="flex flex-wrap gap-1">
                    {rec.semesters[rec.semesters.length - 1].grades.slice(0, 5).map((g, i) => (
                      <span key={i} className={`badge ${gradeColor(g.grade)}`}>{g.subject}: {gradeToLetter(g.grade)}</span>
                    ))}
                    {rec.semesters[rec.semesters.length - 1].grades.length > 5 && (
                      <span className="badge badge-brand">+{rec.semesters[rec.semesters.length - 1].grades.length - 5}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                {!rec.isVerified && (
                  <button className="btn-secondary btn-sm" onClick={e => { e.stopPropagation(); handleVerify(rec.recordId); }}><CheckCircle size={12} /> Xác minh</button>
                )}
                <button className="btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setShowUpdate(rec); setUpdateForm({ name: rec.name, transcript: rec.transcriptIPFS }); }}><Edit size={12} /> Sửa</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState lucideIcon={FileText} title="Chưa có hồ sơ" description="Tạo hồ sơ học tập đầu tiên"
          action={<button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Tạo hồ sơ</button>} />
      )}

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Hồ sơ #${showDetail?.recordId} - ${showDetail?.name}`}>
        {showDetail && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-surface-500">Họ tên:</span><p className="font-medium">{showDetail.name}</p></div>
              <div><span className="text-surface-500">MSV:</span><p className="font-medium">{showDetail.studentId}</p></div>
              <div><span className="text-surface-500">Địa chỉ:</span><p className="font-mono text-xs">{showDetail.student}</p></div>
              <div><span className="text-surface-500">Nhập học:</span><p>{formatDate(showDetail.enrollmentDate)}</p></div>
              <div><span className="text-surface-500">GPA tích lũy:</span><p className="text-lg font-bold text-brand-600">{formatGPA(showDetail.cumulativeGpa)}</p></div>
              <div><span className="text-surface-500">Tổng TC:</span><p className="font-medium">{showDetail.totalCredits}</p></div>
            </div>
            {showDetail.isVerified && (
              <div className="p-2 rounded bg-success-50 text-success-700 text-xs">
                <CheckCircle size={12} className="inline mr-1" />Xác minh bởi {shortenAddress(showDetail.verifier)} lúc {formatDate(showDetail.verificationDate)}
              </div>
            )}
            {showDetail.transcriptIPFS && (
              <div className="text-xs"><span className="text-surface-500">IPFS:</span> <span className="font-mono break-all">{showDetail.transcriptIPFS}</span></div>
            )}
            {/* Semesters */}
            {showDetail.semesters.map((sem, si) => (
              <div key={si} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Học kỳ {sem.semesterIndex + 1}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-surface-500">GPA: {formatGPA(sem.gpa)} · {sem.totalCredits} TC</span>
                    {sem.isCompleted ? (
                      <span className="badge badge-success text-xs">Hoàn thành</span>
                    ) : (
                      <button className="btn-secondary btn-sm text-xs" onClick={() => handleCompleteSemester(showDetail.recordId, sem.semesterIndex)}>Hoàn thành HK</button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {sem.grades.map((g, gi) => (
                    <div key={gi} className="flex items-center justify-between py-1 border-b border-surface-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold">{gi + 1}</span>
                        <span className="text-sm text-surface-800">{g.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-400">{g.credits} TC</span>
                        <span className={`badge ${gradeColor(g.grade)}`}>{g.grade} ({gradeToLetter(g.grade)})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Create Record Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo hồ sơ"
        footer={<button className="btn-primary" onClick={handleCreate} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Họ tên</label><input className="input" placeholder="Nguyễn Văn A" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mã SV</label><input className="input" placeholder="SV2024001" value={createForm.studentId} onChange={e => setCreateForm(f => ({ ...f, studentId: e.target.value }))} /></div>
          <div><label className="label">Ghi chú</label><textarea className="input" rows={3} value={createForm.transcript} onChange={e => setCreateForm(f => ({ ...f, transcript: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Add Grade Modal */}
      <Modal open={showGrade} onClose={() => setShowGrade(false)} title="Thêm điểm"
        footer={<button className="btn-primary" onClick={handleAddGrade} disabled={isLoading}>{isLoading ? 'Đang thêm...' : 'Thêm'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Record ID</label><input className="input" type="number" placeholder="1" value={gradeForm.recordId} onChange={e => setGradeForm(f => ({ ...f, recordId: e.target.value }))} /></div>
          <div><label className="label">Môn học</label><input className="input" placeholder="Toán cao cấp" value={gradeForm.subject} onChange={e => setGradeForm(f => ({ ...f, subject: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Điểm (0-100)</label><input className="input" type="number" min={0} max={100} value={gradeForm.grade} onChange={e => setGradeForm(f => ({ ...f, grade: e.target.value }))} /></div>
            <div><label className="label">Tín chỉ</label><input className="input" type="number" min={1} value={gradeForm.credits} onChange={e => setGradeForm(f => ({ ...f, credits: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>

      {/* Issue Transcript Modal */}
      <Modal open={showTranscript} onClose={() => setShowTranscript(false)} title="Cấp bảng điểm IPFS"
        footer={<button className="btn-primary" onClick={handleIssueTranscript} disabled={isLoading || !transcriptForm.recordId || !transcriptForm.ipfsHash}>
          {isLoading ? 'Đang xử lý...' : 'Cấp bảng điểm'}
        </button>}>
        <div className="space-y-4">
          <div><label className="label">Record ID</label><input className="input" type="number" placeholder="1" value={transcriptForm.recordId} onChange={e => setTranscriptForm(f => ({ ...f, recordId: e.target.value }))} /></div>
          <div><label className="label">IPFS Hash</label><input className="input" placeholder="QmXxx..." value={transcriptForm.ipfsHash} onChange={e => setTranscriptForm(f => ({ ...f, ipfsHash: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Update Record Modal */}
      <Modal open={!!showUpdate} onClose={() => setShowUpdate(null)} title={`Cập nhật hồ sơ #${showUpdate?.recordId}`}
        footer={<button className="btn-primary" onClick={() => showUpdate && handleUpdateRecord(showUpdate.recordId)} disabled={isLoading}>
          {isLoading ? 'Đang cập nhật...' : 'Cập nhật'}
        </button>}>
        <div className="space-y-4">
          <div><label className="label">Họ tên</label><input className="input" value={updateForm.name} onChange={e => setUpdateForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Ghi chú</label><textarea className="input" rows={3} value={updateForm.transcript} onChange={e => setUpdateForm(f => ({ ...f, transcript: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Authorize Verifier Modal */}
      <Modal open={showVerifier} onClose={() => setShowVerifier(false)} title="Ủy quyền Verifier"
        footer={<button className="btn-primary" onClick={handleAuthorizeVerifier} disabled={isLoading || !verifierAddr}>
          {isLoading ? 'Đang xử lý...' : 'Ủy quyền'}
        </button>}>
        <div><label className="label">Địa chỉ Verifier</label><input className="input" placeholder="0x..." value={verifierAddr} onChange={e => setVerifierAddr(e.target.value)} /></div>
      </Modal>
    </div>
  );
}

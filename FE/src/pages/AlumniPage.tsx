import { useState } from 'react';
import { UserCheck, Plus, Calendar, Heart, Mail, Users } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useAlumniRegistry } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';

const demoAlumni = [
  { id: 1, name: 'Phạm Minh Tuấn', graduationYear: 2023, program: 'Blockchain Engineering', company: 'Polygon Labs', role: 'Smart Contract Engineer', isMentor: true },
  { id: 2, name: 'Nguyễn Thị Hương', graduationYear: 2022, program: 'Computer Science', company: 'FPT Software', role: 'Tech Lead', isMentor: true },
  { id: 3, name: 'Trần Đức Anh', graduationYear: 2024, program: 'AI & Machine Learning', company: 'VinAI', role: 'ML Engineer', isMentor: false },
];

const demoEvents = [
  { id: 1, title: 'Alumni Meetup Q2/2025', date: '2025-06-15', attendees: 45 },
  { id: 2, title: 'Career Fair – Blockchain Edition', date: '2025-07-20', attendees: 120 },
  { id: 3, title: 'Mentorship Kickoff', date: '2025-05-01', attendees: 30 },
];

export default function AlumniPage() {
  const alumni = useAlumniRegistry();
  const { isLoading, execute } = useContractAction();

  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({ name: '', graduationYear: '', program: '', company: '', role: '' });

  const handleRegister = () => execute(
    async () => {
      if (!alumni) throw new Error('Contract not available');
      return alumni.registerAlumni(form.name, Number(form.graduationYear), form.program, form.company, form.role);
    },
    { successMessage: 'Đã đăng ký cựu sinh viên!', onSuccess: () => setShowRegister(false) }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <UserCheck size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Cựu sinh viên</h1>
            <p className="text-sm text-surface-500">{demoAlumni.length} thành viên · {demoAlumni.filter(a => a.isMentor).length} mentor</p>
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowRegister(true)}><Plus size={14} /> Đăng ký</button>
      </div>

      {/* Members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {demoAlumni.map(a => (
          <div key={a.id} className="card card-hover">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-sm shrink-0">
                {a.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-surface-800 truncate">{a.name}</h3>
                  {a.isMentor && <span className="badge badge-success text-[10px]">Mentor</span>}
                </div>
                <p className="text-xs text-surface-500">{a.role} @ {a.company}</p>
                <p className="text-xs text-surface-500 mt-1">{a.program} · K{a.graduationYear}</p>
                <button className="btn-ghost btn-sm mt-2"><Mail size={12} /> Liên hệ</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Events */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Sự kiện sắp tới</h2>
        <div className="space-y-2">
          {demoEvents.map(ev => (
            <div key={ev.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-brand-600 font-bold">{new Date(ev.date).toLocaleDateString('vi', { month: 'short' })}</span>
                  <span className="text-sm font-bold text-surface-800 leading-none">{new Date(ev.date).getDate()}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-surface-800">{ev.title}</h3>
                  <p className="text-xs text-surface-500"><Users size={10} className="inline" /> {ev.attendees} tham gia</p>
                </div>
              </div>
              <button className="btn-primary btn-sm">Tham gia</button>
            </div>
          ))}
        </div>
      </div>

      {/* Mentors */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Mentorship</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {demoAlumni.filter(a => a.isMentor).map(m => (
            <div key={m.id} className="card card-hover">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-lg">
                  {m.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-surface-800">{m.name}</h3>
                  <p className="text-xs text-surface-500">{m.role} @ {m.company}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {['Blockchain', 'Smart Contracts', 'DeFi'].map(t => <span key={t} className="badge badge-brand">{t}</span>)}
              </div>
              <button className="btn-primary btn-sm w-full"><Heart size={14} /> Đăng ký Mentorship</button>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Đăng ký cựu sinh viên" size="lg"
        footer={<button className="btn-primary" onClick={handleRegister} disabled={isLoading}>{isLoading ? 'Đang đăng ký...' : 'Đăng ký'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Họ tên</label><input className="input" placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Năm tốt nghiệp</label><input className="input" type="number" placeholder="2024" value={form.graduationYear} onChange={e => setForm(f => ({ ...f, graduationYear: e.target.value }))} /></div>
            <div><label className="label">Chương trình</label><input className="input" placeholder="Computer Science" value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Công ty</label><input className="input" placeholder="FPT Software" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            <div><label className="label">Vị trí</label><input className="input" placeholder="Software Engineer" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

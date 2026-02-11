import { useState } from 'react';
import { UserCheck, Plus, Calendar, Heart, MessageCircle, Users, Mail } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useAlumniRegistry } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress } from '@/lib/utils';

const demoAlumni = [
  { id: 1, name: 'Phạm Minh Tuấn', graduationYear: 2023, program: 'Blockchain Engineering', company: 'Polygon Labs', role: 'Smart Contract Engineer', isMentor: true },
  { id: 2, name: 'Nguyễn Thị Hương', graduationYear: 2022, program: 'Computer Science', company: 'FPT Software', role: 'Tech Lead', isMentor: true },
  { id: 3, name: 'Trần Đức Anh', graduationYear: 2024, program: 'AI & Machine Learning', company: 'VinAI', role: 'ML Engineer', isMentor: false },
];

const demoEvents = [
  { id: 1, title: 'Alumni Meetup Q2/2025', date: '2025-06-15', type: 'meetup', attendees: 45 },
  { id: 2, title: 'Career Fair – Blockchain Edition', date: '2025-07-20', type: 'career', attendees: 120 },
  { id: 3, title: 'Mentorship Kickoff', date: '2025-05-01', type: 'mentorship', attendees: 30 },
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
    <div>
      <PageHeader title="Cựu sinh viên" description="Mạng lưới alumni, mentorship và sự kiện" lucideIcon={UserCheck} badge="Alumni"
        action={<button className="btn-primary btn-sm" onClick={() => setShowRegister(true)}><Plus size={14} /> Đăng ký</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Cựu sinh viên" value={demoAlumni.length} icon={<UserCheck className="w-5 h-5" />} color="brand" />
        <StatCard label="Mentor" value={demoAlumni.filter(a => a.isMentor).length} icon={<Heart className="w-5 h-5" />} color="success" />
        <StatCard label="Sự kiện" value={demoEvents.length} icon={<Calendar className="w-5 h-5" />} color="warning" />
        <StatCard label="Kết nối" value="24" icon={<MessageCircle className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'members', label: 'Thành viên', icon: <Users size={14} />, count: demoAlumni.length },
        { id: 'events', label: 'Sự kiện', icon: <Calendar size={14} />, count: demoEvents.length },
        { id: 'mentors', label: 'Mentorship', icon: <Heart size={14} /> },
      ]}>
        {(active) => active === 'members' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {demoAlumni.map(a => (
              <div key={a.id} className="card card-hover">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {a.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{a.name}</h3>
                      {a.isMentor && <span className="badge badge-success text-[10px]">Mentor</span>}
                    </div>
                    <p className="text-xs text-surface-400">{a.role} @ {a.company}</p>
                    <p className="text-xs text-surface-500 mt-1">{a.program} • K{a.graduationYear}</p>
                    <div className="flex gap-2 mt-3">
                      <button className="btn-ghost btn-sm"><Mail size={12} /> Liên hệ</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : active === 'events' ? (
          <div className="space-y-3">
            {demoEvents.map(ev => (
              <div key={ev.id} className="card card-hover flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex flex-col items-center justify-center">
                    <span className="text-xs text-brand-400 font-bold">{new Date(ev.date).toLocaleDateString('vi', { month: 'short' })}</span>
                    <span className="text-lg font-bold text-white leading-none">{new Date(ev.date).getDate()}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{ev.title}</h3>
                    <p className="text-xs text-surface-400"><Users size={10} className="inline" /> {ev.attendees} tham gia</p>
                  </div>
                </div>
                <button className="btn-primary btn-sm">Tham gia</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {demoAlumni.filter(a => a.isMentor).map(m => (
              <div key={m.id} className="card card-hover">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-xl">
                    {m.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white">{m.name}</h3>
                    <p className="text-sm text-surface-400">{m.role} @ {m.company}</p>
                    <p className="text-xs text-surface-500">{m.program}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-surface-800/30">
                  <p className="text-xs text-surface-400 mb-2">Lĩnh vực mentor</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Blockchain', 'Smart Contracts', 'DeFi'].map(t => (
                      <span key={t} className="badge badge-brand">{t}</span>
                    ))}
                  </div>
                </div>
                <button className="btn-primary btn-sm w-full mt-3"><Heart size={14} /> Đăng ký Mentorship</button>
              </div>
            ))}
          </div>
        )}
      </Tabs>

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

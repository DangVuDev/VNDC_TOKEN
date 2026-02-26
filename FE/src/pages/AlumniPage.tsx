import { useState, useEffect, useCallback } from 'react';
import { UserCheck, Plus, Calendar, Heart, Mail, Users, Loader2, DollarSign } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useAlumniRegistry } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatDate, shortenAddress, formatVNDC } from '@/lib/utils';

interface Alumni { addr: string; name: string; program: string; graduationYear: number; status: string; registeredAt: number; profileURI: string; }
interface AlumniEvent { id: number; name: string; description: string; eventDate: number; location: string; organizer: string; registrationCount: number; }
interface Mentorship { id: number; mentor: string; mentee: string; startDate: number; endDate: number; isActive: boolean; }

export default function AlumniPage() {
  const { address } = useWeb3();
  const alumni = useAlumniRegistry();
  const { isLoading, execute } = useContractAction();

  const [members, setMembers] = useState<Alumni[]>([]);
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [connections, setConnections] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, totalEvents: 0, totalMentorships: 0, totalDonations: 0, totalDonationAmount: '0' });
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [showMentorship, setShowMentorship] = useState(false);
  const [form, setForm] = useState({ name: '', graduationYear: '', program: '', profileURI: '' });
  const [eventForm, setEventForm] = useState({ name: '', description: '', date: '', location: '' });
  const [donateForm, setDonateForm] = useState({ amount: '', purpose: '' });
  const [mentorForm, setMentorForm] = useState({ mentee: '', duration: '' });

  const loadData = useCallback(async () => {
    if (!alumni) return;
    setLoading(true);
    try {
      const [totalAlumni, totalEvents, totalMentorships, totalDonations, totalDonationAmount] = await Promise.all([
        alumni.getTotalAlumni().catch(() => 0n), alumni.getTotalEvents().catch(() => 0n),
        alumni.getTotalMentorships().catch(() => 0n), alumni.getTotalDonations().catch(() => 0n),
        alumni.getTotalDonationAmount().catch(() => 0n),
      ]);
      setStats({ total: Number(totalAlumni), totalEvents: Number(totalEvents), totalMentorships: Number(totalMentorships), totalDonations: Number(totalDonations), totalDonationAmount: formatVNDC(totalDonationAmount) });

      // Load events
      const evList: AlumniEvent[] = [];
      for (let i = 1; i <= Number(totalEvents); i++) {
        try {
          const e = await alumni.getEventInfo(i);
          evList.push({ id: i, name: e.name, description: e.description, eventDate: Number(e.eventDate), location: e.location, organizer: e.organizer, registrationCount: Number(e.registrationCount) });
        } catch {}
      }
      setEvents(evList);

      // Load mentorships
      const mList: Mentorship[] = [];
      for (let i = 1; i <= Number(totalMentorships); i++) {
        try {
          const m = await alumni.getMentorshipInfo(i);
          mList.push({ id: i, mentor: m.mentor, mentee: m.mentee, startDate: Number(m.startDate), endDate: Number(m.endDate), isActive: m.isActive });
        } catch {}
      }
      setMentorships(mList);

      if (address) {
        const registered = await alumni.isRegisteredAlumni(address).catch(() => false);
        setIsRegistered(registered);
        if (registered) {
          const conns: string[] = await alumni.getConnections(address).catch(() => []);
          setConnections(conns);
        }
      }
    } catch {}
    setLoading(false);
  }, [alumni, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRegister = () => execute(
    async () => {
      if (!alumni) throw new Error('Contract not available');
      return alumni.registerAlumni(form.name, form.program, Number(form.graduationYear), form.profileURI);
    },
    { successMessage: 'Đã đăng ký cựu sinh viên!', onSuccess: () => { setShowRegister(false); loadData(); } }
  );

  const handleCreateEvent = () => execute(
    async () => {
      if (!alumni) throw new Error('Contract not available');
      const eventDate = Math.floor(new Date(eventForm.date).getTime() / 1000);
      return alumni.createEvent(eventForm.name, eventForm.description, eventDate, eventForm.location);
    },
    { successMessage: 'Đã tạo sự kiện!', onSuccess: () => { setShowCreateEvent(false); loadData(); } }
  );

  const handleRegisterForEvent = (eventId: number) => execute(
    async () => {
      if (!alumni) throw new Error('Contract not available');
      return alumni.registerForEvent(eventId);
    },
    { successMessage: 'Đã đăng ký sự kiện!', onSuccess: loadData }
  );

  const handleConnect = (otherAlumni: string) => execute(
    async () => {
      if (!alumni) throw new Error('Contract not available');
      return alumni.connectWithAlumni(otherAlumni);
    },
    { successMessage: 'Đã kết nối!', onSuccess: loadData }
  );

  const handleDonate = () => execute(
    async () => {
      if (!alumni) throw new Error('Contract not available');
      const { parseUnits } = await import('ethers');
      return alumni.makeDonation(parseUnits(donateForm.amount, 18), donateForm.purpose);
    },
    { successMessage: 'Cảm ơn bạn đã đóng góp!', onSuccess: () => { setShowDonate(false); loadData(); } }
  );

  const handleCreateMentorship = () => execute(
    async () => {
      if (!alumni) throw new Error('Contract not available');
      const duration = Number(mentorForm.duration) * 86400;
      return alumni.createMentorship(mentorForm.mentee, duration);
    },
    { successMessage: 'Đã tạo mentorship!', onSuccess: () => { setShowMentorship(false); loadData(); } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><UserCheck size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Cựu sinh viên</h1>
            <p className="text-sm text-surface-500">{stats.total} thành viên · {stats.totalMentorships} mentorship</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isRegistered && <button className="btn-primary btn-sm" onClick={() => setShowRegister(true)}><Plus size={14} /> Đăng ký</button>}
          <button className="btn-ghost btn-sm" onClick={() => setShowCreateEvent(true)}><Calendar size={14} /> Tạo sự kiện</button>
          <button className="btn-ghost btn-sm" onClick={() => setShowDonate(true)}><DollarSign size={14} /> Quyên góp</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Thành viên', value: stats.total, cls: 'text-brand-600' },
          { label: 'Sự kiện', value: stats.totalEvents, cls: 'text-info-600' },
          { label: 'Mentorships', value: stats.totalMentorships, cls: 'text-success-600' },
          { label: 'Lượt quyên góp', value: stats.totalDonations, cls: 'text-warning-600' },
          { label: 'Quyên góp', value: stats.totalDonationAmount + ' VNDC', cls: 'text-error-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : (
        <>
          {/* Events */}
          <div>
            <h2 className="text-base font-semibold text-surface-800 mb-3">Sự kiện ({events.length})</h2>
            {events.length === 0 ? (
              <EmptyState lucideIcon={Calendar} title="Chưa có sự kiện" description="Tạo sự kiện đầu tiên" />
            ) : (
              <div className="space-y-2">
                {events.map(ev => (
                  <div key={ev.id} className="card flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-brand-600 font-bold">{ev.eventDate ? new Date(ev.eventDate * 1000).toLocaleDateString('vi', { month: 'short' }) : '—'}</span>
                        <span className="text-sm font-bold text-surface-800 leading-none">{ev.eventDate ? new Date(ev.eventDate * 1000).getDate() : '—'}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-surface-800">{ev.name}</h3>
                        <p className="text-xs text-surface-500">{ev.description} · {ev.location}</p>
                        <p className="text-xs text-surface-500"><Users size={10} className="inline" /> {ev.registrationCount} tham gia</p>
                      </div>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => handleRegisterForEvent(ev.id)}>Tham gia</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mentorships */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-surface-800">Mentorship ({mentorships.length})</h2>
              <button className="btn-ghost btn-sm" onClick={() => setShowMentorship(true)}><Plus size={14} /> Tạo mentorship</button>
            </div>
            {mentorships.length === 0 ? (
              <EmptyState lucideIcon={Heart} title="Chưa có mentorship" description="Tạo chương trình mentorship đầu tiên" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mentorships.map(m => (
                  <div key={m.id} className="card card-hover">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={m.isActive ? 'badge badge-success' : 'badge badge-neutral'}>{m.isActive ? 'Đang hoạt động' : 'Đã kết thúc'}</span>
                    </div>
                    <p className="text-xs text-surface-500">Mentor: {shortenAddress(m.mentor)}</p>
                    <p className="text-xs text-surface-500">Mentee: {shortenAddress(m.mentee)}</p>
                    <p className="text-xs text-surface-500 mt-1">{formatDate(m.startDate)} → {formatDate(m.endDate)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connections */}
          {isRegistered && (
            <div>
              <h2 className="text-base font-semibold text-surface-800 mb-3">Kết nối ({connections.length})</h2>
              {connections.length === 0 ? (
                <p className="text-sm text-surface-500">Chưa có kết nối nào.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connections.map(c => (
                    <span key={c} className="badge badge-brand">{shortenAddress(c)}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Register Modal */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Đăng ký cựu sinh viên" size="lg"
        footer={<button className="btn-primary" onClick={handleRegister} disabled={isLoading}>{isLoading ? 'Đang đăng ký...' : 'Đăng ký'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Họ tên</label><input className="input" placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Năm tốt nghiệp</label><input className="input" type="number" placeholder="2024" value={form.graduationYear} onChange={e => setForm(f => ({ ...f, graduationYear: e.target.value }))} /></div>
            <div><label className="label">Chương trình</label><input className="input" placeholder="Computer Science" value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} /></div>
          </div>
          <div><label className="label">Profile URI</label><input className="input" placeholder="ipfs://..." value={form.profileURI} onChange={e => setForm(f => ({ ...f, profileURI: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Create Event Modal */}
      <Modal open={showCreateEvent} onClose={() => setShowCreateEvent(false)} title="Tạo sự kiện" size="lg"
        footer={<button className="btn-primary" onClick={handleCreateEvent} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo sự kiện'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên sự kiện</label><input className="input" placeholder="Alumni Meetup" value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Ngày</label><input className="input" type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Địa điểm</label><input className="input" placeholder="Hà Nội" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>

      {/* Donate Modal */}
      <Modal open={showDonate} onClose={() => setShowDonate(false)} title="Quyên góp"
        footer={<button className="btn-primary" onClick={handleDonate} disabled={isLoading}>{isLoading ? 'Đang gửi...' : 'Quyên góp'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Số tiền (VNDC)</label><input className="input" type="number" placeholder="100" value={donateForm.amount} onChange={e => setDonateForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div><label className="label">Mục đích</label><input className="input" placeholder="Hỗ trợ sinh viên..." value={donateForm.purpose} onChange={e => setDonateForm(f => ({ ...f, purpose: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Mentorship Modal */}
      <Modal open={showMentorship} onClose={() => setShowMentorship(false)} title="Tạo Mentorship"
        footer={<button className="btn-primary" onClick={handleCreateMentorship} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ mentee</label><input className="input" placeholder="0x..." value={mentorForm.mentee} onChange={e => setMentorForm(f => ({ ...f, mentee: e.target.value }))} /></div>
          <div><label className="label">Thời gian (ngày)</label><input className="input" type="number" placeholder="90" value={mentorForm.duration} onChange={e => setMentorForm(f => ({ ...f, duration: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

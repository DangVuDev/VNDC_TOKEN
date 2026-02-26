import { useState, useEffect, useCallback } from 'react';
import {
  HeartHandshake, Plus, Search, Target, Loader2, Clock, Users, Coins,
  TrendingUp, Gift, AlertTriangle, CheckCircle, XCircle, Eye, Flag,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, BarChart3, Wallet,
  Image, Milestone, ChevronRight, ExternalLink, Megaphone,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useFundraising, useVNDC } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, formatDate, shortenAddress, timeAgo } from '@/lib/utils';

// ─── Types ───
interface CampaignInfo {
  id: number; creator: string; title: string; description: string;
  imageURI: string; category: number; goalAmount: bigint; raisedAmount: bigint;
  donorCount: number; deadline: number; minDonation: bigint;
  status: number; createdAt: number;
}

interface MilestoneInfo {
  description: string; target: bigint; completed: boolean;
}

interface DonationInfo {
  amount: bigint; lastMessage: string; lastDonatedAt: number;
}

interface PlatformStats {
  totalCampaigns: number; totalRaised: bigint; totalDonors: number;
  totalSuccessful: number; matchingFundBalance: bigint;
}

// ─── Constants ───
const CATEGORIES = ['Dự án SV', 'Nghiên cứu', 'CLB / Đoàn thể', 'Từ thiện', 'Sự kiện', 'Khởi nghiệp', 'Khác'];
const CATEGORY_ICONS = [Target, Search, Users, HeartHandshake, Megaphone, TrendingUp, Flag];
const STATUS_LABELS = ['Đang gây quỹ', 'Thành công', 'Thất bại', 'Đã huỷ'];
const STATUS_COLORS = ['badge-brand', 'badge-success', 'badge-error', 'badge-neutral'];

type Tab = 'browse' | 'myCampaigns' | 'myDonations' | 'admin';

export default function FundraisingPage() {
  const { address } = useWeb3();
  const fundraising = useFundraising();
  const vndc = useVNDC();
  const { isLoading, execute } = useContractAction();

  // ─── UI State ───
  const [tab, setTab] = useState<Tab>('browse');
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState(-1);

  // ─── Data State ───
  const [stats, setStats] = useState<PlatformStats>({
    totalCampaigns: 0, totalRaised: 0n, totalDonors: 0, totalSuccessful: 0, matchingFundBalance: 0n,
  });
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<CampaignInfo[]>([]);
  const [myDonatedCampaigns, setMyDonatedCampaigns] = useState<CampaignInfo[]>([]);
  const [myDonationAmounts, setMyDonationAmounts] = useState<Map<number, DonationInfo>>(new Map());
  const [owner, setOwner] = useState('');

  // ─── Modal State ───
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showCampaignDetail, setShowCampaignDetail] = useState<CampaignInfo | null>(null);
  const [showDonateModal, setShowDonateModal] = useState<CampaignInfo | null>(null);
  const [showDepositMatching, setShowDepositMatching] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState<CampaignInfo | null>(null);
  const [detailMilestones, setDetailMilestones] = useState<MilestoneInfo[]>([]);
  const [detailDonors, setDetailDonors] = useState<string[]>([]);

  // ─── Form State ───
  const [campaignForm, setCampaignForm] = useState({
    title: '', description: '', imageURI: '', category: '0',
    goalAmount: '', durationDays: '30', minDonation: '1',
  });
  const [donateForm, setDonateForm] = useState({ amount: '', message: '' });
  const [milestoneForm, setMilestoneForm] = useState({ description: '', targetAmount: '' });
  const [matchingAmount, setMatchingAmount] = useState('');
  const [matchApplyForm, setMatchApplyForm] = useState({ campaignId: '', amount: '' });

  // ─── Helpers ───
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  const getProgress = (c: CampaignInfo) =>
    c.goalAmount > 0n ? Math.min(100, Number((c.raisedAmount * 100n) / c.goalAmount)) : 0;

  const getTimeLeft = (deadline: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = deadline - now;
    if (diff <= 0) return 'Đã hết hạn';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days} ngày ${hours}h`;
    return `${hours}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  // ─── Load Data ───
  const loadData = useCallback(async () => {
    if (!fundraising) return;
    setLoading(true);
    try {
      const [statsResult, totalCampaigns, ownerAddr] = await Promise.all([
        fundraising.getPlatformStats().catch(() => [0n, 0n, 0n, 0n, 0n]),
        fundraising.getTotalCampaigns().catch(() => 0n),
        fundraising.owner().catch(() => ''),
      ]);

      setStats({
        totalCampaigns: Number(statsResult[0]),
        totalRaised: statsResult[1],
        totalDonors: Number(statsResult[2]),
        totalSuccessful: Number(statsResult[3]),
        matchingFundBalance: statsResult[4],
      });
      setOwner(ownerAddr);

      // Load all campaigns
      const total = Number(totalCampaigns);
      const allCampaigns: CampaignInfo[] = [];
      for (let i = 1; i <= total; i++) {
        try {
          const c = await fundraising.getCampaign(i);
          allCampaigns.push({
            id: i,
            creator: c[0],
            title: c[1],
            description: c[2],
            imageURI: c[3],
            category: Number(c[4]),
            goalAmount: c[5],
            raisedAmount: c[6],
            donorCount: Number(c[7]),
            deadline: Number(c[8]),
            minDonation: c[9],
            status: Number(c[10]),
            createdAt: Number(c[11]),
          });
        } catch { /* skip */ }
      }
      setCampaigns(allCampaigns);

      // User specific data
      if (address) {
        // My campaigns
        try {
          const myIds: bigint[] = await fundraising.getUserCampaigns(address);
          setMyCampaigns(allCampaigns.filter(c => myIds.some(id => Number(id) === c.id)));
        } catch { setMyCampaigns([]); }

        // My donations
        try {
          const donatedIds: bigint[] = await fundraising.getUserDonations(address);
          const donated: CampaignInfo[] = [];
          const amounts = new Map<number, DonationInfo>();
          for (const cid of donatedIds) {
            const camp = allCampaigns.find(c => c.id === Number(cid));
            if (camp) donated.push(camp);
            try {
              const d = await fundraising.getDonation(Number(cid), address);
              amounts.set(Number(cid), { amount: d[0], lastMessage: d[1], lastDonatedAt: Number(d[2]) });
            } catch { /* skip */ }
          }
          setMyDonatedCampaigns(donated);
          setMyDonationAmounts(amounts);
        } catch { setMyDonatedCampaigns([]); setMyDonationAmounts(new Map()); }
      }
    } catch (e) { console.error('Load error', e); }
    setLoading(false);
  }, [fundraising, address]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Load campaign detail data ───
  const loadDetail = async (campaign: CampaignInfo) => {
    if (!fundraising) return;
    setShowCampaignDetail(campaign);
    try {
      const [ms, donors] = await Promise.all([
        fundraising.getMilestones(campaign.id).catch(() => [[], [], []]),
        fundraising.getCampaignDonors(campaign.id).catch(() => []),
      ]);
      const descs = ms[0] || []; const targets = ms[1] || []; const completed = ms[2] || [];
      const milestones: MilestoneInfo[] = [];
      for (let i = 0; i < descs.length; i++) {
        milestones.push({ description: descs[i], target: targets[i], completed: completed[i] });
      }
      setDetailMilestones(milestones);
      setDetailDonors(donors as string[]);
    } catch { setDetailMilestones([]); setDetailDonors([]); }
  };

  // ─── Actions ───
  const handleCreateCampaign = () => execute(async () => {
    if (!fundraising) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    return fundraising.createCampaign(
      campaignForm.title,
      campaignForm.description,
      campaignForm.imageURI,
      Number(campaignForm.category),
      parseUnits(campaignForm.goalAmount || '0', 18),
      Number(campaignForm.durationDays),
      parseUnits(campaignForm.minDonation || '0', 18),
    );
  }, {
    successMessage: 'Đã tạo chiến dịch!',
    onSuccess: () => {
      setShowCreateCampaign(false);
      setCampaignForm({ title: '', description: '', imageURI: '', category: '0', goalAmount: '', durationDays: '30', minDonation: '1' });
      loadData();
    },
  });

  const handleDonate = (campaign: CampaignInfo) => execute(async () => {
    if (!fundraising || !vndc) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    const amount = parseUnits(donateForm.amount || '0', 18);
    const fundraisingAddr = await fundraising.getAddress();
    const approveTx = await vndc.approve(fundraisingAddr, amount);
    await approveTx.wait();
    return fundraising.donate(campaign.id, amount, donateForm.message);
  }, {
    successMessage: 'Cảm ơn bạn đã ủng hộ!',
    onSuccess: () => { setShowDonateModal(null); setDonateForm({ amount: '', message: '' }); loadData(); },
  });

  const handleWithdrawFunds = (campaignId: number) => execute(async () => {
    if (!fundraising) throw new Error('Contract not available');
    return fundraising.withdrawFunds(campaignId);
  }, { successMessage: 'Đã rút tiền thành công!', onSuccess: loadData });

  const handleClaimRefund = (campaignId: number) => execute(async () => {
    if (!fundraising) throw new Error('Contract not available');
    return fundraising.claimRefund(campaignId);
  }, { successMessage: 'Đã hoàn tiền!', onSuccess: loadData });

  const handleCancelCampaign = (campaignId: number) => execute(async () => {
    if (!fundraising) throw new Error('Contract not available');
    return fundraising.cancelCampaign(campaignId);
  }, { successMessage: 'Đã huỷ chiến dịch!', onSuccess: () => { setShowCampaignDetail(null); loadData(); } });

  const handleAddMilestone = () => execute(async () => {
    if (!fundraising || !showAddMilestone) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    return fundraising.addMilestone(
      showAddMilestone.id,
      milestoneForm.description,
      parseUnits(milestoneForm.targetAmount || '0', 18),
    );
  }, {
    successMessage: 'Đã thêm milestone!',
    onSuccess: () => { setShowAddMilestone(null); setMilestoneForm({ description: '', targetAmount: '' }); loadData(); },
  });

  const handleCompleteMilestone = (campaignId: number, index: number) => execute(async () => {
    if (!fundraising) throw new Error('Contract not available');
    return fundraising.completeMilestone(campaignId, index);
  }, { successMessage: 'Đã hoàn thành milestone!', onSuccess: () => loadDetail({ ...showCampaignDetail! }) });

  // Admin actions
  const handleDepositMatching = () => execute(async () => {
    if (!fundraising || !vndc) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    const amount = parseUnits(matchingAmount || '0', 18);
    const addr = await fundraising.getAddress();
    const approveTx = await vndc.approve(addr, amount);
    await approveTx.wait();
    return fundraising.depositMatchingFund(amount);
  }, {
    successMessage: 'Đã nạp quỹ matching!',
    onSuccess: () => { setShowDepositMatching(false); setMatchingAmount(''); loadData(); },
  });

  const handleApplyMatching = () => execute(async () => {
    if (!fundraising) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    return fundraising.applyMatchingFund(
      Number(matchApplyForm.campaignId),
      parseUnits(matchApplyForm.amount || '0', 18),
    );
  }, { successMessage: 'Đã áp dụng matching fund!', onSuccess: () => { setMatchApplyForm({ campaignId: '', amount: '' }); loadData(); } });

  // ─── Filtered ───
  const activeCampaigns = campaigns.filter(c => c.status === 0);
  const filtered = activeCampaigns.filter(c => {
    if (searchText && !c.title.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterCategory >= 0 && c.category !== filterCategory) return false;
    return true;
  });

  const tabs = [
    { key: 'browse' as Tab, label: 'Khám phá', icon: Search, count: activeCampaigns.length },
    { key: 'myCampaigns' as Tab, label: 'Chiến dịch của tôi', icon: Megaphone, count: myCampaigns.length },
    { key: 'myDonations' as Tab, label: 'Đã ủng hộ', icon: HeartHandshake, count: myDonatedCampaigns.length },
    ...(isOwner ? [{ key: 'admin' as Tab, label: 'Quản trị', icon: BarChart3, count: 0 }] : []),
  ];

  // ─── Campaign Card ───
  const CampaignCard = ({ c, showAction = true }: { c: CampaignInfo; showAction?: boolean }) => {
    const progress = getProgress(c);
    const CatIcon = CATEGORY_ICONS[c.category] || Flag;
    return (
      <div className="card overflow-hidden hover:shadow-lg transition-shadow">
        {/* Image */}
        <div className="h-40 bg-gradient-to-br from-brand-100 to-brand-200 relative flex items-center justify-center overflow-hidden">
          {c.imageURI ? (
            <img src={c.imageURI} alt={c.title} className="w-full h-full object-cover" />
          ) : (
            <CatIcon className="w-12 h-12 text-brand-400" />
          )}
          <span className={`absolute top-2 right-2 badge ${STATUS_COLORS[c.status]}`}>
            {STATUS_LABELS[c.status]}
          </span>
        </div>
        {/* Content */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-surface-800 line-clamp-1">{c.title}</h3>
            <p className="text-xs text-surface-500 mt-0.5 flex items-center gap-1">
              <CatIcon className="w-3 h-3" /> {CATEGORIES[c.category] || 'Khác'}
              <span className="mx-1">•</span>
              {shortenAddress(c.creator)}
            </p>
          </div>
          <p className="text-sm text-surface-600 line-clamp-2">{c.description}</p>
          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-surface-500">{formatVNDC(c.raisedAmount)} / {formatVNDC(c.goalAmount)} VNDC</span>
              <span className="font-semibold text-brand-600">{progress}%</span>
            </div>
            <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
          {/* Stats */}
          <div className="flex justify-between text-xs text-surface-500">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.donorCount} người</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {getTimeLeft(c.deadline)}</span>
          </div>
          {/* Actions */}
          {showAction && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => loadDetail(c)} className="btn-ghost flex-1 text-sm flex items-center justify-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Chi tiết
              </button>
              {c.status === 0 && (
                <button
                  onClick={() => { setShowDonateModal(c); setDonateForm({ amount: '', message: '' }); }}
                  className="btn-brand flex-1 text-sm flex items-center justify-center gap-1"
                >
                  <HeartHandshake className="w-3.5 h-3.5" /> Ủng hộ
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
            <HeartHandshake className="w-7 h-7 text-brand-500" />
            Gây quỹ cộng đồng
          </h1>
          <p className="text-surface-500 mt-1">Crowdfunding cho dự án sinh viên, nghiên cứu & hoạt động</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateCampaign(true)} className="btn-brand flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tạo chiến dịch
          </button>
          <button onClick={loadData} disabled={loading} className="btn-ghost flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Chiến dịch', value: stats.totalCampaigns.toString(), icon: Megaphone, color: 'text-brand-500' },
          { label: 'Đã huy động', value: `${formatVNDC(stats.totalRaised)} VNDC`, icon: Coins, color: 'text-green-500' },
          { label: 'Nhà tài trợ', value: stats.totalDonors.toString(), icon: Users, color: 'text-blue-500' },
          { label: 'Thành công', value: stats.totalSuccessful.toString(), icon: CheckCircle, color: 'text-purple-500' },
          { label: 'Quỹ matching', value: `${formatVNDC(stats.matchingFundBalance)} VNDC`, icon: Gift, color: 'text-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-surface-500">{label}</p>
              <p className="text-sm font-bold text-surface-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-surface-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              tab === t.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-surface-100 text-surface-600">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <>
          {/* ═══ TAB: Browse ═══ */}
          {tab === 'browse' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    type="text" placeholder="Tìm kiếm chiến dịch..."
                    className="input w-full pl-9"
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                  />
                </div>
                <select
                  className="input"
                  value={filterCategory}
                  onChange={e => setFilterCategory(Number(e.target.value))}
                >
                  <option value={-1}>Tất cả danh mục</option>
                  {CATEGORIES.map((cat, i) => <option key={i} value={i}>{cat}</option>)}
                </select>
              </div>

              {filtered.length === 0 ? (
                <EmptyState lucideIcon={Megaphone} title="Chưa có chiến dịch" description="Hãy tạo chiến dịch gây quỹ đầu tiên!" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map(c => <CampaignCard key={c.id} c={c} />)}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: My Campaigns ═══ */}
          {tab === 'myCampaigns' && (
            <div>
              {!address ? (
                <EmptyState lucideIcon={Wallet} title="Chưa kết nối ví" description="Kết nối ví để xem chiến dịch của bạn" />
              ) : myCampaigns.length === 0 ? (
                <EmptyState
                  lucideIcon={Megaphone}
                  title="Chưa có chiến dịch nào"
                  description="Bạn chưa tạo chiến dịch gây quỹ nào"
                  action={
                    <button onClick={() => setShowCreateCampaign(true)} className="btn-brand flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Tạo chiến dịch
                    </button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {myCampaigns.map(c => {
                    const progress = getProgress(c);
                    return (
                      <div key={c.id} className="card p-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-surface-800">{c.title}</h3>
                              <span className={`badge ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                            </div>
                            <div className="flex gap-6 text-sm text-surface-500 mb-2">
                              <span>{CATEGORIES[c.category]}</span>
                              <span>{c.donorCount} người ủng hộ</span>
                              <span>{getTimeLeft(c.deadline)}</span>
                            </div>
                            <div className="max-w-md">
                              <div className="flex justify-between text-xs mb-1">
                                <span>{formatVNDC(c.raisedAmount)} / {formatVNDC(c.goalAmount)} VNDC</span>
                                <span className="font-semibold text-brand-600">{progress}%</span>
                              </div>
                              <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-brand-500'}`}
                                  style={{ width: `${Math.min(100, progress)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => loadDetail(c)} className="btn-ghost text-sm flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> Chi tiết
                            </button>
                            {c.status === 0 && (
                              <>
                                <button
                                  onClick={() => { setShowAddMilestone(c); setMilestoneForm({ description: '', targetAmount: '' }); }}
                                  className="btn-ghost text-sm flex items-center gap-1"
                                >
                                  <Milestone className="w-3.5 h-3.5" /> Milestone
                                </button>
                                <button
                                  onClick={() => handleCancelCampaign(c.id)}
                                  disabled={isLoading}
                                  className="btn-ghost text-sm text-red-600 flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Huỷ
                                </button>
                              </>
                            )}
                            {c.status === 1 && (
                              <button
                                onClick={() => handleWithdrawFunds(c.id)}
                                disabled={isLoading}
                                className="btn-brand text-sm flex items-center gap-1"
                              >
                                <ArrowUpFromLine className="w-3.5 h-3.5" /> Rút tiền
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: My Donations ═══ */}
          {tab === 'myDonations' && (
            <div>
              {!address ? (
                <EmptyState lucideIcon={Wallet} title="Chưa kết nối ví" description="Kết nối ví để xem lịch sử ủng hộ" />
              ) : myDonatedCampaigns.length === 0 ? (
                <EmptyState lucideIcon={HeartHandshake} title="Chưa ủng hộ chiến dịch nào" description="Khám phá các chiến dịch và ủng hộ ngay!" />
              ) : (
                <div className="space-y-4">
                  {myDonatedCampaigns.map(c => {
                    const donation = myDonationAmounts.get(c.id);
                    const canRefund = c.status === 2 || c.status === 3; // Failed or Cancelled
                    return (
                      <div key={c.id} className="card p-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-surface-800">{c.title}</h3>
                              <span className={`badge ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                            </div>
                            <div className="flex gap-4 text-sm">
                              <span className="text-surface-500">Đã ủng hộ:</span>
                              <span className="font-bold text-green-600">{donation ? formatVNDC(donation.amount) : '0'} VNDC</span>
                              {donation?.lastMessage && (
                                <span className="text-surface-400 italic">"{donation.lastMessage}"</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => loadDetail(c)} className="btn-ghost text-sm flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> Chi tiết
                            </button>
                            {canRefund && donation && donation.amount > 0n && (
                              <button
                                onClick={() => handleClaimRefund(c.id)}
                                disabled={isLoading}
                                className="btn-ghost text-sm text-amber-600 flex items-center gap-1"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" /> Hoàn tiền
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: Admin ═══ */}
          {tab === 'admin' && isOwner && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setShowDepositMatching(true)} className="btn-brand flex items-center gap-2">
                  <Gift className="w-4 h-4" /> Nạp quỹ Matching
                </button>
              </div>

              {/* Apply matching fund */}
              <div className="card p-5">
                <h3 className="font-semibold text-surface-800 mb-3">Áp dụng Matching Fund</h3>
                <p className="text-sm text-surface-500 mb-3">Hỗ trợ thêm cho chiến dịch bằng quỹ matching (quỹ hiện tại: {formatVNDC(stats.matchingFundBalance)} VNDC)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-600 mb-1">Campaign ID</label>
                    <input
                      type="number" placeholder="#1, #2..."
                      className="input w-full"
                      value={matchApplyForm.campaignId}
                      onChange={e => setMatchApplyForm(f => ({ ...f, campaignId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-600 mb-1">Số lượng (VNDC)</label>
                    <input
                      type="number" placeholder="100"
                      className="input w-full"
                      value={matchApplyForm.amount}
                      onChange={e => setMatchApplyForm(f => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleApplyMatching}
                      disabled={isLoading || !matchApplyForm.campaignId || !matchApplyForm.amount}
                      className="btn-brand flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Áp dụng
                    </button>
                  </div>
                </div>
              </div>

              {/* All campaigns table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-surface-200">
                  <h3 className="font-semibold text-surface-800">Tất cả chiến dịch ({campaigns.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-50">
                      <tr>
                        <th className="text-left p-3 text-surface-500 font-medium">ID</th>
                        <th className="text-left p-3 text-surface-500 font-medium">Tiêu đề</th>
                        <th className="text-left p-3 text-surface-500 font-medium">Người tạo</th>
                        <th className="text-left p-3 text-surface-500 font-medium">Mục tiêu</th>
                        <th className="text-left p-3 text-surface-500 font-medium">Đã huy động</th>
                        <th className="text-left p-3 text-surface-500 font-medium">Tiến độ</th>
                        <th className="text-left p-3 text-surface-500 font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(c => (
                        <tr key={c.id} className="border-t border-surface-100 hover:bg-surface-50 cursor-pointer" onClick={() => loadDetail(c)}>
                          <td className="p-3 font-medium">#{c.id}</td>
                          <td className="p-3 max-w-[200px] truncate">{c.title}</td>
                          <td className="p-3 text-xs">{shortenAddress(c.creator)}</td>
                          <td className="p-3">{formatVNDC(c.goalAmount)}</td>
                          <td className="p-3">{formatVNDC(c.raisedAmount)}</td>
                          <td className="p-3 font-bold text-brand-600">{getProgress(c)}%</td>
                          <td className="p-3"><span className={`badge ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Create Campaign Modal */}
      <Modal open={showCreateCampaign} onClose={() => setShowCreateCampaign(false)} title="Tạo chiến dịch gây quỹ" description="Mô tả mục tiêu và huy động cộng đồng ủng hộ" size="lg">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Tiêu đề chiến dịch</label>
            <input type="text" placeholder="VD: Gây quỹ cho dự án AI Chatbot..." className="input w-full"
              value={campaignForm.title} onChange={e => setCampaignForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Mô tả chi tiết</label>
            <textarea rows={3} placeholder="Mô tả dự án, mục đích sử dụng quỹ..." className="input w-full"
              value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Danh mục</label>
              <select className="input w-full" value={campaignForm.category} onChange={e => setCampaignForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((cat, i) => <option key={i} value={i}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Link ảnh (URL)</label>
              <input type="text" placeholder="https://..." className="input w-full"
                value={campaignForm.imageURI} onChange={e => setCampaignForm(f => ({ ...f, imageURI: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Mục tiêu (VNDC)</label>
              <input type="number" placeholder="10000" className="input w-full"
                value={campaignForm.goalAmount} onChange={e => setCampaignForm(f => ({ ...f, goalAmount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Thời hạn (ngày)</label>
              <input type="number" placeholder="30" className="input w-full"
                value={campaignForm.durationDays} onChange={e => setCampaignForm(f => ({ ...f, durationDays: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Donate tối thiểu</label>
              <input type="number" placeholder="1" className="input w-full"
                value={campaignForm.minDonation} onChange={e => setCampaignForm(f => ({ ...f, minDonation: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreateCampaign}
              disabled={isLoading || !campaignForm.title || !campaignForm.goalAmount}
              className="btn-brand flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Tạo chiến dịch
            </button>
            <button onClick={() => setShowCreateCampaign(false)} className="btn-ghost">Huỷ</button>
          </div>
        </div>
      </Modal>

      {/* Donate Modal */}
      <Modal
        open={!!showDonateModal}
        onClose={() => setShowDonateModal(null)}
        title={`Ủng hộ: ${showDonateModal?.title ?? ''}`}
        description={showDonateModal ? `Mục tiêu: ${formatVNDC(showDonateModal.goalAmount)} VNDC` : ''}
      >
        {showDonateModal && (
          <div className="p-5 space-y-4">
            <div className="bg-surface-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-surface-500">Đã huy động</span>
                <span className="font-bold">{formatVNDC(showDonateModal.raisedAmount)} / {formatVNDC(showDonateModal.goalAmount)} VNDC</span>
              </div>
              <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, getProgress(showDonateModal))}%` }} />
              </div>
            </div>
            {showDonateModal.minDonation > 0n && (
              <p className="text-xs text-surface-500">Donate tối thiểu: {formatVNDC(showDonateModal.minDonation)} VNDC</p>
            )}
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Số lượng (VNDC)</label>
              <input type="number" placeholder="Nhập số lượng..." className="input w-full"
                value={donateForm.amount} onChange={e => setDonateForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Lời nhắn (tuỳ chọn)</label>
              <input type="text" placeholder="Chúc dự án thành công!" className="input w-full"
                value={donateForm.message} onChange={e => setDonateForm(f => ({ ...f, message: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleDonate(showDonateModal)}
                disabled={isLoading || !donateForm.amount}
                className="btn-brand flex-1 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartHandshake className="w-4 h-4" />}
                Approve &amp; Ủng hộ
              </button>
              <button onClick={() => setShowDonateModal(null)} className="btn-ghost">Huỷ</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Campaign Detail Modal */}
      <Modal
        open={!!showCampaignDetail}
        onClose={() => setShowCampaignDetail(null)}
        title={showCampaignDetail?.title ?? ''}
        size="lg"
      >
        {showCampaignDetail && (() => {
          const c = showCampaignDetail;
          const progress = getProgress(c);
          const isMine = address && c.creator.toLowerCase() === address.toLowerCase();
          return (
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Header info */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                <span className="badge badge-neutral">{CATEGORIES[c.category]}</span>
                <span className="text-xs text-surface-500">Tạo bởi {shortenAddress(c.creator)}</span>
                <span className="text-xs text-surface-400">• {formatDate(c.createdAt)}</span>
              </div>

              {/* Image */}
              {c.imageURI && (
                <img src={c.imageURI} alt={c.title} className="w-full h-48 object-cover rounded-lg" />
              )}

              <p className="text-sm text-surface-600">{c.description}</p>

              {/* Progress */}
              <div className="card p-4 bg-surface-50">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-surface-500">Tiến độ huy động</span>
                  <span className="font-bold text-brand-600">{progress}%</span>
                </div>
                <div className="h-3 bg-surface-200 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <p className="font-bold text-surface-800">{formatVNDC(c.raisedAmount)}</p>
                    <p className="text-xs text-surface-500">Đã huy động</p>
                  </div>
                  <div>
                    <p className="font-bold text-surface-800">{formatVNDC(c.goalAmount)}</p>
                    <p className="text-xs text-surface-500">Mục tiêu</p>
                  </div>
                  <div>
                    <p className="font-bold text-surface-800">{c.donorCount}</p>
                    <p className="text-xs text-surface-500">Người ủng hộ</p>
                  </div>
                </div>
              </div>

              {/* Milestones */}
              {detailMilestones.length > 0 && (
                <div>
                  <h4 className="font-semibold text-surface-700 mb-2 flex items-center gap-1"><Milestone className="w-4 h-4" /> Milestones</h4>
                  <div className="space-y-2">
                    {detailMilestones.map((ms, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${ms.completed ? 'bg-green-50 border-green-200' : 'bg-surface-50 border-surface-200'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ms.completed ? 'bg-green-500 text-white' : 'bg-surface-300 text-white'}`}>
                          {ms.completed ? '✓' : i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-surface-700">{ms.description}</p>
                          <p className="text-xs text-surface-500">Mục tiêu: {formatVNDC(ms.target)} VNDC</p>
                        </div>
                        {isMine && !ms.completed && c.raisedAmount >= ms.target && (
                          <button
                            onClick={() => handleCompleteMilestone(c.id, i)}
                            disabled={isLoading}
                            className="btn-ghost text-xs text-green-600"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Donors */}
              {detailDonors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-surface-700 mb-2">Nhà tài trợ ({detailDonors.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {detailDonors.slice(0, 20).map((d, i) => (
                      <span key={i} className="badge badge-neutral text-xs">{shortenAddress(d)}</span>
                    ))}
                    {detailDonors.length > 20 && <span className="badge badge-neutral text-xs">+{detailDonors.length - 20}</span>}
                  </div>
                </div>
              )}

              {/* Detail actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-200">
                {c.status === 0 && (
                  <button
                    onClick={() => { setShowCampaignDetail(null); setShowDonateModal(c); setDonateForm({ amount: '', message: '' }); }}
                    className="btn-brand flex items-center gap-1 text-sm"
                  >
                    <HeartHandshake className="w-3.5 h-3.5" /> Ủng hộ
                  </button>
                )}
                {isMine && c.status === 1 && (
                  <button onClick={() => handleWithdrawFunds(c.id)} disabled={isLoading} className="btn-brand flex items-center gap-1 text-sm">
                    <ArrowUpFromLine className="w-3.5 h-3.5" /> Rút tiền
                  </button>
                )}
                {isMine && c.status === 0 && (
                  <button onClick={() => handleCancelCampaign(c.id)} disabled={isLoading} className="btn-ghost text-sm text-red-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Huỷ chiến dịch
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Add Milestone Modal */}
      <Modal open={!!showAddMilestone} onClose={() => setShowAddMilestone(null)} title="Thêm Milestone" description={`Chiến dịch: ${showAddMilestone?.title ?? ''}`}>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Mô tả milestone</label>
            <input type="text" placeholder="VD: Hoàn thành prototype v1..." className="input w-full"
              value={milestoneForm.description} onChange={e => setMilestoneForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Mức tiền mục tiêu (VNDC)</label>
            <input type="number" placeholder="5000" className="input w-full"
              value={milestoneForm.targetAmount} onChange={e => setMilestoneForm(f => ({ ...f, targetAmount: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddMilestone}
              disabled={isLoading || !milestoneForm.description || !milestoneForm.targetAmount}
              className="btn-brand flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Thêm
            </button>
            <button onClick={() => setShowAddMilestone(null)} className="btn-ghost">Huỷ</button>
          </div>
        </div>
      </Modal>

      {/* Deposit Matching Fund Modal */}
      <Modal open={showDepositMatching} onClose={() => setShowDepositMatching(false)} title="Nạp quỹ Matching" description="Nạp VNDC vào quỹ matching để hỗ trợ chiến dịch">
        <div className="p-5 space-y-4">
          <div className="bg-surface-50 rounded-lg p-3 text-sm">
            <p className="text-surface-500">Quỹ matching hiện tại</p>
            <p className="font-bold text-lg">{formatVNDC(stats.matchingFundBalance)} VNDC</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Số lượng nạp (VNDC)</label>
            <input type="number" placeholder="Nhập số lượng..." className="input w-full"
              value={matchingAmount} onChange={e => setMatchingAmount(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleDepositMatching} disabled={isLoading || !matchingAmount} className="btn-brand flex-1 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              Approve &amp; Nạp
            </button>
            <button onClick={() => setShowDepositMatching(false)} className="btn-ghost">Huỷ</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, Plus, TrendingUp, Coins, Clock, Shield, Loader2, RefreshCw,
  AlertTriangle, CheckCircle, Zap, ArrowDownToLine, ArrowUpFromLine,
  Timer, Percent, Users, BarChart3, Wallet, Lock, Unlock, Gift,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useStakingPool, useVNDC } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, formatDate, shortenAddress } from '@/lib/utils';

// ─── Types ───
interface PoolInfo {
  id: number; poolType: number; apyBps: number; minStake: bigint; maxStake: bigint;
  lockDays: number; totalStaked: bigint; totalStakers: number;
  maxCapacity: bigint; active: boolean; createdAt: number;
}

interface StakeInfo {
  id: number; staker: string; poolId: number; principal: bigint;
  pendingReward: bigint; stakedAt: number; unlockAt: number;
  lastClaimAt: number; status: number;
}

interface PlatformStats {
  totalPools: number; totalStaked: bigint; totalStakers: number;
  totalRewardsPaid: bigint; rewardBalance: bigint;
}

// ─── Constants ───
const POOL_TYPE_LABELS = ['Linh hoạt', '30 ngày', '90 ngày', '180 ngày', '365 ngày'];
const POOL_TYPE_ICONS = [Unlock, Lock, Lock, Lock, Lock];
const STAKE_STATUS = ['Đang stake', 'Đã rút', 'Rút khẩn cấp'];
const STAKE_STATUS_COLORS = ['badge-success', 'badge-neutral', 'badge-error'];

type Tab = 'pools' | 'myStakes' | 'admin';

export default function StakingPage() {
  const { address } = useWeb3();
  const staking = useStakingPool();
  const vndc = useVNDC();
  const { isLoading, execute } = useContractAction();

  // ─── UI State ───
  const [tab, setTab] = useState<Tab>('pools');
  const [loading, setLoading] = useState(true);

  // ─── Data State ───
  const [stats, setStats] = useState<PlatformStats>({
    totalPools: 0, totalStaked: 0n, totalStakers: 0, totalRewardsPaid: 0n, rewardBalance: 0n,
  });
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [myStakes, setMyStakes] = useState<StakeInfo[]>([]);
  const [owner, setOwner] = useState('');
  const [stakingTokenAddr, setStakingTokenAddr] = useState('');

  // ─── Modal State ───
  const [showStakeModal, setShowStakeModal] = useState<PoolInfo | null>(null);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [showDepositRewards, setShowDepositRewards] = useState(false);
  const [showStakeDetail, setShowStakeDetail] = useState<StakeInfo | null>(null);

  // ─── Form State ───
  const [stakeAmount, setStakeAmount] = useState('');
  const [poolForm, setPoolForm] = useState({
    poolType: '0', apyBps: '', minStake: '', maxStake: '', lockDays: '0', maxCapacity: '',
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [updatePoolForm, setUpdatePoolForm] = useState({ poolId: '', newApyBps: '', active: true });

  // ─── Helpers ───
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();
  const formatApy = (bps: number) => `${(bps / 100).toFixed(2)}%`;

  const getPoolById = (poolId: number) => pools.find(p => p.id === poolId);

  const getTimeRemaining = (unlockAt: number) => {
    if (unlockAt === 0) return 'Linh hoạt';
    const now = Math.floor(Date.now() / 1000);
    const diff = unlockAt - now;
    if (diff <= 0) return 'Đã mở khoá';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days} ngày ${hours}h`;
    return `${hours}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  // ─── Load Data ───
  const loadData = useCallback(async () => {
    if (!staking) return;
    setLoading(true);
    try {
      const [statsResult, totalPools, ownerAddr, tokenAddr] = await Promise.all([
        staking.getPlatformStats().catch(() => [0n, 0n, 0n, 0n, 0n]),
        staking.getTotalPools().catch(() => 0n),
        staking.owner().catch(() => ''),
        staking.stakingToken().catch(() => ''),
      ]);

      setStats({
        totalPools: Number(statsResult[0]),
        totalStaked: statsResult[1],
        totalStakers: Number(statsResult[2]),
        totalRewardsPaid: statsResult[3],
        rewardBalance: statsResult[4],
      });
      setOwner(ownerAddr);
      setStakingTokenAddr(tokenAddr);

      // Load all pools
      const total = Number(totalPools);
      const loadedPools: PoolInfo[] = [];
      for (let i = 1; i <= total; i++) {
        try {
          const p = await staking.getPool(i);
          loadedPools.push({
            id: i,
            poolType: Number(p[0]),
            apyBps: Number(p[1]),
            minStake: p[2],
            maxStake: p[3],
            lockDays: Number(p[4]),
            totalStaked: p[5],
            totalStakers: Number(p[6]),
            maxCapacity: p[7],
            active: p[8],
            createdAt: Number(p[9]),
          });
        } catch { /* skip */ }
      }
      setPools(loadedPools);

      // Load user stakes
      if (address) {
        try {
          const stakeIds: bigint[] = await staking.getUserStakes(address);
          const loadedStakes: StakeInfo[] = [];
          for (const sid of stakeIds) {
            try {
              const s = await staking.getStakeInfo(Number(sid));
              loadedStakes.push({
                id: Number(sid),
                staker: s[0],
                poolId: Number(s[1]),
                principal: s[2],
                pendingReward: s[3],
                stakedAt: Number(s[4]),
                unlockAt: Number(s[5]),
                lastClaimAt: Number(s[6]),
                status: Number(s[7]),
              });
            } catch { /* skip */ }
          }
          setMyStakes(loadedStakes);
        } catch { setMyStakes([]); }
      }
    } catch (e) { console.error('Load error', e); }
    setLoading(false);
  }, [staking, address]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Actions ───
  const handleApproveAndStake = (pool: PoolInfo) => execute(async () => {
    if (!staking || !vndc) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    const amount = parseUnits(stakeAmount || '0', 18);

    // Approve staking token transfer
    const stakingAddr = await staking.getAddress();
    const approveTx = await vndc.approve(stakingAddr, amount);
    await approveTx.wait();

    // Stake
    return staking.stake(pool.id, amount);
  }, {
    successMessage: 'Stake thành công!',
    onSuccess: () => { setShowStakeModal(null); setStakeAmount(''); loadData(); },
  });

  const handleUnstake = (stakeId: number) => execute(async () => {
    if (!staking) throw new Error('Contract not available');
    return staking.unstake(stakeId);
  }, { successMessage: 'Đã rút stake!', onSuccess: () => { setShowStakeDetail(null); loadData(); } });

  const handleClaimRewards = (stakeId: number) => execute(async () => {
    if (!staking) throw new Error('Contract not available');
    return staking.claimRewards(stakeId);
  }, { successMessage: 'Đã nhận thưởng!', onSuccess: loadData });

  const handleCompound = (stakeId: number) => execute(async () => {
    if (!staking) throw new Error('Contract not available');
    return staking.compound(stakeId);
  }, { successMessage: 'Đã gộp lãi vào gốc!', onSuccess: loadData });

  const handleEmergencyWithdraw = (stakeId: number) => execute(async () => {
    if (!staking) throw new Error('Contract not available');
    return staking.emergencyWithdraw(stakeId);
  }, { successMessage: 'Đã rút khẩn cấp!', onSuccess: () => { setShowStakeDetail(null); loadData(); } });

  // Admin actions
  const handleCreatePool = () => execute(async () => {
    if (!staking) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    return staking.createPool(
      Number(poolForm.poolType),
      Number(poolForm.apyBps),
      parseUnits(poolForm.minStake || '0', 18),
      parseUnits(poolForm.maxStake || '0', 18),
      Number(poolForm.lockDays),
      parseUnits(poolForm.maxCapacity || '0', 18),
    );
  }, {
    successMessage: 'Đã tạo pool!',
    onSuccess: () => {
      setShowCreatePool(false);
      setPoolForm({ poolType: '0', apyBps: '', minStake: '', maxStake: '', lockDays: '0', maxCapacity: '' });
      loadData();
    },
  });

  const handleDepositRewards = () => execute(async () => {
    if (!staking || !vndc) throw new Error('Contract not available');
    const { parseUnits } = await import('ethers');
    const amount = parseUnits(depositAmount || '0', 18);
    const stakingAddr = await staking.getAddress();
    const approveTx = await vndc.approve(stakingAddr, amount);
    await approveTx.wait();
    return staking.depositRewards(amount);
  }, {
    successMessage: 'Đã nạp quỹ thưởng!',
    onSuccess: () => { setShowDepositRewards(false); setDepositAmount(''); loadData(); },
  });

  const handleUpdatePool = () => execute(async () => {
    if (!staking) throw new Error('Contract not available');
    return staking.updatePool(
      Number(updatePoolForm.poolId),
      Number(updatePoolForm.newApyBps),
      updatePoolForm.active,
    );
  }, { successMessage: 'Đã cập nhật pool!', onSuccess: loadData });

  // ─── Derived ───
  const activePools = pools.filter(p => p.active);
  const activeStakes = myStakes.filter(s => s.status === 0);
  const totalMyStaked = activeStakes.reduce((sum, s) => sum + s.principal, 0n);
  const totalMyPending = activeStakes.reduce((sum, s) => sum + s.pendingReward, 0n);

  const tabs = [
    { key: 'pools' as Tab, label: 'Staking Pools', icon: Landmark, count: activePools.length },
    { key: 'myStakes' as Tab, label: 'Stake của tôi', icon: Wallet, count: myStakes.length },
    ...(isOwner ? [{ key: 'admin' as Tab, label: 'Quản trị', icon: Shield, count: 0 }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-brand-500" />
            Staking Pool
          </h1>
          <p className="text-surface-500 mt-1">Stake token để nhận lãi suất hấp dẫn</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Tổng Pools', value: stats.totalPools.toString(), icon: Landmark, color: 'text-brand-500' },
          { label: 'Tổng Staked', value: `${formatVNDC(stats.totalStaked)} VNDC`, icon: Coins, color: 'text-green-500' },
          { label: 'Tổng Stakers', value: stats.totalStakers.toString(), icon: Users, color: 'text-blue-500' },
          { label: 'Đã trả thưởng', value: `${formatVNDC(stats.totalRewardsPaid)} VNDC`, icon: Gift, color: 'text-purple-500' },
          { label: 'Quỹ thưởng', value: `${formatVNDC(stats.rewardBalance)} VNDC`, icon: Shield, color: 'text-amber-500' },
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

      {/* My Summary (if staking) */}
      {activeStakes.length > 0 && (
        <div className="card p-4 border-brand-200 bg-brand-50/30">
          <div className="flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-xs text-surface-500">Đang stake</p>
              <p className="text-lg font-bold text-brand-600">{formatVNDC(totalMyStaked)} VNDC</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Lãi chờ nhận</p>
              <p className="text-lg font-bold text-green-600">{formatVNDC(totalMyPending)} VNDC</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Stake hoạt động</p>
              <p className="text-lg font-bold text-surface-700">{activeStakes.length}</p>
            </div>
          </div>
        </div>
      )}

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
          {/* ═══ TAB: Pools ═══ */}
          {tab === 'pools' && (
            <div>
              {activePools.length === 0 ? (
                <EmptyState lucideIcon={Landmark} title="Chưa có pool nào" description="Admin chưa tạo staking pool. Quay lại sau nhé!" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activePools.map(pool => {
                    const TypeIcon = POOL_TYPE_ICONS[pool.poolType] || Lock;
                    return (
                      <div key={pool.id} className="card p-5 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                              <TypeIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-surface-800">Pool #{pool.id}</h3>
                              <span className="text-xs text-surface-500">{POOL_TYPE_LABELS[pool.poolType] || 'Unknown'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">{formatApy(pool.apyBps)}</p>
                            <p className="text-xs text-surface-500">APY</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-surface-500 flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> Khoá</span>
                            <span className="font-medium text-surface-700">{pool.lockDays > 0 ? `${pool.lockDays} ngày` : 'Không khoá'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-surface-500 flex items-center gap-1"><ArrowDownToLine className="w-3.5 h-3.5" /> Min</span>
                            <span className="font-medium text-surface-700">{formatVNDC(pool.minStake)} VNDC</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-surface-500 flex items-center gap-1"><ArrowUpFromLine className="w-3.5 h-3.5" /> Max</span>
                            <span className="font-medium text-surface-700">{pool.maxStake > 0n ? `${formatVNDC(pool.maxStake)} VNDC` : 'Không giới hạn'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-surface-500 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Đã stake</span>
                            <span className="font-medium text-surface-700">{formatVNDC(pool.totalStaked)} VNDC</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-surface-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Stakers</span>
                            <span className="font-medium text-surface-700">{pool.totalStakers}</span>
                          </div>
                          {pool.maxCapacity > 0n && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-surface-500">Dung lượng</span>
                                <span className="text-surface-600">
                                  {((Number(pool.totalStaked) / Number(pool.maxCapacity)) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-500 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (Number(pool.totalStaked) / Number(pool.maxCapacity)) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => { setShowStakeModal(pool); setStakeAmount(''); }}
                          disabled={isLoading}
                          className="btn-brand w-full mt-4 flex items-center justify-center gap-2"
                        >
                          <Zap className="w-4 h-4" /> Stake ngay
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: My Stakes ═══ */}
          {tab === 'myStakes' && (
            <div>
              {!address ? (
                <EmptyState lucideIcon={Wallet} title="Chưa kết nối ví" description="Kết nối ví để xem stakes của bạn" />
              ) : myStakes.length === 0 ? (
                <EmptyState lucideIcon={Coins} title="Chưa có stake nào" description="Bạn chưa stake token nào. Hãy chọn pool và bắt đầu!" />
              ) : (
                <div className="space-y-4">
                  {myStakes.map(stake => {
                    const pool = getPoolById(stake.poolId);
                    const isActive = stake.status === 0;
                    const isLocked = stake.unlockAt > 0 && Math.floor(Date.now() / 1000) < stake.unlockAt;
                    return (
                      <div key={stake.id} className="card p-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Left info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-surface-800">Stake #{stake.id}</h3>
                              <span className={`badge ${STAKE_STATUS_COLORS[stake.status]}`}>
                                {STAKE_STATUS[stake.status]}
                              </span>
                              {isLocked && (
                                <span className="badge badge-warning flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Khoá
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-surface-500">Pool</p>
                                <p className="font-medium text-surface-700">
                                  #{stake.poolId} — {pool ? POOL_TYPE_LABELS[pool.poolType] : '?'}
                                  {pool && <span className="text-green-600 ml-1">({formatApy(pool.apyBps)})</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-surface-500">Gốc</p>
                                <p className="font-bold text-surface-800">{formatVNDC(stake.principal)} VNDC</p>
                              </div>
                              <div>
                                <p className="text-surface-500">Lãi chờ</p>
                                <p className="font-bold text-green-600">{formatVNDC(stake.pendingReward)} VNDC</p>
                              </div>
                              <div>
                                <p className="text-surface-500">{stake.unlockAt > 0 ? 'Mở khoá' : 'Linh hoạt'}</p>
                                <p className="font-medium text-surface-700">
                                  {stake.unlockAt > 0 ? getTimeRemaining(stake.unlockAt) : 'Rút bất cứ lúc nào'}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-4 text-xs text-surface-400 mt-2">
                              <span>Stake lúc: {formatDate(stake.stakedAt)}</span>
                              <span>Nhận lãi lúc: {formatDate(stake.lastClaimAt)}</span>
                            </div>
                          </div>

                          {/* Right actions */}
                          {isActive && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleClaimRewards(stake.id)}
                                disabled={isLoading || stake.pendingReward === 0n}
                                className="btn-brand text-sm flex items-center gap-1"
                              >
                                <Gift className="w-3.5 h-3.5" /> Nhận lãi
                              </button>
                              <button
                                onClick={() => handleCompound(stake.id)}
                                disabled={isLoading || stake.pendingReward === 0n}
                                className="btn-ghost text-sm flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Gộp lãi
                              </button>
                              <button
                                onClick={() => setShowStakeDetail(stake)}
                                className="btn-ghost text-sm flex items-center gap-1"
                              >
                                <ArrowUpFromLine className="w-3.5 h-3.5" /> Rút
                              </button>
                            </div>
                          )}
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
              {/* Admin actions */}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setShowCreatePool(true)} className="btn-brand flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tạo Pool mới
                </button>
                <button onClick={() => setShowDepositRewards(true)} className="btn-ghost flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4" /> Nạp quỹ thưởng
                </button>
              </div>

              {/* Pool management table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-surface-200">
                  <h3 className="font-semibold text-surface-800">Quản lý Pools</h3>
                </div>
                {pools.length === 0 ? (
                  <EmptyState lucideIcon={Landmark} title="Chưa có pool" description="Tạo pool staking đầu tiên" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-50">
                        <tr>
                          <th className="text-left p-3 text-surface-500 font-medium">ID</th>
                          <th className="text-left p-3 text-surface-500 font-medium">Loại</th>
                          <th className="text-left p-3 text-surface-500 font-medium">APY</th>
                          <th className="text-left p-3 text-surface-500 font-medium">Min/Max</th>
                          <th className="text-left p-3 text-surface-500 font-medium">Khoá</th>
                          <th className="text-left p-3 text-surface-500 font-medium">Staked</th>
                          <th className="text-left p-3 text-surface-500 font-medium">Stakers</th>
                          <th className="text-left p-3 text-surface-500 font-medium">Trạng thái</th>
                          <th className="text-left p-3 text-surface-500 font-medium">Cập nhật</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pools.map(pool => (
                          <tr key={pool.id} className="border-t border-surface-100 hover:bg-surface-50">
                            <td className="p-3 font-medium">#{pool.id}</td>
                            <td className="p-3">{POOL_TYPE_LABELS[pool.poolType]}</td>
                            <td className="p-3 text-green-600 font-bold">{formatApy(pool.apyBps)}</td>
                            <td className="p-3 text-xs">
                              {formatVNDC(pool.minStake)} / {pool.maxStake > 0n ? formatVNDC(pool.maxStake) : '∞'}
                            </td>
                            <td className="p-3">{pool.lockDays > 0 ? `${pool.lockDays}d` : '—'}</td>
                            <td className="p-3">{formatVNDC(pool.totalStaked)}</td>
                            <td className="p-3">{pool.totalStakers}</td>
                            <td className="p-3">
                              <span className={`badge ${pool.active ? 'badge-success' : 'badge-error'}`}>
                                {pool.active ? 'Hoạt động' : 'Tắt'}
                              </span>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => setUpdatePoolForm({
                                  poolId: pool.id.toString(),
                                  newApyBps: pool.apyBps.toString(),
                                  active: pool.active,
                                })}
                                className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                              >
                                Sửa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Update Pool form (inline) */}
              {updatePoolForm.poolId && (
                <div className="card p-5">
                  <h3 className="font-semibold text-surface-800 mb-3">Cập nhật Pool #{updatePoolForm.poolId}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-600 mb-1">APY mới (basis points)</label>
                      <input
                        type="number" placeholder="1200 = 12%"
                        className="input w-full"
                        value={updatePoolForm.newApyBps}
                        onChange={e => setUpdatePoolForm(f => ({ ...f, newApyBps: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox" checked={updatePoolForm.active}
                          onChange={e => setUpdatePoolForm(f => ({ ...f, active: e.target.checked }))}
                          className="w-4 h-4 rounded border-surface-300"
                        />
                        Hoạt động
                      </label>
                    </div>
                    <div className="flex items-end gap-2">
                      <button onClick={handleUpdatePool} disabled={isLoading} className="btn-brand flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Lưu
                      </button>
                      <button onClick={() => setUpdatePoolForm({ poolId: '', newApyBps: '', active: true })} className="btn-ghost">
                        Huỷ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="card p-4 text-sm text-surface-500 space-y-1">
                <p><strong>Staking Token:</strong> {stakingTokenAddr ? shortenAddress(stakingTokenAddr) : '—'}</p>
                <p><strong>Contract Owner:</strong> {owner ? shortenAddress(owner) : '—'}</p>
                <p><strong>Quỹ thưởng hiện tại:</strong> {formatVNDC(stats.rewardBalance)} VNDC</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Stake Modal */}
      <Modal
        open={!!showStakeModal}
        onClose={() => setShowStakeModal(null)}
        title={`Stake vào Pool #${showStakeModal?.id ?? ''}`}
        description={showStakeModal ? `${POOL_TYPE_LABELS[showStakeModal.poolType]} — APY ${formatApy(showStakeModal.apyBps)}` : ''}
      >
        {showStakeModal && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-surface-50 rounded-lg p-3">
                <p className="text-surface-500">Min stake</p>
                <p className="font-bold">{formatVNDC(showStakeModal.minStake)} VNDC</p>
              </div>
              <div className="bg-surface-50 rounded-lg p-3">
                <p className="text-surface-500">Max stake</p>
                <p className="font-bold">{showStakeModal.maxStake > 0n ? `${formatVNDC(showStakeModal.maxStake)} VNDC` : 'Không giới hạn'}</p>
              </div>
              <div className="bg-surface-50 rounded-lg p-3">
                <p className="text-surface-500">Thời gian khoá</p>
                <p className="font-bold">{showStakeModal.lockDays > 0 ? `${showStakeModal.lockDays} ngày` : 'Không khoá'}</p>
              </div>
              <div className="bg-surface-50 rounded-lg p-3">
                <p className="text-surface-500">APY</p>
                <p className="font-bold text-green-600">{formatApy(showStakeModal.apyBps)}</p>
              </div>
            </div>

            {showStakeModal.lockDays > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Rút sớm sẽ bị phạt. Token sẽ khoá trong {showStakeModal.lockDays} ngày.</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Số lượng stake (VNDC)</label>
              <input
                type="number" placeholder="Nhập số lượng..."
                className="input w-full"
                value={stakeAmount}
                onChange={e => setStakeAmount(e.target.value)}
              />
              {stakeAmount && (
                <p className="text-xs text-surface-400 mt-1">
                  Lãi ước tính / năm: ~{formatVNDC(BigInt(Math.floor(parseFloat(stakeAmount || '0') * showStakeModal.apyBps / 10000 * 1e18)))} VNDC
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleApproveAndStake(showStakeModal)}
                disabled={isLoading || !stakeAmount}
                className="btn-brand flex-1 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Approve &amp; Stake
              </button>
              <button onClick={() => setShowStakeModal(null)} className="btn-ghost">Huỷ</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Pool Modal */}
      <Modal open={showCreatePool} onClose={() => setShowCreatePool(false)} title="Tạo Staking Pool" description="Cấu hình pool mới cho người dùng stake">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Loại pool</label>
            <select className="input w-full" value={poolForm.poolType} onChange={e => setPoolForm(f => ({ ...f, poolType: e.target.value }))}>
              {POOL_TYPE_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">APY (basis points)</label>
              <input type="number" placeholder="1200 = 12%" className="input w-full" value={poolForm.apyBps} onChange={e => setPoolForm(f => ({ ...f, apyBps: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Ngày khoá</label>
              <input type="number" placeholder="0 = linh hoạt" className="input w-full" value={poolForm.lockDays} onChange={e => setPoolForm(f => ({ ...f, lockDays: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Min stake (VNDC)</label>
              <input type="number" placeholder="100" className="input w-full" value={poolForm.minStake} onChange={e => setPoolForm(f => ({ ...f, minStake: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Max stake (VNDC)</label>
              <input type="number" placeholder="0 = không giới hạn" className="input w-full" value={poolForm.maxStake} onChange={e => setPoolForm(f => ({ ...f, maxStake: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Dung lượng tối đa (VNDC)</label>
            <input type="number" placeholder="0 = không giới hạn" className="input w-full" value={poolForm.maxCapacity} onChange={e => setPoolForm(f => ({ ...f, maxCapacity: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleCreatePool} disabled={isLoading || !poolForm.apyBps || !poolForm.minStake} className="btn-brand flex-1 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Tạo Pool
            </button>
            <button onClick={() => setShowCreatePool(false)} className="btn-ghost">Huỷ</button>
          </div>
        </div>
      </Modal>

      {/* Deposit Rewards Modal */}
      <Modal open={showDepositRewards} onClose={() => setShowDepositRewards(false)} title="Nạp quỹ thưởng" description="Nạp VNDC vào quỹ thưởng để trả lãi cho stakers">
        <div className="p-5 space-y-4">
          <div className="bg-surface-50 rounded-lg p-3 text-sm">
            <p className="text-surface-500">Quỹ thưởng hiện tại</p>
            <p className="font-bold text-lg">{formatVNDC(stats.rewardBalance)} VNDC</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 mb-1">Số lượng nạp (VNDC)</label>
            <input
              type="number" placeholder="Nhập số lượng..."
              className="input w-full"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleDepositRewards} disabled={isLoading || !depositAmount} className="btn-brand flex-1 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              Approve &amp; Nạp
            </button>
            <button onClick={() => setShowDepositRewards(false)} className="btn-ghost">Huỷ</button>
          </div>
        </div>
      </Modal>

      {/* Stake Detail / Unstake Modal */}
      <Modal
        open={!!showStakeDetail}
        onClose={() => setShowStakeDetail(null)}
        title={`Stake #${showStakeDetail?.id ?? ''}`}
      >
        {showStakeDetail && (() => {
          const pool = getPoolById(showStakeDetail.poolId);
          const isLocked = showStakeDetail.unlockAt > 0 && Math.floor(Date.now() / 1000) < showStakeDetail.unlockAt;
          return (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-surface-500">Gốc</p>
                  <p className="font-bold">{formatVNDC(showStakeDetail.principal)} VNDC</p>
                </div>
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-surface-500">Lãi chờ</p>
                  <p className="font-bold text-green-600">{formatVNDC(showStakeDetail.pendingReward)} VNDC</p>
                </div>
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-surface-500">Pool</p>
                  <p className="font-bold">#{showStakeDetail.poolId} — {pool ? POOL_TYPE_LABELS[pool.poolType] : '?'}</p>
                </div>
                <div className="bg-surface-50 rounded-lg p-3">
                  <p className="text-surface-500">Trạng thái khoá</p>
                  <p className="font-bold">{isLocked ? getTimeRemaining(showStakeDetail.unlockAt) : 'Đã mở khoá'}</p>
                </div>
              </div>

              {isLocked && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Token đang bị khoá. Rút sớm sẽ mất phí phạt và không nhận lãi.</span>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => handleUnstake(showStakeDetail.id)}
                  disabled={isLoading}
                  className={`${isLocked ? 'btn-ghost border-amber-300 text-amber-700 hover:bg-amber-50' : 'btn-brand'} w-full flex items-center justify-center gap-2`}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
                  {isLocked ? 'Rút sớm (có phạt)' : 'Rút stake'}
                </button>
                <button
                  onClick={() => handleEmergencyWithdraw(showStakeDetail.id)}
                  disabled={isLoading}
                  className="btn-ghost w-full flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <AlertTriangle className="w-4 h-4" /> Rút khẩn cấp (mất phí + không lãi)
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Coins, Send, Flame, Plus, Shield, Pause, Play,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useWeb3 } from '@/contexts/Web3Context';
import { useVNDC } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, shortenAddress } from '@/lib/utils';
import { parseUnits } from 'ethers';

export default function TokenPage() {
  const { address, isConnected } = useWeb3();
  const vndc = useVNDC();
  const { isLoading, execute } = useContractAction();

  const [tokenInfo, setTokenInfo] = useState({
    name: 'VNDC', symbol: 'VNDC', decimals: 18,
    totalSupply: '0', balance: '0', isPaused: false,
  });
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [showMint, setShowMint] = useState(false);
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');

  useEffect(() => {
    async function load() {
      if (!vndc) return;
      try {
        const [info, supply, paused] = await Promise.all([
          vndc.getTokenInfo(),
          vndc.totalSupply(),
          vndc.isPaused(),
        ]);
        const bal = address ? await vndc.balanceOf(address) : 0n;
        setTokenInfo({
          name: info[0], symbol: info[1], decimals: Number(info[2]),
          totalSupply: formatVNDC(supply), balance: formatVNDC(bal),
          isPaused: paused,
        });
      } catch {}
    }
    load();
  }, [vndc, address]);

  const handleTransfer = () => execute(
    async () => {
      if (!vndc) throw new Error('Contract not available');
      return vndc.transfer(transferTo, parseUnits(transferAmount, 18));
    },
    { successMessage: `Đã chuyển ${transferAmount} VNDC`, onSuccess: () => { setTransferTo(''); setTransferAmount(''); } }
  );

  const handleMint = () => execute(
    async () => {
      if (!vndc) throw new Error('Contract not available');
      return vndc.mint(mintTo || address, parseUnits(mintAmount, 18));
    },
    { successMessage: `Đã mint ${mintAmount} VNDC`, onSuccess: () => setShowMint(false) }
  );

  const handleBurn = () => execute(
    async () => {
      if (!vndc) throw new Error('Contract not available');
      return vndc.burn(parseUnits(burnAmount, 18));
    },
    { successMessage: `Đã burn ${burnAmount} VNDC`, onSuccess: () => setBurnAmount('') }
  );

  return (
    <div className="space-y-6">
      {/* Balance Hero */}
      <div className="card p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Coins size={18} className="text-brand-600" />
            </div>
            <h1 className="text-lg font-bold text-surface-800">VNDC Token</h1>
            <span className="badge badge-brand text-[10px]">ERC-20</span>
            {tokenInfo.isPaused && <span className="badge badge-danger text-[10px]"><Pause size={10} /> Paused</span>}
          </div>
          <p className="text-3xl font-bold text-surface-800">{tokenInfo.balance} <span className="text-lg text-surface-400">VNDC</span></p>
          {address && <p className="text-xs font-mono text-surface-400 mt-1">{shortenAddress(address, 8)}</p>}
        </div>
        <div className="flex divide-x divide-surface-200 border-t border-surface-200 text-center">
          <div className="flex-1 py-3">
            <p className="text-[11px] text-surface-400">Tổng cung</p>
            <p className="text-sm font-semibold text-surface-700">{tokenInfo.totalSupply}</p>
          </div>
          <div className="flex-1 py-3">
            <p className="text-[11px] text-surface-400">Decimals</p>
            <p className="text-sm font-semibold text-surface-700">{tokenInfo.decimals}</p>
          </div>
          <div className="flex-1 py-3">
            <p className="text-[11px] text-surface-400">Trạng thái</p>
            <p className="text-sm font-semibold text-surface-700 flex items-center justify-center gap-1">
              {tokenInfo.isPaused
                ? <><Pause size={12} className="text-danger-600" /> Dừng</>
                : <><Play size={12} className="text-success-600" /> Hoạt động</>
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Form */}
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Send size={15} className="text-brand-600" /> Chuyển VNDC
          </h3>
          <div className="space-y-3">
            <div>
              <label className="label">Địa chỉ nhận</label>
              <input className="input" placeholder="0x..." value={transferTo} onChange={e => setTransferTo(e.target.value)} />
            </div>
            <div>
              <label className="label">Số lượng</label>
              <input className="input" type="number" placeholder="0.00" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
              <p className="text-xs text-surface-400 mt-1">Khả dụng: {tokenInfo.balance} VNDC</p>
            </div>
            <button className="btn-primary w-full" onClick={handleTransfer} disabled={isLoading || !transferTo || !transferAmount}>
              <Send size={15} /> {isLoading ? 'Đang xử lý...' : 'Chuyển Token'}
            </button>
          </div>
        </div>

        {/* Token Info */}
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-4">Thông tin</h3>
          <div className="space-y-2">
            {[
              { label: 'Tên', value: tokenInfo.name },
              { label: 'Ký hiệu', value: tokenInfo.symbol },
              { label: 'Chuẩn', value: 'ERC-20 + Permit' },
              { label: 'Tính năng', value: 'Mint, Burn, Pause' },
            ].map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-surface-200 last:border-0">
                <span className="text-sm text-surface-500">{r.label}</span>
                <span className="text-sm font-medium text-surface-800">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin Section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-badge"><Shield size={10} /> Admin Only</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-surface-800 mb-3">Mint Token</h4>
            <div className="space-y-2">
              <input className="input" placeholder="Địa chỉ nhận (trống = ví bạn)" value={mintTo} onChange={e => setMintTo(e.target.value)} />
              <input className="input" type="number" placeholder="Số lượng" value={mintAmount} onChange={e => setMintAmount(e.target.value)} />
              <button className="btn-primary btn-sm w-full" onClick={handleMint} disabled={isLoading || !mintAmount}>
                <Plus size={14} /> Mint
              </button>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-surface-800 mb-3">Burn Token</h4>
            <div className="space-y-2">
              <input className="input" type="number" placeholder="Số lượng burn" value={burnAmount} onChange={e => setBurnAmount(e.target.value)} />
              <button className="btn-danger btn-sm w-full" onClick={handleBurn} disabled={isLoading || !burnAmount}>
                <Flame size={14} /> Burn
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
  

import { useState, useEffect } from 'react';
import {
  Coins, Send, ArrowDownToLine, Flame, Copy, ExternalLink,
  Plus, Shield, Pause, Play, Users, TrendingUp,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import DataTable from '@/components/ui/DataTable';
import { useWeb3 } from '@/contexts/Web3Context';
import { useVNDC } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { formatVNDC, shortenAddress, copyToClipboard } from '@/lib/utils';
import toast from 'react-hot-toast';
import { parseUnits } from 'ethers';

export default function TokenPage() {
  const { address, isConnected } = useWeb3();
  const vndc = useVNDC();
  const { isLoading, execute } = useContractAction();

  const [tokenInfo, setTokenInfo] = useState({
    name: 'VNDC', symbol: 'VNDC', decimals: 18,
    totalSupply: '0', balance: '0', isPaused: false,
  });
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMint, setShowMint] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');

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
      } catch {
        // Contracts not deployed
      }
    }
    load();
  }, [vndc, address]);

  const handleTransfer = () => execute(
    async () => {
      if (!vndc) throw new Error('Contract not available');
      const amount = parseUnits(transferAmount, 18);
      return vndc.transfer(transferTo, amount);
    },
    { successMessage: `Đã chuyển ${transferAmount} VNDC`, onSuccess: () => setShowTransfer(false) }
  );

  const handleMint = () => execute(
    async () => {
      if (!vndc) throw new Error('Contract not available');
      const amount = parseUnits(mintAmount, 18);
      return vndc.mint(mintTo || address, amount);
    },
    { successMessage: `Đã mint ${mintAmount} VNDC`, onSuccess: () => setShowMint(false) }
  );

  const handleBurn = (amount: string) => execute(
    async () => {
      if (!vndc) throw new Error('Contract not available');
      return vndc.burn(parseUnits(amount, 18));
    },
    { successMessage: `Đã burn ${amount} VNDC` }
  );

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: <Coins size={14} /> },
    { id: 'transfer', label: 'Chuyển token', icon: <Send size={14} /> },
    { id: 'admin', label: 'Quản trị', icon: <Shield size={14} /> },
  ];

  return (
    <div>
      <PageHeader
        title="VNDC Token"
        description="ERC-20 Token với Permit (EIP-2612) — Đồng tiền kỹ thuật số cho campus"
        lucideIcon={Coins}
        badge="ERC-20"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setShowTransfer(true)}>
              <Send size={14} /> Chuyển
            </button>
            <button className="btn-primary btn-sm" onClick={() => setShowMint(true)}>
              <Plus size={14} /> Mint
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng cung" value={tokenInfo.totalSupply} icon={<Coins className="w-5 h-5" />} color="brand" />
        <StatCard label="Số dư của bạn" value={tokenInfo.balance} icon={<ArrowDownToLine className="w-5 h-5" />} color="success" />
        <StatCard label="Trạng thái" value={tokenInfo.isPaused ? 'Tạm dừng' : 'Hoạt động'} icon={tokenInfo.isPaused ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />} color={tokenInfo.isPaused ? 'danger' : 'success'} />
        <StatCard label="Decimals" value={tokenInfo.decimals} icon={<TrendingUp className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={tabs}>
        {(active) => (
          <>
            {active === 'overview' && (
              <div className="space-y-6">
                {/* Token Info Card */}
                <div className="card">
                  <h3 className="text-base font-semibold text-white mb-4">Thông tin Token</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Tên', value: tokenInfo.name },
                      { label: 'Ký hiệu', value: tokenInfo.symbol },
                      { label: 'Chuẩn', value: 'ERC-20 + ERC-20Permit' },
                      { label: 'Decimals', value: tokenInfo.decimals.toString() },
                      { label: 'Tổng cung', value: `${tokenInfo.totalSupply} ${tokenInfo.symbol}` },
                      { label: 'Tính năng', value: 'Mint, Burn, Pause, Permit' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between p-3 rounded-xl bg-surface-800/30">
                        <span className="text-sm text-surface-400">{label}</span>
                        <span className="text-sm font-medium text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contract Functions */}
                <div className="card">
                  <h3 className="text-base font-semibold text-white mb-4">Các hàm Smart Contract</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { name: 'transfer()', desc: 'Chuyển token cho người khác', icon: Send },
                      { name: 'approve()', desc: 'Cho phép chi tiêu token', icon: Shield },
                      { name: 'mint()', desc: 'Tạo token mới (Minter)', icon: Plus },
                      { name: 'burn()', desc: 'Đốt token', icon: Flame },
                      { name: 'permit()', desc: 'Gasless approval (EIP-2612)', icon: ExternalLink },
                      { name: 'pause()', desc: 'Tạm dừng giao dịch (Admin)', icon: Pause },
                    ].map(({ name, desc, icon: Icon }) => (
                      <div key={name} className="p-3 rounded-xl bg-surface-800/30 border border-surface-700/30 hover:border-brand-500/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className="text-brand-400" />
                          <code className="text-sm font-mono text-brand-300">{name}</code>
                        </div>
                        <p className="text-xs text-surface-500">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {active === 'transfer' && (
              <div className="card max-w-xl">
                <h3 className="text-base font-semibold text-white mb-4">Chuyển VNDC Token</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Địa chỉ nhận</label>
                    <input className="input" placeholder="0x..." value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Số lượng</label>
                    <input className="input" type="number" placeholder="0.00" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                    <p className="text-xs text-surface-500 mt-1">Số dư: {tokenInfo.balance} VNDC</p>
                  </div>
                  <button className="btn-primary w-full" onClick={handleTransfer} disabled={isLoading || !transferTo || !transferAmount}>
                    <Send size={16} /> {isLoading ? 'Đang xử lý...' : 'Chuyển Token'}
                  </button>
                </div>
              </div>
            )}

            {active === 'admin' && (
              <div className="space-y-6">
                <div className="card max-w-xl">
                  <h3 className="text-base font-semibold text-white mb-4">Mint Token</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Địa chỉ nhận</label>
                      <input className="input" placeholder="0x... (để trống = ví hiện tại)" value={mintTo} onChange={(e) => setMintTo(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Số lượng</label>
                      <input className="input" type="number" placeholder="1000" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
                    </div>
                    <button className="btn-primary w-full" onClick={handleMint} disabled={isLoading || !mintAmount}>
                      <Plus size={16} /> {isLoading ? 'Đang mint...' : 'Mint Token'}
                    </button>
                  </div>
                </div>

                <div className="card max-w-xl">
                  <h3 className="text-base font-semibold text-white mb-4">Burn Token</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Số lượng burn</label>
                      <input className="input" type="number" placeholder="100" id="burnAmount" />
                    </div>
                    <button className="btn-danger w-full" onClick={() => {
                      const val = (document.getElementById('burnAmount') as HTMLInputElement)?.value;
                      if (val) handleBurn(val);
                    }} disabled={isLoading}>
                      <Flame size={16} /> {isLoading ? 'Đang burn...' : 'Burn Token'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Tabs>

      {/* Transfer Modal */}
      <Modal open={showTransfer} onClose={() => setShowTransfer(false)} title="Chuyển VNDC"
        footer={
          <button className="btn-primary" onClick={handleTransfer} disabled={isLoading || !transferTo || !transferAmount}>
            <Send size={14} /> Xác nhận chuyển
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Địa chỉ nhận</label>
            <input className="input" placeholder="0x..." value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Số lượng VNDC</label>
            <input className="input" type="number" placeholder="0.00" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Mint Modal */}
      <Modal open={showMint} onClose={() => setShowMint(false)} title="Mint VNDC Token"
        description="Chỉ tài khoản có quyền Minter mới có thể thực hiện"
        footer={
          <button className="btn-primary" onClick={handleMint} disabled={isLoading || !mintAmount}>
            <Plus size={14} /> Mint
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Địa chỉ nhận (để trống = ví bạn)</label>
            <input className="input" placeholder="0x..." value={mintTo} onChange={(e) => setMintTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Số lượng</label>
            <input className="input" type="number" placeholder="1000" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { CreditCard, Send, Store, RefreshCcw, Receipt, Plus, DollarSign, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import DataTable from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { usePaymentProcessor, useMerchantRegistry } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, formatDate, formatVNDC } from '@/lib/utils';
import { parseUnits } from 'ethers';

export default function PaymentsPage() {
  const { address } = useWeb3();
  const payment = usePaymentProcessor();
  const merchant = useMerchantRegistry();
  const { isLoading, execute } = useContractAction();

  const [totalPayments, setTotalPayments] = useState(0);
  const [showPay, setShowPay] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [payForm, setPayForm] = useState({ merchant: '', amount: '', method: 'VNDC' });
  const [refundForm, setRefundForm] = useState({ paymentId: '', reason: '' });

  useEffect(() => {
    async function load() {
      if (!payment) return;
      try {
        const total = await payment.getTotalPaymentCount();
        setTotalPayments(Number(total));
      } catch {}
    }
    load();
  }, [payment]);

  const handlePayment = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      const amount = parseUnits(payForm.amount, 18);
      return payment.processPayment(payForm.merchant, amount, payForm.method);
    },
    { successMessage: 'Thanh toán thành công!', onSuccess: () => setShowPay(false) }
  );

  const handleRefund = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.refundPayment(refundForm.paymentId, refundForm.reason);
    },
    { successMessage: 'Hoàn tiền thành công!', onSuccess: () => setShowRefund(false) }
  );

  return (
    <div>
      <PageHeader title="Thanh toán" description="Xử lý thanh toán, hoàn tiền, quản lý phương thức thanh toán" lucideIcon={CreditCard} badge="Payment"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setShowRefund(true)}><RefreshCcw size={14} /> Hoàn tiền</button>
            <button className="btn-primary btn-sm" onClick={() => setShowPay(true)}><Send size={14} /> Thanh toán</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng giao dịch" value={totalPayments} icon={<Receipt className="w-5 h-5" />} color="brand" />
        <StatCard label="Doanh thu" value="0 VNDC" icon={<DollarSign className="w-5 h-5" />} color="success" />
        <StatCard label="Phương thức" value="3" icon={<CreditCard className="w-5 h-5" />} color="info" subtitle="VNDC, ETH, USDC" />
        <StatCard label="Merchants" value="0" icon={<Store className="w-5 h-5" />} color="warning" />
      </div>

      <Tabs tabs={[
        { id: 'transactions', label: 'Giao dịch', icon: <Receipt size={14} /> },
        { id: 'merchants', label: 'Merchants', icon: <Store size={14} /> },
        { id: 'methods', label: 'Phương thức', icon: <CreditCard size={14} /> },
      ]}>
        {(active) => active === 'transactions' ? (
          <EmptyState lucideIcon={Receipt} title="Chưa có giao dịch"
            description="Thực hiện thanh toán đầu tiên để xem lịch sử giao dịch"
            action={<button className="btn-primary btn-sm" onClick={() => setShowPay(true)}><Send size={14} /> Thanh toán ngay</button>} />
        ) : active === 'merchants' ? (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Đăng ký Merchant</h3>
            <p className="text-sm text-surface-400 mb-4">Merchants có thể nhận thanh toán VNDC từ sinh viên</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Căn-tin', 'Thư viện', 'Ký túc xá'].map(cat => (
                <div key={cat} className="p-4 rounded-xl bg-surface-800/30 border border-surface-700/30 text-center">
                  <Store size={24} className="text-brand-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-white">{cat}</p>
                  <p className="text-xs text-surface-500">Danh mục</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'VNDC', desc: 'ERC-20 Token', active: true, color: 'from-indigo-500 to-violet-500' },
              { name: 'ETH', desc: 'Native currency', active: true, color: 'from-sky-500 to-blue-500' },
              { name: 'USDC', desc: 'Stablecoin', active: false, color: 'from-emerald-500 to-teal-500' },
            ].map(m => (
              <div key={m.name} className="card card-hover">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mb-3 shadow-lg`}>
                  <DollarSign size={18} className="text-white" />
                </div>
                <h4 className="text-sm font-semibold text-white">{m.name}</h4>
                <p className="text-xs text-surface-400 mb-3">{m.desc}</p>
                <span className={`badge ${m.active ? 'badge-success' : 'badge-neutral'}`}>{m.active ? 'Hỗ trợ' : 'Sắp có'}</span>
              </div>
            ))}
          </div>
        )}
      </Tabs>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="Thanh toán" description="Gửi thanh toán đến merchant"
        footer={<button className="btn-primary" onClick={handlePayment} disabled={isLoading}>{isLoading ? 'Đang thanh toán...' : 'Thanh toán'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Địa chỉ Merchant</label><input className="input" placeholder="0x..." value={payForm.merchant} onChange={e => setPayForm(f => ({ ...f, merchant: e.target.value }))} /></div>
          <div><label className="label">Số tiền (VNDC)</label><input className="input" type="number" placeholder="100" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div><label className="label">Phương thức</label>
            <select className="select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
              <option>VNDC</option><option>ETH</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal open={showRefund} onClose={() => setShowRefund(false)} title="Hoàn tiền"
        footer={<button className="btn-danger" onClick={handleRefund} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Hoàn tiền'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Payment ID</label><input className="input" type="number" placeholder="1" value={refundForm.paymentId} onChange={e => setRefundForm(f => ({ ...f, paymentId: e.target.value }))} /></div>
          <div><label className="label">Lý do</label><textarea className="textarea" placeholder="Lý do hoàn tiền..." value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

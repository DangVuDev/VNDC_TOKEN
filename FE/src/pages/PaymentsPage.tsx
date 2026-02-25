import { useState, useEffect } from 'react';
import { Send, Store, RefreshCcw, Receipt } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { usePaymentProcessor, useMerchantRegistry } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { parseUnits } from 'ethers';

export default function PaymentsPage() {
  const { address } = useWeb3();
  const payment = usePaymentProcessor();
  const merchant = useMerchantRegistry();
  const { isLoading, execute } = useContractAction();

  const [totalPayments, setTotalPayments] = useState(0);
  const [showRefund, setShowRefund] = useState(false);
  const [payForm, setPayForm] = useState({ merchant: '', amount: '', method: 'VNDC' });
  const [refundForm, setRefundForm] = useState({ paymentId: '', reason: '' });

  useEffect(() => {
    async function load() {
      if (!payment) return;
      try { setTotalPayments(Number(await payment.getTotalPaymentCount())); } catch {}
    }
    load();
  }, [payment]);

  const handlePayment = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.processPayment(payForm.merchant, parseUnits(payForm.amount, 18), payForm.method);
    },
    { successMessage: 'Thanh toán thành công!', onSuccess: () => setPayForm({ merchant: '', amount: '', method: 'VNDC' }) }
  );

  const handleRefund = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.refundPayment(refundForm.paymentId, refundForm.reason);
    },
    { successMessage: 'Hoàn tiền thành công!', onSuccess: () => setShowRefund(false) }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Send size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Thanh toán</h1>
            <p className="text-sm text-surface-500">{totalPayments} giao dịch</p>
          </div>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => setShowRefund(true)}>
          <RefreshCcw size={14} /> Hoàn tiền
        </button>
      </div>

      {/* Pay form + history split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Payment form */}
        <div className="lg:col-span-2 card">
          <h2 className="text-base font-semibold text-surface-800 mb-4">Thanh toán mới</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Merchant</label>
              <input className="input" placeholder="0x..." value={payForm.merchant} onChange={e => setPayForm(f => ({ ...f, merchant: e.target.value }))} />
            </div>
            <div>
              <label className="label">Số tiền</label>
              <input className="input" type="number" placeholder="100" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phương thức</label>
              <select className="select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                <option>VNDC</option><option>ETH</option>
              </select>
            </div>
            <button className="btn-primary w-full" onClick={handlePayment} disabled={isLoading || !payForm.merchant || !payForm.amount}>
              {isLoading ? 'Đang xử lý...' : 'Thanh toán'}
            </button>
          </div>
        </div>

        {/* Transaction history */}
        <div className="lg:col-span-3">
          <EmptyState lucideIcon={Receipt} title="Chưa có giao dịch"
            description="Thực hiện thanh toán đầu tiên" />
        </div>
      </div>

      {/* Merchant categories */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 mb-3">Danh mục Merchant</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['Căn-tin', 'Thư viện', 'Ký túc xá', 'Phòng thí nghiệm'].map(cat => (
            <div key={cat} className="card text-center py-5">
              <Store size={22} className="text-brand-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-surface-800">{cat}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Refund Modal */}
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

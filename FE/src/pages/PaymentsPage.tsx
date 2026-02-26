import { useState, useEffect, useCallback } from 'react';
import { Send, Store, RefreshCcw, Receipt, Plus, Link, Unlink, Eye, Loader2, Settings } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { usePaymentProcessor, useMerchantRegistry } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { parseUnits, formatUnits } from 'ethers';
import { shortenAddress, formatDate, formatVNDC } from '@/lib/utils';

interface Payment {
  paymentId: number;
  student: string;
  merchant: string;
  amount: bigint;
  paymentMethod: string;
  timestamp: number;
  isRefunded: boolean;
  refundAmount: bigint;
  refundReason: string;
  refundTimestamp: number;
}

interface MerchantInfo {
  merchantAddress: string;
  name: string;
  category: string;
  contactEmail: string;
  contactPhone: string;
  isApproved: boolean;
  isActive: boolean;
  commissionRate: number;
  totalTransactions: number;
  totalRevenue: bigint;
  registrationDate: number;
  approvalDate: number;
}

export default function PaymentsPage() {
  const { address } = useWeb3();
  const payment = usePaymentProcessor();
  const merchant = useMerchantRegistry();
  const { isLoading, execute } = useContractAction();

  const [loading, setLoading] = useState(true);
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalMerchants, setTotalMerchants] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [myPayments, setMyPayments] = useState<Payment[]>([]);
  const [myTotalSpent, setMyTotalSpent] = useState(0n);

  const [showRefund, setShowRefund] = useState(false);
  const [showDetail, setShowDetail] = useState<Payment | null>(null);
  const [showLinkWallet, setShowLinkWallet] = useState(false);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [showRegisterMerchant, setShowRegisterMerchant] = useState(false);
  const [showMerchantDetail, setShowMerchantDetail] = useState<MerchantInfo | null>(null);
  const [merchantLookup, setMerchantLookup] = useState('');

  const [payForm, setPayForm] = useState({ merchant: '', amount: '', method: 'VNDC' });
  const [refundForm, setRefundForm] = useState({ paymentId: '', reason: '' });
  const [linkForm, setLinkForm] = useState({ method: '', walletId: '' });
  const [methodForm, setMethodForm] = useState({ name: '', tokenAddress: '', minAmount: '', maxAmount: '' });
  const [merchantForm, setMerchantForm] = useState({ name: '', category: '', email: '', phone: '' });

  const parsePayment = (p: any): Payment => ({
    paymentId: Number(p[0] || p.paymentId || 0),
    student: p[1] || p.student || '',
    merchant: p[2] || p.merchant || '',
    amount: BigInt(p[3] || p.amount || 0),
    paymentMethod: p[4] || p.paymentMethod || '',
    timestamp: Number(p[5] || p.timestamp || 0),
    isRefunded: p[6] ?? p.isRefunded ?? false,
    refundAmount: BigInt(p[7] || p.refundAmount || 0),
    refundReason: p[8] || p.refundReason || '',
    refundTimestamp: Number(p[9] || p.refundTimestamp || 0),
  });

  const loadData = useCallback(async () => {
    if (!payment) return;
    setLoading(true);
    try {
      const total = await payment.getTotalPaymentCount().catch(() => 0n);
      setTotalPayments(Number(total));

      if (address) {
        try {
          const payments = await payment.getStudentPayments(address);
          const list = payments.map(parsePayment);
          setMyPayments(list);
          const totalSpent = list.reduce((acc: bigint, p: Payment) => acc + (p.isRefunded ? 0n : p.amount), 0n);
          setMyTotalSpent(totalSpent);
        } catch { setMyPayments([]); }
      }

      if (merchant) {
        try {
          const [tm, ta] = await Promise.all([
            merchant.getTotalMerchants().catch(() => 0n),
            merchant.getTotalApprovedMerchants().catch(() => 0n),
          ]);
          setTotalMerchants(Number(tm));
          setTotalApproved(Number(ta));
        } catch {}
      }
    } catch {}
    setLoading(false);
  }, [payment, merchant, address]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePayment = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.processPayment(payForm.merchant, parseUnits(payForm.amount, 18), payForm.method);
    },
    { successMessage: 'Thanh toán thành công!', onSuccess: () => { setPayForm({ merchant: '', amount: '', method: 'VNDC' }); loadData(); } }
  );

  const handleRefund = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.refundPayment(refundForm.paymentId, refundForm.reason);
    },
    { successMessage: 'Hoàn tiền thành công!', onSuccess: () => { setShowRefund(false); loadData(); } }
  );

  const handleLinkWallet = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.linkWallet(linkForm.method, linkForm.walletId);
    },
    { successMessage: 'Đã liên kết ví!', onSuccess: () => setShowLinkWallet(false) }
  );

  const handleUnlinkWallet = (method: string) => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.unlinkWallet(method);
    },
    { successMessage: 'Đã hủy liên kết ví!' }
  );

  const handleAddMethod = () => execute(
    async () => {
      if (!payment) throw new Error('Contract not available');
      return payment.addPaymentMethod(methodForm.name, methodForm.tokenAddress, parseUnits(methodForm.minAmount, 18), parseUnits(methodForm.maxAmount, 18));
    },
    { successMessage: 'Đã thêm phương thức thanh toán!', onSuccess: () => setShowAddMethod(false) }
  );

  const handleRegisterMerchant = () => execute(
    async () => {
      if (!merchant) throw new Error('Contract not available');
      return merchant.registerMerchant(merchantForm.name, merchantForm.category, merchantForm.email, merchantForm.phone);
    },
    { successMessage: 'Đã đăng ký merchant!', onSuccess: () => { setShowRegisterMerchant(false); loadData(); } }
  );

  const handleLookupMerchant = async () => {
    if (!merchant || !merchantLookup) return;
    try {
      const m = await merchant.getMerchant(merchantLookup);
      setShowMerchantDetail({
        merchantAddress: m[0] || merchantLookup,
        name: m[1] || '',
        category: m[2] || '',
        contactEmail: m[3] || '',
        contactPhone: m[4] || '',
        isApproved: m[5] ?? false,
        isActive: m[6] ?? false,
        commissionRate: Number(m[7] || 0),
        totalTransactions: Number(m[8] || 0),
        totalRevenue: BigInt(m[9] || 0),
        registrationDate: Number(m[10] || 0),
        approvalDate: Number(m[11] || 0),
      });
    } catch { alert('Không tìm thấy merchant'); }
  };

  const handleApproveMerchant = (addr: string) => execute(
    async () => {
      if (!merchant) throw new Error('Contract not available');
      return merchant.approveMerchant(addr);
    },
    { successMessage: 'Đã phê duyệt merchant!', onSuccess: () => { setShowMerchantDetail(null); loadData(); } }
  );

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;

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
            <p className="text-sm text-surface-500">{totalPayments} giao dịch · {totalApproved}/{totalMerchants} merchants</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowAddMethod(true)}><Settings size={14} /></button>
          <button className="btn-ghost btn-sm" onClick={() => setShowLinkWallet(true)}><Link size={14} /></button>
          <button className="btn-secondary btn-sm" onClick={() => setShowRefund(true)}><RefreshCcw size={14} /> Hoàn tiền</button>
          <button className="btn-secondary btn-sm" onClick={() => setShowRegisterMerchant(true)}><Store size={14} /> Đăng ký MC</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-brand-600">{totalPayments}</p>
          <p className="text-xs text-surface-500 mt-1">Tổng giao dịch</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-success-600">{myPayments.length}</p>
          <p className="text-xs text-surface-500 mt-1">GD của tôi</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-warning-600">{formatVNDC(myTotalSpent)}</p>
          <p className="text-xs text-surface-500 mt-1">Đã chi tiêu</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-surface-600">{totalApproved}</p>
          <p className="text-xs text-surface-500 mt-1">Merchants</p>
        </div>
      </div>

      {/* Pay form + history split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Payment form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold text-surface-800 mb-4">Thanh toán mới</h2>
            <div className="space-y-4">
              <div><label className="label">Merchant</label><input className="input" placeholder="0x..." value={payForm.merchant} onChange={e => setPayForm(f => ({ ...f, merchant: e.target.value }))} /></div>
              <div><label className="label">Số tiền</label><input className="input" type="number" placeholder="100" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
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

          {/* Merchant Lookup */}
          <div className="card">
            <h3 className="text-sm font-semibold text-surface-700 mb-2">Tra cứu Merchant</h3>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Địa chỉ merchant..." value={merchantLookup} onChange={e => setMerchantLookup(e.target.value)} />
              <button className="btn-secondary btn-sm" onClick={handleLookupMerchant} disabled={!merchantLookup}><Eye size={14} /></button>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div className="lg:col-span-3">
          {myPayments.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-surface-800">Lịch sử giao dịch</h2>
              {myPayments.map(p => (
                <div key={p.paymentId} className="card card-hover cursor-pointer" onClick={() => setShowDetail(p)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.isRefunded ? 'bg-danger-50' : 'bg-success-50'}`}>
                        {p.isRefunded ? <RefreshCcw size={16} className="text-danger-600" /> : <Send size={16} className="text-success-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-800">#{p.paymentId} · {shortenAddress(p.merchant)}</p>
                        <p className="text-xs text-surface-500">{p.paymentMethod} · {formatDate(p.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${p.isRefunded ? 'text-danger-600 line-through' : 'text-surface-800'}`}>
                        {formatVNDC(p.amount)}
                      </p>
                      {p.isRefunded && (
                        <span className="badge badge-danger text-xs">Hoàn tiền</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState lucideIcon={Receipt} title="Chưa có giao dịch" description="Thực hiện thanh toán đầu tiên" />
          )}
        </div>
      </div>

      {/* Payment Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Giao dịch #${showDetail?.paymentId}`}>
        {showDetail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-surface-500">Người trả:</span><p className="font-mono text-xs">{showDetail.student}</p></div>
              <div><span className="text-surface-500">Merchant:</span><p className="font-mono text-xs">{showDetail.merchant}</p></div>
              <div><span className="text-surface-500">Số tiền:</span><p className="font-bold">{formatVNDC(showDetail.amount)}</p></div>
              <div><span className="text-surface-500">Phương thức:</span><p>{showDetail.paymentMethod}</p></div>
              <div><span className="text-surface-500">Thời gian:</span><p>{formatDate(showDetail.timestamp)}</p></div>
              <div><span className="text-surface-500">Trạng thái:</span><p>{showDetail.isRefunded ? <span className="badge badge-danger">Đã hoàn tiền</span> : <span className="badge badge-success">Thành công</span>}</p></div>
            </div>
            {showDetail.isRefunded && (
              <div className="border-t pt-3 space-y-2">
                <div><span className="text-surface-500">Số tiền hoàn:</span><p className="font-bold text-danger-600">{formatVNDC(showDetail.refundAmount)}</p></div>
                <div><span className="text-surface-500">Lý do:</span><p>{showDetail.refundReason}</p></div>
                <div><span className="text-surface-500">Ngày hoàn:</span><p>{formatDate(showDetail.refundTimestamp)}</p></div>
              </div>
            )}
            {!showDetail.isRefunded && (
              <button className="btn-danger btn-sm mt-2" onClick={() => { setRefundForm({ paymentId: showDetail.paymentId.toString(), reason: '' }); setShowDetail(null); setShowRefund(true); }}>
                <RefreshCcw size={12} /> Hoàn tiền
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Refund Modal */}
      <Modal open={showRefund} onClose={() => setShowRefund(false)} title="Hoàn tiền"
        footer={<button className="btn-danger" onClick={handleRefund} disabled={isLoading || !refundForm.paymentId || !refundForm.reason}>{isLoading ? 'Đang xử lý...' : 'Hoàn tiền'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Payment ID</label><input className="input" type="number" placeholder="1" value={refundForm.paymentId} onChange={e => setRefundForm(f => ({ ...f, paymentId: e.target.value }))} /></div>
          <div><label className="label">Lý do</label><textarea className="input" rows={3} placeholder="Lý do hoàn tiền..." value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Link Wallet Modal */}
      <Modal open={showLinkWallet} onClose={() => setShowLinkWallet(false)} title="Liên kết ví"
        footer={<button className="btn-primary" onClick={handleLinkWallet} disabled={isLoading || !linkForm.method || !linkForm.walletId}>{isLoading ? 'Đang xử lý...' : 'Liên kết'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Phương thức thanh toán</label><input className="input" placeholder="VNDC" value={linkForm.method} onChange={e => setLinkForm(f => ({ ...f, method: e.target.value }))} /></div>
          <div><label className="label">Wallet ID</label><input className="input" placeholder="wallet-id-123" value={linkForm.walletId} onChange={e => setLinkForm(f => ({ ...f, walletId: e.target.value }))} /></div>
        </div>
        <div className="mt-3">
          <button className="btn-ghost btn-sm text-danger-600" onClick={() => linkForm.method && handleUnlinkWallet(linkForm.method)}><Unlink size={12} /> Hủy liên kết {linkForm.method}</button>
        </div>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal open={showAddMethod} onClose={() => setShowAddMethod(false)} title="Thêm phương thức thanh toán"
        footer={<button className="btn-primary" onClick={handleAddMethod} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Thêm'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên phương thức</label><input className="input" placeholder="BTC" value={methodForm.name} onChange={e => setMethodForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Token Address</label><input className="input" placeholder="0x..." value={methodForm.tokenAddress} onChange={e => setMethodForm(f => ({ ...f, tokenAddress: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Min Amount</label><input className="input" type="number" value={methodForm.minAmount} onChange={e => setMethodForm(f => ({ ...f, minAmount: e.target.value }))} /></div>
            <div><label className="label">Max Amount</label><input className="input" type="number" value={methodForm.maxAmount} onChange={e => setMethodForm(f => ({ ...f, maxAmount: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>

      {/* Register Merchant Modal */}
      <Modal open={showRegisterMerchant} onClose={() => setShowRegisterMerchant(false)} title="Đăng ký Merchant"
        footer={<button className="btn-primary" onClick={handleRegisterMerchant} disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Đăng ký'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên</label><input className="input" placeholder="Căn-tin Đại học" value={merchantForm.name} onChange={e => setMerchantForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Danh mục</label><input className="input" placeholder="Ẩm thực" value={merchantForm.category} onChange={e => setMerchantForm(f => ({ ...f, category: e.target.value }))} /></div>
          <div><label className="label">Email</label><input className="input" type="email" placeholder="contact@..." value={merchantForm.email} onChange={e => setMerchantForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Điện thoại</label><input className="input" placeholder="0123..." value={merchantForm.phone} onChange={e => setMerchantForm(f => ({ ...f, phone: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Merchant Detail Modal */}
      <Modal open={!!showMerchantDetail} onClose={() => setShowMerchantDetail(null)} title={`Merchant: ${showMerchantDetail?.name}`}>
        {showMerchantDetail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-surface-500">Địa chỉ:</span><p className="font-mono text-xs">{showMerchantDetail.merchantAddress}</p></div>
              <div><span className="text-surface-500">Danh mục:</span><p>{showMerchantDetail.category}</p></div>
              <div><span className="text-surface-500">Email:</span><p>{showMerchantDetail.contactEmail}</p></div>
              <div><span className="text-surface-500">SĐT:</span><p>{showMerchantDetail.contactPhone}</p></div>
              <div><span className="text-surface-500">Trạng thái:</span><p>
                {showMerchantDetail.isApproved ? <span className="badge badge-success">Phê duyệt</span> : <span className="badge badge-warning">Chờ duyệt</span>}
                {showMerchantDetail.isActive ? <span className="badge badge-success ml-1">Active</span> : <span className="badge badge-danger ml-1">Inactive</span>}
              </p></div>
              <div><span className="text-surface-500">Hoa hồng:</span><p>{showMerchantDetail.commissionRate / 100}%</p></div>
              <div><span className="text-surface-500">Tổng GD:</span><p className="font-bold">{showMerchantDetail.totalTransactions}</p></div>
              <div><span className="text-surface-500">Doanh thu:</span><p className="font-bold text-brand-600">{formatVNDC(showMerchantDetail.totalRevenue)}</p></div>
              <div><span className="text-surface-500">Đăng ký:</span><p>{formatDate(showMerchantDetail.registrationDate)}</p></div>
              {showMerchantDetail.approvalDate > 0 && <div><span className="text-surface-500">Phê duyệt:</span><p>{formatDate(showMerchantDetail.approvalDate)}</p></div>}
            </div>
            {!showMerchantDetail.isApproved && (
              <button className="btn-primary btn-sm mt-2" onClick={() => handleApproveMerchant(showMerchantDetail.merchantAddress)}>Phê duyệt</button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

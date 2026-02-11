import { useState, useMemo } from 'react';
import {
  ArrowLeftRight, Plus, TrendingUp, TrendingDown, Clock, CheckCircle,
  XCircle, Search, Filter, ArrowUpDown, Coins, Users, BarChart3,
  ShoppingCart, Tag, RefreshCcw, AlertCircle, ChevronDown, Copy,
  ExternalLink, Zap, ArrowRight, CandlestickChart,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import TradingChart, { useTradingData, TRADING_PAIRS } from '@/components/chart/TradingChart';
import { useWeb3 } from '@/contexts/Web3Context';
import { cn, shortenAddress, formatNumber, formatDate, timeAgo } from '@/lib/utils';

// ─── Types ───
interface Order {
  id: number;
  type: 'buy' | 'sell';
  trader: string;
  tokenOffer: string;
  tokenWant: string;
  amountOffer: number;
  amountWant: number;
  price: number;
  filled: number;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  createdAt: number;
}

interface Trade {
  id: number;
  buyer: string;
  seller: string;
  token: string;
  amount: number;
  price: number;
  total: number;
  timestamp: number;
}

interface MarketItem {
  id: number;
  seller: string;
  title: string;
  description: string;
  category: string;
  price: number;
  token: string;
  imageUrl?: string;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: number;
}

// ─── Mock Data ───
const MOCK_ORDERS: Order[] = [
  { id: 1, type: 'buy', trader: '0x1234...abcd', tokenOffer: 'ETH', tokenWant: 'VNDC', amountOffer: 0.5, amountWant: 50000, price: 100000, filled: 0, status: 'open', createdAt: Date.now() / 1000 - 300 },
  { id: 2, type: 'sell', trader: '0x5678...efgh', tokenOffer: 'VNDC', tokenWant: 'ETH', amountOffer: 100000, amountWant: 1, price: 100000, filled: 40, status: 'partial', createdAt: Date.now() / 1000 - 1200 },
  { id: 3, type: 'buy', trader: '0x9abc...ijkl', tokenOffer: 'SGOV', tokenWant: 'VNDC', amountOffer: 500, amountWant: 25000, price: 50, filled: 0, status: 'open', createdAt: Date.now() / 1000 - 3600 },
  { id: 4, type: 'sell', trader: '0xdef0...mnop', tokenOffer: 'VNDC', tokenWant: 'SGOV', amountOffer: 10000, amountWant: 200, price: 50, filled: 100, status: 'filled', createdAt: Date.now() / 1000 - 7200 },
  { id: 5, type: 'buy', trader: '0x1111...qrst', tokenOffer: 'ETH', tokenWant: 'SGOV', amountOffer: 0.2, amountWant: 1000, price: 0.0002, filled: 0, status: 'open', createdAt: Date.now() / 1000 - 600 },
  { id: 6, type: 'sell', trader: '0x2222...uvwx', tokenOffer: 'VNDC', tokenWant: 'ETH', amountOffer: 200000, amountWant: 2, price: 100000, filled: 0, status: 'cancelled', createdAt: Date.now() / 1000 - 14400 },
];

const MOCK_TRADES: Trade[] = [
  { id: 1, buyer: '0x1234...abcd', seller: '0x5678...efgh', token: 'VNDC/ETH', amount: 50000, price: 0.00001, total: 0.5, timestamp: Date.now() / 1000 - 120 },
  { id: 2, buyer: '0x9abc...ijkl', seller: '0xdef0...mnop', token: 'VNDC/SGOV', amount: 10000, price: 50, total: 200, timestamp: Date.now() / 1000 - 600 },
  { id: 3, buyer: '0x1111...qrst', seller: '0x2222...uvwx', token: 'VNDC/ETH', amount: 30000, price: 0.00001, total: 0.3, timestamp: Date.now() / 1000 - 1800 },
  { id: 4, buyer: '0xaaaa...1234', seller: '0xbbbb...5678', token: 'SGOV/ETH', amount: 500, price: 0.0002, total: 0.1, timestamp: Date.now() / 1000 - 3600 },
  { id: 5, buyer: '0xcccc...9012', seller: '0xdddd...3456', token: 'VNDC/ETH', amount: 75000, price: 0.00001, total: 0.75, timestamp: Date.now() / 1000 - 5400 },
];

const MOCK_MARKETPLACE: MarketItem[] = [
  { id: 1, seller: '0x1234...abcd', title: 'Giáo trình Blockchain cơ bản', description: 'Tài liệu học tập Blockchain & Smart Contract cho sinh viên năm 3', category: 'Tài liệu', price: 500, token: 'VNDC', status: 'active', createdAt: Date.now() / 1000 - 86400 },
  { id: 2, seller: '0x5678...efgh', title: 'Dạy kèm Solidity 1-1', description: '5 buổi dạy kèm Solidity từ cơ bản đến nâng cao', category: 'Dịch vụ', price: 2000, token: 'VNDC', status: 'active', createdAt: Date.now() / 1000 - 172800 },
  { id: 3, seller: '0x9abc...ijkl', title: 'Máy tính Casio fx-580VN', description: 'Máy tính cũ còn mới 90%, bao test', category: 'Vật dụng', price: 1500, token: 'VNDC', status: 'active', createdAt: Date.now() / 1000 - 259200 },
  { id: 4, seller: '0xdef0...mnop', title: 'Thiết kế UI/UX cho đồ án', description: 'Nhận thiết kế giao diện cho đồ án môn học, bao đẹp', category: 'Dịch vụ', price: 3000, token: 'VNDC', status: 'sold', createdAt: Date.now() / 1000 - 345600 },
  { id: 5, seller: '0x1111...qrst', title: 'Vé sự kiện Tech Talk #12', description: 'Vé tham dự buổi Tech Talk chủ đề AI & Web3', category: 'Sự kiện', price: 100, token: 'VNDC', status: 'active', createdAt: Date.now() / 1000 - 43200 },
];

const SUPPORTED_TOKENS = ['VNDC', 'ETH', 'SGOV'];
const CATEGORIES = ['Tất cả', 'Tài liệu', 'Dịch vụ', 'Vật dụng', 'Sự kiện', 'Khác'];

export default function ExchangePage() {
  const { isConnected, address } = useWeb3();
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [tokenOffer, setTokenOffer] = useState('VNDC');
  const [tokenWant, setTokenWant] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [orderFilter, setOrderFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);

  // Marketplace listing form
  const [listTitle, setListTitle] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [listCategory, setListCategory] = useState('Tài liệu');
  const [listPrice, setListPrice] = useState('');
  const [listToken, setListToken] = useState('VNDC');

  // Chart data
  const chartData = useTradingData(selectedPairIndex, 120);

  const stats = useMemo(() => ({
    totalVolume24h: '2.85 ETH',
    totalOrders: MOCK_ORDERS.filter(o => o.status === 'open' || o.status === 'partial').length,
    totalTrades: MOCK_TRADES.length,
    totalListings: MOCK_MARKETPLACE.filter(m => m.status === 'active').length,
  }), []);

  const filteredOrders = useMemo(() => {
    return MOCK_ORDERS.filter(o => {
      if (orderFilter !== 'all' && o.type !== orderFilter) return false;
      return true;
    });
  }, [orderFilter]);

  const filteredMarketplace = useMemo(() => {
    return MOCK_MARKETPLACE.filter(item => {
      if (item.status !== 'active') return false;
      if (selectedCategory !== 'Tất cả' && item.category !== selectedCategory) return false;
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [selectedCategory, searchQuery]);

  const handleCreateOrder = () => {
    // TODO: Call smart contract
    setShowCreateOrder(false);
    setAmount('');
    setPrice('');
  };

  const handleCreateListing = () => {
    // TODO: Call smart contract
    setShowCreateListing(false);
    setListTitle('');
    setListDesc('');
    setListPrice('');
  };

  const tabs = [
    { id: 'chart', label: 'Biểu đồ', icon: <CandlestickChart size={15} /> },
    { id: 'orderbook', label: 'Sổ lệnh', icon: <ArrowUpDown size={15} /> },
    { id: 'trades', label: 'Lịch sử giao dịch', icon: <Clock size={15} /> },
    { id: 'marketplace', label: 'Chợ nội bộ', icon: <ShoppingCart size={15} /> },
    { id: 'my-orders', label: 'Lệnh của tôi', icon: <Tag size={15} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Sàn giao dịch nội bộ"
        description="Giao dịch token P2P và mua bán tài nguyên trong campus"
        lucideIcon={ArrowLeftRight}
        badge="DEX"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowCreateListing(true)} className="btn-secondary btn-sm">
              <ShoppingCart size={15} /> Đăng bán
            </button>
            <button onClick={() => setShowCreateOrder(true)} className="btn-primary btn-sm">
              <Plus size={15} /> Tạo lệnh
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Khối lượng 24h" value={stats.totalVolume24h} icon={<TrendingUp className="w-5 h-5" />} color="brand" change="+12.5%" trend="up" />
        <StatCard label="Lệnh đang mở" value={stats.totalOrders} icon={<ArrowUpDown className="w-5 h-5" />} color="info" />
        <StatCard label="Giao dịch hôm nay" value={stats.totalTrades} icon={<BarChart3 className="w-5 h-5" />} color="success" />
        <StatCard label="Sản phẩm đang bán" value={stats.totalListings} icon={<ShoppingCart className="w-5 h-5" />} color="warning" />
      </div>

      {/* Quick Swap Widget */}
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-white">Đổi nhanh (Quick Swap)</h3>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="label">Từ</label>
            <div className="flex gap-2">
              <input type="number" placeholder="0.00" className="input flex-1" />
              <select className="select w-28" value={tokenOffer} onChange={e => setTokenOffer(e.target.value)}>
                {SUPPORTED_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 transition-all mt-5 sm:mt-0">
            <ArrowRight size={18} />
          </button>
          <div className="flex-1 w-full">
            <label className="label">Đến</label>
            <div className="flex gap-2">
              <input type="number" placeholder="0.00" className="input flex-1" readOnly />
              <select className="select w-28" value={tokenWant} onChange={e => setTokenWant(e.target.value)}>
                {SUPPORTED_TOKENS.filter(t => t !== tokenOffer).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary mt-5 sm:mt-0 w-full sm:w-auto" disabled={!isConnected}>
            <RefreshCcw size={15} /> Đổi ngay
          </button>
        </div>
        {!isConnected && (
          <p className="text-xs text-surface-500 mt-3 flex items-center gap-1">
            <AlertCircle size={12} /> Kết nối ví để giao dịch
          </p>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs tabs={tabs} defaultTab="chart">
        {(activeTab) => (
          <>
            {/* ─── Chart ─── */}
            {activeTab === 'chart' && (
              <div>
                {/* Pair Selector */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto">
                  {TRADING_PAIRS.map((p, i) => (
                    <button
                      key={p.pair}
                      onClick={() => setSelectedPairIndex(i)}
                      className={cn(
                        'px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border',
                        selectedPairIndex === i
                          ? 'bg-brand-500/15 text-brand-300 border-brand-500/30 shadow-lg shadow-brand-500/5'
                          : 'bg-surface-800/40 text-surface-400 border-surface-700/40 hover:text-white hover:border-surface-600/50'
                      )}
                    >
                      {p.pair}
                    </button>
                  ))}
                </div>

                {/* Main Chart */}
                <TradingChart
                  data={chartData}
                  pair={TRADING_PAIRS[selectedPairIndex].pair}
                  height={480}
                />

                {/* Market Depth / Recent Trades below chart */}
                <div className="grid lg:grid-cols-2 gap-4 mt-4">
                  {/* Buy Orders (Bids) */}
                  <div className="glass-card p-4">
                    <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-1.5">
                      <TrendingUp size={14} /> Lệnh mua (Bid)
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-surface-500 pb-1.5 border-b border-surface-700/30">
                        <span>Giá</span>
                        <span>Số lượng</span>
                        <span>Tổng</span>
                      </div>
                      {MOCK_ORDERS.filter(o => o.type === 'buy' && o.status === 'open').map((o, i) => {
                        const depth = 30 + Math.random() * 70;
                        return (
                          <div key={o.id} className="flex items-center justify-between text-xs py-1 relative">
                            <div className="absolute inset-0 bg-emerald-500/5 rounded" style={{ width: `${depth}%` }} />
                            <span className="text-emerald-400 font-mono relative z-10">{o.price.toFixed(o.price < 1 ? 6 : 2)}</span>
                            <span className="text-surface-300 font-mono relative z-10">{formatNumber(o.amountOffer)}</span>
                            <span className="text-surface-400 font-mono relative z-10">{formatNumber(o.amountOffer * o.price)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sell Orders (Asks) */}
                  <div className="glass-card p-4">
                    <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-1.5">
                      <TrendingDown size={14} /> Lệnh bán (Ask)
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-surface-500 pb-1.5 border-b border-surface-700/30">
                        <span>Giá</span>
                        <span>Số lượng</span>
                        <span>Tổng</span>
                      </div>
                      {MOCK_ORDERS.filter(o => o.type === 'sell' && (o.status === 'open' || o.status === 'partial')).map((o, i) => {
                        const depth = 30 + Math.random() * 70;
                        return (
                          <div key={o.id} className="flex items-center justify-between text-xs py-1 relative">
                            <div className="absolute inset-0 bg-red-500/5 rounded" style={{ width: `${depth}%` }} />
                            <span className="text-red-400 font-mono relative z-10">{o.price.toFixed(o.price < 1 ? 6 : 2)}</span>
                            <span className="text-surface-300 font-mono relative z-10">{formatNumber(o.amountOffer)}</span>
                            <span className="text-surface-400 font-mono relative z-10">{formatNumber(o.amountOffer * o.price)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Recent Trades Ticker */}
                <div className="glass-card p-4 mt-4">
                  <h4 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-1.5">
                    <Clock size={14} /> Giao dịch gần nhất
                  </h4>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {MOCK_TRADES.map(trade => (
                      <div key={trade.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-800/40 border border-surface-700/30 shrink-0">
                        <span className="text-xs font-semibold text-white">{trade.token}</span>
                        <span className="text-xs font-mono text-emerald-400">{trade.price}</span>
                        <span className="text-xs font-mono text-surface-400">{formatNumber(trade.amount)}</span>
                        <span className="text-[10px] text-surface-500">{timeAgo(trade.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Order Book ─── */}
            {activeTab === 'orderbook' && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="tab-nav !mb-0">
                    {(['all', 'buy', 'sell'] as const).map(f => (
                      <button key={f} onClick={() => setOrderFilter(f)} className={cn('tab-btn', orderFilter === f && 'active')}>
                        {f === 'all' ? 'Tất cả' : f === 'buy' ? 'Mua' : 'Bán'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Loại</th>
                        <th>Trader</th>
                        <th>Cặp</th>
                        <th className="text-right">Số lượng</th>
                        <th className="text-right">Giá</th>
                        <th>Đã khớp</th>
                        <th>Trạng thái</th>
                        <th>Thời gian</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(order => (
                        <tr key={order.id}>
                          <td>
                            <span className={cn(
                              'badge',
                              order.type === 'buy' ? 'badge-success' : 'badge-danger'
                            )}>
                              {order.type === 'buy' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {order.type === 'buy' ? 'Mua' : 'Bán'}
                            </span>
                          </td>
                          <td>
                            <span className="font-mono text-xs text-surface-300">{order.trader}</span>
                          </td>
                          <td>
                            <span className="font-semibold text-white">
                              {order.tokenOffer}/{order.tokenWant}
                            </span>
                          </td>
                          <td className="text-right font-mono">{formatNumber(order.amountOffer)}</td>
                          <td className="text-right font-mono text-brand-300">{formatNumber(order.price)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-500 rounded-full transition-all"
                                  style={{ width: `${order.filled}%` }}
                                />
                              </div>
                              <span className="text-xs text-surface-400">{order.filled}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={cn('badge', {
                              'badge-success': order.status === 'filled',
                              'badge-warning': order.status === 'partial',
                              'badge-info': order.status === 'open',
                              'badge-neutral': order.status === 'cancelled',
                            })}>
                              {order.status === 'open' ? 'Đang mở' :
                               order.status === 'partial' ? 'Khớp 1 phần' :
                               order.status === 'filled' ? 'Đã khớp' : 'Đã hủy'}
                            </span>
                          </td>
                          <td className="text-xs text-surface-400">{timeAgo(order.createdAt)}</td>
                          <td>
                            {order.status === 'open' && (
                              <button className="btn-primary btn-sm" disabled={!isConnected}>
                                {order.type === 'buy' ? 'Bán' : 'Mua'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── Trade History ─── */}
            {activeTab === 'trades' && (
              <div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Cặp</th>
                        <th>Người mua</th>
                        <th>Người bán</th>
                        <th className="text-right">Số lượng</th>
                        <th className="text-right">Giá</th>
                        <th className="text-right">Tổng</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_TRADES.map(trade => (
                        <tr key={trade.id}>
                          <td className="text-surface-500 font-mono">#{trade.id}</td>
                          <td className="font-semibold text-white">{trade.token}</td>
                          <td>
                            <span className="font-mono text-xs text-emerald-400">{trade.buyer}</span>
                          </td>
                          <td>
                            <span className="font-mono text-xs text-red-400">{trade.seller}</span>
                          </td>
                          <td className="text-right font-mono">{formatNumber(trade.amount)}</td>
                          <td className="text-right font-mono text-brand-300">{trade.price}</td>
                          <td className="text-right font-mono font-semibold text-white">{trade.total}</td>
                          <td className="text-xs text-surface-400">{timeAgo(trade.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mini Chart */}
                <TradingChart
                  data={chartData}
                  pair={TRADING_PAIRS[selectedPairIndex].pair}
                  height={280}
                  className="mt-6"
                />
              </div>
            )}

            {/* ─── Marketplace ─── */}
            {activeTab === 'marketplace' && (
              <div>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm sản phẩm, dịch vụ..."
                      className="input pl-10"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          'px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                          selectedCategory === cat
                            ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                            : 'bg-surface-800/50 text-surface-400 border border-surface-700/40 hover:text-white'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Grid */}
                {filteredMarketplace.length === 0 ? (
                  <EmptyState
                    lucideIcon={ShoppingCart}
                    title="Không tìm thấy sản phẩm"
                    description="Thử thay đổi bộ lọc hoặc đăng bán sản phẩm mới"
                    action={
                      <button onClick={() => setShowCreateListing(true)} className="btn-primary btn-sm">
                        <Plus size={15} /> Đăng bán ngay
                      </button>
                    }
                  />
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMarketplace.map(item => (
                      <div key={item.id} className="glass-card p-5 flex flex-col">
                        {/* Image placeholder */}
                        <div className="w-full h-36 rounded-xl bg-surface-800/60 border border-surface-700/30 flex items-center justify-center mb-4 overflow-hidden">
                          <div className="text-center">
                            <Tag className="w-8 h-8 text-surface-600 mx-auto mb-1" />
                            <span className="text-[10px] text-surface-600">{item.category}</span>
                          </div>
                        </div>

                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white text-sm leading-tight flex-1">{item.title}</h3>
                          <span className="badge badge-brand text-[11px] ml-2 shrink-0">{item.category}</span>
                        </div>

                        <p className="text-xs text-surface-400 mb-4 line-clamp-2 flex-1">{item.description}</p>

                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-surface-700/30">
                          <div>
                            <span className="text-lg font-bold text-white">{formatNumber(item.price, 0)}</span>
                            <span className="text-xs text-brand-400 ml-1">{item.token}</span>
                          </div>
                          <button className="btn-primary btn-sm" disabled={!isConnected}>
                            <ShoppingCart size={14} /> Mua
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[11px] text-surface-500 font-mono">{item.seller}</span>
                          <span className="text-[11px] text-surface-500">{timeAgo(item.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── My Orders ─── */}
            {activeTab === 'my-orders' && (
              <div>
                {!isConnected ? (
                  <EmptyState
                    lucideIcon={ArrowLeftRight}
                    title="Kết nối ví để xem"
                    description="Bạn cần kết nối ví MetaMask để xem các lệnh của mình"
                  />
                ) : (
                  <div>
                    {/* My Active Orders */}
                    <h3 className="text-sm font-semibold text-surface-300 mb-3">Lệnh đang mở</h3>
                    <div className="grid gap-3 mb-8">
                      {MOCK_ORDERS.filter(o => o.status === 'open' || o.status === 'partial').slice(0, 2).map(order => (
                        <div key={order.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center',
                              order.type === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            )}>
                              {order.type === 'buy' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">
                                  {order.type === 'buy' ? 'Mua' : 'Bán'} {order.tokenOffer}
                                </span>
                                <span className={cn('badge', order.status === 'partial' ? 'badge-warning' : 'badge-info')}>
                                  {order.status === 'partial' ? 'Khớp 1 phần' : 'Đang mở'}
                                </span>
                              </div>
                              <p className="text-xs text-surface-400 mt-0.5">
                                {formatNumber(order.amountOffer)} {order.tokenOffer} → {formatNumber(order.amountWant)} {order.tokenWant}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-mono text-brand-300">{formatNumber(order.price)}</p>
                              <p className="text-[11px] text-surface-500">Giá</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${order.filled}%` }} />
                              </div>
                              <span className="text-xs text-surface-400 w-8">{order.filled}%</span>
                            </div>
                            <button className="btn-danger btn-sm">
                              <XCircle size={14} /> Hủy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* My Listings */}
                    <h3 className="text-sm font-semibold text-surface-300 mb-3">Sản phẩm đang bán</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {MOCK_MARKETPLACE.slice(0, 2).map(item => (
                        <div key={item.id} className="glass-card p-4 flex items-start gap-4">
                          <div className="w-14 h-14 rounded-xl bg-surface-800/60 border border-surface-700/30 flex items-center justify-center shrink-0">
                            <Tag className="w-6 h-6 text-surface-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white text-sm truncate">{item.title}</h4>
                            <p className="text-xs text-surface-400 mt-0.5">{item.category}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-bold text-brand-300">{formatNumber(item.price, 0)} {item.token}</span>
                              <span className="badge badge-success text-[11px]">Đang bán</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* My Trade History */}
                    <h3 className="text-sm font-semibold text-surface-300 mb-3 mt-8">Lịch sử giao dịch</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Cặp</th>
                            <th>Loại</th>
                            <th className="text-right">Số lượng</th>
                            <th className="text-right">Tổng</th>
                            <th>Thời gian</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_TRADES.slice(0, 3).map(trade => (
                            <tr key={trade.id}>
                              <td className="font-semibold text-white">{trade.token}</td>
                              <td><span className="badge badge-success">Mua</span></td>
                              <td className="text-right font-mono">{formatNumber(trade.amount)}</td>
                              <td className="text-right font-mono text-brand-300">{trade.total}</td>
                              <td className="text-xs text-surface-400">{timeAgo(trade.timestamp)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Tabs>

      {/* ─── Create Order Modal ─── */}
      <Modal
        open={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        title="Tạo lệnh giao dịch"
        description="Đặt lệnh mua hoặc bán token P2P"
        footer={
          <>
            <button onClick={() => setShowCreateOrder(false)} className="btn-ghost">Hủy</button>
            <button onClick={handleCreateOrder} className="btn-primary" disabled={!amount || !price}>
              <Plus size={15} /> {orderType === 'buy' ? 'Đặt lệnh mua' : 'Đặt lệnh bán'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Buy/Sell Toggle */}
          <div className="flex gap-2 p-1 rounded-xl bg-surface-800/50 border border-surface-700/40">
            <button
              onClick={() => setOrderType('buy')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                orderType === 'buy'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-lg'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <TrendingUp size={14} className="inline mr-1.5" /> Mua
            </button>
            <button
              onClick={() => setOrderType('sell')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                orderType === 'sell'
                  ? 'bg-red-500/20 text-red-400 shadow-lg'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <TrendingDown size={14} className="inline mr-1.5" /> Bán
            </button>
          </div>

          {/* Token Pair */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{orderType === 'buy' ? 'Token muốn mua' : 'Token muốn bán'}</label>
              <select className="select" value={tokenOffer} onChange={e => setTokenOffer(e.target.value)}>
                {SUPPORTED_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Đổi lấy</label>
              <select className="select" value={tokenWant} onChange={e => setTokenWant(e.target.value)}>
                {SUPPORTED_TOKENS.filter(t => t !== tokenOffer).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label">Số lượng</label>
            <div className="relative">
              <input
                type="number"
                className="input pr-16"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-400">{tokenOffer}</span>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="label">Giá mỗi đơn vị</label>
            <div className="relative">
              <input
                type="number"
                className="input pr-16"
                placeholder="0.00"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-400">{tokenWant}</span>
            </div>
          </div>

          {/* Summary */}
          {amount && price && (
            <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700/30">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-surface-400">Tổng giá trị</span>
                <span className="font-semibold text-white">
                  {formatNumber(parseFloat(amount) * parseFloat(price))} {tokenWant}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400">Phí giao dịch (0.3%)</span>
                <span className="text-surface-300">
                  {formatNumber(parseFloat(amount) * parseFloat(price) * 0.003)} {tokenWant}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Create Listing Modal ─── */}
      <Modal
        open={showCreateListing}
        onClose={() => setShowCreateListing(false)}
        title="Đăng bán sản phẩm"
        description="Đăng bán tài liệu, dịch vụ hoặc vật dụng trong campus"
        footer={
          <>
            <button onClick={() => setShowCreateListing(false)} className="btn-ghost">Hủy</button>
            <button onClick={handleCreateListing} className="btn-primary" disabled={!listTitle || !listPrice}>
              <ShoppingCart size={15} /> Đăng bán
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Tên sản phẩm / dịch vụ</label>
            <input
              type="text"
              className="input"
              placeholder="VD: Giáo trình Toán cao cấp..."
              value={listTitle}
              onChange={e => setListTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Mô tả</label>
            <textarea
              className="textarea"
              placeholder="Mô tả chi tiết sản phẩm hoặc dịch vụ..."
              value={listDesc}
              onChange={e => setListDesc(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Danh mục</label>
              <select className="select" value={listCategory} onChange={e => setListCategory(e.target.value)}>
                {CATEGORIES.filter(c => c !== 'Tất cả').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Token thanh toán</label>
              <select className="select" value={listToken} onChange={e => setListToken(e.target.value)}>
                {SUPPORTED_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Giá bán</label>
            <div className="relative">
              <input
                type="number"
                className="input pr-16"
                placeholder="0"
                value={listPrice}
                onChange={e => setListPrice(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-400">{listToken}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useMemo, useCallback } from 'react';
import {
  ArrowLeftRight, TrendingUp, TrendingDown, Clock,
  XCircle, ArrowUpDown, RefreshCcw, AlertCircle, Zap,
} from 'lucide-react';
import TradingChart from '@/components/chart/TradingChart';
import { useWeb3 } from '@/contexts/Web3Context';
import { useExchange, useCandles, useUserOrders, useAllTickers } from '@/hooks/useExchange';
import { PAIRS, TIMEFRAMES, exchange, type BookLevel, type Trade, type TradingPair, type Order } from '@/lib/exchange';
import { cn, formatNumber, shortenAddress } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Helpers ───

function fmtPrice(v: number, prec: number) { return v.toFixed(prec); }
function fmtAmt(v: number, prec: number) { return prec === 0 ? Math.round(v).toLocaleString() : v.toFixed(prec); }
function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

const DEMO_BAL: Record<string, number> = { VNDC: 1_000_000, ETH: 10, SGOV: 10_000 };

// ─── Main Component ───

export default function ExchangePage() {
  const { address, isConnected } = useWeb3();

  // Trading state
  const [pairId, setPairId] = useState('VNDC_ETH');
  const [timeframe, setTimeframe] = useState('1h');
  const [formSide, setFormSide] = useState<'buy' | 'sell'>('buy');
  const [formType, setFormType] = useState<'limit' | 'market'>('limit');
  const [formPrice, setFormPrice] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [bottomTab, setBottomTab] = useState<'open' | 'history' | 'trades'>('open');
  const [mobileTab, setMobileTab] = useState<'chart' | 'book' | 'form'>('chart');

  // Hooks
  const { pair, ticker, orderBook, recentTrades, placeOrder, cancelOrder } = useExchange(pairId);
  const candles = useCandles(pairId, timeframe);
  const userOrders = useUserOrders(address ?? undefined);
  const allTickers = useAllTickers();

  // Derived
  const pairName = `${pair.base}/${pair.quote}`;
  const dp = pair.pricePrecision;
  const da = pair.amountPrecision;
  const total = useMemo(() => {
    const p = formType === 'market' ? ticker.lastPrice : parseFloat(formPrice) || 0;
    const a = parseFloat(formAmount) || 0;
    return p * a;
  }, [formPrice, formAmount, formType, ticker.lastPrice]);
  const fee = total * 0.001;
  const quoteBalance = DEMO_BAL[pair.quote] || 0;
  const baseBalance = DEMO_BAL[pair.base] || 0;
  const openOrders = useMemo(() => userOrders.filter(o => o.status === 'open' || o.status === 'partial'), [userOrders]);
  const histOrders = useMemo(() => userOrders.filter(o => o.status === 'filled' || o.status === 'cancelled'), [userOrders]);

  // Handlers
  const handlePlace = useCallback(() => {
    if (!isConnected) { toast.error('Vui lòng kết nối ví!'); return; }
    const price = formType === 'market' ? ticker.lastPrice : parseFloat(formPrice);
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) { toast.error('Nhập số lượng hợp lệ'); return; }
    if (formType === 'limit' && (!price || price <= 0)) { toast.error('Nhập giá hợp lệ'); return; }
    try {
      const o = placeOrder({ side: formSide, type: formType, price: price || 0, amount, trader: address! });
      if (o.status === 'filled') toast.success(`Khớp lệnh hoàn toàn: ${fmtAmt(o.filled, da)} ${pair.base}`);
      else if (o.status === 'partial') toast.success(`Khớp ${fmtAmt(o.filled, da)}/${fmtAmt(o.amount, da)} ${pair.base}. Còn lại đang chờ.`);
      else toast.success('Đặt lệnh thành công!');
      setFormAmount('');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  }, [formSide, formType, formPrice, formAmount, pair, ticker, address, isConnected, placeOrder, da]);

  const handleCancel = useCallback((id: string) => {
    if (cancelOrder(id)) toast.success('Đã hủy lệnh');
  }, [cancelOrder]);

  const setPercent = useCallback((pct: number) => {
    const price = formType === 'market' ? ticker.lastPrice : parseFloat(formPrice) || ticker.lastPrice;
    if (price <= 0) return;
    if (formSide === 'buy') {
      const maxAmt = (quoteBalance * pct) / price;
      setFormAmount(fmtAmt(maxAmt, da));
    } else {
      setFormAmount(fmtAmt(baseBalance * pct, da));
    }
  }, [formSide, formType, formPrice, ticker, quoteBalance, baseBalance, da]);

  const fillPrice = useCallback((price: number) => {
    setFormPrice(fmtPrice(price, dp));
    setFormType('limit');
  }, [dp]);

  const isUp = ticker.changePercent24h >= 0;

  // ─── RENDER ───

  return (
    <div className="space-y-2 max-w-[1400px] mx-auto">
      {/* ─── PAIR SELECTOR + TICKER ─── */}
      <div className="card p-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Pair tabs */}
          <div className="flex gap-1 overflow-x-auto shrink-0">
            {PAIRS.map(p => {
              const t = allTickers[p.id];
              const up = t ? t.changePercent24h >= 0 : true;
              return (
                <button
                  key={p.id}
                  onClick={() => setPairId(p.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border',
                    pairId === p.id
                      ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-700'
                      : 'bg-surface-50 text-surface-600 border-transparent hover:border-surface-200',
                  )}
                >
                  {p.base}/{p.quote}
                  {t && (
                    <span className={cn('ml-1.5 text-[10px]', up ? 'text-success' : 'text-danger')}>
                      {up ? '+' : ''}{t.changePercent24h.toFixed(1)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ticker stats */}
          <div className="flex items-center gap-4 overflow-x-auto text-xs flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-lg font-bold font-mono', isUp ? 'text-success' : 'text-danger')}>
                {fmtPrice(ticker.lastPrice, dp)}
              </span>
              <span className={cn('font-semibold', isUp ? 'text-success' : 'text-danger')}>
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-surface-500">
              <span>
                24h <span className={cn('font-mono font-semibold', isUp ? 'text-success' : 'text-danger')}>
                  {isUp ? '+' : ''}{ticker.changePercent24h.toFixed(2)}%
                </span>
              </span>
              <span>H <span className="font-mono text-surface-700">{fmtPrice(ticker.high24h, dp)}</span></span>
              <span>L <span className="font-mono text-surface-700">{fmtPrice(ticker.low24h, dp)}</span></span>
              <span>Vol <span className="font-mono text-surface-700">{formatNumber(ticker.volume24h, 0)}</span></span>
            </div>
          </div>

          {/* Reset button */}
          <button
            onClick={() => { exchange.reset(); toast.success('Đã reset dữ liệu sàn'); }}
            className="shrink-0 p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
            title="Reset exchange data"
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {/* ─── MOBILE TAB SWITCHER ─── */}
      <div className="flex lg:hidden gap-1 bg-surface-50 rounded-lg p-0.5 border border-surface-200">
        {(['chart', 'book', 'form'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={cn(
              'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all',
              mobileTab === tab ? 'bg-white text-brand-600 shadow-sm dark:bg-surface-700' : 'text-surface-500',
            )}
          >
            {tab === 'chart' ? 'Biểu đồ' : tab === 'book' ? 'Sổ lệnh' : 'Đặt lệnh'}
          </button>
        ))}
      </div>

      {/* ─── MAIN GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2">
        {/* LEFT COLUMN */}
        <div className={cn('space-y-2', mobileTab !== 'chart' && mobileTab !== 'form' ? 'hidden lg:block' : '')}>
          {/* Chart */}
          <div className={cn(mobileTab !== 'chart' ? 'hidden lg:block' : '')}>
            <TradingChart
              candles={candles}
              pair={pairName}
              height={380}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
          </div>

          {/* Order Form */}
          <div className={cn('card p-4', mobileTab !== 'form' ? 'hidden lg:block' : '')}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-brand-500" />
                <span className="text-sm font-bold text-surface-800">Đặt lệnh</span>
              </div>
              {/* Type toggle */}
              <div className="flex rounded-lg bg-surface-50 border border-surface-200 p-0.5">
                {(['limit', 'market'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFormType(t)}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-semibold transition-all',
                      formType === t
                        ? 'bg-white text-brand-600 shadow-sm dark:bg-surface-700'
                        : 'text-surface-500',
                    )}
                  >
                    {t === 'limit' ? 'Limit' : 'Market'}
                  </button>
                ))}
              </div>
            </div>

            {/* Buy/Sell toggle */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setFormSide('buy')}
                className={cn(
                  'py-2 rounded-lg text-sm font-bold transition-all',
                  formSide === 'buy'
                    ? 'bg-success text-white shadow-md'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200',
                )}
              >
                Mua {pair.base}
              </button>
              <button
                onClick={() => setFormSide('sell')}
                className={cn(
                  'py-2 rounded-lg text-sm font-bold transition-all',
                  formSide === 'sell'
                    ? 'bg-danger text-white shadow-md'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200',
                )}
              >
                Bán {pair.base}
              </button>
            </div>

            {/* Price input */}
            {formType === 'limit' && (
              <div className="mb-2">
                <label className="text-[11px] text-surface-500 mb-1 block">Giá ({pair.quote})</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    placeholder={fmtPrice(ticker.lastPrice, dp)}
                    step={10 ** -dp}
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm font-mono text-surface-800 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-surface-400">{pair.quote}</span>
                </div>
              </div>
            )}

            {/* Amount input */}
            <div className="mb-2">
              <label className="text-[11px] text-surface-500 mb-1 block">Số lượng ({pair.base})</label>
              <div className="relative">
                <input
                  type="number"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder={`Min: ${pair.minAmount}`}
                  step={10 ** -da}
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm font-mono text-surface-800 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-surface-400">{pair.base}</span>
              </div>
            </div>

            {/* Percent buttons */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[0.25, 0.5, 0.75, 1].map(p => (
                <button
                  key={p}
                  onClick={() => setPercent(p)}
                  className="py-1.5 rounded-md text-[10px] font-semibold bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors"
                >
                  {p * 100}%
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="space-y-1 mb-3 text-xs text-surface-500">
              <div className="flex justify-between">
                <span>Tổng</span>
                <span className="font-mono text-surface-700">{total > 0 ? total.toFixed(dp) : '0'} {pair.quote}</span>
              </div>
              <div className="flex justify-between">
                <span>Phí (0.1%)</span>
                <span className="font-mono text-surface-700">{fee > 0 ? fee.toFixed(dp) : '0'} {pair.quote}</span>
              </div>
              <div className="flex justify-between">
                <span>Khả dụng</span>
                <span className="font-mono text-surface-700">
                  {formatNumber(formSide === 'buy' ? quoteBalance : baseBalance, 0)} {formSide === 'buy' ? pair.quote : pair.base}
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handlePlace}
              disabled={!isConnected}
              className={cn(
                'w-full py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                formSide === 'buy'
                  ? 'bg-success hover:bg-success/90 text-white'
                  : 'bg-danger hover:bg-danger/90 text-white',
              )}
            >
              {!isConnected ? 'Kết nối ví để giao dịch' : formSide === 'buy' ? `Mua ${pair.base}` : `Bán ${pair.base}`}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN — Order Book + Trades */}
        <div className={cn('space-y-2', mobileTab !== 'book' ? 'hidden lg:block' : '')}>
          {/* ORDER BOOK */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-100">
              <ArrowUpDown size={14} className="text-brand-500" />
              <span className="text-xs font-bold text-surface-800">Sổ lệnh</span>
            </div>

            {/* Header */}
            <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] font-semibold text-surface-400">
              <span>Giá ({pair.quote})</span>
              <span className="text-right">SL ({pair.base})</span>
              <span className="text-right">Tổng</span>
            </div>

            {/* Asks (reversed — highest at top) */}
            <div className="max-h-[200px] overflow-y-auto flex flex-col-reverse">
              {orderBook.asks.slice(0, 15).map((level, i) => (
                <OrderBookRow
                  key={`a${i}`}
                  level={level}
                  side="ask"
                  maxTotal={orderBook.asks.length > 0 ? orderBook.asks[Math.min(14, orderBook.asks.length - 1)].total : 1}
                  dp={dp}
                  da={da}
                  onClick={() => fillPrice(level.price)}
                />
              ))}
            </div>

            {/* Spread */}
            <div className="px-3 py-1.5 text-center border-y border-surface-100 bg-surface-50/50">
              <span className={cn('text-sm font-bold font-mono', isUp ? 'text-success' : 'text-danger')}>
                {fmtPrice(ticker.lastPrice, dp)}
              </span>
              {ticker.spread > 0 && (
                <span className="ml-2 text-[10px] text-surface-400">
                  Spread: {fmtPrice(ticker.spread, dp)} ({ticker.spreadPercent}%)
                </span>
              )}
            </div>

            {/* Bids */}
            <div className="max-h-[200px] overflow-y-auto">
              {orderBook.bids.slice(0, 15).map((level, i) => (
                <OrderBookRow
                  key={`b${i}`}
                  level={level}
                  side="bid"
                  maxTotal={orderBook.bids.length > 0 ? orderBook.bids[Math.min(14, orderBook.bids.length - 1)].total : 1}
                  dp={dp}
                  da={da}
                  onClick={() => fillPrice(level.price)}
                />
              ))}
            </div>
          </div>

          {/* RECENT TRADES */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-100">
              <ArrowLeftRight size={14} className="text-brand-500" />
              <span className="text-xs font-bold text-surface-800">Giao dịch gần đây</span>
            </div>
            <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] font-semibold text-surface-400">
              <span>Giá</span>
              <span className="text-right">SL</span>
              <span className="text-right">Thời gian</span>
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              {recentTrades.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-surface-400">Chưa có giao dịch</div>
              ) : (
                recentTrades.slice(0, 30).map((trade, i) => (
                  <div
                    key={trade.id || i}
                    className="grid grid-cols-3 gap-1 px-3 py-1 text-[11px] hover:bg-surface-50 transition-colors cursor-default"
                  >
                    <span className={cn('font-mono font-semibold', trade.side === 'buy' ? 'text-success' : 'text-danger')}>
                      {fmtPrice(trade.price, dp)}
                    </span>
                    <span className="font-mono text-surface-600 text-right">{fmtAmt(trade.amount, da)}</span>
                    <span className="font-mono text-surface-400 text-right">{fmtTime(trade.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MY ORDERS ─── */}
      <div className="card overflow-hidden">
        <div className="flex items-center border-b border-surface-100">
          {([
            { key: 'open' as const, label: `Lệnh mở (${openOrders.length})` },
            { key: 'history' as const, label: 'Lịch sử lệnh' },
            { key: 'trades' as const, label: 'Lịch sử GD' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setBottomTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold transition-all border-b-2',
                bottomTab === tab.key
                  ? 'text-brand-600 border-brand-500'
                  : 'text-surface-500 border-transparent hover:text-surface-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {bottomTab === 'open' && (
            <OrdersTable
              orders={openOrders}
              pair={pair}
              dp={dp}
              da={da}
              showCancel
              onCancel={handleCancel}
            />
          )}
          {bottomTab === 'history' && (
            <OrdersTable orders={histOrders} pair={pair} dp={dp} da={da} />
          )}
          {bottomTab === 'trades' && (
            <TradesTable trades={recentTrades} pair={pair} dp={dp} da={da} />
          )}
        </div>
      </div>

      {/* ─── INFO BANNER ─── */}
      {!isConnected && (
        <div className="card p-3 flex items-center gap-3 border-l-4 border-warning bg-warning/5">
          <AlertCircle size={18} className="text-warning shrink-0" />
          <div className="text-xs text-surface-600">
            <span className="font-semibold">Chế độ xem.</span> Kết nối ví MetaMask để đặt lệnh giao dịch thật.
            <span className="text-surface-400 ml-1">Market maker tự động tạo hoạt động giao dịch.</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTS ───

function OrderBookRow({
  level, side, maxTotal, dp, da, onClick,
}: {
  level: BookLevel; side: 'bid' | 'ask'; maxTotal: number; dp: number; da: number; onClick: () => void;
}) {
  const pct = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
  const bgClass = side === 'bid' ? 'bg-success/10' : 'bg-danger/10';

  return (
    <div
      className="relative grid grid-cols-3 gap-1 px-3 py-0.5 text-[11px] cursor-pointer hover:bg-surface-100 transition-colors"
      onClick={onClick}
    >
      <div className={`absolute inset-y-0 right-0 ${bgClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      <span className={cn('font-mono font-semibold relative z-10', side === 'bid' ? 'text-success' : 'text-danger')}>
        {fmtPrice(level.price, dp)}
      </span>
      <span className="font-mono text-surface-600 text-right relative z-10">{fmtAmt(level.amount, da)}</span>
      <span className="font-mono text-surface-400 text-right relative z-10">{fmtAmt(level.total, da)}</span>
    </div>
  );
}

function OrdersTable({
  orders, pair, dp, da, showCancel, onCancel,
}: {
  orders: Order[]; pair: TradingPair; dp: number; da: number; showCancel?: boolean; onCancel?: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="py-10 text-center text-xs text-surface-400">
        <Clock size={24} className="mx-auto mb-2 opacity-40" />
        Chưa có lệnh nào
      </div>
    );
  }

  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-surface-400 font-semibold border-b border-surface-100">
          <th className="px-3 py-2 text-left">Cặp</th>
          <th className="px-2 py-2 text-left">Loại</th>
          <th className="px-2 py-2 text-left">Bên</th>
          <th className="px-2 py-2 text-right">Giá</th>
          <th className="px-2 py-2 text-right">SL</th>
          <th className="px-2 py-2 text-right">Đã khớp</th>
          <th className="px-2 py-2 text-center">Trạng thái</th>
          <th className="px-2 py-2 text-right">Thời gian</th>
          {showCancel && <th className="px-3 py-2 text-right">Hành động</th>}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => {
          const p = PAIRS.find(pp => pp.id === o.pairId) || pair;
          return (
            <tr key={o.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
              <td className="px-3 py-2 font-semibold text-surface-700">{p.base}/{p.quote}</td>
              <td className="px-2 py-2 text-surface-500 capitalize">{o.type}</td>
              <td className={cn('px-2 py-2 font-semibold capitalize', o.side === 'buy' ? 'text-success' : 'text-danger')}>
                {o.side === 'buy' ? 'Mua' : 'Bán'}
              </td>
              <td className="px-2 py-2 text-right font-mono text-surface-700">
                {o.type === 'market' ? 'Market' : fmtPrice(o.price, dp)}
              </td>
              <td className="px-2 py-2 text-right font-mono text-surface-600">{fmtAmt(o.amount, da)}</td>
              <td className="px-2 py-2 text-right font-mono text-surface-600">
                {fmtAmt(o.filled, da)}/{fmtAmt(o.amount, da)}
              </td>
              <td className="px-2 py-2 text-center">
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                  o.status === 'open' ? 'bg-info/10 text-info' :
                  o.status === 'partial' ? 'bg-warning/10 text-warning' :
                  o.status === 'filled' ? 'bg-success/10 text-success' : 'bg-surface-100 text-surface-500',
                )}>
                  {o.status === 'open' ? 'Chờ' : o.status === 'partial' ? 'Một phần' : o.status === 'filled' ? 'Đã khớp' : 'Đã hủy'}
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono text-surface-400">{fmtTime(o.timestamp)}</td>
              {showCancel && (
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onCancel?.(o.id)}
                    className="p-1 rounded-md text-danger hover:bg-danger/10 transition-colors"
                    title="Hủy lệnh"
                  >
                    <XCircle size={14} />
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TradesTable({
  trades, pair, dp, da,
}: {
  trades: Trade[]; pair: TradingPair; dp: number; da: number;
}) {
  if (trades.length === 0) {
    return (
      <div className="py-10 text-center text-xs text-surface-400">
        <ArrowLeftRight size={24} className="mx-auto mb-2 opacity-40" />
        Chưa có giao dịch
      </div>
    );
  }

  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-surface-400 font-semibold border-b border-surface-100">
          <th className="px-3 py-2 text-left">Bên</th>
          <th className="px-2 py-2 text-right">Giá</th>
          <th className="px-2 py-2 text-right">SL</th>
          <th className="px-2 py-2 text-right">Tổng ({pair.quote})</th>
          <th className="px-3 py-2 text-right">Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t, i) => (
          <tr key={t.id || i} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
            <td className={cn('px-3 py-2 font-semibold capitalize', t.side === 'buy' ? 'text-success' : 'text-danger')}>
              {t.side === 'buy' ? 'Mua' : 'Bán'}
            </td>
            <td className="px-2 py-2 text-right font-mono text-surface-700">{fmtPrice(t.price, dp)}</td>
            <td className="px-2 py-2 text-right font-mono text-surface-600">{fmtAmt(t.amount, da)}</td>
            <td className="px-2 py-2 text-right font-mono text-surface-600">{t.quoteAmount.toFixed(dp)}</td>
            <td className="px-3 py-2 text-right font-mono text-surface-400">{fmtTime(t.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


// ──────────────────────────────────────────────────
// VNDC Campus — Internal Exchange Engine
// Full order book, matching engine, candle aggregation & market maker
// ──────────────────────────────────────────────────

// ─── Types ───

export interface TradingPair {
  id: string;
  base: string;
  quote: string;
  pricePrecision: number;
  amountPrecision: number;
  minAmount: number;
  basePrice: number;
}

export interface Order {
  id: string;
  pairId: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  price: number;
  amount: number;
  filled: number;
  remaining: number;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  trader: string;
  timestamp: number;
  isBot: boolean;
}

export interface Trade {
  id: string;
  pairId: string;
  price: number;
  amount: number;
  quoteAmount: number;
  maker: string;
  taker: string;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BookLevel {
  price: number;
  amount: number;
  total: number;
  count: number;
}

export interface Ticker {
  pairId: string;
  lastPrice: number;
  prevPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPercent: number;
}

export type ExchangeEvent = 'trade' | 'orderbook' | 'order' | 'ticker' | 'candle';

// ─── Constants ───

export const PAIRS: TradingPair[] = [
  { id: 'VNDC_ETH', base: 'VNDC', quote: 'ETH', pricePrecision: 8, amountPrecision: 0, minAmount: 100, basePrice: 0.00001 },
  { id: 'SGOV_VNDC', base: 'SGOV', quote: 'VNDC', pricePrecision: 2, amountPrecision: 2, minAmount: 1, basePrice: 50 },
  { id: 'SGOV_ETH', base: 'SGOV', quote: 'ETH', pricePrecision: 6, amountPrecision: 2, minAmount: 0.1, basePrice: 0.0005 },
];

export const TIMEFRAMES = [
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '4h', seconds: 14400 },
  { label: '1D', seconds: 86400 },
] as const;

const SEED_COUNTS: Record<string, number> = {
  '1m': 360, '5m': 200, '15m': 200, '1h': 168, '4h': 180, '1D': 90,
};

const STORAGE_KEY = 'vndc_exchange_v3';
const BOT_ADDR = '0xBOT_MarketMaker';

// ─── Utilities ───

let _uid = 0;
function uid(p: string) { return `${p}${Date.now().toString(36)}${(++_uid).toString(36)}`; }
function round(n: number, d: number) { const f = 10 ** d; return Math.round(n * f) / f; }
function bucket(ts: number, s: number) { return Math.floor(ts / s) * s; }

// ─── Event Emitter ───

type Fn = (...a: unknown[]) => void;

class Emitter {
  private _m = new Map<string, Set<Fn>>();

  on(e: string, f: Fn) {
    if (!this._m.has(e)) this._m.set(e, new Set());
    this._m.get(e)!.add(f);
    return () => this.off(e, f);
  }

  off(e: string, f: Fn) { this._m.get(e)?.delete(f); }

  emit(e: string, ...a: unknown[]) {
    this._m.get(e)?.forEach(fn => {
      try { fn(...a); } catch { /* ignore listener errors */ }
    });
  }
}

// ──────────────────────────────────────────────────
// Exchange Engine
// ──────────────────────────────────────────────────

class ExchangeEngine extends Emitter {
  orders = new Map<string, Order>();
  trades = new Map<string, Trade[]>();
  candles = new Map<string, Map<string, Candle[]>>();
  tickers = new Map<string, Ticker>();

  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _init = false;

  constructor() {
    super();
    this._boot();
  }

  // ─── INIT ───

  private _boot() {
    if (this._init) return;
    this._init = true;

    for (const p of PAIRS) {
      this.trades.set(p.id, []);
      this.candles.set(p.id, new Map());
      for (const tf of TIMEFRAMES) this.candles.get(p.id)!.set(tf.label, []);
    }

    if (!this._load()) this._seed();

    for (const p of PAIRS) this._ticker(p.id);
    this._mmStart();
  }

  // ─── SEED HISTORICAL DATA ───

  private _seed() {
    for (const p of PAIRS) {
      this._seedCandles(p);
      this._seedBook(p);
    }
    this._save();
  }

  private _seedCandles(pair: TradingPair) {
    const now = Math.floor(Date.now() / 1000);

    for (const tf of TIMEFRAMES) {
      const count = SEED_COUNTS[tf.label] || 100;
      let price = pair.basePrice;
      const arr: Candle[] = [];

      for (let i = count; i >= 0; i--) {
        const time = bucket(now - i * tf.seconds, tf.seconds);
        const vol = 0.015 + Math.random() * 0.025;
        const ch = (Math.random() - 0.48) * vol;
        const o = price;
        const c = round(price * (1 + ch), pair.pricePrecision);
        const h = round(Math.max(o, c) * (1 + Math.random() * 0.008), pair.pricePrecision);
        const l = round(Math.min(o, c) * (1 - Math.random() * 0.008), pair.pricePrecision);
        const v = Math.round(200 + Math.random() * 10000);
        arr.push({ time, open: o, high: h, low: l, close: c, volume: v });
        price = c;
      }

      this.candles.get(pair.id)!.set(tf.label, arr);
    }
  }

  private _seedBook(pair: TradingPair) {
    const hourC = this.candles.get(pair.id)!.get('1h')!;
    const mid = hourC.length > 0 ? hourC[hourC.length - 1].close : pair.basePrice;

    for (let i = 0; i < 20; i++) {
      const spread = 0.001 + i * 0.002;
      const bp = round(mid * (1 - spread), pair.pricePrecision);
      const ap = round(mid * (1 + spread), pair.pricePrecision);
      const amt = Math.round(pair.minAmount * (5 + Math.random() * 100));

      if (bp > 0) this._addBot(pair.id, 'buy', bp, amt);
      if (ap > 0) this._addBot(pair.id, 'sell', ap, amt);
    }
  }

  private _addBot(pairId: string, side: 'buy' | 'sell', price: number, amount: number) {
    const o: Order = {
      id: uid('B'), pairId, side, type: 'limit', price, amount,
      filled: 0, remaining: amount,
      status: 'open', trader: BOT_ADDR, timestamp: Date.now(), isBot: true,
    };
    this.orders.set(o.id, o);
  }

  // ─── PUBLIC: Place Order ───

  placeOrder(params: {
    pairId: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    price: number;
    amount: number;
    trader: string;
  }): Order {
    const pair = PAIRS.find(p => p.id === params.pairId);
    if (!pair) throw new Error('Invalid pair');
    if (params.amount < pair.minAmount) throw new Error(`Minimum amount: ${pair.minAmount} ${pair.base}`);
    if (params.type === 'limit' && params.price <= 0) throw new Error('Price must be > 0');

    const order: Order = {
      id: uid('U'),
      pairId: params.pairId,
      side: params.side,
      type: params.type,
      price: params.type === 'market' ? 0 : round(params.price, pair.pricePrecision),
      amount: round(params.amount, pair.amountPrecision),
      filled: 0,
      remaining: round(params.amount, pair.amountPrecision),
      status: 'open',
      trader: params.trader,
      timestamp: Date.now(),
      isBot: false,
    };

    this.orders.set(order.id, order);
    this.emit('order', order);

    this._match(order);

    if (order.remaining > 0 && order.type === 'market') {
      order.status = order.filled > 0 ? 'partial' : 'cancelled';
      this.orders.set(order.id, order);
    }

    this.emit('orderbook', params.pairId);
    this._ticker(params.pairId);
    this._save();
    return order;
  }

  // ─── PUBLIC: Cancel Order ───

  cancelOrder(orderId: string): boolean {
    const o = this.orders.get(orderId);
    if (!o || o.status === 'filled' || o.status === 'cancelled') return false;
    o.status = 'cancelled';
    o.remaining = 0;
    this.orders.set(orderId, o);
    this.emit('order', o);
    this.emit('orderbook', o.pairId);
    this._save();
    return true;
  }

  // ─── MATCHING ENGINE ───

  private _match(incoming: Order) {
    const pair = PAIRS.find(p => p.id === incoming.pairId)!;

    const opp = this._openOrders(incoming.pairId)
      .filter(o => o.side !== incoming.side && o.id !== incoming.id)
      .sort((a, b) =>
        incoming.side === 'buy' ? a.price - b.price : b.price - a.price
      );

    for (const maker of opp) {
      if (incoming.remaining <= 0) break;

      if (incoming.type === 'limit') {
        if (incoming.side === 'buy' && maker.price > incoming.price) break;
        if (incoming.side === 'sell' && maker.price < incoming.price) break;
      }

      const fillAmt = round(Math.min(incoming.remaining, maker.remaining), pair.amountPrecision);
      if (fillAmt <= 0) continue;
      const fillPrice = maker.price;

      const trade: Trade = {
        id: uid('T'), pairId: incoming.pairId,
        price: fillPrice, amount: fillAmt,
        quoteAmount: round(fillAmt * fillPrice, pair.pricePrecision),
        maker: maker.trader, taker: incoming.trader,
        side: incoming.side, timestamp: Date.now(),
      };

      const pairTrades = this.trades.get(incoming.pairId)!;
      pairTrades.push(trade);
      if (pairTrades.length > 2000) pairTrades.splice(0, pairTrades.length - 1500);

      incoming.filled += fillAmt;
      incoming.remaining = round(incoming.remaining - fillAmt, pair.amountPrecision);
      incoming.status = incoming.remaining <= 0 ? 'filled' : 'partial';
      this.orders.set(incoming.id, incoming);

      maker.filled += fillAmt;
      maker.remaining = round(maker.remaining - fillAmt, pair.amountPrecision);
      maker.status = maker.remaining <= 0 ? 'filled' : 'partial';
      this.orders.set(maker.id, maker);

      this._updateCandle(incoming.pairId, fillPrice, fillAmt);
      this.emit('trade', trade);
      this.emit('order', maker);
    }
  }

  // ─── CANDLE AGGREGATION ───

  private _updateCandle(pairId: string, price: number, volume: number) {
    const nowSec = Math.floor(Date.now() / 1000);
    for (const tf of TIMEFRAMES) {
      const bk = bucket(nowSec, tf.seconds);
      const arr = this.candles.get(pairId)!.get(tf.label)!;
      const last = arr.length > 0 ? arr[arr.length - 1] : null;

      if (last && last.time === bk) {
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.close = price;
        last.volume += volume;
      } else {
        arr.push({ time: bk, open: price, high: price, low: price, close: price, volume });
        if (arr.length > 600) arr.splice(0, arr.length - 500);
      }

      this.emit('candle', { pairId, timeframe: tf.label, candle: arr[arr.length - 1] });
    }
  }

  // ─── DATA ACCESS ───

  private _openOrders(pairId: string): Order[] {
    return Array.from(this.orders.values())
      .filter(o => o.pairId === pairId && (o.status === 'open' || o.status === 'partial'));
  }

  getOrderBook(pairId: string, depth = 20): { bids: BookLevel[]; asks: BookLevel[] } {
    const open = this._openOrders(pairId);
    const bidsM = new Map<number, { amount: number; count: number }>();
    const asksM = new Map<number, { amount: number; count: number }>();

    for (const o of open) {
      const m = o.side === 'buy' ? bidsM : asksM;
      const e = m.get(o.price) || { amount: 0, count: 0 };
      e.amount += o.remaining;
      e.count++;
      m.set(o.price, e);
    }

    const buildLevels = (
      m: Map<number, { amount: number; count: number }>,
      sortFn: (a: number, b: number) => number,
    ): BookLevel[] =>
      Array.from(m.entries())
        .sort(([a], [b]) => sortFn(a, b))
        .slice(0, depth)
        .reduce<BookLevel[]>((acc, [price, { amount, count }]) => {
          const prev = acc.length > 0 ? acc[acc.length - 1].total : 0;
          acc.push({ price, amount, count, total: prev + amount });
          return acc;
        }, []);

    return {
      bids: buildLevels(bidsM, (a, b) => b - a),
      asks: buildLevels(asksM, (a, b) => a - b),
    };
  }

  getTrades(pairId: string, limit = 50): Trade[] {
    return (this.trades.get(pairId) || []).slice(-limit).reverse();
  }

  getCandles(pairId: string, timeframe: string): Candle[] {
    return this.candles.get(pairId)?.get(timeframe) || [];
  }

  getUserOrders(trader: string, pairId?: string): Order[] {
    return Array.from(this.orders.values())
      .filter(o => o.trader === trader && !o.isBot && (!pairId || o.pairId === pairId))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // ─── TICKER ───

  private _ticker(pairId: string) {
    const pair = PAIRS.find(p => p.id === pairId)!;
    const trades = this.trades.get(pairId) || [];
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    const t24 = trades.filter(t => t.timestamp > dayAgo);
    const last = trades.length > 0 ? trades[trades.length - 1] : null;
    const prev = trades.length > 1 ? trades[trades.length - 2] : null;
    const book = this.getOrderBook(pairId, 1);

    const lastP = last?.price || pair.basePrice;
    const firstP = t24.length > 0 ? t24[0].price : lastP;
    const ch = lastP - firstP;
    const chPct = firstP > 0 ? (ch / firstP) * 100 : 0;
    const bestBid = book.bids[0]?.price || 0;
    const bestAsk = book.asks[0]?.price || 0;

    const ticker: Ticker = {
      pairId, lastPrice: lastP,
      prevPrice: prev?.price || lastP,
      change24h: round(ch, pair.pricePrecision),
      changePercent24h: round(chPct, 2),
      high24h: t24.length > 0 ? Math.max(...t24.map(t => t.price)) : lastP,
      low24h: t24.length > 0 ? Math.min(...t24.map(t => t.price)) : lastP,
      volume24h: t24.reduce((s, t) => s + t.amount, 0),
      quoteVolume24h: round(t24.reduce((s, t) => s + t.quoteAmount, 0), pair.pricePrecision),
      bestBid, bestAsk,
      spread: bestAsk > 0 && bestBid > 0 ? round(bestAsk - bestBid, pair.pricePrecision) : 0,
      spreadPercent: bestBid > 0 && bestAsk > 0 ? round(((bestAsk - bestBid) / bestBid) * 100, 4) : 0,
    };

    this.tickers.set(pairId, ticker);
    this.emit('ticker', ticker);
  }

  getTicker(pairId: string): Ticker {
    return this.tickers.get(pairId) || {
      pairId, lastPrice: PAIRS.find(p => p.id === pairId)?.basePrice || 0,
      prevPrice: 0, change24h: 0, changePercent24h: 0,
      high24h: 0, low24h: 0, volume24h: 0, quoteVolume24h: 0,
      bestBid: 0, bestAsk: 0, spread: 0, spreadPercent: 0,
    };
  }

  // ─── MARKET MAKER ───

  private _mmStart() {
    if (this._timer) return;
    const tick = () => {
      this._mmTick();
      this._timer = setTimeout(tick, 1500 + Math.random() * 3500);
    };
    this._timer = setTimeout(tick, 800);
  }

  stopMarketMaker() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  private _mmTick() {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const tk = this.getTicker(pair.id);
    const mid = tk.lastPrice || pair.basePrice;
    const roll = Math.random();

    if (roll < 0.30) {
      // Place limit order
      const side = Math.random() < 0.5 ? 'buy' as const : 'sell' as const;
      const off = (0.0005 + Math.random() * 0.005) * mid;
      const price = round(side === 'buy' ? mid - off : mid + off, pair.pricePrecision);
      const amt = round(pair.minAmount * (5 + Math.random() * 50), pair.amountPrecision);
      if (price > 0) this._addBot(pair.id, side, price, amt);
      this.emit('orderbook', pair.id);
    } else if (roll < 0.65) {
      // Market order → generates trade
      const side = Math.random() < 0.5 ? 'buy' as const : 'sell' as const;
      const amt = round(pair.minAmount * (2 + Math.random() * 20), pair.amountPrecision);
      const order: Order = {
        id: uid('B'), pairId: pair.id, side, type: 'market', price: 0,
        amount: amt, filled: 0, remaining: amt,
        status: 'open', trader: BOT_ADDR, timestamp: Date.now(), isBot: true,
      };
      this.orders.set(order.id, order);
      this._match(order);
      if (order.remaining > 0) {
        order.status = order.filled > 0 ? 'partial' : 'cancelled';
        this.orders.set(order.id, order);
      }
      this.emit('orderbook', pair.id);
      this._ticker(pair.id);
    } else if (roll < 0.80) {
      // Clean old bot orders
      const old = this._openOrders(pair.id)
        .filter(o => o.isBot && Date.now() - o.timestamp > 120_000);
      if (old.length > 15) {
        for (const o of old.slice(0, 5)) {
          o.status = 'cancelled'; o.remaining = 0;
          this.orders.set(o.id, o);
        }
        this.emit('orderbook', pair.id);
      }
    } else {
      // Replenish if thin
      const book = this.getOrderBook(pair.id);
      if (book.bids.length < 8 || book.asks.length < 8) {
        this._seedBook(pair);
        this.emit('orderbook', pair.id);
      }
    }

    // Periodic cleanup of filled/cancelled orders (memory management)
    if (Math.random() < 0.05) this._cleanup();
    if (Math.random() < 0.1) this._save();
  }

  private _cleanup() {
    const cutoff = Date.now() - 600_000; // 10 min
    const toDelete: string[] = [];
    for (const [id, o] of this.orders) {
      if (o.isBot && (o.status === 'filled' || o.status === 'cancelled') && o.timestamp < cutoff) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) this.orders.delete(id);
  }

  // ─── PERSISTENCE ───

  private _save() {
    try {
      const openOrders = Array.from(this.orders.entries())
        .filter(([, o]) => o.status === 'open' || o.status === 'partial');
      const userOrders = Array.from(this.orders.entries())
        .filter(([, o]) => !o.isBot && Date.now() - o.timestamp < 86_400_000);

      const data = {
        orders: [...openOrders, ...userOrders],
        trades: Object.fromEntries(
          Array.from(this.trades.entries()).map(([k, v]) => [k, v.slice(-500)])
        ),
        candles: Object.fromEntries(
          Array.from(this.candles.entries()).map(([pid, m]) => [
            pid,
            Object.fromEntries(Array.from(m.entries()).map(([tf, c]) => [tf, c.slice(-500)])),
          ])
        ),
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* quota exceeded */ }
  }

  private _load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      // Don't load stale data (> 1 hour)
      if (data.savedAt && Date.now() - data.savedAt > 3_600_000) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }

      if (data.orders) {
        for (const [id, order] of data.orders as [string, Order][]) {
          this.orders.set(id, order);
        }
      }

      if (data.trades) {
        for (const [pid, trades] of Object.entries(data.trades)) {
          if (this.trades.has(pid)) this.trades.set(pid, trades as Trade[]);
        }
      }

      if (data.candles) {
        for (const [pid, tfMap] of Object.entries(data.candles)) {
          if (!this.candles.has(pid)) continue;
          for (const [tf, candles] of Object.entries(tfMap as Record<string, Candle[]>)) {
            this.candles.get(pid)!.set(tf, candles);
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // ─── RESET ───

  reset() {
    this.stopMarketMaker();
    this.orders.clear();
    for (const p of PAIRS) {
      this.trades.set(p.id, []);
      for (const tf of TIMEFRAMES) this.candles.get(p.id)!.set(tf.label, []);
    }
    localStorage.removeItem(STORAGE_KEY);
    this._seed();
    this._mmStart();
    for (const p of PAIRS) {
      this.emit('orderbook', p.id);
      this._ticker(p.id);
    }
  }

  // Public save for beforeunload
  forceSave() { this._save(); }
}

// ─── Singleton ───

export const exchange = new ExchangeEngine();

// Save on page close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => exchange.forceSave());
}

import { useState, useEffect, useCallback } from 'react';
import {
  exchange,
  PAIRS,
  type Ticker,
  type Trade,
  type Candle,
  type Order,
  type BookLevel,
} from '@/lib/exchange';

// ─── useExchange: main hook for a trading pair ───

export function useExchange(pairId: string) {
  const [ticker, setTicker] = useState<Ticker>(exchange.getTicker(pairId));
  const [orderBook, setOrderBook] = useState<{ bids: BookLevel[]; asks: BookLevel[] }>(
    exchange.getOrderBook(pairId)
  );
  const [recentTrades, setRecentTrades] = useState<Trade[]>(exchange.getTrades(pairId));

  useEffect(() => {
    const refresh = () => {
      setTicker(exchange.getTicker(pairId));
      setOrderBook(exchange.getOrderBook(pairId));
      setRecentTrades(exchange.getTrades(pairId));
    };

    const u1 = exchange.on('ticker', (t: unknown) => {
      if ((t as Ticker).pairId === pairId) setTicker(t as Ticker);
    });
    const u2 = exchange.on('orderbook', (pid: unknown) => {
      if (pid === pairId) setOrderBook(exchange.getOrderBook(pairId));
    });
    const u3 = exchange.on('trade', (t: unknown) => {
      if ((t as Trade).pairId === pairId) setRecentTrades(exchange.getTrades(pairId));
    });

    refresh();
    return () => { u1(); u2(); u3(); };
  }, [pairId]);

  const placeOrder = useCallback(
    (params: { side: 'buy' | 'sell'; type: 'limit' | 'market'; price: number; amount: number; trader: string }) =>
      exchange.placeOrder({ ...params, pairId }),
    [pairId],
  );

  const cancelOrder = useCallback((id: string) => exchange.cancelOrder(id), []);

  return {
    pair: PAIRS.find(p => p.id === pairId)!,
    ticker,
    orderBook,
    recentTrades,
    placeOrder,
    cancelOrder,
  };
}

// ─── useCandles: candle data for chart ───

export function useCandles(pairId: string, timeframe: string) {
  const [candles, setCandles] = useState<Candle[]>(exchange.getCandles(pairId, timeframe));

  useEffect(() => {
    setCandles(exchange.getCandles(pairId, timeframe));
    const unsub = exchange.on('candle', (data: unknown) => {
      const d = data as { pairId: string; timeframe: string };
      if (d.pairId === pairId && d.timeframe === timeframe) {
        setCandles([...exchange.getCandles(pairId, timeframe)]);
      }
    });
    return unsub;
  }, [pairId, timeframe]);

  return candles;
}

// ─── useUserOrders: current user's orders ───

export function useUserOrders(trader: string | undefined, pairId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!trader) { setOrders([]); return; }
    setOrders(exchange.getUserOrders(trader, pairId));
    const unsub = exchange.on('order', () => {
      if (trader) setOrders(exchange.getUserOrders(trader, pairId));
    });
    return unsub;
  }, [trader, pairId]);

  return orders;
}

// ─── useAllTickers: all pair tickers (for pair selector) ───

export function useAllTickers() {
  const [tickers, setTickers] = useState<Record<string, Ticker>>(() => {
    const m: Record<string, Ticker> = {};
    for (const p of PAIRS) m[p.id] = exchange.getTicker(p.id);
    return m;
  });

  useEffect(() => {
    const unsub = exchange.on('ticker', (t: unknown) => {
      const tk = t as Ticker;
      setTickers(prev => ({ ...prev, [tk.pairId]: tk }));
    });
    return unsub;
  }, []);

  return tickers;
}

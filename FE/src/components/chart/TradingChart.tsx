import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';

// ─── Types ───
export interface OHLCVData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingChartProps {
  data: OHLCVData[];
  pair: string;
  height?: number;
  className?: string;
}

// ─── Generate realistic mock OHLCV data ───
function generateMockData(days: number, basePrice: number): OHLCVData[] {
  const data: OHLCVData[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;

  for (let i = days; i >= 0; i--) {
    const time = (now - i * daySeconds) as Time;
    const volatility = 0.02 + Math.random() * 0.03;
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);
    const volume = 10000 + Math.random() * 90000;

    data.push({
      time,
      open: parseFloat(open.toFixed(6)),
      high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),
      close: parseFloat(close.toFixed(6)),
      volume: parseFloat(volume.toFixed(0)),
    });

    price = close;
  }
  return data;
}

// ─── Timeframes ───
const TIMEFRAMES = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
] as const;

// ─── Preset Pairs ───
export const TRADING_PAIRS = [
  { pair: 'VNDC/ETH', basePrice: 0.00001 },
  { pair: 'VNDC/SGOV', basePrice: 50 },
  { pair: 'SGOV/ETH', basePrice: 0.0002 },
] as const;

export default function TradingChart({ data, pair, height = 420, className = '' }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [timeframe, setTimeframe] = useState('1d');
  const [showMA, setShowMA] = useState(true);

  // Calculate MA20
  const ma20 = useMemo(() => {
    if (data.length < 20) return [];
    return data.map((d, i) => {
      if (i < 19) return null;
      const sum = data.slice(i - 19, i + 1).reduce((acc, cur) => acc + cur.close, 0);
      return { time: d.time, value: parseFloat((sum / 20).toFixed(6)) };
    }).filter(Boolean) as { time: Time; value: number }[];
  }, [data]);

  // Current price info
  const currentPrice = data.length > 0 ? data[data.length - 1] : null;
  const prevClose = data.length > 1 ? data[data.length - 2].close : currentPrice?.open || 0;
  const priceChange = currentPrice ? currentPrice.close - prevClose : 0;
  const priceChangePercent = prevClose ? (priceChange / prevClose) * 100 : 0;
  const isPositive = priceChange >= 0;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#6b7280',
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(100, 116, 139, 0.08)' },
        horzLines: { color: 'rgba(100, 116, 139, 0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(99, 102, 241, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: 'rgba(99, 102, 241, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(100, 116, 139, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: 'rgba(100, 116, 139, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const candleData: CandlestickData[] = data.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candlestickSeries.setData(candleData);

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumeData: HistogramData[] = data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
    }));
    volumeSeries.setData(volumeData);

    // MA20 line
    if (showMA && ma20.length > 0) {
      const maSeries = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      maSeries.setData(ma20);
    }

    chart.timeScale().fitContent();

    chartRef.current = chart;
    candlestickRef.current = candlestickSeries;
    volumeRef.current = volumeSeries;

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [data, height, showMA, ma20]);

  return (
    <div className={`card overflow-hidden ${className}`}>
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 pb-0">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-surface-800">{pair}</h3>
          {currentPrice && (
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-surface-800">
                {currentPrice.close.toFixed(currentPrice.close < 1 ? 6 : 2)}
              </span>
              <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{priceChange.toFixed(currentPrice.close < 1 ? 8 : 4)}
                ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* MA Toggle */}
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              showMA
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-surface-50 text-surface-500 border border-surface-200'
            }`}
          >
            MA20
          </button>

          {/* Timeframes */}
          <div className="flex rounded-xl bg-surface-50 border border-surface-200 p-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  timeframe === tf.value
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OHLCV Summary Bar */}
      {currentPrice && (
        <div className="flex gap-4 px-4 py-2 text-[11px]">
          <span className="text-surface-500">O <span className="text-surface-700 font-mono">{currentPrice.open.toFixed(currentPrice.open < 1 ? 6 : 2)}</span></span>
          <span className="text-surface-500">H <span className="text-emerald-600 font-mono">{currentPrice.high.toFixed(currentPrice.high < 1 ? 6 : 2)}</span></span>
          <span className="text-surface-500">L <span className="text-red-600 font-mono">{currentPrice.low.toFixed(currentPrice.low < 1 ? 6 : 2)}</span></span>
          <span className="text-surface-500">C <span className={`font-mono ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>{currentPrice.close.toFixed(currentPrice.close < 1 ? 6 : 2)}</span></span>
          <span className="text-surface-500">Vol <span className="text-surface-700 font-mono">{(currentPrice.volume / 1000).toFixed(1)}K</span></span>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}

// ─── Hook to generate mock data for a pair ───
export function useTradingData(pairIndex: number, days = 90): OHLCVData[] {
  return useMemo(() => {
    const p = TRADING_PAIRS[pairIndex] || TRADING_PAIRS[0];
    return generateMockData(days, p.basePrice);
  }, [pairIndex, days]);
}

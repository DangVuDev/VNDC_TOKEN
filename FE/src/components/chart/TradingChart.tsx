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
import { useTheme } from '@/contexts/ThemeContext';
import { TIMEFRAMES, type Candle } from '@/lib/exchange';

// ─── Props ───

interface TradingChartProps {
  candles: Candle[];
  pair: string;
  height?: number;
  className?: string;
  timeframe: string;
  onTimeframeChange?: (tf: string) => void;
}

// ─── Helpers ───

function toCD(c: Candle): CandlestickData {
  return { time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close };
}
function toHD(c: Candle): HistogramData {
  return {
    time: c.time as Time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
  };
}

function calcMA(candles: Candle[], period: number): { time: Time; value: number }[] {
  if (candles.length < period) return [];
  return candles
    .map((d, i) => {
      if (i < period - 1) return null;
      const sum = candles.slice(i - period + 1, i + 1).reduce((a, c) => a + c.close, 0);
      return { time: d.time as Time, value: sum / period };
    })
    .filter(Boolean) as { time: Time; value: number }[];
}

// ─── Component ───

export default function TradingChart({
  candles,
  pair,
  height = 400,
  className = '',
  timeframe,
  onTimeframeChange,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const csRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRef = useRef<ISeriesApi<'Line'> | null>(null);
  const initRef = useRef(false);

  const { isDark } = useTheme();
  const [showMA, setShowMA] = useState(true);

  // Theme colors
  const bg = isDark ? '#1a1b2e' : '#ffffff';
  const text = isDark ? '#94a3b8' : '#6b7280';
  const grid = isDark ? 'rgba(148,163,184,0.06)' : 'rgba(100,116,139,0.08)';
  const border = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.1)';

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: text,
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(99,102,241,0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#6366f1' },
        horzLine: { color: 'rgba(99,102,241,0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#6366f1' },
      },
      rightPriceScale: { borderColor: border, scaleMargins: { top: 0.1, bottom: 0.25 } },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false },
      handleScroll: { vertTouchDrag: false },
    });

    const cs = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });

    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const ma = chart.addLineSeries({
      color: '#f59e0b', lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    csRef.current = cs;
    volRef.current = vol;
    maRef.current = ma;
    initRef.current = false;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Update theme
  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    });
  }, [bg, text, grid]);

  // Update data
  useEffect(() => {
    const cs = csRef.current;
    const vol = volRef.current;
    const ma = maRef.current;
    if (!cs || !vol || candles.length === 0) return;

    if (!initRef.current) {
      cs.setData(candles.map(toCD));
      vol.setData(candles.map(toHD));
      if (showMA && ma) ma.setData(calcMA(candles, 20));
      chartRef.current?.timeScale().fitContent();
      initRef.current = true;
    } else {
      const last = candles[candles.length - 1];
      cs.update(toCD(last));
      vol.update(toHD(last));
      if (showMA && ma) {
        const maData = calcMA(candles, 20);
        if (maData.length > 0) ma.update(maData[maData.length - 1]);
      }
    }
  }, [candles, showMA]);

  // Reset initialization flag on timeframe/pair change
  useEffect(() => {
    initRef.current = false;
  }, [timeframe, pair]);

  // Toggle MA visibility
  useEffect(() => {
    if (maRef.current) {
      maRef.current.applyOptions({ visible: showMA });
    }
  }, [showMA]);

  // Derived values
  const last = candles.length > 0 ? candles[candles.length - 1] : null;
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = prev && prev.close > 0 ? (change / prev.close) * 100 : 0;
  const isUp = change >= 0;
  const dp = last && last.close < 1 ? 6 : 2;

  return (
    <div className={`card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 pb-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-bold text-surface-800 shrink-0">{pair}</span>
          {last && (
            <>
              <span className="text-lg font-bold text-surface-800 font-mono">{last.close.toFixed(dp)}</span>
              <span className={`text-xs font-semibold ${isUp ? 'text-success' : 'text-danger'}`}>
                {isUp ? '+' : ''}{change.toFixed(dp)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all border ${
              showMA
                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700'
                : 'bg-surface-50 text-surface-500 border-surface-200'
            }`}
          >
            MA20
          </button>
          <div className="flex rounded-lg bg-surface-50 border border-surface-200 p-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.label}
                onClick={() => onTimeframeChange?.(tf.label)}
                className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  timeframe === tf.label
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OHLCV mini bar */}
      {last && (
        <div className="flex flex-wrap gap-3 px-3 py-1.5 text-[10px]">
          <span className="text-surface-500">O <span className="text-surface-700 font-mono">{last.open.toFixed(dp)}</span></span>
          <span className="text-surface-500">H <span className="text-success font-mono">{last.high.toFixed(dp)}</span></span>
          <span className="text-surface-500">L <span className="text-danger font-mono">{last.low.toFixed(dp)}</span></span>
          <span className="text-surface-500">C <span className={`font-mono ${isUp ? 'text-success' : 'text-danger'}`}>{last.close.toFixed(dp)}</span></span>
          <span className="text-surface-500">Vol <span className="text-surface-700 font-mono">{last.volume > 999 ? `${(last.volume / 1000).toFixed(1)}K` : last.volume}</span></span>
        </div>
      )}

      {/* Chart */}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

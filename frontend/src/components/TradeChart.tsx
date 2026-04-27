'use client';

/**
 * TradeChart — Professional live candlestick chart for a single trade's lifespan.
 *
 * Visual design:
 *   • Dark slate background — looks like a real trading terminal inside the light card
 *   • Time window auto-locked to 5-min before entry → now (no manual zoom needed)
 *   • Price scale auto-zoomed via autoscaleInfoProvider to keep entry/SL/TP
 *     prominently visible with 20% padding above and below
 *   • Blue arrow marker at the exact entry candle
 *   • Colour-coded price lines with price labels on the axis
 *   • Outcome banner when TP or SL has permanently locked
 *
 * Library: TradingView lightweight-charts v5, lazily imported (SSR-safe).
 */

import { useEffect, useRef } from 'react';
import { CheckCheck, X, Activity } from 'lucide-react';
import type { CandleBar } from '@/lib/types';
import type { LockedOutcome } from '@/lib/useTradeOutcome';
import { cn, formatCurrency } from '@/lib/utils';

// ── Props ─────────────────────────────────────────────────────────────────────

interface TradeChartProps {
  ticker: string;
  candles: CandleBar[];
  entryPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  entryTime: string;
  direction: 'CALL' | 'PUT';
  lockedOutcome: LockedOutcome;
  isLoading: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TradeChart({
  ticker,
  candles,
  entryPrice,
  stopPrice,
  targetPrice,
  entryTime,
  direction,
  lockedOutcome,
  isLoading,
}: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isCall = direction === 'CALL';

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const el = containerRef.current;
    let chart: any   = null;
    let ro: ResizeObserver | null = null;
    let mounted = true;

    (async () => {
      const {
        createChart,
        CandlestickSeries,
        LineStyle,
        ColorType,
        createSeriesMarkers,
      } = await import('lightweight-charts');

      if (!mounted || !el) return;
      el.innerHTML = '';

      // ── Chart instance ──────────────────────────────────────────────────────
      // Helper: format a UTC-seconds timestamp as HH:MM ET
      const toET = (utcSec: number) =>
        new Date(utcSec * 1000).toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour:     '2-digit',
          minute:   '2-digit',
          hour12:   false,
        });

      chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: '#0f172a' },
          textColor:  '#94a3b8',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize:   11,
        },
        grid: {
          vertLines: { color: '#1e293b' },
          horzLines: { color: '#1e293b' },
        },
        localization: {
          // Crosshair time tooltip → ET
          timeFormatter: (utcSec: number) => `${toET(utcSec)} ET`,
        },
        width:  el.clientWidth,
        height: 250,
        rightPriceScale: {
          borderColor:   '#334155',
          scaleMargins:  { top: 0.18, bottom: 0.18 },
          minimumWidth:  70,
        },
        timeScale: {
          borderColor:    '#334155',
          timeVisible:    true,
          secondsVisible: false,
          rightOffset:    5,
          // X-axis tick labels → ET
          tickMarkFormatter: (utcSec: number) => toET(utcSec),
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color:                '#475569',
            width:                1,
            style:                LineStyle.Dashed,
            labelBackgroundColor: '#1e293b',
          },
          horzLine: {
            color:                '#475569',
            width:                1,
            style:                LineStyle.Dashed,
            labelBackgroundColor: '#1e293b',
          },
        },
        handleScroll: true,
        handleScale:  true,
      });

      // ── Collect all price levels for auto-scale math ─────────────────────────
      const levels = [entryPrice, stopPrice, targetPrice].filter(
        (p): p is number => p !== null,
      );

      // ── Candlestick series with autoscaleInfoProvider ────────────────────────
      const series = chart.addSeries(CandlestickSeries, {
        upColor:         '#22c55e',
        downColor:       '#ef4444',
        borderUpColor:   '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor:     '#475569',
        wickDownColor:   '#475569',

        /**
         * Ensure the price scale always encompasses entry, SL, and TP even
         * when the candle range would otherwise exclude them.  Adds 20% padding
         * above and below the combined level span.
         */
        autoscaleInfoProvider: (original: () => any) => {
          const base = original();

          if (!levels.length) return base;

          const levelMin = Math.min(...levels);
          const levelMax = Math.max(...levels);

          // Merge candle range with our levels
          const combinedMin = base
            ? Math.min(base.priceRange.minValue, levelMin)
            : levelMin;
          const combinedMax = base
            ? Math.max(base.priceRange.maxValue, levelMax)
            : levelMax;

          // Guarantee a minimum visible span (avoid degenerate flat charts)
          const rawSpan = combinedMax - combinedMin;
          const span    = rawSpan < combinedMin * 0.002
            ? combinedMin * 0.01
            : rawSpan;

          const pad = span * 0.20; // 20% padding top and bottom

          return {
            priceRange: {
              minValue: combinedMin - pad,
              maxValue: combinedMax + pad,
            },
            margins: base?.margins,
          };
        },
      });

      // ── Load ALL today's candles — logical range controls the visible window ──
      const entryMs = new Date(entryTime).getTime();

      series.setData(
        candles.map((c) => ({
          time:  Math.floor(new Date(c.t).getTime() / 1000) as any,
          open:  c.o,
          high:  c.h,
          low:   c.l,
          close: c.c,
        })),
      );

      // ── Entry arrow marker ───────────────────────────────────────────────────
      // Find the candle closest to the entry timestamp
      const closestCandle = candles.reduce((prev, curr) => {
        const pd = Math.abs(new Date(prev.t).getTime() - entryMs);
        const cd = Math.abs(new Date(curr.t).getTime() - entryMs);
        return cd < pd ? curr : prev;
      });

      createSeriesMarkers(series, [
        {
          time:     Math.floor(new Date(closestCandle.t).getTime() / 1000) as any,
          position: isCall ? 'belowBar' : 'aboveBar',
          color:    '#60a5fa',
          shape:    isCall ? 'arrowUp' : 'arrowDown',
          text:     'Entry',
          size:     1,
        },
      ]);

      // ── Price lines ──────────────────────────────────────────────────────────

      // Entry — bright blue, slightly thicker
      series.createPriceLine({
        price:            entryPrice,
        color:            '#60a5fa',
        lineWidth:        2,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: true,
        title:            `Entry  ${formatCurrency(entryPrice)}`,
      });

      // Stop-loss — red
      if (stopPrice !== null) {
        series.createPriceLine({
          price:            stopPrice,
          color:            '#f87171',
          lineWidth:        1,
          lineStyle:        LineStyle.Dashed,
          axisLabelVisible: true,
          title:            `SL  ${formatCurrency(stopPrice)}`,
        });
      }

      // Take-profit — green
      if (targetPrice !== null) {
        series.createPriceLine({
          price:            targetPrice,
          color:            '#4ade80',
          lineWidth:        1,
          lineStyle:        LineStyle.Dashed,
          axisLabelVisible: true,
          title:            `TP  ${formatCurrency(targetPrice)}`,
        });
      }

      // ── Time zoom via logical range (bar indices — reliable in v5) ───────────
      // Find the index of the entry candle in the full candles array
      const entryIdx = candles.findIndex(
        (c) => Math.abs(new Date(c.t).getTime() - entryMs) < 60 * 1000,
      );
      const lastIdx   = candles.length - 1;
      const anchorIdx = entryIdx >= 0 ? entryIdx : lastIdx;

      // Show 30 candles of lead-up + entry + everything through current bar + 4 padding slots
      chart.timeScale().setVisibleLogicalRange({
        from: anchorIdx - 30,   // 30 one-min candles before entry
        to:   lastIdx + 4,      // current bar + small right-edge breathing room
      });

      // ── Responsive resize ────────────────────────────────────────────────────
      ro = new ResizeObserver(() => {
        if (el && mounted) chart.applyOptions({ width: el.clientWidth });
      });
      ro.observe(el);
    })();

    return () => {
      mounted = false;
      ro?.disconnect();
      try { chart?.remove(); } catch { /* already removed */ }
    };
  }, [candles, entryPrice, stopPrice, targetPrice, entryTime, direction]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
          <div className="h-3 w-28 bg-slate-800 rounded animate-pulse" />
          <div className="h-3 w-12 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-[250px] flex items-center justify-center gap-2 bg-slate-900">
          <Activity className="h-4 w-4 text-slate-600 animate-pulse" />
          <span className="text-xs text-slate-600">Fetching candles…</span>
        </div>
        <div className="h-8 bg-slate-900 border-t border-slate-800" />
      </div>
    );
  }

  // ── No data ─────────────────────────────────────────────────────────────────
  if (candles.length === 0) {
    return (
      <div className="w-full rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900">
        <div className="h-[290px] flex flex-col items-center justify-center gap-2 text-center px-6">
          <Activity className="h-5 w-5 text-slate-600" />
          <p className="text-xs text-slate-500">No chart data yet</p>
          <p className="text-[10px] text-slate-600">
            Candles are available during market hours (9:30 AM – 4:00 PM ET)
          </p>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full rounded-xl overflow-hidden border border-slate-700/60 shadow-lg shadow-slate-950/30">

      {/* ── Chart header bar ── */}
      <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {/* Live / locked indicator */}
          {lockedOutcome ? (
            <span className={cn(
              'h-1.5 w-1.5 rounded-full flex-shrink-0',
              lockedOutcome === 'take_profit' ? 'bg-green-400' : 'bg-red-400',
            )} />
          ) : (
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
          )}
          <span className="text-[11px] font-semibold text-slate-300 tracking-wide">
            {ticker}
            <span className={cn(
              'ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold tracking-wider',
              isCall
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20   text-red-400',
            )}>
              {direction}
            </span>
          </span>
          <span className="text-[10px] text-slate-600">· 1-min</span>
        </div>

        {/* Outcome chip */}
        {lockedOutcome ? (
          <div className={cn(
            'flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold',
            lockedOutcome === 'take_profit'
              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
              : 'bg-red-500/15   text-red-400   border border-red-500/30',
          )}>
            {lockedOutcome === 'take_profit'
              ? <><CheckCheck className="h-2.5 w-2.5" /> TP Hit — Locked</>
              : <><X          className="h-2.5 w-2.5" /> SL Hit — Locked</>
            }
          </div>
        ) : (
          <span className="text-[9px] text-slate-600 tracking-widest uppercase">Live</span>
        )}
      </div>

      {/* ── Canvas (lightweight-charts renders here) ── */}
      <div ref={containerRef} className="w-full bg-slate-900" />

      {/* ── Legend bar ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-slate-900 border-t border-slate-800 px-3 py-1.5">
        {/* Entry */}
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="inline-flex h-0 w-5 border-t-[2px] border-dashed border-blue-400 opacity-80" />
          Entry&nbsp;<span className="text-slate-300 font-medium">{formatCurrency(entryPrice)}</span>
        </span>

        {/* SL */}
        {stopPrice !== null && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="inline-flex h-0 w-5 border-t-[1px] border-dashed border-red-400 opacity-80" />
            SL&nbsp;<span className="text-red-400 font-medium">{formatCurrency(stopPrice)}</span>
          </span>
        )}

        {/* TP */}
        {targetPrice !== null && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="inline-flex h-0 w-5 border-t-[1px] border-dashed border-green-400 opacity-80" />
            TP&nbsp;<span className="text-green-400 font-medium">{formatCurrency(targetPrice)}</span>
          </span>
        )}

        {/* Risk/reward ratio */}
        {stopPrice !== null && targetPrice !== null && (
          <>
            <span className="h-3 w-px bg-slate-700 hidden sm:block" />
            <span className="text-[9px] text-slate-600 hidden sm:block">
              R:R&nbsp;
              <span className="text-slate-500 font-medium">
                1 : {Math.abs((targetPrice - entryPrice) / (entryPrice - stopPrice)).toFixed(1)}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { BarChart2, RefreshCw, AlertCircle, Zap, Radio, Clock } from 'lucide-react';
import { useTrades } from '@/lib/api';
import { cn, formatTime } from '@/lib/utils';
import {
  persistActiveTrades,
  usePersistedTrades,
  isDisplayHours,
  isOutcomeExpired,
} from '@/lib/useTradeOutcome';
import TradeCard from './TradeCard';
import type { TradeSetup } from '@/lib/types';

type FilterTab = 'ALL' | 'GOLDEN' | 'V4_ICT';

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All Active', value: 'ALL'    },
  { label: 'Actionable', value: 'GOLDEN' },
  { label: 'ICT V4.1',  value: 'V4_ICT' },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border-dim bg-bg-card p-4 space-y-3 animate-pulse">
      <div className="h-2 w-16 skeleton rounded" />
      <div className="flex items-center gap-3">
        <div className="h-7 w-20 skeleton rounded" />
        <div className="h-5 w-12 skeleton rounded" />
        <div className="ml-auto h-4 w-14 skeleton rounded" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-16 skeleton rounded" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 skeleton rounded" />)}
      </div>
      <div className="space-y-1.5">
        {[1, 2].map((i) => (
          <div key={i} className="h-3 skeleton rounded" style={{ width: `${65 + i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function NoCallouts({ filter, marketClosed }: { filter: FilterTab; marketClosed: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        {!marketClosed && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-accent/15" />
        )}
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-blue-accent/25 bg-blue-accent/8">
          {marketClosed
            ? <Clock className="h-5 w-5 text-text-muted" />
            : <Radio  className="h-5 w-5 text-blue-accent" />
          }
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-text-primary">
          {marketClosed
            ? 'Market closed'
            : filter === 'GOLDEN'  ? 'No Actionable Trades right now'
            : filter === 'V4_ICT' ? 'No ICT V4.1 index signals right now'
            :                       'No active callouts right now'}
        </p>
        <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
          {marketClosed
            ? 'Trade cards are only shown 9:35 AM – 4:00 PM ET. Next session opens at tomorrow\'s open.'
            : filter === 'GOLDEN'
            ? 'All confluence gates must pass simultaneously.'
            : filter === 'V4_ICT'
            ? 'Active FVG + VA Zone + Retracement gates must all pass.'
            : 'Scanner is live and watching every tick. Callouts appear only when a setup clears all quality gates.'}
        </p>
      </div>
      {!marketClosed && (
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-green-trade live-dot" />
          Scanner active
        </div>
      )}
    </div>
  );
}

// ── Section headers ───────────────────────────────────────────────────────────

function GoldenHeader({ count }: { count: number }) {
  return (
    <div className="col-span-full">
      <div className="flex items-center gap-2 rounded-lg border border-gold-trade/35 bg-gold-trade/8 px-3 py-2 mb-1">
        <Zap className="h-3.5 w-3.5 text-gold-trade flex-shrink-0" />
        <span className="text-xs font-bold tracking-wider text-gold-trade uppercase">Actionable Trades</span>
        <span className="rounded-full bg-gold-trade/20 border border-gold-trade/30 px-1.5 py-0.5 text-[9px] font-semibold text-gold-trade">
          {count}
        </span>
        <span className="ml-auto text-[10px] text-gold-trade/60">All confluence gates passed</span>
      </div>
    </div>
  );
}

function V4Header({ count }: { count: number }) {
  return (
    <div className="col-span-full">
      <div className="flex items-center gap-2 rounded-lg border border-blue-accent/30 bg-blue-accent/8 px-3 py-2 mb-1">
        <BarChart2 className="h-3.5 w-3.5 text-blue-accent flex-shrink-0" />
        <span className="text-xs font-bold tracking-wider text-blue-accent uppercase">ICT V4.1 Index Signals</span>
        <span className="rounded-full bg-blue-accent/20 border border-blue-accent/25 px-1.5 py-0.5 text-[9px] font-semibold text-blue-accent">
          {count}
        </span>
        <span className="ml-auto text-[10px] text-blue-accent/60">75% WR · 9.3× PF · 7-DTE</span>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border-dim" />
      <span className="text-[10px] font-semibold tracking-widest text-text-muted uppercase">{label}</span>
      <div className="h-px flex-1 bg-border-dim" />
    </div>
  );
}

/** Banner shown when the live API is temporarily unavailable during market hours. */
function StaleDataBanner() {
  return (
    <div className="col-span-full flex items-center gap-2.5 rounded-lg border border-yellow-alert/25 bg-yellow-alert/8 px-3.5 py-2.5 text-xs mb-1">
      <AlertCircle className="h-3.5 w-3.5 text-yellow-alert flex-shrink-0" />
      <div>
        <span className="font-bold text-yellow-alert">Scanner reconnecting</span>
        <span className="text-text-muted ml-2">
          Showing last known positions. Live data will resume automatically.
        </span>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortTrades(trades: TradeSetup[]): TradeSetup[] {
  return [...trades].sort((a, b) => {
    const aG = a.is_golden_hour ? 1 : 0;
    const bG = b.is_golden_hour ? 1 : 0;
    if (aG !== bG) return bG - aG;
    return b.confidence_score - a.confidence_score;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TradeList() {
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const { data, error, isLoading, mutate } = useTrades();

  // Persisted trades from localStorage (today only)
  const persistedTrades = usePersistedTrades();

  // Market-hours flag — starts true (safe default), corrects client-side after mount
  const [marketOpen, setMarketOpen] = useState(true);
  useEffect(() => {
    setMarketOpen(isDisplayHours());
    const id = setInterval(() => setMarketOpen(isDisplayHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  // 30-second tick to re-evaluate which terminal cards have expired (>15 min post-TP/SL)
  const [expireTick, setExpireTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setExpireTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Persist live trades to localStorage whenever API returns them
  useEffect(() => {
    if (data?.trades && data.trades.length > 0) {
      persistActiveTrades(data.trades);
    }
  }, [data?.trades]);

  // Decide which trade set to show.
  // ZERO cards are displayed outside the 9:00 AM – 4:30 PM ET window.
  const liveTrades = data?.trades ?? [];

  // During market hours: fall back to persisted trades if the live API returns empty
  // (covers brief API outages / scanner startup delay). Never show persisted cards
  // outside market hours.
  const showingPersisted =
    marketOpen && liveTrades.length === 0 && persistedTrades.length > 0;

  const rawTrades = !marketOpen
    ? []                              // outside hours → always empty
    : liveTrades.length > 0
      ? liveTrades
      : showingPersisted
        ? persistedTrades
        : [];

  // Remove cards whose terminal outcome (TP/SL) was locked >15 minutes ago.
  // expireTick causes a re-render every 30 s so the filter stays current.
  void expireTick; // consumed only to trigger re-render — intentionally unused in filter
  const allTrades = rawTrades.filter((t) => !isOutcomeExpired(t.id));

  const marketClosed = !marketOpen;

  const sorted     = sortTrades(allTrades);
  const goldenOnly = sorted.filter((t) => t.is_golden_hour);
  const v4Only     = sorted.filter((t) => t.strategy?.startsWith('V4_'));

  const displayed: TradeSetup[] =
    filter === 'GOLDEN'  ? goldenOnly
    : filter === 'V4_ICT' ? v4Only
    : sorted;

  // Sections for ALL view
  const v4InView      = filter === 'ALL' ? sorted.filter(t =>  t.strategy?.startsWith('V4_')) : [];
  const goldenInView  = filter === 'ALL' ? sorted.filter(t =>  t.is_golden_hour && !t.strategy?.startsWith('V4_')) : [];
  const regularInView = filter === 'ALL' ? sorted.filter(t => !t.is_golden_hour && !t.strategy?.startsWith('V4_')) : [];

  return (
    <section className="flex flex-col gap-3">

      {/* ── Sub-filter tabs ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-border-dim bg-bg-card p-1">
          {TABS.map((tab) => {
            const count  = tab.value === 'GOLDEN' ? goldenOnly.length
                         : tab.value === 'V4_ICT' ? v4Only.length
                         : allTrades.length;
            const active = filter === tab.value;
            const isGold = tab.value === 'GOLDEN';
            const isV4   = tab.value === 'V4_ICT';

            return (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={cn(
                  'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium tracking-wide transition-all',
                  active
                    ? isGold ? 'bg-gold-trade/20 text-gold-trade border border-gold-trade/35'
                    : isV4   ? 'bg-blue-accent/20 text-blue-accent border border-blue-accent/30'
                    :          'bg-blue-accent/20 text-blue-accent border border-blue-accent/30'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {isGold && <Zap className="h-2.5 w-2.5 flex-shrink-0" />}
                {tab.label}
                <span className={cn(
                  'rounded-full px-1 py-0.5 text-[9px] leading-none min-w-[16px] text-center',
                  active && isGold ? 'bg-gold-trade/30 text-gold-trade'
                  : active         ? 'bg-blue-accent/20 text-blue-accent'
                  :                  'bg-border-dim text-text-muted'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {data?.last_updated && (
            <span className="hidden sm:block text-[10px] text-text-muted">
              {formatTime(data.last_updated)}
            </span>
          )}
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1 rounded border border-border-dim bg-bg-card px-2 py-1.5 text-[10px] text-text-muted hover:border-blue-accent/40 hover:text-blue-accent transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && !data && !showingPersisted && (
        <div className="flex items-center gap-2 rounded-lg border border-red-trade/20 bg-red-trade/10 px-3 py-2 text-xs text-red-trade">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Unable to reach scanner. Retrying automatically.
        </div>
      )}

      {/* ── Grid ── */}
      {isLoading && !data ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : filter === 'ALL' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {allTrades.length === 0 ? (
            <NoCallouts filter="ALL" marketClosed={marketClosed} />
          ) : (
            <>
              {/* Market-closed banner when showing persisted trades */}
              {showingPersisted && <StaleDataBanner />}

              {v4InView.length > 0 && (
                <>
                  <V4Header count={v4InView.length} />
                  {v4InView.map((t) => (
                    <div key={t.id}>
                      <TradeCard trade={t} />
                    </div>
                  ))}
                </>
              )}

              {v4InView.length > 0 && (goldenInView.length > 0 || regularInView.length > 0) && (
                <Divider label="0DTE Intraday Setups" />
              )}

              {goldenInView.length > 0 && (
                <>
                  <GoldenHeader count={goldenInView.length} />
                  {goldenInView.map((t) => (
                    <div key={t.id}>
                      <TradeCard trade={t} />
                    </div>
                  ))}
                </>
              )}

              {goldenInView.length > 0 && regularInView.length > 0 && (
                <Divider label="Other Setups" />
              )}

              {regularInView.map((t) => (
                <div key={t.id}>
                  <TradeCard trade={t} />
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {displayed.length === 0 ? (
            <NoCallouts filter={filter} marketClosed={marketClosed} />
          ) : (
            <>
              {showingPersisted && <StaleDataBanner />}
              {displayed.map((t) => (
                <div key={t.id}>
                  <TradeCard trade={t} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

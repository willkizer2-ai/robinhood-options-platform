'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronUp,
  ArrowUpCircle, ArrowDownCircle,
  AlertTriangle, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, Clock, Tag,
  BookOpen, Target, ShieldAlert, Zap,
  BarChart2, Activity, Layers,
  CheckCheck, X, Pause, LineChart,
} from 'lucide-react';
import type { TradeSetup } from '@/lib/types';
import { useTickerPrice, useTickerCandles } from '@/lib/api';
import { useLockedOutcome } from '@/lib/useTradeOutcome';
import TradeChart from './TradeChart';
import {
  cn, formatCurrency, formatPct, formatTime, formatTimeZone,
  formatDecimal, formatNumber, confidenceColor, confidenceBgColor,
  sentimentBgColor, sentimentLabel,
} from '@/lib/utils';

// ─── Auto contract-state helpers ─────────────────────────────────────────────

type ContractState = 'hold' | 'take_profit' | 'terminated' | 'not_entered';

/** Extract the first dollar amount from a guidance string, e.g. "$1.42" → 1.42 */
function parsePremiumFromGuidance(text: string): number | null {
  const m = text.match(/\$(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Estimate current option premium using a linear-delta approximation.
 *   ΔPremium ≈ delta × ΔUnderlying
 * Works for both CALL (delta > 0) and PUT (delta < 0).
 */
function estimatePremium(
  entryPremium: number,
  delta: number,
  detectionPrice: number,
  currentPrice: number,
): number {
  const estimated = entryPremium + delta * (currentPrice - detectionPrice);
  return Math.max(estimated, 0.01);        // options can't go negative
}

/**
 * Determine trade entry status and whether TP/SL has been breached.
 *
 * State machine:
 *   not_entered → hold → take_profit | terminated
 *
 * 'not_entered': The underlying price has not confirmed the directional move
 *   since the card was posted (CALL: price < detectionPrice; PUT: price > detectionPrice).
 *   The limit order would not yet have been executed.
 *
 * 'hold': Price has confirmed direction — entry is live, neither SL nor TP hit yet.
 *
 * Returns null when data is missing so the card shows its original banner.
 */
function computeState(
  trade: TradeSetup,
  currentPrice: number | null | undefined,
): ContractState | null {
  if (!currentPrice || !trade.execution || trade.decision !== 'DO_TAKE') return null;

  const exec           = trade.execution;
  const entryPremium   = exec.suggested_entry;
  const delta          = trade.contract.delta ?? (trade.direction === 'CALL' ? 0.5 : -0.5);
  const detectionPrice = trade.market_context.current_price;
  const isCall         = trade.direction === 'CALL';

  // ── Entry confirmation ─────────────────────────────────────────────────────
  // CALL: underlying must reach or exceed detection price (bull move confirms)
  // PUT:  underlying must reach or fall below detection price (bear move confirms)
  const entryConfirmed = isCall
    ? currentPrice >= detectionPrice
    : currentPrice <= detectionPrice;

  if (!entryConfirmed) return 'not_entered';

  // ── TP / SL check ──────────────────────────────────────────────────────────
  const stopPremium   = parsePremiumFromGuidance(exec.stop_loss_guidance);
  const targetPremium = parsePremiumFromGuidance(exec.profit_target_guidance);

  if (!stopPremium || !targetPremium) return 'hold'; // confirmed entry, levels missing

  const estimated = estimatePremium(entryPremium, delta, detectionPrice, currentPrice);

  if (estimated >= targetPremium) return 'take_profit';
  if (estimated <= stopPremium)   return 'terminated';
  return 'hold';
}

/**
 * Derive stop-loss and take-profit as underlying stock price levels.
 *
 * The execution guidance gives option-premium values (e.g. "Stop at $1.20").
 * We invert the delta approximation to get the equivalent stock price:
 *   stockLevel = entryStockPrice + (premiumLevel - entryPremium) / delta
 *
 * Returns null for either level when the input data is missing or yields an
 * implausible value (negative price, or delta too close to 0).
 */
function deriveUnderlyingLevels(trade: TradeSetup): {
  stopPrice:   number | null;
  targetPrice: number | null;
} {
  if (!trade.execution) return { stopPrice: null, targetPrice: null };

  const exec          = trade.execution;
  const delta         = trade.contract.delta ?? (trade.direction === 'CALL' ? 0.5 : -0.5);
  const detectionPx   = trade.market_context.current_price;
  const entryPremium  = exec.suggested_entry;

  // Guard against near-zero delta (deep ITM/OTM edge cases)
  if (Math.abs(delta) < 0.01) return { stopPrice: null, targetPrice: null };

  const slPremium  = parsePremiumFromGuidance(exec.stop_loss_guidance);
  const tpPremium  = parsePremiumFromGuidance(exec.profit_target_guidance);

  const raw = (premium: number | null): number | null => {
    if (premium === null) return null;
    const px = detectionPx + (premium - entryPremium) / delta;
    return px > 0.5 ? Math.round(px * 100) / 100 : null; // sanity-check
  };

  return { stopPrice: raw(slPremium), targetPrice: raw(tpPremium) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GhPill({ label, passed }: { label: string; passed: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase',
      passed
        ? 'bg-gold-trade/20 border border-gold-trade/40 text-gold-trade'
        : 'bg-border-dim/50 border border-border-dim text-text-muted'
    )}>
      {passed ? '✓' : '✗'} {label}
    </span>
  );
}

function V4Pill({ label, passed }: { label: string; passed: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase',
      passed
        ? 'bg-blue-accent/20 border border-blue-accent/35 text-blue-accent'
        : 'bg-border-dim/50 border border-border-dim text-text-muted'
    )}>
      {passed ? '✓' : '✗'} {label}
    </span>
  );
}

// Live price — only shows the dollar price, no change % per user request
function LivePrice({ ticker }: { ticker: string }) {
  const { data, isLoading } = useTickerPrice(ticker);

  if (isLoading && !data) {
    return <div className="h-5 w-16 skeleton rounded" />;
  }
  if (!data?.price) return null;

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-green-trade flex-shrink-0" />
      <span className="text-sm font-bold tabular-nums text-text-primary">
        {formatCurrency(data.price)}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TradeCard({ trade }: { trade: TradeSetup }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [chartOpen,   setChartOpen]   = useState(false);

  // ── Live price + state calculation ───────────────────────────────────────
  const { data: priceData } = useTickerPrice(trade.ticker);
  const liveState    = computeState(trade, priceData?.price);

  // Outcome locking: once TP/SL fires it is written to localStorage and
  // never reverted — even if price retraces across the threshold later.
  const contractState = useLockedOutcome(trade.id, liveState);

  // ── Candle data — only fetched while chart is open AND trade is active ──
  // Chart is restricted to hold / take_profit / terminated states; not_entered
  // trades have no live position so showing a chart would be misleading.
  const chartAllowed =
    contractState === 'hold' ||
    contractState === 'take_profit' ||
    contractState === 'terminated';

  const { data: candleData, isLoading: candlesLoading } =
    useTickerCandles(chartOpen && chartAllowed ? trade.ticker : null);

  // ── Derived underlying TP/SL for chart lines ─────────────────────────────
  const { stopPrice, targetPrice } = deriveUnderlyingLevels(trade);

  const isDoTake  = trade.decision === 'DO_TAKE';
  const isCall    = trade.direction === 'CALL';
  const isGolden  = trade.is_golden_hour === true;
  const isV4      = trade.strategy?.startsWith('V4_');
  const ctx       = trade.market_context;
  const ghFilters = trade.golden_hour_filters;
  const exec      = trade.execution;

  // Normalise confidence to 0-100 for display (API returns 0-1)
  const confidencePct = trade.confidence_score <= 1
    ? Math.round(trade.confidence_score * 100)
    : Math.round(trade.confidence_score);

  // ── Card border + shadow ─────────────────────────────────────────────────
  const cardCls = cn(
    'relative flex flex-col rounded-xl border transition-all duration-200 overflow-hidden',
    contractState === 'terminated'
      ? 'border-state-exit/50   bg-bg-card opacity-75 shadow-card'
      : contractState === 'take_profit'
      ? 'border-state-profit/60 bg-bg-card shadow-card-md'
      : contractState === 'hold'
      ? 'border-state-hold/60  bg-bg-card shadow-card-md'
      : contractState === 'not_entered'
      ? 'border-border-dim/70  bg-bg-card shadow-card opacity-80'
      : isGolden
      ? 'border-gold-trade/60  bg-bg-card shadow-card-lg'
      : isV4
      ? 'border-blue-accent/50 bg-bg-card shadow-card-md'
      : isDoTake
      ? 'border-green-trade/40 bg-bg-card shadow-card'
      : 'border-border-dim     bg-bg-card shadow-card opacity-80 hover:opacity-100'
  );

  // ── Top accent line colour ────────────────────────────────────────────────
  const accentColor =
    contractState === 'terminated'    ? 'bg-state-exit'
    : contractState === 'take_profit' ? 'bg-state-profit'
    : contractState === 'hold'        ? 'bg-state-hold'
    : contractState === 'not_entered' ? null   // no accent — awaiting entry
    : isGolden                        ? 'bg-gold-trade'
    : isV4                            ? 'bg-blue-accent'
    : isDoTake                        ? 'bg-green-trade'
    : null;

  // ── Banner ────────────────────────────────────────────────────────────────
  const Banner = () => {
    if (contractState === 'not_entered') return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-border-dim/40 border-b border-border-dim text-text-muted text-[11px] font-bold tracking-widest uppercase">
        <Clock className="h-3.5 w-3.5" /> Trade Not Entered — Awaiting Entry Level
      </div>
    );
    if (contractState === 'terminated') return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-state-exit/12 border-b border-state-exit/25 text-state-exit text-[11px] font-bold tracking-widest uppercase">
        <X className="h-3.5 w-3.5" /> Stop Loss Hit
      </div>
    );
    if (contractState === 'take_profit') return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-state-profit/12 border-b border-state-profit/25 text-state-profit text-[11px] font-bold tracking-widest uppercase">
        <CheckCheck className="h-3.5 w-3.5" /> Take Profit Hit ✓
      </div>
    );
    if (contractState === 'hold') return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-state-hold/10 border-b border-state-hold/20 text-state-hold text-[11px] font-bold tracking-widest uppercase">
        <Pause className="h-3.5 w-3.5" /> Holding — Neither Level Hit
      </div>
    );

    // No auto-state yet — show original banners
    if (isGolden) return (
      <div className="flex flex-col items-center gap-0.5 px-4 py-2 bg-gold-trade">
        <div className="flex items-center gap-2 text-white">
          <Zap className="h-3.5 w-3.5 fill-current" />
          <span className="text-[11px] font-black tracking-widest uppercase">
            {isV4 ? 'ICT V4.1 — High Confidence' : 'Actionable Trade'}
          </span>
          <Zap className="h-3.5 w-3.5 fill-current" />
        </div>
        <span className="text-[9px] tracking-widest text-white/75 uppercase">
          {isV4 ? '75% WR · 9.3× PF Backtested' : 'All Confluence Gates Passed'}
        </span>
      </div>
    );
    if (isV4) return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-blue-accent/10 border-b border-blue-accent/20">
        <BarChart2 className="h-3.5 w-3.5 text-blue-accent" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-blue-accent">
          ICT V4.1 — 7-DTE Index
        </span>
        <span className="text-[9px] text-blue-accent/55 font-medium">75% WR / 9.3× PF</span>
      </div>
    );
    return (
      <div className={cn(
        'flex items-center justify-center gap-1.5 px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase',
        isDoTake
          ? 'bg-green-trade text-white'
          : 'bg-red-trade/10 text-red-trade border-b border-red-trade/20'
      )}>
        {isDoTake
          ? <><CheckCircle2 className="h-3.5 w-3.5" /> DO TAKE</>
          : <><XCircle      className="h-3.5 w-3.5" /> DON'T TAKE</>
        }
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <article className={cardCls}>

      {/* Top accent line */}
      {accentColor && (
        <div className={cn('absolute inset-x-0 top-0 h-[3px]', accentColor)} />
      )}

      <Banner />

      <div className="flex flex-col gap-3 p-4">

        {/* ── Header: ticker · direction · confidence · live price ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className={cn(
              'text-2xl font-black tracking-tight',
              contractState === 'hold'          ? 'text-state-hold'
              : contractState === 'take_profit'  ? 'text-state-profit'
              : contractState === 'terminated'   ? 'text-text-muted'
              : contractState === 'not_entered'  ? 'text-text-muted'
              : isGolden                         ? 'text-gold-trade'
              : 'text-text-primary'
            )}>
              {trade.ticker}
            </span>

            <span className={cn(
              'flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold',
              isCall
                ? 'border-green-trade/40 bg-green-trade/10 text-green-trade'
                : 'border-red-trade/40   bg-red-trade/10   text-red-trade'
            )}>
              {isCall
                ? <ArrowUpCircle   className="h-3 w-3" />
                : <ArrowDownCircle className="h-3 w-3" />
              }
              {trade.direction}
            </span>

            <div className="flex flex-col gap-0.5">
              <span className={cn(
                'text-base font-black tabular-nums leading-none',
                isGolden ? 'text-gold-trade' : confidenceColor(confidencePct)
              )}>
                {confidencePct}%
              </span>
              <div className="h-0.5 w-10 overflow-hidden rounded-full bg-border-dim">
                <div
                  className={cn(
                    'h-full rounded-full confidence-bar',
                    isGolden ? 'bg-gold-trade' : confidenceBgColor(confidencePct)
                  )}
                  style={{ width: `${Math.min(confidencePct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Live price */}
          <LivePrice ticker={trade.ticker} />
        </div>

        {/* ── Strategy + catalyst tags ── */}
        <div className="flex flex-wrap gap-1.5">
          <span className={cn(
            'rounded border px-1.5 py-0.5 text-[9px] tracking-widest uppercase font-semibold',
            isGolden ? 'border-gold-trade/30 bg-gold-trade/10 text-gold-trade'
            : isV4   ? 'border-blue-accent/30 bg-blue-accent/10 text-blue-accent'
            :          'border-border-dim bg-bg-elevated text-text-muted'
          )}>
            {trade.strategy}
          </span>
          {trade.news_catalyst_tag && (
            <span className="flex items-center gap-1 rounded border border-yellow-alert/30 bg-yellow-alert/10 px-1.5 py-0.5 text-[9px] tracking-wider text-yellow-alert uppercase font-semibold">
              <Tag className="h-2.5 w-2.5" />{trade.news_catalyst_tag}
            </span>
          )}
          {trade.reasoning.dont_chase_warning && (
            <span className="flex items-center gap-1 rounded border border-red-trade/30 bg-red-trade/10 px-1.5 py-0.5 text-[9px] tracking-wider text-red-trade uppercase font-semibold">
              <AlertTriangle className="h-2.5 w-2.5" />DON'T CHASE
            </span>
          )}
        </div>

        {/* ── Contract pills ── */}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded border border-border-dim bg-bg-elevated px-2 py-1 text-[10px] text-text-muted">
            STRIKE <span className="font-bold text-text-primary ml-0.5">{formatCurrency(trade.contract.strike)}</span>
          </span>
          <span className="rounded border border-border-dim bg-bg-elevated px-2 py-1 text-[10px] text-text-muted">
            EXP <span className="font-bold text-text-primary ml-0.5">{trade.contract.expiration}</span>
          </span>
          <span className="rounded border border-yellow-alert/25 bg-yellow-alert/10 px-2 py-1 text-[10px] text-text-muted">
            PREM <span className={cn('font-bold ml-0.5', isGolden ? 'text-gold-trade' : 'text-yellow-alert')}>
              {formatCurrency(trade.contract.premium)}
            </span>
          </span>
          {trade.contract.delta != null && (
            <span className="rounded border border-border-dim bg-bg-elevated px-2 py-1 text-[10px] text-text-muted">
              Δ <span className="font-bold text-text-primary">{formatDecimal(trade.contract.delta, 2)}</span>
            </span>
          )}
          {trade.contract.implied_volatility != null && (
            <span className="rounded border border-border-dim bg-bg-elevated px-2 py-1 text-[10px] text-text-muted">
              IV <span className="font-bold text-text-primary">
                {(trade.contract.implied_volatility * 100).toFixed(1)}%
              </span>
            </span>
          )}
          {trade.contract.volume != null && (
            <span className="rounded border border-border-dim bg-bg-elevated px-2 py-1 text-[10px] text-text-muted">
              VOL <span className="font-bold text-text-primary">{formatNumber(trade.contract.volume)}</span>
            </span>
          )}
        </div>

        {/* ── Entry / Stop / Target (DO TAKE only) ── */}
        {isDoTake && exec && (
          <div className="grid grid-cols-3 gap-2">
            <div className={cn(
              'rounded border p-2 text-center',
              isGolden ? 'border-gold-trade/30 bg-gold-trade/8' : 'border-blue-accent/20 bg-blue-accent/8'
            )}>
              <p className="text-[9px] tracking-wider text-text-muted uppercase mb-0.5">Entry</p>
              <p className={cn('text-sm font-bold', isGolden ? 'text-gold-trade' : 'text-blue-accent')}>
                {formatCurrency(exec.suggested_entry)}
              </p>
              <p className="text-[9px] text-text-muted">{exec.entry_type}</p>
            </div>
            <div className="rounded border border-red-trade/25 bg-red-trade/8 p-2 text-center">
              <p className="text-[9px] tracking-wider text-text-muted uppercase mb-0.5">Stop</p>
              <p className="text-sm font-bold text-red-trade">{exec.stop_loss_guidance}</p>
            </div>
            <div className="rounded border border-green-trade/25 bg-green-trade/8 p-2 text-center">
              <p className="text-[9px] tracking-wider text-text-muted uppercase mb-0.5">Target</p>
              <p className="text-sm font-bold text-green-trade">{exec.profit_target_guidance}</p>
            </div>
          </div>
        )}

        {/* ── Top 2 reasoning bullets ── */}
        {trade.reasoning.bullet_points.length > 0 && (
          <ul className="space-y-1">
            {trade.reasoning.bullet_points.slice(0, 2).map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-text-primary leading-relaxed">
                <span className={cn(
                  'mt-1.5 h-1 w-1 flex-shrink-0 rounded-full',
                  isGolden ? 'bg-gold-trade/60'
                  : isV4   ? 'bg-blue-accent/60'
                  :          'bg-text-muted/50'
                )} />
                {pt}
              </li>
            ))}
          </ul>
        )}

        {/* ── Live Chart dropdown (active trades only: hold / TP / SL) ── */}
        {isDoTake && exec && chartAllowed && (
          <>
            <button
              onClick={() => setChartOpen((o) => !o)}
              className={cn(
                'flex w-full items-center justify-between rounded border px-3 py-2',
                'text-[11px] transition-colors',
                chartOpen
                  ? 'border-blue-accent/40 bg-blue-accent/8 text-blue-accent'
                  : 'border-border-dim bg-bg-elevated text-text-muted hover:border-blue-accent/40 hover:text-blue-accent'
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <LineChart className="h-3 w-3" />
                {chartOpen ? 'Hide Chart' : 'Live Chart'}
              </span>
              {chartOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {chartOpen && (
              <TradeChart
                ticker={trade.ticker}
                candles={candleData?.candles ?? []}
                entryPrice={ctx.current_price}
                stopPrice={stopPrice}
                targetPrice={targetPrice}
                entryTime={trade.detected_at}
                direction={trade.direction}
                lockedOutcome={
                  contractState === 'take_profit' || contractState === 'terminated'
                    ? contractState
                    : null
                }
                isLoading={candlesLoading && !candleData}
              />
            )}
          </>
        )}

        {/* ── Full details accordion ── */}
        <button
          onClick={() => setDetailsOpen(o => !o)}
          className="flex w-full items-center justify-between rounded border border-border-dim bg-bg-elevated px-3 py-2 text-[11px] text-text-muted hover:border-border-med hover:text-text-secondary transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            {detailsOpen ? 'Hide Details' : 'Full Details'}
          </span>
          {detailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {detailsOpen && (
          <div className="space-y-3 pt-1 border-t border-border-dim/40 mt-1">

            {/* Actionable Trade confluence gates */}
            {isGolden && ghFilters && !isV4 && (
              <div className="rounded-lg border border-gold-trade/25 bg-gold-trade/5 p-3">
                <p className="flex items-center gap-1 text-[9px] tracking-widest text-gold-trade uppercase font-bold mb-2">
                  <Zap className="h-2.5 w-2.5" /> Confluence Gates
                </p>
                <div className="flex flex-wrap gap-1">
                  <GhPill label="IV Rank"   passed={ghFilters.iv_rank_ok     ?? false} />
                  <GhPill label="Vol ≥2×"   passed={ghFilters.volume_ok       ?? false} />
                  <GhPill label="ATR/Prem"  passed={ghFilters.atr_premium_ok  ?? false} />
                  <GhPill label="ADX"       passed={ghFilters.adx_ok          ?? false} />
                  <GhPill label="ORB"       passed={ghFilters.orb_ok          ?? false} />
                  <GhPill label="Move Edge" passed={ghFilters.move_edge_ok     ?? false} />
                </div>
              </div>
            )}

            {/* ICT V4.1 confluence gates */}
            {isV4 && ghFilters && (
              <div className="rounded-lg border border-blue-accent/25 bg-blue-accent/5 p-3">
                <p className="flex items-center gap-1 text-[9px] tracking-widest text-blue-accent uppercase font-bold mb-2">
                  <Activity className="h-2.5 w-2.5" /> ICT V4.1 Confluence
                </p>
                <div className="flex flex-wrap gap-1">
                  <V4Pill label="Active FVG" passed={ghFilters.active_fvg   ?? false} />
                  <V4Pill label="VA Zone"    passed={ghFilters.va_zone       ?? false} />
                  <V4Pill label="Fib Level"  passed={ghFilters.fib_ote       ?? false} />
                  <V4Pill label="Structure"  passed={ghFilters.structure     ?? false} />
                  <V4Pill label="HTF Bias"   passed={ghFilters.htf_bias      ?? false} />
                  <V4Pill label="Volume"     passed={ghFilters.volume_conf   ?? false} />
                </div>
              </div>
            )}

            {/* Price context */}
            <div className={cn(
              'rounded-lg border px-3 py-2.5',
              isGolden ? 'border-gold-trade/20 bg-gold-trade/5' : 'border-border-dim bg-bg-elevated/60'
            )}>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  {isCall
                    ? <TrendingUp  className="h-3 w-3 text-green-trade" />
                    : <TrendingDown className="h-3 w-3 text-red-trade" />
                  }
                  <span className="text-text-muted">Underlying</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(ctx.current_price)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">VWAP</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(ctx.vwap)}</span>
                  <span className={cn(
                    'text-[10px] font-semibold',
                    ctx.price_vs_vwap >= 0 ? 'text-green-trade' : 'text-red-trade'
                  )}>
                    {formatPct(ctx.price_vs_vwap)}
                  </span>
                </div>
                {ctx.rsi_14 != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">RSI</span>
                    <span className={cn(
                      'font-semibold',
                      ctx.rsi_14 > 70 ? 'text-red-trade'
                      : ctx.rsi_14 < 30 ? 'text-green-trade'
                      : 'text-text-primary'
                    )}>
                      {formatDecimal(ctx.rsi_14, 1)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">Vol</span>
                  <span className={cn(
                    'font-semibold',
                    ctx.volume_ratio >= 2.0 ? 'text-yellow-alert' : 'text-text-primary'
                  )}>
                    {formatDecimal(ctx.volume_ratio, 2)}×
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">Structure</span>
                  <span className="font-semibold text-blue-accent capitalize">{ctx.market_structure}</span>
                </div>
              </div>

              {/* V2.1 metrics row */}
              {(ctx.adx_14 != null || ctx.iv_rank != null || ctx.orb_confirmed != null || ctx.expected_move_edge != null) && (
                <div className="mt-2 pt-2 border-t border-border-dim/40 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {ctx.adx_14 != null && (
                    <div className="flex items-center gap-1.5">
                      <BarChart2 className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">ADX</span>
                      <span className={cn(
                        'font-semibold',
                        ctx.adx_14 >= 28 ? 'text-green-trade'
                        : ctx.adx_14 >= 22 ? 'text-yellow-alert'
                        : 'text-red-trade'
                      )}>
                        {formatDecimal(ctx.adx_14, 1)}
                      </span>
                    </div>
                  )}
                  {ctx.iv_rank != null && (
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">IV Rank</span>
                      <span className={cn(
                        'font-semibold',
                        ctx.iv_rank < 0.40 ? 'text-green-trade'
                        : ctx.iv_rank < 0.65 ? 'text-yellow-alert'
                        : 'text-red-trade'
                      )}>
                        {(ctx.iv_rank * 100).toFixed(0)}th
                      </span>
                    </div>
                  )}
                  {ctx.orb_confirmed != null && (
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">ORB</span>
                      <span className={cn('font-semibold', ctx.orb_confirmed ? 'text-green-trade' : 'text-red-trade')}>
                        {ctx.orb_confirmed ? 'YES' : 'NO'}
                      </span>
                    </div>
                  )}
                  {ctx.expected_move_edge != null && (
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">Edge</span>
                      <span className={cn(
                        'font-semibold',
                        ctx.expected_move_edge >= 0.25 ? 'text-green-trade'
                        : ctx.expected_move_edge >= 0 ? 'text-yellow-alert'
                        : 'text-red-trade'
                      )}>
                        {formatPct(ctx.expected_move_edge * 100)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Remaining reasoning bullets */}
            {trade.reasoning.bullet_points.length > 2 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[9px] tracking-widest text-text-muted uppercase font-semibold">
                  <BookOpen className="h-3 w-3" /> Full Analysis
                </p>
                <ul className="space-y-1">
                  {trade.reasoning.bullet_points.slice(2).map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-text-primary">
                      <span className={cn(
                        'mt-1.5 h-1 w-1 flex-shrink-0 rounded-full',
                        isGolden ? 'bg-gold-trade/50' : 'bg-text-muted/40'
                      )} />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {trade.reasoning.risk_warning && (
              <div className="flex items-start gap-1.5 rounded border border-yellow-alert/20 bg-yellow-alert/8 p-2.5 text-xs text-yellow-alert">
                <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {trade.reasoning.risk_warning}
              </div>
            )}
            {trade.reasoning.invalidation_level != null && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Target className="h-3 w-3 text-red-trade" />
                Invalidation:{' '}
                <span className="font-semibold text-red-trade">
                  {formatCurrency(trade.reasoning.invalidation_level)}
                </span>
              </div>
            )}

            {/* NLP sentiment */}
            {trade.nlp_analysis && (
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase',
                  sentimentBgColor(trade.nlp_analysis.sentiment)
                )}>
                  {sentimentLabel(trade.nlp_analysis.sentiment)}
                </span>
                <span className="text-[10px] text-text-muted">
                  Impact:{' '}
                  <span className="font-semibold text-text-primary">
                    {formatDecimal(trade.nlp_analysis.impact_score, 1)}/10
                  </span>
                </span>
                {trade.nlp_analysis.sentiment_confidence > 0 && (
                  <span className="text-[10px] text-text-muted">
                    Conf:{' '}
                    <span className="font-semibold text-text-primary">
                      {(trade.nlp_analysis.sentiment_confidence * 100).toFixed(0)}%
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* Robinhood execution steps */}
            {isDoTake && exec && exec.steps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] tracking-widest text-text-muted uppercase font-semibold">
                    Robinhood Steps
                  </p>
                  <div className="flex gap-2 text-[10px]">
                    <span className="rounded border border-border-dim bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                      Normal <span className="font-bold text-text-primary">{exec.normal_account_contracts}c</span>
                    </span>
                    <span className="rounded border border-yellow-alert/25 bg-yellow-alert/10 px-1.5 py-0.5 text-text-muted">
                      Small <span className="font-bold text-yellow-alert">{exec.small_account_contracts}c</span>
                    </span>
                  </div>
                </div>
                {exec.steps.map((step) => (
                  <div key={step.step_number} className={cn(
                    'flex gap-2 rounded border p-2',
                    isGolden
                      ? 'border-gold-trade/20 bg-gold-trade/5'
                      : 'border-border-dim bg-bg-elevated/60'
                  )}>
                    <span className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                      isGolden ? 'bg-gold-trade/20 text-gold-trade' : 'bg-blue-accent/15 text-blue-accent'
                    )}>
                      {step.step_number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-text-primary">{step.instruction}</p>
                      {step.detail && (
                        <p className="text-[10px] text-text-muted mt-0.5">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-text-muted border-t border-border-dim/35">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Detected {formatTime(trade.detected_at)} {formatTimeZone(trade.detected_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            {isGolden && !contractState && (
              <span className="flex items-center gap-0.5 text-gold-trade font-medium">
                <Zap className="h-2.5 w-2.5" /> AT
              </span>
            )}
            {!trade.is_active && (
              <span className="text-red-trade/60">Inactive</span>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}

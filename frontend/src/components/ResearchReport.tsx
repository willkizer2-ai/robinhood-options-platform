'use client';

import { Moon, TrendingUp, TrendingDown, Calendar, AlertCircle } from 'lucide-react';
import { useResearch } from '@/lib/api';
import { cn, formatDate, formatDecimal } from '@/lib/utils';
import type { ResearchSetup } from '@/lib/types';

function MarketBiasBadge({ bias }: { bias: string }) {
  const b = bias.toLowerCase();
  if (b.includes('bull')) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-trade/20 border border-green-trade/30 px-2.5 py-1 text-xs font-bold text-green-trade">
        <TrendingUp className="h-3.5 w-3.5" />
        {bias}
      </span>
    );
  }
  if (b.includes('bear')) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-trade/20 border border-red-trade/30 px-2.5 py-1 text-xs font-bold text-red-trade">
        <TrendingDown className="h-3.5 w-3.5" />
        {bias}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border-dim bg-bg-base px-2.5 py-1 text-xs font-bold text-text-muted">
      {bias}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const l = level.toLowerCase();
  if (l === 'high') {
    return (
      <span className="rounded border border-red-trade/30 bg-red-trade/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-trade">
        HIGH RISK
      </span>
    );
  }
  if (l === 'medium') {
    return (
      <span className="rounded border border-yellow-alert/30 bg-yellow-alert/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-yellow-alert">
        MED RISK
      </span>
    );
  }
  return (
    <span className="rounded border border-green-trade/30 bg-green-trade/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-green-trade">
      LOW RISK
    </span>
  );
}

function SetupCard({ setup }: { setup: ResearchSetup }) {
  const isCall = setup.direction === 'CALL';
  const strengthPct = Math.min(Math.max(setup.catalyst_strength * 10, 0), 100);

  return (
    <div
      className={cn(
        'flex-shrink-0 w-52 rounded-xl border p-3 space-y-2',
        isCall
          ? 'border-green-trade/25 bg-green-trade/5'
          : 'border-red-trade/25 bg-red-trade/5'
      )}
    >
      {/* Ticker + direction */}
      <div className="flex items-center justify-between">
        <span className="text-base font-black text-text-primary">{setup.ticker}</span>
        <span
          className={cn(
            'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold border',
            isCall
              ? 'border-green-trade/40 bg-green-trade/15 text-green-trade'
              : 'border-red-trade/40 bg-red-trade/15 text-red-trade'
          )}
        >
          {isCall ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          {setup.direction}
        </span>
      </div>

      {/* Strategy */}
      <p className="text-[10px] tracking-wider text-text-muted uppercase font-medium">
        {setup.suggested_strategy}
      </p>

      {/* Catalyst */}
      <div>
        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Catalyst</p>
        <p className="text-[11px] text-text-primary leading-snug line-clamp-2">
          {setup.catalyst}
        </p>
      </div>

      {/* Catalyst strength bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">
            Strength
          </span>
          <span className="text-[10px] font-bold text-text-primary">
            {formatDecimal(setup.catalyst_strength, 1)}/10
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border-dim">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              setup.catalyst_strength >= 7
                ? 'bg-green-trade'
                : setup.catalyst_strength >= 5
                ? 'bg-yellow-alert'
                : 'bg-red-trade'
            )}
            style={{ width: `${strengthPct}%` }}
          />
        </div>
      </div>

      {/* Risk */}
      <div className="flex items-center justify-between">
        <RiskBadge level={setup.risk_level} />
        <span className="text-[10px] text-text-muted">
          Score:{' '}
          <span className="font-semibold text-text-primary">
            {formatDecimal(setup.sentiment_score, 1)}
          </span>
        </span>
      </div>

      {/* Summary */}
      {setup.summary && (
        <p className="text-[10px] text-text-muted leading-relaxed line-clamp-3">
          {setup.summary}
        </p>
      )}
    </div>
  );
}

function SkeletonSetupCard() {
  return (
    <div className="flex-shrink-0 w-52 rounded-xl border border-border-dim bg-bg-card p-3 space-y-2 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-14 skeleton rounded" />
        <div className="h-4 w-10 skeleton rounded" />
      </div>
      <div className="h-2.5 w-24 skeleton rounded" />
      <div className="space-y-1">
        <div className="h-2.5 skeleton rounded w-full" />
        <div className="h-2.5 skeleton rounded w-3/4" />
      </div>
      <div className="h-1 skeleton rounded-full" />
    </div>
  );
}

export default function ResearchReport() {
  const { data, error, isLoading } = useResearch();

  return (
    <section className="rounded-xl border border-border-dim bg-bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-dim px-4 py-3">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-blue-accent" />
          <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
            Overnight Research
          </h2>
          {data && (
            <span className="text-[10px] text-text-muted hidden sm:block">
              {formatDate(data.market_date)}
            </span>
          )}
        </div>
        {data?.market_bias && <MarketBiasBadge bias={data.market_bias} />}
      </div>

      {/* Error */}
      {error && !data && (
        <div className="m-4 flex items-center gap-2 rounded border border-red-trade/20 bg-red-trade/10 px-3 py-2 text-xs text-red-trade">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Unable to load overnight research.
        </div>
      )}

      {isLoading && !data ? (
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="h-3 skeleton rounded w-24" />
            <div className="h-3 skeleton rounded w-full" />
            <div className="h-3 skeleton rounded w-4/5" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <SkeletonSetupCard key={i} />
            ))}
          </div>
        </div>
      ) : data ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Key events tomorrow */}
            {data.key_events_tomorrow.length > 0 && (
              <div>
                <h3 className="flex items-center gap-1.5 mb-2 text-[10px] tracking-wider text-text-muted uppercase font-medium">
                  <Calendar className="h-3 w-3" />
                  Key Events Tomorrow
                </h3>
                <ul className="space-y-1">
                  {data.key_events_tomorrow.map((event, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-text-primary">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-yellow-alert/60" />
                      {event}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Macro context */}
            {data.macro_context && (
              <div>
                <h3 className="mb-2 text-[10px] tracking-wider text-text-muted uppercase font-medium">
                  Macro Context
                </h3>
                <p className="text-xs text-text-muted italic leading-relaxed line-clamp-4">
                  {data.macro_context}
                </p>
              </div>
            )}
          </div>

          {/* Top setups — horizontal scroll */}
          {data.top_setups.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-[10px] tracking-wider text-text-muted uppercase font-medium">
                Top Setups ({data.top_setups.length})
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {data.top_setups.map((setup, i) => (
                  <SetupCard key={`${setup.ticker}-${i}`} setup={setup} />
                ))}
              </div>
            </div>
          )}

          {data.top_setups.length === 0 && !data.macro_context && (
            <p className="py-4 text-center text-sm text-text-muted">
              No overnight research available yet.
            </p>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-text-muted">
          No overnight research available.
        </div>
      )}
    </section>
  );
}

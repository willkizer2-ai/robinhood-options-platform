'use client';

import { useEffect, useState } from 'react';
import { Eye, Clock } from 'lucide-react';
import { useScannerStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── DST-aware Eastern Time clock ─────────────────────────────────────────────

function getEasternTime() {
  const now = new Date();
  const day = now.getDay();

  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const timeStr = etFormatter.format(now);

  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
  const tz  = now.getTimezoneOffset() < Math.max(jan, jul) ? 'EDT' : 'EST';

  if (day === 0 || day === 6) return { isOpen: false, label: 'CLOSED', tz, timeStr };

  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const etH = parseInt(etParts.find((p) => p.type === 'hour')?.value   ?? '0', 10);
  const etM = parseInt(etParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const t   = etH * 60 + etM;

  const open  = 9 * 60 + 30;
  const close = 16 * 60;

  if (t >= open && t < close)    return { isOpen: true,  label: 'MARKET OPEN',  tz, timeStr };
  if (t >= 4 * 60 && t < open)  return { isOpen: false, label: 'PRE-MARKET',   tz, timeStr };
  if (t >= close && t < 20 * 60) return { isOpen: false, label: 'AFTER-HOURS', tz, timeStr };
  return { isOpen: false, label: 'CLOSED', tz, timeStr };
}

function useMarketStatus() {
  const [status, setStatus] = useState(getEasternTime);
  useEffect(() => {
    const id = setInterval(() => setStatus(getEasternTime()), 30_000);
    return () => clearInterval(id);
  }, []);
  return status;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Header() {
  const { data: scanner } = useScannerStatus();
  const market = useMarketStatus();

  return (
    <header className="sticky top-0 z-50 border-b border-border-dim bg-bg-base/90 backdrop-blur-md">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">

          {/* ── Logo + brand ── */}
          <div className="flex items-center gap-3">
            {/* Eye icon — the Cyclops mark */}
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-blue-accent/30 bg-blue-accent/10"
              style={{ boxShadow: '0 0 14px rgba(255,140,42,0.22)' }}
            >
              <Eye className="h-5 w-5 text-blue-accent" />
            </div>

            <div>
              {/* Primary title */}
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold tracking-[0.18em] text-text-primary uppercase font-mono leading-none">
                  Market Cyclops
                </span>
                {scanner?.is_running && (
                  <span className="flex items-center gap-1 rounded-full border border-green-trade/30 bg-green-trade/10 px-1.5 py-0.5">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-green-trade" />
                    <span className="text-[9px] font-semibold tracking-wider text-green-trade uppercase">
                      Live
                    </span>
                  </span>
                )}
              </div>
              {/* Subtitle */}
              <p className="text-[10px] font-semibold tracking-[0.14em] text-text-secondary uppercase mt-0.5">
                Will Kizer
              </p>
            </div>
          </div>

          {/* ── Right: market status + clock + scanner stats ── */}
          <div className="flex items-center gap-3">

            {/* Market status pill */}
            <div className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide',
              market.isOpen
                ? 'border-green-trade/30 bg-green-trade/10 text-green-trade'
                : 'border-border-dim bg-transparent text-text-muted'
            )}>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full flex-shrink-0',
                market.isOpen ? 'live-dot bg-green-trade' : 'bg-text-muted/40'
              )} />
              {market.label}
            </div>

            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-text-muted">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className="tabular-nums font-medium font-mono">{market.timeStr}</span>
              <span className="text-blue-accent font-semibold">{market.tz}</span>
            </div>

            {/* Scanner mini-metrics */}
            {scanner && (
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-border-dim text-[11px] text-text-muted">
                <span>
                  <span className="font-semibold text-text-primary tabular-nums">{scanner.tickers_tracked}</span>{' '}
                  tickers
                </span>
                <span>
                  <span className="font-semibold text-text-primary tabular-nums">{scanner.setups_found}</span>{' '}
                  setups
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}

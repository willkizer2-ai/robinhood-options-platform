'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useScannerStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

function getEasternTime() {
  const now = new Date();
  const day = now.getDay();
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const timeStr = etFormatter.format(now);
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
  const tz  = now.getTimezoneOffset() < Math.max(jan, jul) ? 'EDT' : 'EST';
  if (day === 0 || day === 6) return { isOpen: false, label: 'CLOSED', tz, timeStr };
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now);
  const etH = parseInt(etParts.find((p) => p.type === 'hour')?.value   ?? '0', 10);
  const etM = parseInt(etParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const t   = etH * 60 + etM;
  const open = 9 * 60 + 30, close = 16 * 60;
  if (t >= open && t < close)     return { isOpen: true,  label: 'MARKET OPEN',  tz, timeStr };
  if (t >= 4 * 60 && t < open)   return { isOpen: false, label: 'PRE-MARKET',   tz, timeStr };
  if (t >= close && t < 20 * 60) return { isOpen: false, label: 'AFTER-HOURS',  tz, timeStr };
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

export default function Header() {
  const { data: scanner } = useScannerStatus();
  const market = useMarketStatus();

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(180,180,204,0.14)] bg-[#161619]/90 backdrop-blur-md">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">

          {/* ── Logo + brand ── */}
          <div className="flex items-center gap-3">
            {/* Web Trace logo mark */}
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-[rgba(180,180,204,0.24)] bg-[rgba(180,180,204,0.08)]"
              style={{ boxShadow: '0 0 14px rgba(180,180,204,0.18)' }}
            >
              <svg width="22" height="22" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="wtTrace" x1="8" y1="48" x2="56" y2="14" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#9c9cba"/>
                    <stop offset="0.5" stopColor="#b4b4cc"/>
                    <stop offset="1" stopColor="#8aa0e6"/>
                  </linearGradient>
                </defs>
                <polyline points="4,40 16,28 26,34 36,18 48,24 60,10"
                  stroke="url(#wtTrace)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <circle cx="36" cy="18" r="4" fill="#b4b4cc" opacity="0.9"/>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold tracking-[0.16em] text-[#f4f4f9] uppercase leading-none"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Web Trace
                </span>
                {scanner?.is_running && (
                  <span className="flex items-center gap-1 rounded-full border border-[rgba(45,212,191,0.30)] bg-[rgba(45,212,191,0.10)] px-1.5 py-0.5">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
                    <span className="text-[9px] font-semibold tracking-wider text-[#2dd4bf] uppercase">Live</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[#8a8b9c] uppercase mt-0.5">
                Portfolio Management
              </p>
            </div>
          </div>

          {/* ── Right: market status + clock + scanner stats ── */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide',
              market.isOpen
                ? 'border-[rgba(45,212,191,0.30)] bg-[rgba(45,212,191,0.10)] text-[#2dd4bf]'
                : 'border-[rgba(180,180,204,0.14)] bg-transparent text-[#8a8b9c]'
            )}>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full flex-shrink-0',
                market.isOpen ? 'live-dot bg-[#2dd4bf]' : 'bg-[#8a8b9c]/40'
              )} />
              {market.label}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#8a8b9c]">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className="tabular-nums font-medium font-mono">{market.timeStr}</span>
              <span className="text-[#b4b4cc] font-semibold">{market.tz}</span>
            </div>

            {scanner && (
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-[rgba(180,180,204,0.14)] text-[11px] text-[#8a8b9c]">
                <span>
                  <span className="font-semibold text-[#f4f4f9] tabular-nums">{scanner.tickers_tracked}</span>{' '}tickers
                </span>
                <span>
                  <span className="font-semibold text-[#f4f4f9] tabular-nums">{scanner.setups_found}</span>{' '}setups
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}

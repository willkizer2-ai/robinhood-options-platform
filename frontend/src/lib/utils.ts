import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import type { Sentiment } from './types';

// ─── Class merging ────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatCurrency(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '$—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ─── Percentage ───────────────────────────────────────────────────────────────

export function formatPct(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—%';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// ─── Time (all times rendered in America/New_York — EST/EDT) ──────────────────
// The backend stores naive UTC datetimes. We force UTC interpretation by
// appending 'Z' when no timezone designator is present, then convert to ET.

function toET(iso: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Returns e.g. "9:34 AM" in ET — appends Z to treat bare ISO strings as UTC */
export function formatTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(utc));
  } catch {
    return '—';
  }
}

/** Returns "ET" abbreviation for the given timestamp (EST or EDT) */
export function formatTimeZone(iso: string | undefined | null): 'EST' | 'EDT' {
  if (!iso) return 'EST';
  try {
    const utc  = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    const d    = new Date(utc);
    const jan  = new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
    const jul  = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
    return d.getTimezoneOffset() < Math.max(jan, jul) ? 'EDT' : 'EST';
  } catch {
    return 'EST';
  }
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(utc));
  } catch {
    return '—';
  }
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(utc));
  } catch {
    return '—';
  }
}

// ─── Confidence color ─────────────────────────────────────────────────────────

export function confidenceColor(score: number): string {
  if (score >= 80) return 'text-green-trade';
  if (score >= 65) return 'text-yellow-alert';
  if (score >= 50) return 'text-blue-accent';
  return 'text-text-muted';
}

export function confidenceBgColor(score: number): string {
  if (score >= 80) return 'bg-green-trade';
  if (score >= 65) return 'bg-yellow-alert';
  if (score >= 50) return 'bg-blue-accent';
  return 'bg-text-muted';
}

// ─── Sentiment color ──────────────────────────────────────────────────────────

export function sentimentColor(s: Sentiment | undefined): string {
  switch (s) {
    case 'STRONG_BULLISH':
      return 'text-green-trade';
    case 'BULLISH':
      return 'text-green-500';
    case 'MIXED':
      return 'text-yellow-alert';
    case 'BEARISH':
      return 'text-red-400';
    case 'STRONG_BEARISH':
      return 'text-red-trade';
    default:
      return 'text-text-muted';
  }
}

export function sentimentBgColor(s: Sentiment | undefined): string {
  switch (s) {
    case 'STRONG_BULLISH':
      return 'bg-green-trade/20 text-green-trade border border-green-trade/30';
    case 'BULLISH':
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'MIXED':
      return 'bg-yellow-alert/20 text-yellow-alert border border-yellow-alert/30';
    case 'BEARISH':
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case 'STRONG_BEARISH':
      return 'bg-red-trade/20 text-red-trade border border-red-trade/30';
    default:
      return 'bg-text-muted/20 text-text-muted border border-text-muted/30';
  }
}

export function sentimentLabel(s: Sentiment | undefined): string {
  switch (s) {
    case 'STRONG_BULLISH': return 'Strong Bullish';
    case 'BULLISH': return 'Bullish';
    case 'MIXED': return 'Mixed';
    case 'BEARISH': return 'Bearish';
    case 'STRONG_BEARISH': return 'Strong Bearish';
    default: return 'Unknown';
  }
}

// ─── Number formatting ────────────────────────────────────────────────────────

export function formatNumber(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDecimal(n: number | undefined | null, digits = 2): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(digits);
}

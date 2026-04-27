/**
 * useTradeOutcome — Outcome locking + post-close trade persistence
 *
 * Two concerns handled here:
 *
 * 1. OUTCOME LOCKING
 *    Once a trade card's computed state becomes 'take_profit' or 'terminated',
 *    that outcome is written to localStorage keyed by trade ID.  On every
 *    subsequent render the persisted value wins — even if live price retraces
 *    so the delta-estimated premium drifts back across the original threshold.
 *    Outcomes are scoped to today's date so yesterday's data never bleeds over.
 *
 * 2. TRADE PERSISTENCE
 *    Every time the trades API returns live setups they are merged into a
 *    localStorage snapshot (keyed by trade ID, scoped to today's date).
 *    After the market closes the API returns an empty list, but the snapshot
 *    can still be served so traders see any open positions they need to close.
 *    The snapshot is automatically discarded at midnight ET / next day.
 */

import { useEffect, useState } from 'react';
import type { TradeSetup } from './types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type LockedOutcome = 'take_profit' | 'terminated' | null;

// ── Storage keys ───────────────────────────────────────────────────────────────

const OUTCOMES_KEY = 'rh_trade_outcomes_v2';  // { [id]: { outcome, date } }
const TRADES_KEY   = 'rh_active_trades_v2';   // { date, trades: TradeSetup[] }

// ── Date helper ────────────────────────────────────────────────────────────────

/** Returns today's date string in ET ("2026-04-21"). */
function todayET(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
    .format(new Date())
    .replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'); // MM/DD/YYYY → YYYY-MM-DD
}

// ── Outcome storage helpers ────────────────────────────────────────────────────

type OutcomeStore = Record<string, { outcome: LockedOutcome; date: string; lockedAt?: number }>;

function readOutcomes(): OutcomeStore {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(OUTCOMES_KEY) ?? '{}'); }
  catch { return {}; }
}

function writeOutcomes(store: OutcomeStore) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(OUTCOMES_KEY, JSON.stringify(store)); } catch { /* quota */ }
}

// ── useLockedOutcome ───────────────────────────────────────────────────────────

/**
 * Per-card hook that returns the definitive outcome for a trade.
 *
 * - On mount: hydrates from localStorage (today's value only).
 * - When `liveState` first transitions to a terminal value ('take_profit' or
 *   'terminated'), that value is immediately written to localStorage (with a
 *   `lockedAt` timestamp) and the returned value is permanently locked.
 * - If `liveState` is 'hold', 'not_entered', or null, the live value is
 *   returned until a terminal event occurs.
 *
 * Starts as null on the server (SSR-safe) and hydrates after mount to prevent
 * React hydration mismatches.
 */
export function useLockedOutcome(
  tradeId: string,
  liveState: 'hold' | 'take_profit' | 'terminated' | 'not_entered' | null,
): 'hold' | 'take_profit' | 'terminated' | 'not_entered' | null {
  const [locked, setLocked] = useState<LockedOutcome>(null);

  // Hydrate from localStorage after mount (client-only)
  useEffect(() => {
    const today   = todayET();
    const store   = readOutcomes();
    const entry   = store[tradeId];
    if (entry?.date === today && entry.outcome) {
      setLocked(entry.outcome);
    }
  }, [tradeId]);

  // Lock the first terminal outcome observed
  useEffect(() => {
    if (liveState !== 'take_profit' && liveState !== 'terminated') return;
    if (locked) return; // already locked — never overwrite

    const today = todayET();
    const store = readOutcomes();
    if (!store[tradeId]?.outcome) {
      store[tradeId] = { outcome: liveState, date: today, lockedAt: Date.now() };
      writeOutcomes(store);
      setLocked(liveState);
    }
  }, [liveState, tradeId, locked]);

  // Locked outcome wins; otherwise pass through the live state
  if (locked) return locked;
  return liveState;
}

// ── Outcome expiry helper ──────────────────────────────────────────────────────

/**
 * Returns true if a trade's locked outcome (TP or SL) was recorded more than
 * 15 minutes ago. Used by TradeList to remove terminal cards after their
 * 15-minute grace window expires.
 *
 * Returns false when:
 *  • No locked outcome exists for this trade
 *  • The outcome was locked today but has no timestamp (legacy entry)
 *  • The outcome was locked less than 15 minutes ago
 */
export function isOutcomeExpired(tradeId: string): boolean {
  const store = readOutcomes();
  const entry = store[tradeId];
  if (!entry?.outcome) return false;           // no terminal outcome locked
  const today = todayET();
  if (entry.date !== today) return false;      // stale date — handled by date rollover
  if (!entry.lockedAt) return false;           // legacy entry without timestamp
  return Date.now() - entry.lockedAt > 15 * 60 * 1000; // 15 minutes in ms
}

// ── Trade persistence helpers ──────────────────────────────────────────────────

type PersistedStore = { date: string; trades: TradeSetup[] };

function readPersistedStore(): PersistedStore | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TRADES_KEY);
    return raw ? (JSON.parse(raw) as PersistedStore) : null;
  } catch { return null; }
}

function writePersistedStore(store: PersistedStore) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(TRADES_KEY, JSON.stringify(store)); } catch { /* quota */ }
}

/**
 * Merge today's live trades into the localStorage snapshot.
 * Safe to call with an empty array (won't clear today's existing snapshot).
 * Called from TradeList whenever the API returns a non-empty list.
 */
export function persistActiveTrades(trades: TradeSetup[]): void {
  if (!trades.length) return;
  const today    = todayET();
  const existing = readPersistedStore();

  // Build a merged map: existing today's entries + incoming trades
  const map: Record<string, TradeSetup> = {};
  if (existing?.date === today) {
    for (const t of existing.trades) map[t.id] = t;
  }
  for (const t of trades) map[t.id] = t;

  writePersistedStore({ date: today, trades: Object.values(map) });
}

/**
 * Hook that returns today's persisted trades for post-close display.
 * Returns [] on the server (SSR-safe), [] if stored data is from a prior day,
 * and today's trade list otherwise.
 */
export function usePersistedTrades(): TradeSetup[] {
  const [trades, setTrades] = useState<TradeSetup[]>([]);

  useEffect(() => {
    const store = readPersistedStore();
    if (!store) { setTrades([]); return; }
    const today = todayET();
    if (store.date !== today) {
      // Stale data from a prior day — discard and start fresh
      localStorage.removeItem(TRADES_KEY);
      setTrades([]);
    } else {
      setTrades(store.trades);
    }
  }, []);

  return trades;
}

// ── Market-hours helper (ET) ───────────────────────────────────────────────────

/**
 * Returns true if the current ET time is within the display window:
 *   Monday–Friday, 9:00 AM – 4:30 PM ET.
 * Outside this window ZERO trade cards are shown on the dashboard —
 * neither live API results nor persisted cards from earlier in the session.
 */
export function isDisplayHours(): boolean {
  if (typeof window === 'undefined') return true; // safe SSR default
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:  'America/New_York',
    weekday:   'short',
    hour:      'numeric',
    minute:    '2-digit',
    hour12:    false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const weekday = get('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const h = parseInt(get('hour'),   10);
  const m = parseInt(get('minute'), 10);
  const t = h * 60 + m;

  // 9:00 AM – 4:30 PM ET  (540 – 990)
  return t >= 9 * 60 && t <= 16 * 60 + 30;
}

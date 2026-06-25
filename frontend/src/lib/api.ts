// Web Trace — production data layer (TypeScript).
// Ported 1:1 from design-system/ui_kits/dashboard/api.js so the live site matches
// the approved preview exactly. Talks to the existing FastAPI backend.
//
// HARD RULE — NO MOCK DATA: every loader returns EMPTY ({ live:false, … }) on any
// failure. Never return placeholder cards or invented numbers.
'use client';

import { useEffect, useState } from 'react';

// ── API base ─────────────────────────────────────────────────────────────────
// Production: set NEXT_PUBLIC_API_BASE (e.g. https://api.webtrace.app/api).
// Falls back to same-origin '/api' if a rewrite/proxy is configured.
export function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE;
  if (env) return env.replace(/\/$/, '');
  return '/api';
}

// Single attempt with an abort timeout.
async function getOnce<T = any>(path: string, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(apiBase() + path, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()) as T;
  } finally {
    clearTimeout(to);
  }
}

// Resilient GET: retries with backoff so a sleeping/cold-starting backend (which
// can take 30–60s to wake on some hosts) is waited out instead of being reported
// as "unreachable" on the first slow response. Each attempt gets a longer timeout.
async function get<T = any>(path: string, opts?: { retries?: number }): Promise<T> {
  const retries = opts?.retries ?? 3;
  const timeouts = [6000, 12000, 20000, 20000]; // ms per attempt; grows for cold start
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await getOnce<T>(path, timeouts[Math.min(i, timeouts.length - 1)]);
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        // brief backoff before retrying (0.8s, 1.6s, 2.4s …)
        await new Promise((res) => setTimeout(res, 800 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const num = (x: any): number | null => (x == null || isNaN(x) ? null : Number(x));
function fmtET(iso?: string): string {
  if (!iso) return '—';
  try {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    const t = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(utc));
    return t + ' ET';
  } catch {
    return '—';
  }
}
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'T00:00:00Z';
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(utc));
  } catch {
    return String(iso).slice(0, 10);
  }
}
function firstDollar(s: any): string {
  const m = String(s || '').match(/\$\d+(?:\.\d+)?/);
  return m ? m[0] : s || '—';
}

// ── types ────────────────────────────────────────────────────────────────────
export type Tone = 'up' | 'down' | 'accent' | 'gold' | 'neutral';
export interface Setup {
  id: string; ticker: string; direction: string; strategy: string;
  confidence: number; state: string;
  price: number | null; change: number | null; changePct: number | null;
  strike: number | null; exp: string; prem: number | null; delta: number | null; iv: number | null;
  entry: string; stop: string; target: string;
  tags: string[]; bullets: string[]; detected: string;
}
export interface MonthPoint { ym: string; year: string; m: string; r: number; }
export interface StatItem { label: string; value: string; suffix?: string; tone?: Tone; delta?: string | null; }
export interface NewsItem { src: string; h: string; sent: string; tone: Tone; impact: string; tickers: string[]; time: string; }

// ── mappers (API shape → UI shape) ───────────────────────────────────────────
function mapTrade(t: any): Setup {
  const c = t.contract || {}, ctx = t.market_context || {}, ex = t.execution || {};
  const conf = t.confidence_score == null ? 0 : t.confidence_score <= 1 ? Math.round(t.confidence_score * 100) : Math.round(t.confidence_score);
  const tags: string[] = [];
  if (ctx.orb_confirmed) tags.push('ORB confirmed');
  if (num(ctx.volume_ratio) != null && ctx.volume_ratio >= 2) tags.push('Vol ≥ 2×');
  if (t.news_catalyst_tag) tags.push(t.news_catalyst_tag);
  return {
    id: t.id, ticker: t.ticker, direction: t.direction, strategy: t.strategy || 'Setup',
    confidence: conf, state: 'live',
    price: num(ctx.current_price), change: null, changePct: null,
    strike: num(c.strike), exp: c.expiration || '—', prem: num(c.premium), delta: num(c.delta),
    iv: c.implied_volatility != null ? +(c.implied_volatility * 100).toFixed(1) : null,
    entry: ex.suggested_entry != null ? '$' + Number(ex.suggested_entry).toFixed(2) : firstDollar(ex.entry_price_guidance),
    stop: firstDollar(ex.stop_loss_guidance), target: firstDollar(ex.profit_target_guidance),
    tags, bullets: (t.reasoning && t.reasoning.bullet_points) || [], detected: fmtET(t.detected_at),
  };
}
const SENT: Record<string, [string, Tone]> = {
  STRONG_BULLISH: ['Strong Bullish', 'up'], BULLISH: ['Bullish', 'up'], MIXED: ['Mixed', 'gold'],
  BEARISH: ['Bearish', 'down'], STRONG_BEARISH: ['Strong Bearish', 'down'],
};
function mapNewsItem(x: any): NewsItem {
  const s = SENT[(x.nlp && x.nlp.sentiment) || ''] || (['—', 'neutral'] as [string, Tone]);
  return { src: x.source || '—', h: x.headline, sent: s[0], tone: s[1], impact: x.impact || '—', tickers: x.related_tickers || [], time: fmtET(x.published_at) };
}

// ── loaders (fetch + map; on failure → EMPTY, never fabricated) ───────────────
export interface StatusData { live: boolean; tickers: number; setups: number; running: boolean; }
export async function loadStatus(): Promise<StatusData> {
  try { const s = await get('/scanner/status'); return { live: true, tickers: s.tickers_tracked ?? 0, setups: s.setups_found ?? 0, running: !!s.is_running }; }
  catch { return { live: false, tickers: 0, setups: 0, running: false }; }
}

export interface SignalsData { live: boolean; setups: Setup[]; updated: string; active: number; doTake: number; }
export async function loadSignals(): Promise<SignalsData> {
  try {
    const d = await get('/trades');
    const setups: Setup[] = (d.trades || []).map(mapTrade);
    await Promise.all(setups.map(async (st) => {
      try {
        const p = await get('/scanner/price/' + encodeURIComponent(st.ticker), { retries: 0 });
        if (p && p.price != null) { st.price = num(p.price); st.change = num(p.change); st.changePct = p.change_pct != null ? Math.abs(p.change_pct) : null; }
      } catch { /* non-fatal */ }
    }));
    return { live: true, setups, updated: fmtET(d.last_updated), active: d.total ?? setups.length, doTake: d.actionable_count ?? setups.length };
  } catch { return { live: false, setups: [], updated: '—', active: 0, doTake: 0 }; }
}

export interface NewsData { live: boolean; news: NewsItem[]; actionable: number; }
export async function loadNews(): Promise<NewsData> {
  try { const d = await get('/news'); return { live: true, news: (d.items || []).map(mapNewsItem), actionable: d.high_impact_count ?? 0 }; }
  catch { return { live: false, news: [], actionable: 0 }; }
}

export interface StrategyPerf {
  key: string;
  name: string;
  description?: string;
  dteLabel?: string;
  period?: string;
  tradesPerYear?: number | null;
  stats: StatItem[];
  months: MonthPoint[];
}
export interface PerformanceData {
  live: boolean;
  strategies: StrategyPerf[];
  asOf?: string | null;
  disclaimer?: string;
  empty?: boolean;
  // legacy single-strategy fields (kept for any older callers)
  stats?: StatItem[];
  months?: MonthPoint[];
  name?: string;
}

const MON_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function mapStrategy(s: any): StrategyPerf {
  const stats: StatItem[] = [
    { label: 'Total Return', value: (s.total_return_pct >= 0 ? '+' : '') + Number(s.total_return_pct).toFixed(1), suffix: '%', tone: s.total_return_pct >= 0 ? 'up' : 'down', delta: null },
    { label: 'Win Rate', value: Number(s.win_rate <= 1 ? s.win_rate * 100 : s.win_rate).toFixed(1), suffix: '%', tone: 'accent' },
    { label: 'Profit Factor', value: Number(s.profit_factor).toFixed(1), suffix: '×' },
    { label: 'Sharpe', value: Number(s.sharpe_ratio).toFixed(2) },
    { label: 'Max Drawdown', value: Number(s.max_drawdown_pct).toFixed(1), suffix: '%', tone: 'down' },
  ];
  const months: MonthPoint[] = (s.monthly_returns || []).map((m: any) => {
    const ym: string = m.month || '';
    const [yr, mo] = ym.split('-');
    const mi = Math.max(0, (parseInt(mo, 10) || 1) - 1);
    return { ym, year: yr || '', m: MON_ABBR[mi], r: Math.round(m.return_pct) };
  });
  return {
    key: s.key, name: s.name, description: s.description, dteLabel: s.dte_label,
    period: s.period, tradesPerYear: s.trades_per_year ?? null, stats, months,
  };
}

export async function loadPerformance(): Promise<PerformanceData> {
  try {
    const d = await get('/performance');
    const raw = d.strategies || [];
    if (!raw.length) return { live: true, strategies: [], empty: true };
    const strategies = raw.map(mapStrategy);
    const asOf = d.as_of || d.last_updated || null;
    return {
      live: true, strategies, asOf, disclaimer: d.disclaimer,
      // legacy mirror of first strategy
      stats: strategies[0].stats, months: strategies[0].months, name: strategies[0].name,
    };
  } catch { return { live: false, strategies: [], empty: true }; }
}

// ── useLoad — load once + optional polling (mirrors the preview's hook) ───────
export function useLoad<T>(fn: () => Promise<T>, intervalMs?: number): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => fn().then((d) => { if (alive) setData(d); }).catch(() => {});
    run();
    const id = intervalMs ? setInterval(run, intervalMs) : null;
    return () => { alive = false; if (id) clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}

// ── Replay ────────────────────────────────────────────────────────────────────
export interface ConfluenceItem { key: string; name: string; weight: number; earned: number; met: boolean; desc: string; }
export interface ReplayBar { t: string; o: number; h: number; l: number; c: number; }
export interface ReplaySummary { id: string; ticker: string; date: string; direction: string; interval: string; is_intraday: boolean; win: boolean; pnl_pct: number; score?: number; }
export interface ReplayBundle extends ReplaySummary {
  exit_type?: string; entry_price?: number; exit_price?: number; underlying_move?: number;
  bars: ReplayBar[]; entry_index: number; checklist: ConfluenceItem[];
}
export interface ReplayList { maxScore: number; confluenceDefs: any[]; replays: ReplaySummary[]; live: boolean; }

export async function loadReplayList(): Promise<ReplayList> {
  try {
    const d = await get('/replay');
    return { maxScore: d.max_score ?? 100, confluenceDefs: d.confluence_defs ?? [], replays: d.replays ?? [], live: true };
  } catch { return { maxScore: 100, confluenceDefs: [], replays: [], live: false }; }
}

export async function loadReplay(id: string): Promise<ReplayBundle | null> {
  try { return await get('/replay/' + encodeURIComponent(id)) as ReplayBundle; }
  catch { return null; }
}

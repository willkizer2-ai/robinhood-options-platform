'use client';
// Web Trace — Trading Desk (production TSX).
// Ported 1:1 from design-system/ui_kits/dashboard/desk.jsx. Reuses the design
// system's own component primitives so the UI is pixel-identical to the preview.
// Data comes only from the live backend (see ../lib/api). No mock data.

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock, CheckCircle2, Pause, X, CheckCheck, LineChart, CalendarClock,
  Home, Radar, GitFork, Layers, TrendingUp, Activity, ShieldCheck,
} from 'lucide-react';

// Design-system primitives (copied into the repo — see CLAUDE-CODE prompt).
import { Button } from '@ds/components/core/Button';
import { Badge } from '@ds/components/core/Badge';
import { StatusPill } from '@ds/components/core/StatusPill';
import { StatTile } from '@ds/components/data/StatTile';
import { ConfidenceMeter } from '@ds/components/data/ConfidenceMeter';
import { DirectionTag } from '@ds/components/data/DirectionTag';
import { PriceTicker } from '@ds/components/data/PriceTicker';
import { Panel } from '@ds/components/layout/Panel';
import { Tabs } from '@ds/components/navigation/Tabs';
import { Banner } from '@ds/components/feedback/Banner';

import {
  useLoad, fmtDate, loadStatus, loadSignals, loadNews, loadPerformance,
  type Setup, type StatusData,
} from '../lib/api';

// ── tiny helpers ─────────────────────────────────────────────────────────────
function Skeleton({ h = 96, n = 3 }: { h?: number; n?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="wt-skeleton" style={{ height: h, borderRadius: 'var(--radius-lg)' }} />
      ))}
    </div>
  );
}
// connection chip — live backend vs not connected (no fabricated data shown)
function SourceTag({ live }: { live: boolean }) {
  return live ? <StatusPill tone="up" pulse>Live</StatusPill> : <StatusPill tone="neutral" dot={false}>Offline</StatusPill>;
}

const STATE_BANNER: Record<string, { tone: any; label: string; Icon: any }> = {
  live: { tone: 'success', label: 'Do Take — Live', Icon: CheckCircle2 },
  hold: { tone: 'warn', label: 'Holding — Neither Level Hit', Icon: Pause },
  take_profit: { tone: 'success', label: 'Take Profit Hit ✓', Icon: CheckCheck },
  terminated: { tone: 'danger', label: 'Stop Loss Hit', Icon: X },
  not_entered: { tone: 'neutral', label: 'Awaiting Entry Level', Icon: Clock },
};
const STATE_ACCENT: Record<string, any> = { live: 'up', hold: 'gold', take_profit: 'up', terminated: 'down', not_entered: undefined };

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)', border: '1px solid var(--border-default)', background: 'var(--surface-chip)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', whiteSpace: 'nowrap' }}>{children}</span>;
}
function Lvl({ label, value, c, bg }: { label: string; value: string; c: string; bg: string }) {
  return (
    <div style={{ textAlign: 'center', borderRadius: 'var(--radius-md)', padding: '8px 4px', background: bg, border: `1px solid color-mix(in srgb, ${c} 22%, transparent)` }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14, color: c }}>{value}</div>
    </div>
  );
}

// ── Trade card ───────────────────────────────────────────────────────────────
export function TradeCard({ t }: { t: Setup }) {
  const [open, setOpen] = useState(false);
  const b = STATE_BANNER[t.state] || STATE_BANNER.live;
  const dim = t.state === 'terminated' || t.state === 'not_entered';
  const BannerIcon = b.Icon;
  return (
    <Panel accent={STATE_ACCENT[t.state]} padded={false} style={{ opacity: dim ? 0.82 : 1 }}>
      <Banner tone={b.tone} icon={<BannerIcon size={13} />}>{b.label}</Banner>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{t.ticker}</span>
            <DirectionTag direction={t.direction} />
            <ConfidenceMeter value={t.confidence} width={70} />
          </div>
          {t.price != null && <PriceTicker price={t.price} change={t.change ?? undefined} changePct={t.changePct != null ? Math.abs(t.changePct) : undefined} live align="right" />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Badge tone="accent" variant="outline">{t.strategy}</Badge>
          {t.tags.map((tag, i) => <Badge key={i} tone="neutral">{tag}</Badge>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {t.strike != null && <Pill>STRIKE <b style={{ color: 'var(--text-primary)' }}>${t.strike}</b></Pill>}
          <Pill>EXP <b style={{ color: 'var(--text-primary)' }}>{t.exp}</b></Pill>
          {t.prem != null && <Pill>PREM <b style={{ color: 'var(--gold-300)' }}>${t.prem.toFixed(2)}</b></Pill>}
          {t.delta != null && <Pill>Δ <b style={{ color: 'var(--text-primary)' }}>{t.delta.toFixed(2)}</b></Pill>}
          {t.iv != null && <Pill>IV <b style={{ color: 'var(--text-primary)' }}>{t.iv}%</b></Pill>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <Lvl label="Entry" value={t.entry} c="var(--accent-text)" bg="var(--accent-muted)" />
          <Lvl label="Stop" value={t.stop} c="var(--down-text)" bg="var(--down-bg)" />
          <Lvl label="Target" value={t.target} c="var(--up-text)" bg="var(--up-bg)" />
        </div>
        {t.bullets.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {t.bullets.slice(0, open ? 9 : 2).map((pt, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <span style={{ marginTop: 7, width: 4, height: 4, borderRadius: '50%', background: 'var(--periwinkle-500)', flex: 'none' }} />{pt}
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="secondary" leftIcon={<LineChart size={14} />} onClick={() => setOpen((o) => !o)}>{open ? 'Hide details' : 'Full details'}</Button>
          <Button size="sm" variant="success" leftIcon={<CheckCircle2 size={14} />}>Place order</Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={12} /> Detected {t.detected}</span>
          <span>conf {(t.confidence / 100).toFixed(2)}</span>
        </div>
      </div>
    </Panel>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
export function DeskHeader({ status }: { status: StatusData | null }) {
  const live = status ? status.live : false;
  return (
    <header style={{ background: 'rgba(22,22,25,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          {/* Logo + wordmark link back to the landing page */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }} aria-label="Web Trace home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" width={34} height={34} alt="" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Web</span>
              <span className="wt-gradient-text" style={{ fontFamily: 'var(--font-brand)', fontSize: 18 }}>&nbsp;Trace</span>
            </div>
          </Link>
          <SourceTag live={live} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
            <b style={{ color: 'var(--text-primary)' }}>{status ? status.tickers : '—'}</b> tickers · <b style={{ color: 'var(--text-primary)' }}>{status ? status.setups : '—'}</b> setups
          </span>
          <Link href="/">
            <Button variant="ghost" size="sm" leftIcon={<Home size={14} />}>Home</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Screens ──────────────────────────────────────────────────────────────────
export function SignalsScreen() {
  const d = useLoad(loadSignals, 30000);
  if (!d) return <Skeleton n={3} h={300} />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' }}><b style={{ color: 'var(--text-primary)', fontSize: 14 }}>{d.active}</b> active signals</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' }}><b style={{ color: 'var(--up-text)', fontSize: 14 }}>{d.doTake}</b> DO TAKE</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <SourceTag live={d.live} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-faint)' }}>Updated {d.updated}</span>
        </span>
      </div>
      {d.setups.length === 0 ? (
        <Panel><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{d.live ? 'No actionable setups right now. Cards post during the 9:30–11:00 AM ET entry window.' : 'Not connected to the desk — no trades to show. Live setups appear once the backend is reachable.'}</p></Panel>
      ) : (
        <div className="wt-cardgrid">{d.setups.map((t) => <TradeCard key={t.id} t={t} />)}</div>
      )}
    </div>
  );
}

export function PerformanceScreen() {
  const d = useLoad(loadPerformance);
  if (!d) return <Skeleton n={2} h={140} />;
  if (d.empty) return <Panel eyebrow="Performance" title="No trade history yet"><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Performance populates once real trade history is connected. The chart will fill in from Jan 2025 to the latest end-of-day once the backend serves it.</p></Panel>;
  const max = Math.max(20, ...d.months.map((m) => Math.abs(m.r)));
  const groups: { year: string; items: typeof d.months }[] = [];
  d.months.forEach((mo) => {
    const last = groups[groups.length - 1];
    if (last && last.year === mo.year) last.items.push(mo);
    else groups.push({ year: mo.year, items: [mo] });
  });
  const stamp = d.asOf ? 'As of EOD ' + fmtDate(d.asOf) : 'As of last end-of-day';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarClock size={13} /> {stamp}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge tone="gold" variant="outline">Backtested</Badge>
          <SourceTag live={d.live} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12 }}>
        {d.stats.map((s, i) => <StatTile key={i} label={s.label} value={s.value} suffix={s.suffix} tone={s.tone} delta={s.delta ?? undefined} />)}
      </div>
      <Panel eyebrow={d.name || 'Strategy'} title="Monthly Returns" action={<Badge tone="up" variant="soft">{groups.length > 1 ? groups[0].year + '–' + groups[groups.length - 1].year : 'Live'}</Badge>}>
        {d.months.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>No monthly data available yet — history loads from Jan 2025 onward once connected.</p>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 22, height: 200, minWidth: 'min-content', padding: '8px 4px' }}>
              {groups.map((g, gi) => (
                <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: gi > 0 ? '1px solid var(--border-subtle)' : 'none', paddingLeft: gi > 0 ? 22 : 0, marginLeft: gi > 0 ? -22 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flex: 1 }}>
                    {g.items.map((mo, i) => {
                      const up = mo.r >= 0;
                      const h = (Math.abs(mo.r) / max) * 132 + 6;
                      return (
                        <div key={i} title={`${mo.m} ${g.year}: ${up ? '+' : ''}${mo.r}%`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 7, height: '100%', width: 26 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: up ? 'var(--up-text)' : 'var(--down-text)' }}>{up ? '+' : ''}{mo.r}</span>
                          <div style={{ width: '100%', height: h, borderRadius: 'var(--radius-sm)', background: up ? 'var(--up)' : 'var(--down)', boxShadow: up ? 'var(--glow-up)' : 'var(--glow-down)', opacity: 0.92 }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}>{mo.m[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'center' }}>{g.year}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p style={{ margin: '10px 2px 0', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>Monthly net return from the backtested trade record. Months with no qualifying setup show 0%. Past performance is not indicative of future results.</p>
      </Panel>

      <StrategyExplainer />
    </div>
  );
}

// ── Strategy / Confluence explainer ──────────────────────────────────────────
// Documents the ICT V4.1 gates that must align before a trade is taken. This is
// static educational copy describing the engine's methodology — not trade data.
const CONFLUENCES: { Icon: any; name: string; weight: string; body: string }[] = [
  { Icon: Layers, name: 'Fair Value Gap (FVG)', weight: '0–25 pts', body: 'A 3-candle institutional imbalance left unfilled. Entry requires price returning to an active (unmitigated) gap — indices fill ~80% of FVGs within 5 bars.' },
  { Icon: Activity, name: 'Value Area (VAH/VAL)', weight: '0–25 pts', body: 'Rolling volume profile. The strongest entries sit at the Value Area Low (calls) or High (puts), where ~78% of sessions close inside the prior value area.' },
  { Icon: GitFork, name: 'Market Structure', weight: '0–15 pts', body: 'A liquidity sweep (Judas swing) followed by a Change of Character or Break of Structure — confirmation that manipulation is complete before entry.' },
  { Icon: TrendingUp, name: 'Fibonacci OTE', weight: '0–10 pts', body: 'Optimal Trade Entry zone (61.8–78.6% retracement) or the 50% equilibrium, where institutional limit orders cluster.' },
  { Icon: Radar, name: 'HTF Bias', weight: '0–15 pts', body: 'Higher-timeframe (30m–4h) EMA bias sets the only permitted trade direction. Counter-trend signals are rejected.' },
  { Icon: ShieldCheck, name: 'Order Block + Volume', weight: '0–10 pts', body: 'An unmitigated order block overlapping the FVG (the "Unicorn" model) plus volume/CVD confirmation adds the final conviction points.' },
];

export function StrategyExplainer() {
  return (
    <Panel eyebrow="Methodology" title="ICT V4.1 — How a trade qualifies">
      <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        Every signal is scored 0–100 across six confluences. A trade is only taken when the
        combined score clears the threshold (≥65 fires; ≥80 is high-conviction) <em>and</em> the
        mandatory gates — an active FVG, confirmed structure, and HTF bias — all align. The engine
        trades ATM options on liquid index ETFs (SPY, QQQ, IWM, DIA, XLK) with a 50% stop and 150%
        target. Few setups clear the bar by design — quality over frequency.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
        {CONFLUENCES.map((c, i) => (
          <div key={i} style={{ padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 'var(--radius-sm)', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-muted)', color: 'var(--accent-text)', flex: 'none' }}><c.Icon size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{c.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>{c.weight}</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)' }}>{c.body}</p>
          </div>
        ))}
      </div>
      <p style={{ margin: '16px 2px 0', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
        Results shown are backtested on real historical OHLC data over a 2-year window — a limited,
        high-conviction sample, not a live-traded record. ATM premiums modeled via Black-Scholes.
        For educational use; not financial advice.
      </p>
    </Panel>
  );
}

export function NewsScreen() {
  const d = useLoad(loadNews, 60000);
  if (!d) return <div style={{ maxWidth: 640, margin: '0 auto' }}><Skeleton n={3} h={88} /></div>;
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Panel eyebrow="News" title="Market Feed" action={d.actionable ? <Badge tone="accent" variant="outline">{d.actionable} high impact</Badge> : <SourceTag live={d.live} />}>
        {d.news.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{d.live ? 'No news in the feed.' : 'Offline — news appears once the backend is reachable.'}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.news.map((a, i) => (
              <div key={i} style={{ padding: '13px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{a.src}</span>
                  <Badge tone={a.tone} variant="soft" size="sm">{a.sent}</Badge>
                  <Badge tone="neutral" size="sm">{a.impact}</Badge>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>{a.time}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.45 }}>{a.h}</div>
                {a.tickers.length > 0 && <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>{a.tickers.map((tk, j) => <Badge key={j} tone="accent" variant="outline" size="sm">{tk}</Badge>)}</div>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ── Desk shell (3 tabs: Signals · Performance · News) ────────────────────────
export function Desk() {
  const [tab, setTab] = useState('signals');
  const status = useLoad(loadStatus, 15000);
  const tabs = [
    { id: 'signals', label: 'Signals' },
    { id: 'performance', label: 'Performance' },
    { id: 'news', label: 'News' },
  ];
  return (
    <div style={{ maxWidth: 'var(--container-wide)', margin: '0 auto' }}>
      <DeskHeader status={status} />
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(22,22,25,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ padding: '0 24px' }}><Tabs value={tab} onChange={setTab} tabs={tabs} style={{ border: 'none' }} /></div>
      </div>
      <div style={{ padding: '20px 24px 64px' }}>
        {tab === 'signals' && <SignalsScreen />}
        {tab === 'performance' && <PerformanceScreen />}
        {tab === 'news' && <NewsScreen />}
      </div>
    </div>
  );
}

'use client';
// Web Trace — Landing page (production TSX).
// Ported from design-system/ui_kits/marketing/index.html ("Tracing the market's
// edge"). Marketing stat numbers are pulled LIVE from /performance — no hardcoded
// figures — and fall back to "—" when unavailable. No mock data.

import React from 'react';
import Link from 'next/link';
import { Radar, GitFork, LineChart, Newspaper, ShieldCheck, Gauge, ArrowRight, Play } from 'lucide-react';
import { Button } from '@ds/components/core/Button';
import { useLoad, loadPerformance } from '../lib/api';
import ReplayLauncher from '../components/ReplayLauncher';

const FEATURES = [
  { Icon: Radar, h: 'Real-time signal scanner', p: 'A real-time engine surfaces only data-backed 0DTE and multi-day setups — no mocks, no synthetic fills, ever.' },
  { Icon: GitFork, h: 'Confluence gates', p: 'Every signal passes documented gates — volume, VWAP, structure, FVG, HTF bias — shown plainly on each card.' },
  { Icon: LineChart, h: 'Live execution map', p: 'Entry, stop, and target as real price levels, plotted live against the underlying with a locked outcome.' },
  { Icon: Newspaper, h: 'NLP news engine', p: 'Headlines scored for sentiment and impact, mapped to the tickers that actually move on them.' },
  { Icon: ShieldCheck, h: 'Honest by design', p: 'If the data is not real, the field is empty. Confidence is computed from signal strength — never inflated.' },
  { Icon: Gauge, h: 'Backtested edge', p: 'The ICT V4.1 strategy is published with its win rate, profit factor, and drawdown — nothing hidden.' },
];

function Wordmark({ size = 19 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Web</span>
      <span className="wt-gradient-text" style={{ fontFamily: 'var(--font-brand)', fontSize: size }}>&nbsp;Trace</span>
    </span>
  );
}

export default function Landing() {
  // Live marketing stats (no fabricated numbers).
  const perf = useLoad(loadPerformance);
  const stat = (label: string) => {
    const s = perf?.stats?.find((x) => x.label === label);
    return s ? s.value + (s.suffix || '') : '—';
  };

  return (
    <div className="lp">
      <nav className="top">
        <div className="wrap navrow">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" width={32} height={32} alt="" />
            <Wordmark />
          </div>
          <div className="navlinks">
            <a href="#product">Product</a><a href="#strategy">Strategy</a><a href="#performance">Performance</a>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/valuation"><Button variant="ghost" size="sm">Valuation</Button></Link>
            <Link href="/dashboard"><Button variant="primary" size="sm">Open the desk</Button></Link>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-bg" />
        <div className="wrap">
          <div className="wt-eyebrow" style={{ marginBottom: 16 }}>Portfolio Management · Powered by AI</div>
          <h1 className="head"><span className="wt-gradient-text">Tracing</span> the market&rsquo;s edge</h1>
          <p className="sub">A reliable, instrument-grade desk that surfaces real options intelligence — credible setups, live execution levels, and an honest, backtested edge.</p>
          <div className="ctas">
            <Link href="/dashboard"><Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>Open the desk</Button></Link>
            <ReplayLauncher><Button variant="secondary" size="lg" leftIcon={<Play size={16} />}>Watch a session</Button></ReplayLauncher>
          </div>
        </div>
      </header>

      <div className="strip"><div className="wrap striprow">
        <span>0DTE</span><span>ICT V4.1</span><span>yfinance live</span><span>No mock data</span><span>ET-aligned</span>
      </div></div>

      <section className="block" id="product"><div className="wrap">
        <div className="wt-eyebrow" style={{ marginBottom: 16 }}>What it does</div>
        <h2 className="sec">Everything a disciplined options desk needs — and nothing it doesn&rsquo;t</h2>
        <div className="features">
          {FEATURES.map((f, i) => (
            <div className="feat" key={i}>
              <div className="ic"><f.Icon size={20} /></div>
              <h3>{f.h}</h3><p>{f.p}</p>
            </div>
          ))}
        </div>
      </div></section>

      <section className="block" id="performance" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="statband">
          <div><div className="bignum up">{stat('Win Rate')}</div><div className="statlbl">ICT V4.1 win rate (backtested)</div></div>
          <div><div className="bignum">{stat('Profit Factor')}</div><div className="statlbl">Profit factor</div></div>
          <div><div className="bignum">{stat('Sharpe')}</div><div className="statlbl">Sharpe ratio</div></div>
          <div><div className="bignum">0</div><div className="statlbl">Synthetic data points</div></div>
        </div>
      </div></section>

      <section className="cta-final"><div className="wrap">
        <div className="wt-eyebrow" style={{ textAlign: 'center', marginBottom: 16 }}>Ready when the bell rings</div>
        <h2 className="sec" style={{ textAlign: 'center', maxWidth: '20ch', margin: '0 auto' }}>Trace your next setup with <span className="wt-gradient-text">Web&nbsp;Trace</span></h2>
        <div className="ctas" style={{ justifyContent: 'center', marginTop: 30 }}>
          <Link href="/dashboard"><Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>Open the desk</Button></Link>
        </div>
      </div></section>

      <footer><div className="wrap footrow">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.svg" width={26} height={26} alt="" />
          <Wordmark size={16} />
        </div>
        <span className="muted">© 2026 Web Trace Portfolio Management · Built by Will Kizer · For educational use — not financial advice</span>
      </div></footer>

      <style jsx>{`
        .lp { background: var(--surface-page); overflow-x: hidden; }
        .wrap { max-width: var(--container-wide); margin: 0 auto; padding: 0 32px; }
        .top { position: sticky; top: 0; z-index: 50; background: rgba(22,22,25,0.82); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border-subtle); }
        .navrow { display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .navlinks { display: flex; gap: 28px; }
        .navlinks a { color: var(--text-muted); font-size: 13px; font-weight: 500; }
        .navlinks a:hover { color: var(--text-primary); }
        .hero { position: relative; padding: 96px 0 84px; }
        .hero-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(900px 460px at 18% -8%, rgba(138,160,230,0.18), transparent 60%),
            radial-gradient(720px 420px at 92% 8%, rgba(180,180,204,0.12), transparent 60%); }
        .hero .wrap { position: relative; z-index: 1; }
        .head { font-family: var(--font-display); font-weight: 700; font-size: clamp(48px, 7vw, 92px); line-height: 0.98; letter-spacing: -0.035em; margin: 0; max-width: 16ch; }
        .sub { margin: 26px 0 0; max-width: 52ch; font-size: 18px; line-height: 1.6; color: var(--text-secondary); }
        .ctas { display: flex; gap: 14px; margin-top: 34px; flex-wrap: wrap; }
        .strip { border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); padding: 22px 0; }
        .striprow { display: flex; align-items: center; gap: 38px; flex-wrap: wrap; justify-content: center; opacity: 0.7; }
        .striprow span { font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.12em; color: var(--text-muted); text-transform: uppercase; }
        .block { padding: var(--section-pad-y, 96px) 0; }
        .sec { font-family: var(--font-display); font-weight: 700; font-size: clamp(30px, 4vw, 46px); letter-spacing: -0.025em; line-height: 1.08; max-width: 18ch; }
        .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 44px; }
        .feat { padding: 26px; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--surface-card); }
        .feat .ic { width: 40px; height: 40px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; background: var(--accent-muted); color: var(--accent-text); margin-bottom: 16px; }
        .feat h3 { font-size: 17px; font-weight: 600; margin: 0 0 8px; color: var(--text-primary); }
        .feat p { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--text-muted); }
        .statband { border-radius: var(--radius-xl); border: 1px solid var(--border-default); background: linear-gradient(180deg, var(--surface-card), var(--surface-sunken)); padding: 44px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .bignum { font-family: var(--font-brand); font-size: 52px; line-height: 1; color: var(--text-primary); }
        .bignum.up { color: var(--up-text); }
        .statlbl { font-size: 12px; color: var(--text-muted); margin-top: 12px; }
        .cta-final { text-align: center; padding: 100px 0; }
        .footrow { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; border-top: 1px solid var(--border-subtle); padding: 40px 0; }
        .footrow .muted { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-faint); }
        @media (max-width: 820px) { .features { grid-template-columns: 1fr; } .statband { grid-template-columns: repeat(2, 1fr); } }

        /* ── Phones ──────────────────────────────────────────────────────────── */
        @media (max-width: 560px) {
          .wrap { padding: 0 18px; }
          .navrow { height: 56px; }
          .navlinks { display: none; }            /* free up room for the auth buttons */
          .hero { padding: 56px 0 52px; }
          .sub { font-size: 16px; margin-top: 20px; }
          .ctas { margin-top: 26px; gap: 10px; }
          .ctas :global(a), .ctas :global(button) { flex: 1 1 100%; }  /* full-width CTAs */
          .strip { padding: 16px 0; }
          .striprow { gap: 20px 24px; }
          .striprow span { font-size: 11px; }
          .block { padding: 56px 0; }
          .features { margin-top: 28px; }
          .feat { padding: 20px; }
          .statband { padding: 26px 20px; gap: 14px 12px; }
          .bignum { font-size: 40px; }
          .cta-final { padding: 64px 0; }
          .footrow { padding: 28px 0; }
        }
        /* very small phones */
        @media (max-width: 380px) {
          .statband { grid-template-columns: 1fr 1fr; padding: 22px 16px; }
          .bignum { font-size: 34px; }
        }
      `}</style>
    </div>
  );
}

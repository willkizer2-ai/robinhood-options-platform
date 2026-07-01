'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Home, Search, TrendingUp, TrendingDown, Minus, Lock } from 'lucide-react';
import { loadValuation, type ValuationResult, type ValComponent } from '@/lib/api';

const C = {
  up: '#2dd4bf', down: '#f0508f', accent: '#b4b4cc', accentText: '#c7c9e0',
  ink950: '#111114', ink900: '#161619', ink800: '#232329', ink700: '#2e2e36',
  border: 'rgba(180,180,204,0.14)', borderStrong: 'rgba(180,180,204,0.24)',
  text: '#f4f4f9', muted: '#8a8b9c', faint: '#696a78', gold: '#e6b450',
};

// Free-tier lookup limit. This is the MECHANISM; it applies to everyone until
// Phase 2 billing exists to distinguish Pro+ (unlimited) from free (limited).
const FREE_LOOKUP_LIMIT = 3;

function scoreColor(s: number) {
  if (s >= 65) return C.up;
  if (s >= 45) return C.gold;
  return C.down;
}

function ScoreRing({ score }: { score: number }) {
  const r = 46, circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const col = scoreColor(score);
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(180,180,204,0.12)" strokeWidth="9" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 700ms ease' }} />
      <text x="60" y="56" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="26" fontWeight="700" fill={C.text}>{score.toFixed(0)}</text>
      <text x="60" y="76" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10" fill={C.muted}>/ 100</text>
    </svg>
  );
}

function ComponentCard({ title, comp }: { title: string; comp: ValComponent }) {
  if (comp.coming_soon) {
    return (
      <div style={{ padding: 16, borderRadius: 12, border: `1px dashed ${C.border}`, background: C.ink800, opacity: 0.7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{title}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: C.accentText, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 7px' }}>Coming soon</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Discounted cash-flow model — pending a cash-flow data source.</p>
      </div>
    );
  }
  if (!comp.available) {
    return (
      <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, background: C.ink800, opacity: 0.7 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginBottom: 4 }}>{title}</div>
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{comp.reason || 'Data unavailable.'}</p>
      </div>
    );
  }
  const col = scoreColor(comp.score!);
  return (
    <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, background: C.ink800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{title}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: col }}>{comp.score!.toFixed(0)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comp.metrics?.map((m) => (
          <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: C.muted, width: 108, flex: 'none' }}>{m.name}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.text, width: 56, flex: 'none' }}>{m.value}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(180,180,204,0.10)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${m.score}%`, background: scoreColor(m.score), borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ValuationClient() {
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookups, setLookups] = useState(0);
  const limitReached = lookups >= FREE_LOOKUP_LIMIT;

  const run = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t || loading || limitReached) return;
    setLoading(true);
    const r = await loadValuation(t);
    setResult(r);
    setLoading(false);
    if (r.ok) setLookups((n) => n + 1);
  };

  const ReadIcon = result?.ok
    ? (result.composite_score! >= 65 ? TrendingUp : result.composite_score! >= 45 ? Minus : TrendingDown)
    : Minus;

  return (
    <div style={{ minHeight: '100vh', background: C.ink900, color: C.text }}>
      {/* Header with Home link */}
      <header style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(22,22,25,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 940, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>Valuation</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.muted }}>fundamental analysis</span>
          </div>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: C.muted, fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600 }}>
            <Home size={15} /> Home
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 940, margin: '0 auto', padding: '28px 20px 64px' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>Fundamental valuation</h1>
        <p style={{ margin: '0 0 20px', color: C.muted, fontSize: 14, lineHeight: 1.6, maxWidth: 640 }}>
          Enter a ticker to see what its financials show under a fixed, transparent methodology —
          the same yardstick applied to every stock. This is analysis, not advice.
        </p>

        {/* Search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 8, maxWidth: 440 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: C.ink800 }}>
            <Search size={16} color={C.muted} />
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
              placeholder="e.g. AAPL"
              maxLength={8}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, letterSpacing: '0.05em' }}
            />
          </div>
          <button onClick={run} disabled={loading || limitReached || !ticker.trim()}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: (loading || limitReached || !ticker.trim()) ? 'not-allowed' : 'pointer', background: (loading || limitReached || !ticker.trim()) ? C.ink700 : C.accent, color: (loading || limitReached || !ticker.trim()) ? C.muted : C.ink950, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14 }}>
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {/* Free-tier lookup counter */}
        <div style={{ marginBottom: 24, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: limitReached ? C.gold : C.faint }}>
          {limitReached ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Lock size={12} /> Free lookup limit reached ({FREE_LOOKUP_LIMIT}). Pro & Premium get unlimited valuations.
            </span>
          ) : (
            <span>{FREE_LOOKUP_LIMIT - lookups} of {FREE_LOOKUP_LIMIT} free lookups remaining</span>
          )}
        </div>

        {/* Result */}
        {result && !result.ok && (
          <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${C.border}`, background: C.ink800, color: C.muted, fontSize: 14 }}>
            {result.error || 'No data available for this ticker.'}
          </div>
        )}

        {result && result.ok && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20, borderRadius: 14, border: `1px solid ${C.borderStrong}`, background: C.ink800, flexWrap: 'wrap' }}>
              <ScoreRing score={result.composite_score!} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>{result.symbol}</span>
                  <span style={{ fontSize: 14, color: C.muted }}>{result.name}</span>
                  {result.current_price != null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.text }}>${result.current_price}</span>}
                </div>
                {result.sector && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.faint, marginTop: 2 }}>{result.sector}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: scoreColor(result.composite_score!) }}>
                  <ReadIcon size={18} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{result.read}</span>
                </div>
              </div>
            </div>

            {/* Components */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <ComponentCard title="Relative Value" comp={result.components!.relative} />
              <ComponentCard title="Quality & Growth" comp={result.components!.quality} />
              <ComponentCard title="Intrinsic (DCF)" comp={result.components!.dcf} />
            </div>
          </div>
        )}

        {/* Disclaimer — always visible, prominent */}
        <div style={{ marginTop: 28, padding: '14px 16px', borderRadius: 10, border: `1px solid rgba(230,180,80,0.25)`, background: 'rgba(230,180,80,0.06)' }}>
          <p style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, lineHeight: 1.6, color: C.muted }}>
            {result?.disclaimer ||
              'This is a fundamental analysis tool, not investment advice. Scores reflect public financial metrics under a fixed methodology applied identically to every stock. Web Trace is not a registered investment adviser. Do your own research and consult a licensed professional before investing.'}
          </p>
        </div>
      </main>
    </div>
  );
}

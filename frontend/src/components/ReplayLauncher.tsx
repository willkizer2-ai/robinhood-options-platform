'use client';

import React, { useEffect, useState } from 'react';
import { Play, X, TrendingUp, TrendingDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { loadReplayList, type ReplaySummary } from '@/lib/api';

// Lazy-load the chart-heavy replay modal only when a trade is opened.
const TradeReplay = dynamic(() => import('./TradeReplay'), { ssr: false });

const C = {
  up: '#2dd4bf', down: '#f0508f', accent: '#b4b4cc', accentText: '#c7c9e0',
  ink950: '#111114', ink900: '#161619', ink800: '#232329', ink700: '#2e2e36',
  border: 'rgba(180,180,204,0.14)', borderStrong: 'rgba(180,180,204,0.24)',
  text: '#f4f4f9', muted: '#8a8b9c', faint: '#696a78', gold: '#e6b450',
};

function fmtDate(d: string) {
  try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: '2-digit' }).format(new Date(d + 'T00:00:00Z')); }
  catch { return d; }
}

/** A trigger that renders its children as a button; clicking opens the picker. */
export default function ReplayLauncher({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ReplaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || list.length) return;
    setLoading(true);
    loadReplayList().then((r) => { setList(r.replays); setLoading(false); });
  }, [open, list.length]);

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'inline-flex' }}>{children}</span>

      {open && !activeId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(10,10,12,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,100%)', maxHeight: '88vh', overflow: 'auto', background: C.ink900, border: `1px solid ${C.borderStrong}`, borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: C.text }}>Watch a session</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted, marginTop: 2 }}>Pick a backtested trade to replay bar-by-bar.</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 14 }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Loading trades…</div>
              ) : !list.length ? (
                <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No trade replays available yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((r) => {
                    const Icon = r.direction === 'CALL' ? TrendingUp : TrendingDown;
                    const dirC = r.direction === 'CALL' ? C.up : C.down;
                    return (
                      <button key={r.id} onClick={() => setActiveId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.ink800, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                        <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flex: 'none', background: 'rgba(180,180,204,0.10)', color: dirC }}><Icon size={16} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13.5, fontWeight: 600, color: C.text }}>{r.ticker} {r.direction}</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: C.muted }}>{fmtDate(r.date)} · {(r as any).interval === '1m' ? '1-min' : (r as any).interval === '5m' ? '5-min' : r.is_intraday ? '2-min' : 'daily'} · score {r.score ?? '—'}</div>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, color: r.win ? C.up : C.down }}>{r.win ? 'WIN' : 'LOSS'}</span>
                        <span style={{ display: 'inline-flex', color: C.accent }}><Play size={14} /></span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeId && <TradeReplay replayId={activeId} onClose={() => { setActiveId(null); setOpen(false); }} />}
    </>
  );
}

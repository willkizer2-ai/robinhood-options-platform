'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries, LineStyle, createSeriesMarkers } from 'lightweight-charts';
import { Play, Pause, RotateCcw, X, Check, ChevronRight } from 'lucide-react';
import { loadReplay, type ReplayBundle } from '@/lib/api';

// ── Web Trace theme tokens (read from CSS vars where possible) ─────────────────
const C = {
  up: '#2dd4bf', down: '#f0508f', accent: '#b4b4cc', accentText: '#c7c9e0',
  ink950: '#111114', ink900: '#161619', ink800: '#232329', ink700: '#2e2e36',
  border: 'rgba(180,180,204,0.14)', borderStrong: 'rgba(180,180,204,0.24)',
  text: '#f4f4f9', muted: '#8a8b9c', faint: '#696a78', gold: '#e6b450',
};

function fmtDate(d: string) {
  try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d + 'T00:00:00Z')); }
  catch { return d; }
}

export default function TradeReplay({ replayId, onClose }: { replayId: string; onClose: () => void }) {
  const [data, setData] = useState<ReplayBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [playhead, setPlayhead] = useState(0);       // current bar index revealed
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<any>(null);
  const seriesApi = useRef<any>(null);
  const markersApi = useRef<any>(null);
  const entryLineRef = useRef<any>(null);
  const overlayLinesRef = useRef<any[]>([]);

  // Load the replay bundle
  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadReplay(replayId).then((d) => { if (alive) { setData(d); setPlayhead(d ? Math.min(8, d.bars.length - 1) : 0); setLoading(false); } });
    return () => { alive = false; };
  }, [replayId]);

  // Build the chart once data is ready
  useEffect(() => {
    if (!data || !chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: C.ink950 }, textColor: C.muted, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: 'rgba(180,180,204,0.05)' }, horzLines: { color: 'rgba(180,180,204,0.05)' } },
      rightPriceScale: {
        borderColor: C.border,
        // Stretch the candles vertically: tight top/bottom margins make bars taller
        // and easier to read, while still leaving room for entry/overlay labels.
        scaleMargins: { top: 0.08, bottom: 0.08 },
        autoScale: true,
      },
      timeScale: { borderColor: C.border, timeVisible: data.interval === '2m' || data.interval === '1m', secondsVisible: false, rightOffset: 3 },
      crosshair: { vertLine: { color: C.accent, labelBackgroundColor: C.ink700 }, horzLine: { color: C.accent, labelBackgroundColor: C.ink700 } },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down,
      wickUpColor: C.up, wickDownColor: C.down,
    });
    chartApi.current = chart;
    seriesApi.current = series;
    markersApi.current = createSeriesMarkers(series, []);
    const onResize = () => chart.applyOptions({ width: chartRef.current!.clientWidth });
    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartApi.current = null; seriesApi.current = null; markersApi.current = null;
      entryLineRef.current = null; overlayLinesRef.current = [];
    };
  }, [data]);

  // Feed bars up to the playhead
  useEffect(() => {
    if (!data || !seriesApi.current) return;
    const slice = data.bars.slice(0, playhead + 1).map((b, i) => ({
      time: (i + 1) as any,  // synthetic sequential index keeps spacing uniform
      open: b.o, high: b.h, low: b.l, close: b.c,
    }));
    seriesApi.current.setData(slice);

    const pastEntryNow = playhead >= data.entry_index;

    // ── Entry marker (single, at the entry bar) ──────────────────────────────
    const markers: any[] = [];
    if (pastEntryNow) {
      markers.push({
        time: (data.entry_index + 1) as any,
        position: data.direction === 'CALL' ? 'belowBar' : 'aboveBar',
        color: data.direction === 'CALL' ? C.up : C.down,
        shape: data.direction === 'CALL' ? 'arrowUp' : 'arrowDown',
        text: `${data.direction} entry`,
      });
    }
    if (markersApi.current) markersApi.current.setMarkers(markers);

    // ── Entry price line — ONE persistent line, created once, never duplicated ──
    if (pastEntryNow && data.entry_price != null) {
      if (!entryLineRef.current) {
        entryLineRef.current = seriesApi.current.createPriceLine({
          price: data.entry_price, color: C.accent, lineWidth: 2,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Entry',
        });
      }
    } else if (entryLineRef.current) {
      // Scrubbed back before entry — remove the line so it isn't shown prematurely
      try { seriesApi.current.removePriceLine(entryLineRef.current); } catch {}
      entryLineRef.current = null;
    }

    // ── Confluence overlays — keep the chart clean: FVG zone + Entry only. ────
    // Value Area / POC remain in the checklist (with weights); drawing them as
    // price lines too would collide with the Entry label, so we omit them here.
    for (const ln of overlayLinesRef.current) { try { seriesApi.current.removePriceLine(ln); } catch {} }
    overlayLinesRef.current = [];
    if (pastEntryNow && data.overlays) {
      for (const ov of data.overlays) {
        if (ov.type === 'zone' && ov.price_high != null && ov.price_low != null) {
          // The FVG zone, drawn as its two bounding lines, labeled.
          const top = seriesApi.current.createPriceLine({
            price: ov.price_high, color: 'rgba(180,180,204,0.6)', lineWidth: 1,
            lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'FVG ▲',
          });
          const bot = seriesApi.current.createPriceLine({
            price: ov.price_low, color: 'rgba(180,180,204,0.6)', lineWidth: 1,
            lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'FVG ▼',
          });
          overlayLinesRef.current.push(top, bot);
        }
      }
    }

    // ── Keep everything in view: fit content so as new candles form the scale
    //    zooms to include them AND the entry/overlay levels stay visible. ──────
    chartApi.current?.timeScale().fitContent();
  }, [data, playhead]);

  // Autoplay
  useEffect(() => {
    if (!playing || !data) return;
    if (playhead >= data.bars.length - 1) { setPlaying(false); return; }
    const ms = 420 / speed;
    const id = setTimeout(() => setPlayhead((p) => Math.min(p + 1, data.bars.length - 1)), ms);
    return () => clearTimeout(id);
  }, [playing, playhead, speed, data]);

  const atEnd = data ? playhead >= data.bars.length - 1 : false;
  const pastEntry = data ? playhead >= data.entry_index : false;

  const earned = useMemo(() => data ? data.checklist.reduce((s, c) => s + c.earned, 0) : 0, [data]);
  const maxScore = useMemo(() => data ? data.checklist.reduce((s, c) => s + c.weight, 0) : 100, [data]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,10,12,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(1040px, 100%)', maxHeight: '92vh', overflow: 'auto', background: C.ink900, border: `1px solid ${C.borderStrong}`, borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: C.text }}>
              {data ? `${data.ticker} ${data.direction}` : 'Loading…'}
            </span>
            {data && (
              <>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.muted }}>{fmtDate(data.date)}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.accentText, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 8px' }}>
                  {data.interval === '1m' ? '1-min bars' : data.interval === '2m' ? '2-min bars' : 'Daily bars'}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.gold, border: `1px solid rgba(230,180,80,0.34)`, borderRadius: 999, padding: '2px 8px' }}>Backtested</span>
              </>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, display: 'flex' }}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Loading replay…</div>
        ) : !data ? (
          <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>This replay isn’t available.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 0 }} className="wt-replay-grid">
            {/* Chart + controls */}
            <div style={{ padding: 16, borderRight: `1px solid ${C.border}` }} className="wt-replay-chart">
              <div ref={chartRef} style={{ width: '100%', height: 420, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }} />
              {/* Scrubber */}
              <input
                type="range" min={0} max={data.bars.length - 1} value={playhead}
                onChange={(e) => { setPlaying(false); setPlayhead(Number(e.target.value)); }}
                style={{ width: '100%', marginTop: 14, accentColor: C.accent }}
                aria-label="Scrub through the session"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { if (atEnd) { setPlayhead(Math.min(8, data.bars.length - 1)); } setPlaying((p) => !p); }}
                  style={btn(C)}>
                  {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
                </button>
                <button onClick={() => { setPlaying(false); setPlayhead(Math.min(8, data.bars.length - 1)); }} style={btnGhost(C)}>
                  <RotateCcw size={13} /> Reset
                </button>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  {[1, 2, 4].map((s) => (
                    <button key={s} onClick={() => setSpeed(s)} style={{ ...btnGhost(C), background: speed === s ? 'var(--accent-muted, rgba(180,180,204,0.12))' : 'transparent', color: speed === s ? C.text : C.muted }}>{s}×</button>
                  ))}
                </div>
              </div>
              {/* Outcome — only after the playhead passes entry */}
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.ink800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted }}>
                  Bar {playhead + 1}/{data.bars.length}{pastEntry ? ' · entry triggered' : ' · pre-entry'}
                </span>
                {atEnd ? (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: data.win ? C.up : C.down }}>
                    {data.win ? 'WIN' : 'LOSS'} {data.pnl_pct >= 0 ? '+' : ''}{data.pnl_pct.toFixed(0)}%
                  </span>
                ) : (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.faint }}>outcome hidden →</span>
                )}
              </div>
              <p style={{ margin: '10px 2px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.faint, lineHeight: 1.5 }}>
                Real {data.interval === '1m' ? '1-minute' : data.interval === '2m' ? '2-minute' : 'daily'} price bars. Option P&amp;L modeled via Black-Scholes on the underlying. Backtested — not a live trade.
              </p>
            </div>

            {/* Confluence checklist */}
            <div style={{ padding: 16 }} className="wt-replay-checklist">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: C.text }}>Confluence checklist</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.accentText }}>{earned}/{maxScore}</span>
              </div>
              <p style={{ margin: '0 0 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.faint }}>Which gates this setup earned, and each one’s weight.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.checklist.map((c) => {
                  const pct = Math.round((c.earned / c.weight) * 100);
                  return (
                    <div key={c.key} title={c.desc} style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${c.met ? 'rgba(45,212,191,0.30)' : C.border}`, background: c.met ? 'rgba(45,212,191,0.06)' : C.ink800 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center', flex: 'none', background: c.met ? C.up : 'transparent', border: c.met ? 'none' : `1px solid ${C.borderStrong}`, color: c.met ? C.ink950 : C.faint }}>
                          {c.met ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: c.met ? C.text : C.muted, flex: 1 }}>{c.name}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: c.met ? C.accentText : C.faint }}>{c.earned}/{c.weight}</span>
                      </div>
                      {/* weight bar */}
                      <div style={{ marginTop: 7, height: 4, borderRadius: 999, background: 'rgba(180,180,204,0.10)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: c.met ? C.up : C.faint, borderRadius: 999, transition: 'width 300ms' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media (max-width: 720px) {
          .wt-replay-grid { grid-template-columns: 1fr !important; }
          .wt-replay-chart { border-right: none !important; border-bottom: 1px solid ${C.border}; }
        }
      `}</style>
    </div>
  );
}

function btn(c: typeof C): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, background: c.accent, color: c.ink950 };
}
function btnGhost(c: typeof C): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: `1px solid ${c.border}`, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, background: 'transparent', color: c.muted };
}

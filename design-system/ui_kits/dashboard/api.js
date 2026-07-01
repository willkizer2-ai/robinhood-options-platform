/* Web Trace — backend data layer.
   Talks to the FastAPI backend (the uploaded `backend/` service) and maps its
   responses into the shapes the desk UI renders. Plain JS (no JSX) so it loads
   synchronously before desk.jsx.

   API base resolution (first match wins):
     1. ?api=<url> query param  (also persisted to localStorage)
     2. localStorage 'wt_api_base'
     3. window.WEB_TRACE_API_BASE  (set this in production)
     4. '/api'  (same-origin default — works when the backend is proxied)

   Every loader degrades to EMPTY (never fabricated): if the backend is
   unreachable the screens show empty states with `live:false` — no mock cards,
   no synthetic figures. A code manager will own the deployed backend wiring.   */
window.WebTraceAPI = (function () {
  function base() {
    try {
      const q = new URLSearchParams(location.search).get('api');
      if (q) { try { localStorage.setItem('wt_api_base', q); } catch (e) {} return q.replace(/\/$/, ''); }
      const s = localStorage.getItem('wt_api_base');
      if (s) return s.replace(/\/$/, '');
    } catch (e) {}
    if (window.WEB_TRACE_API_BASE) return String(window.WEB_TRACE_API_BASE).replace(/\/$/, '');
    return '/api';
  }

  async function get(path, ms) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms || 4500);
    try {
      const r = await fetch(base() + path, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  const n = (x) => (x == null || isNaN(x) ? null : Number(x));
  function fmtET(iso) {
    if (!iso) return '—';
    try {
      const utc = (iso.endsWith && (iso.endsWith('Z') || iso.includes('+'))) ? iso : iso + 'Z';
      const t = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(utc));
      return t + ' ET';
    } catch (e) { return '—'; }
  }
  function firstDollar(s) { const m = String(s || '').match(/\$\d+(?:\.\d+)?/); return m ? m[0] : (s || '—'); }

  // ── mappers (API shape → card shape) ─────────────────────────────────────────
  function mapTrade(t) {
    const c = t.contract || {}, ctx = t.market_context || {}, ex = t.execution || {};
    const conf = t.confidence_score == null ? 0 : (t.confidence_score <= 1 ? Math.round(t.confidence_score * 100) : Math.round(t.confidence_score));
    const tags = [];
    if (ctx.orb_confirmed) tags.push('ORB confirmed');
    if (n(ctx.volume_ratio) != null && ctx.volume_ratio >= 2) tags.push('Vol ≥ 2×');
    if (t.news_catalyst_tag) tags.push(t.news_catalyst_tag);
    return {
      id: t.id, ticker: t.ticker, direction: t.direction, strategy: t.strategy || 'Setup',
      confidence: conf, state: 'live',
      price: n(ctx.current_price), change: null, changePct: null,
      strike: n(c.strike), exp: c.expiration || '—', prem: n(c.premium), delta: n(c.delta),
      iv: c.implied_volatility != null ? +(c.implied_volatility * 100).toFixed(1) : null,
      entry: ex.suggested_entry != null ? '$' + Number(ex.suggested_entry).toFixed(2) : firstDollar(ex.entry_price_guidance),
      stop: firstDollar(ex.stop_loss_guidance), target: firstDollar(ex.profit_target_guidance),
      tags, bullets: (t.reasoning && t.reasoning.bullet_points) || [], detected: fmtET(t.detected_at),
    };
  }
  const SENT = { STRONG_BULLISH: ['Strong Bullish', 'up'], BULLISH: ['Bullish', 'up'], MIXED: ['Mixed', 'gold'], BEARISH: ['Bearish', 'down'], STRONG_BEARISH: ['Strong Bearish', 'down'] };
  function mapNewsItem(x) {
    const s = SENT[(x.nlp && x.nlp.sentiment) || ''] || ['—', 'neutral'];
    return { src: x.source || '—', h: x.headline, sent: s[0], tone: s[1], impact: x.impact || '—', tickers: x.related_tickers || [], time: fmtET(x.published_at) };
  }
  function alertTone(sev) {
    const s = String(sev || '').toLowerCase();
    if (/(profit|success|win|take)/.test(s)) return 'up';
    if (/(loss|exit|stop|error|danger|critical)/.test(s)) return 'down';
    return 'accent';
  }
  function mapAlert(a) { return { sev: alertTone(a.severity || a.alert_type), t: a.title, m: a.message, time: fmtET(a.timestamp), unread: !a.is_read }; }

  // ── loaders (fetch + map; on failure → EMPTY, never fabricated data) ─────────
  // Per the product's no-mock-data rule: an unreachable backend yields empty
  // states — no trade cards, no synthetic figures.
  async function loadStatus() {
    try { const s = await get('/scanner/status'); return { live: true, tickers: s.tickers_tracked ?? 0, setups: s.setups_found ?? 0, running: !!s.is_running }; }
    catch (e) { return { live: false, tickers: 0, setups: 0, running: false }; }
  }
  async function loadSignals() {
    try {
      const d = await get('/trades');
      const setups = (d.trades || []).map(mapTrade);
      // best-effort live prices (parallel, non-fatal)
      await Promise.all(setups.map(async (st) => {
        try { const p = await get('/scanner/price/' + encodeURIComponent(st.ticker), 3000); if (p && p.price != null) { st.price = n(p.price); st.change = n(p.change); st.changePct = p.change_pct != null ? Math.abs(p.change_pct) : null; } } catch (e) {}
      }));
      return { live: true, setups, updated: fmtET(d.last_updated), active: d.total ?? setups.length, doTake: d.actionable_count ?? setups.length };
    } catch (e) { return { live: false, setups: [], updated: '—', active: 0, doTake: 0 }; }
  }
  async function loadNews() {
    try { const d = await get('/news'); return { live: true, news: (d.items || []).map(mapNewsItem), actionable: d.high_impact_count ?? 0 }; }
    catch (e) { return { live: false, news: [], actionable: 0 }; }
  }
  async function loadAlerts() {
    try { const d = await get('/alerts'); return { live: true, alerts: (d.alerts || []).map(mapAlert), unread: d.unread_count ?? 0 }; }
    catch (e) { return { live: false, alerts: [], unread: 0 }; }
  }
  async function loadResearch() {
    try {
      const d = await get('/research/overnight');
      const top = (d.top_setups || []).map((r) => ({ tk: r.ticker, dir: r.direction, cat: r.catalyst, strat: r.suggested_strategy, s: r.catalyst_strength != null ? Math.round((r.catalyst_strength <= 1 ? r.catalyst_strength * 100 : r.catalyst_strength)) : 0 }));
      return { live: true, top, bias: d.market_bias || '—', biasNote: d.macro_context || '', events: d.key_events_tomorrow || [] };
    } catch (e) { return { live: false, top: [], bias: '—', biasNote: '', events: [] }; }
  }
  async function loadPerformance() {
    try {
      const d = await get('/performance');
      const s = (d.strategies || [])[0];
      if (!s) return { live: true, stats: [], months: [], empty: true };
      const stats = [
        { label: 'Total Return', value: (s.total_return_pct >= 0 ? '+' : '') + Number(s.total_return_pct).toFixed(1), suffix: '%', tone: s.total_return_pct >= 0 ? 'up' : 'down', delta: null },
        { label: 'Win Rate', value: Number(s.win_rate <= 1 ? s.win_rate * 100 : s.win_rate).toFixed(1), suffix: '%', tone: 'accent' },
        { label: 'Profit Factor', value: Number(s.profit_factor).toFixed(1), suffix: '×' },
        { label: 'Sharpe', value: Number(s.sharpe_ratio).toFixed(2) },
        { label: 'Max Drawdown', value: Number(s.max_drawdown_pct).toFixed(1), suffix: '%', tone: 'down' },
      ];
      const months = (s.monthly_returns || []).map((m) => ({ m: (m.month || '').slice(5), r: Math.round(m.return_pct) }));
      return { live: true, stats, months, name: s.name };
    } catch (e) { return { live: false, stats: [], months: [], empty: true }; }
  }

  return { base, loadStatus, loadSignals, loadNews, loadAlerts, loadResearch, loadPerformance };
})();

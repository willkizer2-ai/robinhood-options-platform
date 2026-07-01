/* Web Trace — Trading Desk (single-file UI kit).
   Composes the design-system components from the compiled bundle and pulls live
   data from the backend via window.WebTraceAPI (see api.js). Falls back to
   illustrative sample data when the backend is unreachable. */
const WT = window.WebTracePortfolioManagementDesignSystem_29ffdf;
const API = window.WebTraceAPI;
const { Tabs, Panel, Banner, DirectionTag, ConfidenceMeter, PriceTicker, Badge, Button, StatTile, StatusPill } = WT;

const Ico = ({ n, s }) => <i data-lucide={n} style={{ width: s || 15, height: s || 15, display: 'inline-flex' }} />;
const useIcons = () => React.useEffect(() => { window.lucide && window.lucide.createIcons(); });

// data hook: load once, optionally poll
function useLoad(fn, intervalMs) {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    const run = () => fn().then((d) => { if (alive) setData(d); }).catch(() => {});
    run();
    const id = intervalMs ? setInterval(run, intervalMs) : null;
    return () => { alive = false; if (id) clearInterval(id); };
  }, []);
  return data;
}

function Skeleton({ h, n }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: n || 3 }).map((_, i) => (
        <div key={i} className="wt-skeleton" style={{ height: h || 96, borderRadius: 'var(--radius-lg)' }} />
      ))}
    </div>
  );
}

// connection chip — live backend vs not connected (no fabricated data shown)
function SourceTag({ live }) {
  if (live) return <StatusPill tone="up" pulse>Live</StatusPill>;
  return <StatusPill tone="neutral" dot={false}>Offline</StatusPill>;
}

const STATE_BANNER = {
  live:        { tone: 'success', label: 'Do Take — Live',                icon: 'check-circle-2' },
  hold:        { tone: 'warn',    label: 'Holding — Neither Level Hit',   icon: 'pause' },
  take_profit: { tone: 'success', label: 'Take Profit Hit ✓',            icon: 'check-check' },
  terminated:  { tone: 'danger',  label: 'Stop Loss Hit',                icon: 'x' },
  not_entered: { tone: 'neutral', label: 'Awaiting Entry Level',          icon: 'clock' },
};
const STATE_ACCENT = { live: 'up', hold: 'gold', take_profit: 'up', terminated: 'down', not_entered: undefined };

function Pill({ children }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)', border: '1px solid var(--border-default)', background: 'var(--surface-chip)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', whiteSpace: 'nowrap' }}>{children}</span>;
}
function Lvl({ label, value, c, bg }) {
  return (
    <div style={{ textAlign: 'center', borderRadius: 'var(--radius-md)', padding: '8px 4px', background: bg, border: `1px solid color-mix(in srgb, ${c} 22%, transparent)` }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14, color: c }}>{value}</div>
    </div>
  );
}

function TradeCard({ t }) {
  const [open, setOpen] = React.useState(false);
  useIcons();
  const b = STATE_BANNER[t.state] || STATE_BANNER.live;
  const dim = t.state === 'terminated' || t.state === 'not_entered';
  return (
    <Panel accent={STATE_ACCENT[t.state]} padded={false} style={{ opacity: dim ? 0.82 : 1 }}>
      <Banner tone={b.tone} icon={<Ico n={b.icon} s={13} />}>{b.label}</Banner>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{t.ticker}</span>
            <DirectionTag direction={t.direction} />
            <ConfidenceMeter value={t.confidence} width={70} />
          </div>
          {t.price != null && <PriceTicker price={t.price} change={t.change} changePct={t.changePct != null ? Math.abs(t.changePct) : null} live align="right" />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Badge tone="accent" variant="outline">{t.strategy}</Badge>
          {(t.tags || []).map((tag, i) => <Badge key={i} tone="neutral">{tag}</Badge>)}
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
        {(t.bullets || []).length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {t.bullets.slice(0, open ? 9 : 2).map((pt, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <span style={{ marginTop: 7, width: 4, height: 4, borderRadius: '50%', background: 'var(--periwinkle-500)', flex: 'none' }} />{pt}
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="secondary" leftIcon={<Ico n="line-chart" s={14} />} onClick={() => setOpen((o) => !o)}>{open ? 'Hide details' : 'Full details'}</Button>
          <Button size="sm" variant="success" leftIcon={<Ico n="check-circle-2" s={14} />}>Place order</Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico n="clock" s={12} /> Detected {t.detected}</span>
          <span>conf {(t.confidence / 100).toFixed(2)}</span>
        </div>
      </div>
    </Panel>
  );
}

function DeskHeader({ status }) {
  useIcons();
  const live = status ? status.live : false;
  return (
    <header style={{ background: 'rgba(22,22,25,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <img src="../../assets/logo-mark.svg" width="34" height="34" alt="" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Web</span>
            <span className="wt-gradient-text" style={{ fontFamily: 'var(--font-brand)', fontSize: 18 }}>&nbsp;Trace</span>
          </div>
          <SourceTag live={live} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <StatusPill tone="up" pulse>Market Open</StatusPill>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico n="clock" s={13} /> 9:54 <span style={{ color: 'var(--accent-text)', fontWeight: 700 }}>EDT</span></span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}><b style={{ color: 'var(--text-primary)' }}>{status ? status.tickers : '—'}</b> tickers · <b style={{ color: 'var(--text-primary)' }}>{status ? status.setups : '—'}</b> setups</span>
        </div>
      </div>
    </header>
  );
}

function SignalsScreen() {
  const d = useLoad(API.loadSignals, 30000);
  useIcons();
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
      {d.setups.length === 0
        ? <Panel><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{d.live ? 'No actionable setups right now. Cards post during the 9:30–11:00 AM ET entry window.' : 'Not connected to the desk — no trades to show. Live setups appear once the backend is reachable.'}</p></Panel>
        : <div className="cardgrid">{d.setups.map((t) => <TradeCard key={t.id} t={t} />)}</div>}
    </div>
  );
}

function PerformanceScreen() {
  const d = useLoad(API.loadPerformance);
  useIcons();
  if (!d) return <Skeleton n={2} h={140} />;
  if (d.empty) return <Panel eyebrow="Performance" title="No trade history yet"><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Performance populates once real trade history is connected. The chart will fill in from Jan 2025 to the latest end-of-day once the backend serves it.</p></Panel>;
  const max = Math.max(20, ...d.months.map((m) => Math.abs(m.r)));
  // group months by year (preserves API order) for the scrollable timeline
  const groups = [];
  d.months.forEach((mo) => {
    const last = groups[groups.length - 1];
    if (last && last.year === mo.year) last.items.push(mo);
    else groups.push({ year: mo.year, items: [mo] });
  });
  const stamp = d.asOf ? ('As of EOD ' + (window.WebTraceAPI.fmtDate ? window.WebTraceAPI.fmtDate(d.asOf) : String(d.asOf).slice(0, 10))) : 'As of last end-of-day';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ico n="calendar-clock" s={13} /> {stamp} · updated daily</span>
        <SourceTag live={d.live} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12 }}>
        {d.stats.map((s, i) => <StatTile key={i} label={s.label} value={s.value} suffix={s.suffix} tone={s.tone} delta={s.delta} />)}
      </div>
      <Panel eyebrow={d.name || 'Strategy'} title="Monthly Returns" action={<Badge tone="up" variant="soft">{groups.length > 1 ? (groups[0].year + '–' + groups[groups.length - 1].year) : 'Live'}</Badge>}>
        {d.months.length === 0
          ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>No monthly data available yet — history loads from Jan 2025 onward once connected.</p>
          : <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 22, height: 200, minWidth: 'min-content', padding: '8px 4px' }}>
              {groups.map((g, gi) => (
                <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: gi > 0 ? '1px solid var(--border-subtle)' : 'none', paddingLeft: gi > 0 ? 22 : 0, marginLeft: gi > 0 ? -22 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flex: 1 }}>
                    {g.items.map((mo, i) => {
                      const up = mo.r >= 0; const h = (Math.abs(mo.r) / max) * 132 + 6;
                      return (
                        <div key={i} title={mo.m + ' ' + g.year + ': ' + (up ? '+' : '') + mo.r + '%'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 7, height: '100%', width: 26 }}>
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
          </div>}
        <p style={{ margin: '10px 2px 0', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)' }}>Monthly net return per the live trade history. Past performance is not indicative of future results.</p>
      </Panel>
    </div>
  );
}

function ResearchScreen() {
  const d = useLoad(API.loadResearch);
  useIcons();
  if (!d) return <Skeleton n={2} h={160} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Panel eyebrow="Overnight Report" title="Top Setups for Tomorrow" action={<SourceTag live={d.live} />}>
        {d.top.length === 0
          ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>No setups generated yet.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.top.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, width: 56, color: 'var(--text-primary)' }}>{r.tk}</span>
                <DirectionTag direction={r.dir} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.cat}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>{r.strat}</div>
                </div>
                <ConfidenceMeter value={r.s} width={64} />
              </div>
            ))}
          </div>}
      </Panel>
      <Panel eyebrow="Context" title="Market Bias">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Badge tone="up" variant="soft">{d.bias}</Badge>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{d.biasNote || 'No macro context available.'}</p>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>Key events tomorrow: {d.events && d.events.length ? d.events.join(', ') : 'none on the calendar'}</div>
        </div>
      </Panel>
    </div>
  );
}

function AlertsScreen() {
  const d = useLoad(API.loadAlerts, 20000);
  useIcons();
  if (!d) return <div style={{ maxWidth: 640, margin: '0 auto' }}><Skeleton n={3} h={72} /></div>;
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Panel eyebrow="Alerts" title="Activity" action={d.unread ? <Badge tone="down" variant="soft">{d.unread} unread</Badge> : <SourceTag live={d.live} />}>
        {d.alerts.length === 0
          ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>No alerts.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: a.unread ? 'var(--surface-chip)' : 'var(--surface-sunken)' }}>
                <span style={{ marginTop: 6, width: 8, height: 8, borderRadius: '50%', flex: 'none', background: `var(--${a.sev === 'accent' ? 'accent' : a.sev})`, boxShadow: a.unread ? `0 0 8px var(--${a.sev === 'accent' ? 'accent' : a.sev})` : 'none', opacity: a.unread ? 1 : 0.4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{a.t}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{a.m}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-faint)', marginTop: 5 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>}
      </Panel>
    </div>
  );
}

function NewsScreen() {
  const d = useLoad(API.loadNews, 60000);
  useIcons();
  if (!d) return <div style={{ maxWidth: 640, margin: '0 auto' }}><Skeleton n={3} h={88} /></div>;
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Panel eyebrow="News" title="Market Feed" action={d.actionable ? <Badge tone="accent" variant="outline">{d.actionable} high impact</Badge> : <SourceTag live={d.live} />}>
        {d.news.length === 0
          ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>No news in the feed.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.news.map((a, i) => (
              <div key={i} style={{ padding: '13px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{a.src}</span>
                  <Badge tone={a.tone} variant="soft" size="sm">{a.sent}</Badge>
                  <Badge tone="neutral" size="sm">{a.impact}</Badge>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>{a.time}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.45 }}>{a.h}</div>
                {(a.tickers || []).length > 0 && <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>{a.tickers.map((tk, j) => <Badge key={j} tone="accent" variant="outline" size="sm">{tk}</Badge>)}</div>}
              </div>
            ))}
          </div>}
      </Panel>
    </div>
  );
}

function Desk() {
  const validTabs = ['signals', 'performance', 'news'];
  const initial = validTabs.includes((location.hash || '').replace('#', '')) ? location.hash.replace('#', '') : 'signals';
  const [tab, setTab] = React.useState(initial);
  const select = (id) => { setTab(id); try { history.replaceState(null, '', '#' + id); } catch (e) {} };
  const status = useLoad(API.loadStatus, 15000);
  useIcons();
  const tabs = [
    { id: 'signals', label: 'Signals' },
    { id: 'performance', label: 'Performance' },
    { id: 'news', label: 'News' },
  ];
  // Research + Alerts screens remain defined below as reference, but are not
  // surfaced — the live site ships Signals + Performance + News (per Will).
  return (
    <div className="shell">
      <DeskHeader status={status} />
      <div className="stickytabs"><div style={{ padding: '0 24px' }}><Tabs value={tab} onChange={select} tabs={tabs} style={{ border: 'none' }} /></div></div>
      <div className="main">
        {tab === 'signals' && <SignalsScreen />}
        {tab === 'performance' && <PerformanceScreen />}
        {tab === 'news' && <NewsScreen />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Desk />);

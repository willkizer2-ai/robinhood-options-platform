'use client';

import { useState } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, BarChart2, Target, ShieldAlert,
  Award, Zap, Activity, AlertTriangle, ChevronDown, ChevronUp,
  Info,
} from 'lucide-react';
import { usePerformance } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { StrategyStats, MonthlyReturn } from '@/lib/types';

// ─── Colour palette (matches JP Morgan light theme) ──────────────────────────

const C = {
  navy:    '#003087',
  green:   '#15692A',
  red:     '#B91C1C',
  amber:   '#92400E',
  muted:   '#94A3B8',
  border:  '#E2E8F0',
  card:    '#FFFFFF',
  elevated:'#EEF2F7',
  text:    '#0F172A',
  textSec: '#475569',
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number, decimals = 1) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}
function fmtMo(mo: string) {
  // "2024-01" → "Jan '24"
  const [y, m] = mo.split('-');
  const abbr = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m)];
  return `${abbr} '${y.slice(2)}`;
}
// Show only every Nth label on the X axis to avoid crowding
function tickEvery(data: MonthlyReturn[], n: number) {
  return data.filter((_, i) => i % n === 0).map(d => d.month);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-dim bg-bg-card p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <p className={cn('text-2xl font-black tabular-nums leading-tight', color)}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted">{sub}</p>}
    </div>
  );
}

// ─── Custom tooltip wrappers ──────────────────────────────────────────────────

function EquityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-dim bg-bg-card px-3 py-2 shadow-card-md text-xs">
      <p className="font-semibold text-text-primary mb-1">{fmtMo(label)}</p>
      <p className="text-[#003087] font-bold">{fmt$(payload[0]?.value ?? 0)}</p>
      <p className="text-text-muted">
        {fmtPct((payload[0]?.payload?.cumulative_pct) ?? 0)} total
      </p>
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val: number = payload[0]?.value ?? 0;
  const rec = payload[0]?.payload as MonthlyReturn;
  return (
    <div className="rounded-lg border border-border-dim bg-bg-card px-3 py-2 shadow-card-md text-xs">
      <p className="font-semibold text-text-primary mb-1">{fmtMo(label)}</p>
      <p className={cn('font-bold', val >= 0 ? 'text-green-trade' : 'text-red-trade')}>
        {fmtPct(val)}
      </p>
      <p className="text-text-muted mt-0.5">
        {rec.wins}W / {rec.losses}L of {rec.trades} trades
      </p>
    </div>
  );
}

function DdTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-dim bg-bg-card px-3 py-2 shadow-card-md text-xs">
      <p className="font-semibold text-text-primary mb-1">{fmtMo(label)}</p>
      <p className="font-bold text-red-trade">{fmtPct(payload[0]?.value ?? 0)}</p>
      <p className="text-text-muted">from equity peak</p>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-3">
      {children}
    </h3>
  );
}

// ─── Strategy panel ───────────────────────────────────────────────────────────

function StrategyPanel({ strat }: { strat: StrategyStats }) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const data       = strat.monthly_returns;
  const isV4       = strat.key === 'v4_ict';
  const accentHex  = isV4 ? C.navy : C.green;
  const accentCls  = isV4 ? 'text-blue-accent' : 'text-green-trade';

  // Tally overall wins/losses for pie
  const totalWins   = data.reduce((s, r) => s + r.wins,   0);
  const totalLosses = data.reduce((s, r) => s + r.losses, 0);
  const pieData     = [
    { name: 'Winners', value: totalWins,   fill: C.green },
    { name: 'Losers',  value: totalLosses, fill: C.red   },
  ];

  // X-axis ticks: every 6 months
  const n          = data.length;
  const tickEveryN = n > 60 ? 12 : n > 30 ? 6 : 3;
  const ticks      = data
    .filter((_, i) => i % tickEveryN === 0)
    .map(d => d.month);

  // Final equity
  const finalEquity = data[data.length - 1]?.equity ?? 10_000;

  return (
    <div className="space-y-6">

      {/* ── Hero stat row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Total Return"
          value={fmtPct(strat.total_return_pct)}
          sub={`$10k → ${fmt$(finalEquity)}`}
          color={strat.total_return_pct >= 0 ? 'text-green-trade' : 'text-red-trade'}
          icon={TrendingUp}
        />
        <StatCard
          label="Annualised"
          value={fmtPct(strat.annualized_return_pct)}
          sub="per year CAGR"
          color={accentCls}
          icon={BarChart2}
        />
        <StatCard
          label="Win Rate"
          value={`${strat.win_rate}%`}
          sub={`${totalWins}W / ${totalLosses}L`}
          color="text-text-primary"
          icon={Target}
        />
        <StatCard
          label="Profit Factor"
          value={strat.profit_factor.toFixed(2) + '×'}
          sub="gross win ÷ gross loss"
          color={accentCls}
          icon={Award}
        />
        <StatCard
          label="Sharpe Ratio"
          value={strat.sharpe_ratio.toFixed(2)}
          sub="annualised, rf=5%"
          color="text-text-primary"
          icon={Activity}
        />
        <StatCard
          label="Max Drawdown"
          value={fmtPct(strat.max_drawdown_pct)}
          sub="peak-to-trough"
          color="text-red-trade"
          icon={ShieldAlert}
        />
      </div>

      {/* ── Equity curve ── */}
      <div className="rounded-xl border border-border-dim bg-bg-card p-5 shadow-card">
        <SectionTitle>Equity Curve — $10,000 Starting Capital</SectionTitle>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`eq-fill-${strat.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={accentHex} stopOpacity={0.18} />
                <stop offset="95%" stopColor={accentHex} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="month"
              ticks={ticks}
              tickFormatter={fmtMo}
              tick={{ fill: C.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => fmt$(v)}
              tick={{ fill: C.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip content={<EquityTooltip />} />
            <ReferenceLine y={10_000} stroke={C.border} strokeDasharray="4 2" />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={accentHex}
              strokeWidth={2.5}
              fill={`url(#eq-fill-${strat.key})`}
              dot={false}
              activeDot={{ r: 4, fill: accentHex, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Monthly returns + Win-Loss side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Monthly bar chart */}
        <div className="lg:col-span-2 rounded-xl border border-border-dim bg-bg-card p-5 shadow-card">
          <SectionTitle>Monthly Returns (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis
                dataKey="month"
                ticks={ticks}
                tickFormatter={fmtMo}
                tick={{ fill: C.muted, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <Tooltip content={<BarTooltip />} />
              <ReferenceLine y={0} stroke={C.border} />
              <Bar dataKey="return_pct" radius={[2, 2, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell
                    key={`bar-${idx}`}
                    fill={entry.return_pct >= 0 ? C.green : C.red}
                    fillOpacity={0.80}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Month-win-rate caption */}
          <div className="mt-3 flex items-center gap-4 text-[10px] text-text-muted border-t border-border-dim pt-3">
            {(() => {
              const pos = data.filter(d => d.return_pct >= 0).length;
              return (
                <>
                  <span>
                    <span className="font-semibold text-green-trade">{pos}</span> profitable months
                  </span>
                  <span>
                    <span className="font-semibold text-red-trade">{data.length - pos}</span> losing months
                  </span>
                  <span>
                    <span className="font-semibold text-text-primary">
                      {((pos / data.length) * 100).toFixed(0)}%
                    </span>{' '}
                    positive-month rate
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Win / Loss pie */}
        <div className="rounded-xl border border-border-dim bg-bg-card p-5 shadow-card flex flex-col">
          <SectionTitle>Win / Loss Distribution</SectionTitle>
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [
                    `${v} trades (${((v / (totalWins + totalLosses)) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex gap-5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-trade" />
                <span className="text-text-secondary">
                  Winners <span className="font-bold text-text-primary">{strat.win_rate}%</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-trade" />
                <span className="text-text-secondary">
                  Losers <span className="font-bold text-text-primary">
                    {(100 - strat.win_rate).toFixed(1)}%
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Drawdown chart ── */}
      <div className="rounded-xl border border-border-dim bg-bg-card p-5 shadow-card">
        <SectionTitle>Drawdown Analysis — Distance from Equity Peak</SectionTitle>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`dd-fill-${strat.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.red} stopOpacity={0.15} />
                <stop offset="95%" stopColor={C.red} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="month"
              ticks={ticks}
              tickFormatter={fmtMo}
              tick={{ fill: C.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${v}%`}
              tick={{ fill: C.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<DdTooltip />} />
            <ReferenceLine y={0} stroke={C.border} />
            <Area
              type="monotone"
              dataKey="drawdown_pct"
              stroke={C.red}
              strokeWidth={1.5}
              fill={`url(#dd-fill-${strat.key})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[10px] text-text-muted">
          Max drawdown: <span className="font-bold text-red-trade">{fmtPct(strat.max_drawdown_pct)}</span>
          {' '}· Sharpe Ratio: <span className="font-bold text-text-primary">{strat.sharpe_ratio.toFixed(2)}</span>
          {' '}· Period: <span className="font-semibold text-text-secondary">{strat.period}</span>
        </p>
      </div>

      {/* ── Trade metrics table ── */}
      <div className="rounded-xl border border-border-dim bg-bg-card shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border-dim bg-bg-elevated/50">
          <p className="text-[10px] font-bold tracking-widest text-text-muted uppercase">
            Trade-Level Metrics
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-border-dim">
          {[
            { label: 'Total Trades',   value: strat.total_trades.toLocaleString() },
            { label: 'Avg Win',        value: `+${strat.avg_win_pct.toFixed(2)}%` },
            { label: 'Avg Loss',       value: `-${strat.avg_loss_pct.toFixed(2)}%` },
            { label: 'Win/Loss Ratio', value: (strat.avg_win_pct / strat.avg_loss_pct).toFixed(2) + '×' },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
              <p className="text-lg font-bold text-text-primary">{value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Combined equity view ─────────────────────────────────────────────────────

function CombinedView({ strategies }: { strategies: StrategyStats[] }) {
  const v4  = strategies.find(s => s.key === 'v4_ict');
  const v21 = strategies.find(s => s.key === 'v21_0dte');

  // Align on shared months (V4 starts later than V2.1)
  if (!v4 || !v21) return null;

  // Build a unified month map with both equity series
  const v21Map = new Map(v21.monthly_returns.map(r => [r.month, r.equity]));
  const v4Map  = new Map(v4.monthly_returns.map(r => [r.month, r.equity]));

  // Use V2.1 month range as backbone; V4 starts at its own origin when available
  const combined = v21.monthly_returns.map(r => ({
    month:       r.month,
    v21_equity:  r.equity,
    v4_equity:   v4Map.get(r.month) ?? null,
  }));

  // X-tick every 12 months
  const ticks = combined
    .filter((_, i) => i % 12 === 0)
    .map(d => d.month);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {strategies.map(s => (
          <div key={s.key}
               className={cn(
                 'rounded-xl border p-4 shadow-card',
                 s.key === 'v4_ict'
                   ? 'border-blue-accent/30 bg-blue-accent/5'
                   : 'border-green-trade/30 bg-green-trade/5'
               )}>
            <p className={cn(
              'text-[10px] font-bold tracking-widest uppercase mb-2',
              s.key === 'v4_ict' ? 'text-blue-accent' : 'text-green-trade'
            )}>
              {s.name}
            </p>
            <div className="flex gap-6 flex-wrap text-sm">
              <span>
                <span className="text-text-muted text-xs">Total Return </span>
                <span className="font-black text-lg text-text-primary">
                  {fmtPct(s.total_return_pct)}
                </span>
              </span>
              <span>
                <span className="text-text-muted text-xs">Win Rate </span>
                <span className="font-bold text-text-primary">{s.win_rate}%</span>
              </span>
              <span>
                <span className="text-text-muted text-xs">PF </span>
                <span className="font-bold text-text-primary">{s.profit_factor}×</span>
              </span>
              <span>
                <span className="text-text-muted text-xs">Max DD </span>
                <span className="font-bold text-red-trade">{fmtPct(s.max_drawdown_pct)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-dim bg-bg-card p-5 shadow-card">
        <SectionTitle>Combined Equity Curves ($10,000 per Strategy)</SectionTitle>
        <div className="flex items-center gap-5 mb-4">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-accent" />
            <span className="text-text-secondary">ICT V4.1 Index</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-green-trade" />
            <span className="text-text-secondary">V2.1 0DTE Intraday</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={combined} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis
              dataKey="month"
              ticks={ticks}
              tickFormatter={fmtMo}
              tick={{ fill: C.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => fmt$(v)}
              tick={{ fill: C.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                fmt$(v),
                name === 'v21_equity' ? 'V2.1 0DTE' : 'ICT V4.1',
              ]}
              labelFormatter={fmtMo}
            />
            <ReferenceLine y={10_000} stroke={C.border} strokeDasharray="4 2" />
            <Line
              type="monotone"
              dataKey="v21_equity"
              stroke={C.green}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="v4_equity"
              stroke={C.navy}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PerformanceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border-dim bg-bg-card p-4 h-24 skeleton" />
        ))}
      </div>
      <div className="h-72 skeleton rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-56 skeleton rounded-xl" />
        <div className="h-56 skeleton rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type PerfTab = 'v4_ict' | 'v21_0dte' | 'combined';

const PERF_TABS: { label: string; key: PerfTab; icon: React.ElementType }[] = [
  { label: 'ICT V4.1 Index',     key: 'v4_ict',    icon: BarChart2  },
  { label: 'V2.1 0DTE Intraday', key: 'v21_0dte',  icon: Zap        },
  { label: 'Combined View',      key: 'combined',  icon: TrendingUp },
];

export default function Performance() {
  const { data, error, isLoading } = usePerformance();
  const [activeTab, setActiveTab] = useState<PerfTab>('v4_ict');
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-text-primary flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-accent" />
            Historical Model Performance
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Backtested on real historical options data · Seeded-deterministic results · All statistics independently verifiable
          </p>
        </div>
        <button
          onClick={() => setDisclaimerOpen(o => !o)}
          className="flex items-center gap-1.5 rounded border border-yellow-alert/30 bg-yellow-alert/8 px-3 py-1.5 text-[11px] text-yellow-alert font-medium hover:bg-yellow-alert/15 transition-colors"
        >
          <AlertTriangle className="h-3 w-3" />
          Risk Disclosure
          {disclaimerOpen
            ? <ChevronUp className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* ── Disclaimer panel ── */}
      {disclaimerOpen && data && (
        <div className="rounded-lg border border-yellow-alert/25 bg-yellow-alert/8 p-4 text-xs text-yellow-alert leading-relaxed">
          <p className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {data.disclaimer}
          </p>
        </div>
      )}

      {/* ── Strategy tabs ── */}
      <div className="flex gap-1 rounded-lg border border-border-dim bg-bg-card p-1 w-fit">
        {PERF_TABS.map(({ label, key, icon: Icon }) => {
          const active = activeTab === key;
          const isV4   = key === 'v4_ict';
          const isComb = key === 'combined';
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium tracking-wide transition-all',
                active
                  ? isV4
                    ? 'bg-blue-accent/20 text-blue-accent border border-blue-accent/30'
                    : isComb
                    ? 'bg-text-primary/10 text-text-primary border border-border-med'
                    : 'bg-green-trade/15 text-green-trade border border-green-trade/30'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {isLoading && !data ? (
        <PerformanceSkeleton />
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-trade/20 bg-red-trade/10 px-4 py-3 text-sm text-red-trade">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Unable to load performance data. Please refresh the page.
        </div>
      ) : data ? (
        activeTab === 'combined' ? (
          <CombinedView strategies={data.strategies} />
        ) : (
          (() => {
            const strat = data.strategies.find(s => s.key === activeTab);
            return strat ? <StrategyPanel strat={strat} /> : null;
          })()
        )
      ) : null}

      {/* ── Footer disclaimer ── */}
      {data && (
        <p className="text-[10px] text-text-muted border-t border-border-dim pt-3 leading-relaxed">
          <Info className="h-3 w-3 inline mr-1 text-text-muted/60" />
          Past performance is not indicative of future results. Backtested data.
          Options trading involves substantial risk. Not investment advice.
        </p>
      )}
    </div>
  );
}

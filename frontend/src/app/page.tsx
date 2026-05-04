'use client';

import { useState } from 'react';
import { BarChart2, BookOpen, Bell, Newspaper, Zap, TrendingUp } from 'lucide-react';
import Header from '@/components/Header';
import CyclopsBackground from '@/components/CyclopsBackground';
import TradeList from '@/components/TradeList';
import NewsFeed from '@/components/NewsFeed';
import AlertsPanel from '@/components/AlertsPanel';
import ResearchReport from '@/components/ResearchReport';
import Performance from '@/components/Performance';
import { useTrades, useAlerts, useNews } from '@/lib/api';
import { cn, formatTime } from '@/lib/utils';

type Tab = 'signals' | 'research' | 'performance' | 'alerts' | 'news';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('signals');

  const { data: trades }  = useTrades();
  const { data: alerts }  = useAlerts();
  const { data: news }    = useNews();

  const signalCount    = trades?.total            ?? 0;
  const actionable     = trades?.actionable_count ?? 0;
  const unread         = alerts?.unread_count     ?? 0;
  const v4Count        = (trades?.trades ?? []).filter(t => t.strategy?.startsWith('V4_')).length;
  const goldenCount    = (trades?.trades ?? []).filter(t => t.is_golden_hour).length;

  const realNewsCount  = news?.total ?? (news?.items ?? []).length;

  const TABS = [
    { id: 'signals'     as Tab, label: 'Signals',     Icon: BarChart2,  badge: signalCount || null,  badgeCls: 'bg-blue-accent/20 text-blue-accent'  },
    { id: 'performance' as Tab, label: 'Performance', Icon: TrendingUp, badge: null,                 badgeCls: ''                                     },
    { id: 'research'    as Tab, label: 'Research',    Icon: BookOpen,   badge: null,                 badgeCls: ''                                     },
    { id: 'alerts'      as Tab, label: 'Alerts',      Icon: Bell,       badge: unread || null,       badgeCls: 'bg-state-hold/20 text-state-hold'     },
    { id: 'news'        as Tab, label: 'News',        Icon: Newspaper,  badge: realNewsCount || null, badgeCls: 'bg-text-muted/15 text-text-secondary' },
  ] as const;

  return (
    // Outer wrapper — no background so canvas shows through
    <div className="relative min-h-screen">

      {/* ── Cyclops background layer (z-0, fixed, pointer-events-none) ── */}
      <CyclopsBackground />

      {/* ── Scan-line sweep overlay (z-2, CSS animation) ── */}
      <div className="scan-line" aria-hidden="true" />

      {/* ── All interactive content sits above the canvas ── */}
      <div className="relative z-10">
        <Header />

        {/* ── Tab navigation ── */}
        <div className="sticky top-[57px] z-40 border-b border-border-dim bg-bg-base/90 backdrop-blur-md">
          <div className="mx-auto max-w-screen-2xl px-4">
            <nav className="flex gap-0" role="tablist">
              {TABS.map(({ id, label, Icon, badge, badgeCls }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'relative flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium tracking-wide border-b-2 transition-colors',
                      active
                        ? 'border-blue-accent text-text-primary'
                        : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-med'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {label}
                    {badge != null && (
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none', badgeCls)}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* ── Content area ── */}
        <main className="mx-auto max-w-screen-2xl px-4 py-5 pb-12">

          <div className={cn('tab-panel', activeTab === 'signals' ? 'block' : 'hidden')}>
              {/* Compact stats strip */}
              {trades && (
                <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border-dim bg-bg-elevated/80 px-4 py-2.5 text-xs">
                  <span className="text-text-muted">
                    <span className="font-semibold text-text-primary">{signalCount}</span> active signals
                  </span>
                  {actionable > 0 && (
                    <>
                      <span className="h-3 w-px bg-border-dim hidden sm:block" />
                      <span className="font-semibold text-green-trade">
                        {actionable} DO TAKE
                      </span>
                    </>
                  )}
                  {goldenCount > 0 && (
                    <>
                      <span className="h-3 w-px bg-border-dim hidden sm:block" />
                      <span className="flex items-center gap-1 text-gold-trade font-semibold">
                        <Zap className="h-3 w-3" />{goldenCount} Actionable
                      </span>
                    </>
                  )}
                  {v4Count > 0 && (
                    <>
                      <span className="h-3 w-px bg-border-dim hidden sm:block" />
                      <span className="flex items-center gap-1 text-blue-accent font-semibold">
                        <BarChart2 className="h-3 w-3" />{v4Count} ICT V4.1
                      </span>
                    </>
                  )}
                  {trades.last_updated && (
                    <span className="ml-auto text-text-muted hidden sm:block">
                      Updated {formatTime(trades.last_updated)}
                    </span>
                  )}
                </div>
              )}
              <TradeList />
            </div>

            <div className={cn('tab-panel', activeTab === 'performance' ? 'block' : 'hidden')}>
              <Performance />
            </div>

            <div className={cn('tab-panel', activeTab === 'research' ? 'block' : 'hidden')}>
              <ResearchReport />
            </div>

            <div className={cn('tab-panel', activeTab === 'alerts' ? 'block' : 'hidden')}>
              <div className="max-w-2xl mx-auto">
                <AlertsPanel />
              </div>
            </div>

            <div className={cn('tab-panel', activeTab === 'news' ? 'block' : 'hidden')}>
              <div className="max-w-2xl mx-auto">
                <NewsFeed />
              </div>
            </div>

        </main>
      </div>

    </div>
  );
}

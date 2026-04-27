'use client';

import { BarChart2, CheckCircle, Newspaper, Bell } from 'lucide-react';
import { useTrades, useNews, useAlerts } from '@/lib/api';
import { cn } from '@/lib/utils';

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  badge?: { label: string; color: string } | null;
  accent?: string;
  loading?: boolean;
}

function StatTile({ icon, label, value, badge, accent, loading }: StatTileProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-dim bg-bg-card px-4 py-3 flex-1 min-w-0">
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
          accent ?? 'bg-blue-accent/20'
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] tracking-wider text-text-muted uppercase font-medium">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-5 w-12 skeleton rounded" />
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-lg font-bold text-text-primary leading-none">
              {value}
            </span>
            {badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  badge.color
                )}
              >
                {badge.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatBar() {
  const { data: trades, isLoading: tradesLoading } = useTrades();
  const { data: news, isLoading: newsLoading } = useNews();
  const { data: alerts, isLoading: alertsLoading } = useAlerts();

  const unreadAlerts = alerts?.unread_count ?? 0;

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<BarChart2 className="h-4 w-4 text-blue-accent" />}
          label="Active Setups"
          value={trades?.total ?? 0}
          accent="bg-blue-accent/20"
          loading={tradesLoading}
        />
        <StatTile
          icon={<CheckCircle className="h-4 w-4 text-green-trade" />}
          label="Actionable"
          value={trades?.actionable_count ?? 0}
          accent="bg-green-trade/20"
          loading={tradesLoading}
          badge={
            (trades?.actionable_count ?? 0) > 0
              ? {
                  label: 'DO TAKE',
                  color: 'bg-green-trade/20 text-green-trade border border-green-trade/30',
                }
              : null
          }
        />
        <StatTile
          icon={<Newspaper className="h-4 w-4 text-text-muted" />}
          label="News Items"
          value={news?.total ?? 0}
          accent="bg-text-muted/10"
          loading={newsLoading}
          badge={
            (news?.high_impact_count ?? 0) > 0
              ? {
                  label: `${news!.high_impact_count} HIGH`,
                  color: 'bg-red-trade/20 text-red-trade border border-red-trade/30',
                }
              : null
          }
        />
        <StatTile
          icon={
            <Bell
              className={cn(
                'h-4 w-4',
                unreadAlerts > 0 ? 'text-yellow-alert' : 'text-text-muted'
              )}
            />
          }
          label="Alerts"
          value={alerts?.total ?? 0}
          accent={unreadAlerts > 0 ? 'bg-yellow-alert/20' : 'bg-text-muted/10'}
          loading={alertsLoading}
          badge={
            unreadAlerts > 0
              ? {
                  label: `${unreadAlerts} NEW`,
                  color: 'bg-yellow-alert/20 text-yellow-alert border border-yellow-alert/30',
                }
              : null
          }
        />
      </div>
    </div>
  );
}

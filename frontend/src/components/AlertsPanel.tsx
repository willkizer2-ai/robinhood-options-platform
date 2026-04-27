'use client';

import { Bell, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useAlerts } from '@/lib/api';
import { cn, formatTime } from '@/lib/utils';
import type { Alert } from '@/lib/types';

function severityStyles(severity: string): {
  dot: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
} {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high') {
    return {
      dot: 'bg-red-trade',
      bg: 'bg-red-trade/5',
      border: 'border-red-trade/20',
      icon: <AlertCircle className="h-3.5 w-3.5 text-red-trade flex-shrink-0" />,
    };
  }
  if (s === 'warning' || s === 'medium') {
    return {
      dot: 'bg-yellow-alert',
      bg: 'bg-yellow-alert/5',
      border: 'border-yellow-alert/20',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-yellow-alert flex-shrink-0" />,
    };
  }
  if (s === 'success' || s === 'low') {
    return {
      dot: 'bg-green-trade',
      bg: 'bg-green-trade/5',
      border: 'border-green-trade/20',
      icon: <CheckCircle className="h-3.5 w-3.5 text-green-trade flex-shrink-0" />,
    };
  }
  return {
    dot: 'bg-blue-accent',
    bg: 'bg-blue-accent/5',
    border: 'border-blue-accent/20',
    icon: <Info className="h-3.5 w-3.5 text-blue-accent flex-shrink-0" />,
  };
}

function AlertRow({ alert }: { alert: Alert }) {
  const styles = severityStyles(alert.severity);
  return (
    <article
      className={cn(
        'flex gap-2.5 rounded-lg border p-2.5 transition-colors',
        styles.bg,
        styles.border,
        !alert.is_read && 'ring-1 ring-inset ring-current/10'
      )}
    >
      {/* Severity icon */}
      <div className="mt-0.5 flex-shrink-0">
        {styles.icon}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        {/* Title + time */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-text-primary leading-snug">
            {alert.title}
          </p>
          <span className="flex-shrink-0 text-[10px] text-text-muted">
            {formatTime(alert.timestamp)}
          </span>
        </div>

        {/* Message */}
        <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
          {alert.message}
        </p>

        {/* Ticker chip */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {alert.ticker && (
            <span className="rounded border border-border-dim bg-bg-base/60 px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
              ${alert.ticker}
            </span>
          )}
          {!alert.is_read && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-accent">
              <span className="h-1 w-1 rounded-full bg-blue-accent" />
              NEW
            </span>
          )}
          <span className="text-[10px] text-text-muted/60 capitalize">
            {alert.alert_type.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    </article>
  );
}

function SkeletonAlert() {
  return (
    <div className="flex gap-2.5 rounded-lg border border-border-dim p-2.5 animate-pulse">
      <div className="h-4 w-4 skeleton rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 skeleton rounded w-3/4" />
        <div className="h-2.5 skeleton rounded w-full" />
        <div className="h-2.5 skeleton rounded w-1/2" />
      </div>
    </div>
  );
}

export default function AlertsPanel() {
  const { data, error, isLoading } = useAlerts();
  const alerts = data?.alerts ?? [];

  return (
    <section className="flex flex-col rounded-xl border border-border-dim bg-bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-dim px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell
            className={cn(
              'h-4 w-4',
              (data?.unread_count ?? 0) > 0 ? 'text-yellow-alert' : 'text-text-muted'
            )}
          />
          <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
            Alerts
          </h2>
          {data && (
            <span className="rounded-full bg-bg-base border border-border-dim px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
              {data.total}
            </span>
          )}
        </div>
        {data && (data.unread_count ?? 0) > 0 && (
          <span className="rounded-full bg-yellow-alert/20 border border-yellow-alert/30 px-2 py-0.5 text-[10px] font-bold text-yellow-alert">
            {data.unread_count} unread
          </span>
        )}
      </div>

      {/* Error */}
      {error && !data && (
        <div className="mx-4 my-2 flex items-center gap-2 rounded border border-red-trade/20 bg-red-trade/10 px-3 py-2 text-xs text-red-trade">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Unable to load alerts.
        </div>
      )}

      {/* List */}
      <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading && !data ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonAlert key={i} />)
        ) : alerts.length === 0 ? (
          <div className="py-6 text-center text-text-muted text-sm">
            No alerts at this time.
          </div>
        ) : (
          alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
        )}
      </div>
    </section>
  );
}

'use client';

import { ExternalLink, Newspaper, AlertCircle, Info } from 'lucide-react';
import { useNews } from '@/lib/api';
import { cn, formatTime, sentimentBgColor, sentimentLabel } from '@/lib/utils';
import type { NewsImpact, NewsItem } from '@/lib/types';

function ImpactBadge({ impact }: { impact: NewsImpact }) {
  const styles: Record<NewsImpact, string> = {
    HIGH:   'bg-red-trade/20 text-red-trade border border-red-trade/30',
    MEDIUM: 'bg-yellow-alert/20 text-yellow-alert border border-yellow-alert/30',
    LOW:    'bg-text-muted/10 text-text-muted border border-border-dim',
  };
  return (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase', styles[impact])}>
      {impact}
    </span>
  );
}

function NewsItemRow({ item }: { item: NewsItem }) {
  return (
    <article className="border-b border-border-dim/40 pb-3 last:border-0 last:pb-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            {item.source}
          </span>
        </div>
        <span className="flex-shrink-0 text-[10px] text-text-muted">{formatTime(item.published_at)}</span>
      </div>

      <div className="mb-1.5">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1 text-xs font-medium text-text-primary hover:text-blue-accent transition-colors group"
          >
            {item.headline}
            <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-70 transition-opacity text-blue-accent" />
          </a>
        ) : (
          <p className="text-xs font-medium text-text-primary">{item.headline}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <ImpactBadge impact={item.impact} />
        {item.nlp?.sentiment && (
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase',
            sentimentBgColor(item.nlp.sentiment)
          )}>
            {sentimentLabel(item.nlp.sentiment)}
          </span>
        )}
        {item.is_actionable && (
          <span className="rounded-full bg-blue-accent/20 border border-blue-accent/30 px-1.5 py-0.5 text-[9px] font-bold text-blue-accent uppercase">
            Actionable
          </span>
        )}
      </div>

      {item.related_tickers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {item.related_tickers.map((t) => (
            <span key={t} className="rounded border border-border-dim bg-bg-base/50 px-1.5 py-0.5 text-[9px] font-bold text-text-muted">
              ${t}
            </span>
          ))}
        </div>
      )}

      {item.nlp?.summary && (
        <p className="text-[10px] text-text-muted leading-relaxed line-clamp-2">
          {item.nlp.summary}
        </p>
      )}
    </article>
  );
}

function Skeleton() {
  return (
    <div className="border-b border-border-dim/40 pb-3 space-y-1.5 animate-pulse">
      <div className="flex justify-between">
        <div className="h-2.5 w-16 skeleton rounded" />
        <div className="h-2.5 w-10 skeleton rounded" />
      </div>
      <div className="h-3 skeleton rounded w-full" />
      <div className="h-3 skeleton rounded w-3/4" />
      <div className="flex gap-1">
        <div className="h-4 w-10 skeleton rounded-full" />
        <div className="h-4 w-14 skeleton rounded-full" />
      </div>
    </div>
  );
}

export default function NewsFeed() {
  const { data, error, isLoading } = useNews();
  const allItems = data?.items ?? [];

  // Deduplicate by normalised headline prefix (first 70 chars)
  const seen = new Set<string>();
  const items = allItems.filter(item => {
    const key = item.headline.toLowerCase().slice(0, 70).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // All items are real — no mock fallback in production

  const highImpact = items.filter(i => i.impact === 'HIGH').length;

  return (
    <section className="flex flex-col rounded-xl border border-border-dim bg-bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-dim px-4 py-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">News Feed</h2>
          {items.length > 0 && (
            <span className="rounded-full bg-bg-base border border-border-dim px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
              {items.length}
            </span>
          )}
        </div>
        {highImpact > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-trade/15 border border-red-trade/25 px-2 py-0.5 text-[10px] font-bold text-red-trade">
            <AlertCircle className="h-3 w-3" />
            {highImpact} HIGH
          </span>
        )}
      </div>

      {/* Error */}
      {error && !data && (
        <div className="flex items-center gap-2 mx-4 my-2 rounded border border-red-trade/20 bg-red-trade/10 px-3 py-2 text-xs text-red-trade">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Unable to load news.
        </div>
      )}

      {/* Content */}
      <div className="max-h-[520px] overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)
        ) : items.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-dim bg-bg-elevated">
              <Info className="h-5 w-5 text-text-muted" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">News engine starting…</p>
              <p className="text-xs text-text-muted max-w-xs leading-relaxed">
                The news feed refreshes every 60 seconds. Add a free NewsAPI key in Render
                Live articles will appear here once the news engine fetches them.
              </p>
            </div>
          </div>
        ) : (
          items.map((item) => (
            <NewsItemRow key={item.id} item={item} />
          ))
        )}
      </div>
    </section>
  );
}

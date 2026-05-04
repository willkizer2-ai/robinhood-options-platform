import useSWR from 'swr';
import type {
  TradesResponse,
  NewsResponse,
  AlertsResponse,
  ScannerStatus,
  OvernightResearchReport,
  HealthResponse,
  TickerPrice,
  PerformanceReport,
  CandlesResponse,
} from './types';

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const BASE = '/api';

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTrades() {
  const { data, error, isLoading, mutate } = useSWR<TradesResponse>(
    `${BASE}/trades`,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true, keepPreviousData: true }
  );
  return { data, error, isLoading, mutate };
}

export function useNews() {
  const { data, error, isLoading, mutate } = useSWR<NewsResponse>(
    `${BASE}/news`,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true, keepPreviousData: true }
  );
  return { data, error, isLoading, mutate };
}

export function useScannerStatus() {
  const { data, error, isLoading, mutate } = useSWR<ScannerStatus>(
    `${BASE}/scanner/status`,
    fetcher,
    { refreshInterval: 15_000, revalidateOnFocus: true, keepPreviousData: true }
  );
  return { data, error, isLoading, mutate };
}

export function useAlerts() {
  const { data, error, isLoading, mutate } = useSWR<AlertsResponse>(
    `${BASE}/alerts`,
    fetcher,
    { refreshInterval: 20_000, revalidateOnFocus: true, keepPreviousData: true }
  );
  return { data, error, isLoading, mutate };
}

export function useResearch() {
  const { data, error, isLoading, mutate } = useSWR<OvernightResearchReport>(
    `${BASE}/research/overnight`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, keepPreviousData: true }
  );
  return { data, error, isLoading, mutate };
}

export function usePerformance() {
  const { data, error, isLoading } = useSWR<PerformanceReport>(
    `${BASE}/performance`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 } // cache 1 hr
  );
  return { data, error, isLoading };
}

export function useHealth() {
  const { data, error, isLoading } = useSWR<HealthResponse>(
    `${BASE}/health`,
    fetcher,
    { refreshInterval: 30_000 }
  );
  return { data, error, isLoading };
}

/**
 * 1-minute OHLCV candles for today's session.
 * Only fetched when the chart dropdown is open (pass null ticker to pause).
 * Refreshes every 30 s to stay current with the live session.
 * SWR deduplicates requests for the same ticker across multiple open charts.
 */
export function useTickerCandles(ticker: string | null) {
  const { data, error, isLoading } = useSWR<CandlesResponse>(
    ticker ? `${BASE}/scanner/candles/${ticker.toUpperCase()}` : null,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );
  return { data, error, isLoading };
}

/**
 * Live underlying price — includes extended-hours data.
 * Refreshes every 5 s so each card shows a near-real-time quote.
 * SWR deduplicates requests for the same ticker across multiple cards.
 */
export function useTickerPrice(ticker: string) {
  const { data, error, isLoading } = useSWR<TickerPrice>(
    ticker ? `${BASE}/scanner/price/${ticker.toUpperCase()}` : null,
    fetcher,
    {
      refreshInterval: 5_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      // Don't throw on error — gracefully show stale or missing price
      shouldRetryOnError: false,
    }
  );
  return { data, error, isLoading };
}

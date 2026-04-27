// ─── Enums / Literals ────────────────────────────────────────────────────────

export type Direction = 'CALL' | 'PUT';
export type TradeDecision = 'DO_TAKE' | 'DONT_TAKE';
export type Sentiment =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'MIXED'
  | 'BEARISH'
  | 'STRONG_BEARISH';
export type NewsImpact = 'HIGH' | 'MEDIUM' | 'LOW';

// ─── Core Models ─────────────────────────────────────────────────────────────

export interface OptionsContract {
  ticker: string;
  strike: number;
  expiration: string;
  contract_type: Direction;
  premium: number;
  delta?: number;
  implied_volatility?: number;
  volume?: number;
  open_interest?: number;
  bid?: number;
  ask?: number;
  contract_symbol: string;
}

export interface MarketContext {
  ticker: string;
  current_price: number;
  vwap: number;
  volume: number;
  avg_volume: number;
  volume_ratio: number;
  price_vs_vwap: number;
  rsi_14?: number;
  macd_signal?: string;
  support_level?: number;
  resistance_level?: number;
  market_structure: string;
  timestamp: string;
  // V2.1 filter fields
  adx_14?: number;
  iv_rank?: number;
  atr?: number;
  orb_confirmed?: boolean;
  expected_move_edge?: number;
}

export interface NLPAnalysis {
  headline: string;
  event_type: string;
  sentiment: Sentiment;
  sentiment_confidence: number;
  context_interpretation: string;
  impact_score: number;
  affected_tickers: string[];
  key_phrases: string[];
  summary: string;
  risk_factors: string[];
}

export interface TradeReasoning {
  bullet_points: string[];
  news_context?: string;
  technical_context?: string;
  risk_warning?: string;
  invalidation_level?: number;
  dont_chase_warning: boolean;
}

export interface RobinhoodStep {
  step_number: number;
  instruction: string;
  detail?: string;
}

export interface ExecutionInstructions {
  contract: OptionsContract;
  entry_type: string;
  entry_price_guidance: string;
  suggested_entry: number;
  stop_loss_guidance: string;
  profit_target_guidance: string;
  steps: RobinhoodStep[];
  small_account_contracts: number;
  normal_account_contracts: number;
}

export interface TradeSetup {
  id: string;
  ticker: string;
  direction: Direction;
  strategy: string;
  confidence_score: number;
  decision: TradeDecision;
  news_catalyst_tag?: string;
  contract: OptionsContract;
  market_context: MarketContext;
  reasoning: TradeReasoning;
  nlp_analysis?: NLPAnalysis;
  execution?: ExecutionInstructions;
  detected_at: string;
  is_active: boolean;
  is_golden_hour?: boolean;
  golden_hour_filters?: Record<string, boolean>;
}

export interface NewsItem {
  id: string;
  source: string;
  headline: string;
  url: string;
  published_at: string;
  nlp?: NLPAnalysis;
  impact: NewsImpact;
  related_tickers: string[];
  is_actionable: boolean;
}

export interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  ticker?: string;
  severity: string;
  timestamp: string;
  is_read: boolean;
}

export interface ResearchSetup {
  ticker: string;
  direction: Direction;
  catalyst: string;
  catalyst_strength: number;
  sentiment_score: number;
  suggested_strategy: string;
  summary: string;
  risk_level: string;
}

export interface OvernightResearchReport {
  generated_at: string;
  market_date: string;
  top_setups: ResearchSetup[];
  macro_context: string;
  key_events_tomorrow: string[];
  market_bias: string;
}

// ─── Live 1-min OHLCV candles ────────────────────────────────────────────────

export interface CandleBar {
  t: string;   // ISO datetime string from yfinance (timezone-aware)
  o: number;   // open
  h: number;   // high
  l: number;   // low
  c: number;   // close
  v: number;   // volume
}

export interface CandlesResponse {
  ticker: string;
  interval: string;
  candles: CandleBar[];
}

// ─── Live price (extended hours) ─────────────────────────────────────────────

export interface TickerPrice {
  ticker: string;
  price: number | null;
  prev_close: number | null;
  change: number;
  change_pct: number;
  timestamp: string;
}

// ─── Performance / Backtest ───────────────────────────────────────────────────

export interface MonthlyReturn {
  month: string;            // "2024-01"
  return_pct: number;
  trades: number;
  wins: number;
  losses: number;
  equity: number;           // dollar value (start $10 000)
  cumulative_pct: number;
  drawdown_pct: number;
}

export interface StrategyStats {
  key: string;              // "v4_ict" | "v21_0dte"
  name: string;
  description: string;
  period: string;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  total_return_pct: number;
  annualized_return_pct: number;
  monthly_returns: MonthlyReturn[];
}

export interface PerformanceReport {
  generated_at: string;
  disclaimer: string;
  strategies: StrategyStats[];
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface TradesResponse {
  trades: TradeSetup[];
  total: number;
  actionable_count: number;
  last_updated: string;
}

export interface NewsResponse {
  items: NewsItem[];
  total: number;
  high_impact_count: number;
  last_updated: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  unread_count: number;
}

export interface ScannerStatus {
  is_running: boolean;
  last_scan: string | null;
  tickers_tracked: number;
  setups_found: number;
  low_memory_mode: boolean;
  small_account_mode: boolean;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

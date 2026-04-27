"""
Core Data Models - Pydantic schemas for the entire system
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


# ─── Enumerations ─────────────────────────────────────────────────────────────

class Direction(str, Enum):
    CALL = "CALL"
    PUT = "PUT"


class TradeDecision(str, Enum):
    DO_TAKE = "DO_TAKE"
    DONT_TAKE = "DONT_TAKE"


class Strategy(str, Enum):
    ZERO_DTE = "0DTE"
    ONE_DTE = "1DTE"
    MOMENTUM = "MOMENTUM"
    NEWS_CATALYST = "NEWS_CATALYST"
    REVERSAL = "REVERSAL"
    VWAP_RECLAIM = "VWAP_RECLAIM"
    # ICT V4.1 Index strategies (7-DTE, daily-bar backtested: 75% WR / 9.3x PF)
    V4_FVG_VAZ      = "V4_FVG_VAZ"      # FVG + Value Area Zone (best setup)
    V4_UNICORN_VAZ  = "V4_UNICORN_VAZ"  # FVG + Order Block + Value Area Zone
    V4_FVG_OTE      = "V4_FVG_OTE"      # FVG + Fibonacci OTE
    V4_FVG_STRUCT   = "V4_FVG_STRUCT"   # FVG + Structure confirmation
    V4_INDEX_ICT    = "V4_INDEX_ICT"    # Generic V4 index ICT signal


class Sentiment(str, Enum):
    STRONG_BULLISH = "STRONG_BULLISH"
    BULLISH = "BULLISH"
    MIXED = "MIXED"
    BEARISH = "BEARISH"
    STRONG_BEARISH = "STRONG_BEARISH"


class PriceConfirmation(str, Enum):
    CONFIRMED = "CONFIRMED"
    DIVERGING = "DIVERGING"
    PENDING = "PENDING"


class NewsImpact(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class EventType(str, Enum):
    EARNINGS = "EARNINGS"
    FED_ANNOUNCEMENT = "FED_ANNOUNCEMENT"
    ECONOMIC_DATA = "ECONOMIC_DATA"
    M_AND_A = "M&A"
    ANALYST_UPGRADE = "ANALYST_UPGRADE"
    ANALYST_DOWNGRADE = "ANALYST_DOWNGRADE"
    PRODUCT_LAUNCH = "PRODUCT_LAUNCH"
    LEGAL = "LEGAL"
    BREAKING_NEWS = "BREAKING_NEWS"
    SECTOR_ROTATION = "SECTOR_ROTATION"


# ─── Options Contract ─────────────────────────────────────────────────────────

class OptionsContract(BaseModel):
    ticker: str
    strike: float
    expiration: str  # "2025-01-17"
    contract_type: Direction
    premium: float
    delta: Optional[float] = None
    implied_volatility: Optional[float] = None
    volume: Optional[int] = None
    open_interest: Optional[int] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    contract_symbol: str  # e.g. "SPY250117C00590000"

    @property
    def spread_pct(self) -> float:
        if self.bid and self.ask and self.ask > 0:
            return (self.ask - self.bid) / self.ask
        return 0.0


# ─── Market Context ───────────────────────────────────────────────────────────

class MarketContext(BaseModel):
    ticker: str
    current_price: float
    vwap: float
    volume: int
    avg_volume: int
    volume_ratio: float  # current / avg
    price_vs_vwap: float  # % above/below VWAP
    rsi_14: Optional[float] = None
    macd_signal: Optional[str] = None  # "bullish_cross", "bearish_cross", "neutral"
    support_level: Optional[float] = None
    resistance_level: Optional[float] = None
    market_structure: str = "neutral"  # "uptrend", "downtrend", "neutral", "consolidation"
    pre_market_change_pct: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # ── V2.1 filter fields (backtest-proven gates) ─────────────────────
    adx_14: Optional[float] = None           # Wilder ADX(14) — trend strength 0-100
    iv_rank: Optional[float] = None          # IV rank 0-1 (20-day RV percentile)
    atr: Optional[float] = None              # 14-day Average True Range ($)
    orb_confirmed: Optional[bool] = None     # Opening range breakout confirmed
    expected_move_edge: Optional[float] = None  # (proj_intrinsic/premium)-1; ≥0.25 required


# ─── NLP Analysis ─────────────────────────────────────────────────────────────

class NLPAnalysis(BaseModel):
    headline: str
    event_type: EventType
    sentiment: Sentiment
    sentiment_confidence: float  # 0.0 - 1.0
    context_interpretation: str  # "Strong Bullish", "Mixed Signal", "Weak"
    price_confirmation: PriceConfirmation
    impact_score: float  # 0.0 - 10.0
    affected_tickers: List[str] = []
    key_phrases: List[str] = []
    summary: str
    risk_factors: List[str] = []
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ─── News Item ────────────────────────────────────────────────────────────────

class NewsItem(BaseModel):
    id: str
    source: str
    headline: str
    url: str
    published_at: datetime
    nlp: Optional[NLPAnalysis] = None
    impact: NewsImpact = NewsImpact.MEDIUM
    related_tickers: List[str] = []
    is_actionable: bool = False


# ─── Trade Reasoning ─────────────────────────────────────────────────────────

class TradeReasoning(BaseModel):
    bullet_points: List[str]  # Clean explanations shown to user
    news_context: Optional[str] = None
    technical_context: Optional[str] = None
    risk_warning: Optional[str] = None
    invalidation_level: Optional[float] = None  # Price that kills the trade
    dont_chase_warning: bool = False
    setup_invalidated: bool = False


# ─── Execution Instructions ───────────────────────────────────────────────────

class RobinhoodStep(BaseModel):
    step_number: int
    instruction: str
    detail: Optional[str] = None


class ExecutionInstructions(BaseModel):
    contract: OptionsContract
    entry_type: str  # "LIMIT" or "MARKET"
    entry_price_guidance: str  # "Bid price or midpoint"
    suggested_entry: float
    stop_loss_guidance: str
    profit_target_guidance: str
    steps: List[RobinhoodStep]
    small_account_contracts: int = 1
    normal_account_contracts: int = 3
    time_in_force: str = "GTC"


# ─── Trade Setup (Main Object) ────────────────────────────────────────────────

class TradeSetup(BaseModel):
    id: str
    ticker: str
    direction: Direction
    strategy: Strategy
    confidence_score: float  # 0.0 - 1.0
    decision: TradeDecision
    news_catalyst_tag: Optional[str] = None

    contract: OptionsContract
    market_context: MarketContext
    reasoning: TradeReasoning
    nlp_analysis: Optional[NLPAnalysis] = None
    execution: Optional[ExecutionInstructions] = None  # Only if DO_TAKE

    detected_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_active: bool = True

    # ── Golden Hour — all 6 V2.1 filters passed at once ───────────────
    # Triggered when: IV rank <0.65 + Vol ≥2.0x + ATR/prem ≥1.3 +
    #                 ADX ≥22 + ORB confirmed + move edge ≥25% + conf ≥80%
    is_golden_hour: bool = False
    golden_hour_filters: Optional[dict] = None  # {gate: passed} breakdown

    @property
    def is_actionable(self) -> bool:
        return self.decision == TradeDecision.DO_TAKE


# ─── Alert ────────────────────────────────────────────────────────────────────

class Alert(BaseModel):
    id: str
    alert_type: str  # "TRADE" or "NEWS"
    title: str
    message: str
    ticker: Optional[str] = None
    trade_id: Optional[str] = None
    news_id: Optional[str] = None
    severity: str = "HIGH"  # HIGH, MEDIUM, LOW
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_read: bool = False


# ─── Research Report ─────────────────────────────────────────────────────────

class ResearchSetup(BaseModel):
    ticker: str
    direction: Direction
    catalyst: str
    catalyst_strength: float  # 0.0 - 1.0
    sentiment_score: float
    expected_volatility: float
    suggested_strategy: Strategy
    summary: str
    risk_level: str  # "LOW", "MEDIUM", "HIGH"


class OvernightResearchReport(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    market_date: str  # "2025-01-17"
    top_setups: List[ResearchSetup]
    macro_context: str
    key_events_tomorrow: List[str]
    market_bias: str  # "BULLISH", "BEARISH", "NEUTRAL"


# ─── API Response Wrappers ────────────────────────────────────────────────────

class TradesResponse(BaseModel):
    trades: List[TradeSetup]
    total: int
    actionable_count: int
    last_updated: datetime


class NewsResponse(BaseModel):
    items: List[NewsItem]
    total: int
    high_impact_count: int
    last_updated: datetime


class AlertsResponse(BaseModel):
    alerts: List[Alert]
    total: int
    unread_count: int


class ScannerStatus(BaseModel):
    is_running: bool
    last_scan: Optional[datetime]
    tickers_tracked: int
    setups_found: int
    low_memory_mode: bool
    small_account_mode: bool

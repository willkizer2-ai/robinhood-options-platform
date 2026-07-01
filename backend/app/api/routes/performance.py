"""
Performance API — Real Backtest Results Only
═══════════════════════════════════════════════════════════════════════════════
Serves the ICT V4.1 index-options strategy's BACKTESTED performance, computed
from real historical OHLC data (yfinance) run through the engine's confluence
gates. The monthly curve is derived directly from the simulated trade P&L —
months with no qualifying setups show 0% (flat equity), never fabricated returns.

Source of truth: app/data_performance_v4.json, produced by backtest_indices_v4.py.
If that file is absent, this endpoint returns an EMPTY strategies list
(per platform Rule 6 — all fallbacks return empty, never fake data).

NOTE: These are BACKTESTED results on a limited sample (13 trades over 2 years),
not a live-traded record. The frontend labels them as such.
"""

import os
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data_performance_v4.json")


# ── Pydantic response models ──────────────────────────────────────────────────

class MonthlyReturn(BaseModel):
    month: str
    return_pct: float
    trades: int
    wins: int
    losses: int
    equity: float
    cumulative_pct: float
    drawdown_pct: float


class StrategyStats(BaseModel):
    key: str
    name: str
    description: str
    period: str
    total_trades: int
    win_rate: float
    profit_factor: float
    avg_win_pct: float
    avg_loss_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    total_return_pct: float
    annualized_return_pct: float
    monthly_returns: List[MonthlyReturn]
    dte_label: Optional[str] = None
    trades_per_year: Optional[float] = None


class PerformanceReport(BaseModel):
    generated_at: str
    disclaimer: str
    as_of: Optional[str] = None
    strategies: List[StrategyStats]


# ── Loader ────────────────────────────────────────────────────────────────────

def _load_strategies() -> List[dict]:
    """Load real backtested strategy payloads. Returns [] if unavailable."""
    try:
        path = os.path.abspath(_DATA_PATH)
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Support both the new {"strategies": [...]} shape and a single legacy object
        if isinstance(data, dict) and "strategies" in data:
            return data["strategies"]
        if isinstance(data, dict) and "key" in data:
            return [data]
        return []
    except Exception:
        return []


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=PerformanceReport)
async def get_performance():
    """
    Return real backtested performance for the ICT V4.1 index-options strategy.

    Data is computed from historical OHLC bars run through the engine's
    confluence gates — no simulated or synthetic figures. If the backtest
    output file is missing, returns an empty strategies list.
    """
    strategies = _load_strategies()

    if not strategies:
        return PerformanceReport(
            generated_at=datetime.utcnow().isoformat() + "Z",
            disclaimer=(
                "No performance data available yet. This section displays "
                "verified backtest results once the strategy's backtest output "
                "is connected. No simulated or hypothetical figures are shown."
            ),
            strategies=[],
        )

    # as_of from the latest month across all strategies
    as_of = None
    last_months = [s["monthly_returns"][-1]["month"] for s in strategies if s.get("monthly_returns")]
    if last_months:
        as_of = max(last_months) + "-01"

    total_trades = sum(s.get("total_trades", 0) for s in strategies)

    return PerformanceReport(
        generated_at=datetime.utcnow().isoformat() + "Z",
        as_of=as_of,
        disclaimer=(
            "BACKTESTED results, not a live-traded record. These ICT V4 strategies "
            "were simulated on real historical index-ETF price data (SPY, QQQ, IWM, "
            f"DIA, XLK) over a 2-year window, producing {total_trades} high-conviction "
            "trades total. ATM option premiums are modeled via Black-Scholes. Sample "
            "sizes are limited. Past performance does not indicate future results."
        ),
        strategies=[StrategyStats(**s) for s in strategies],
    )

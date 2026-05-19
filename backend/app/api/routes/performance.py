"""
Performance API — Real Backtest Results Only

This endpoint returns an empty payload until real backtested performance
data (from live trade records or a verified historical options dataset)
is connected.

No simulated, Monte Carlo, or synthetic performance figures are served.
Per platform Rule 6: all fallbacks must return empty — never fake data.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


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


class PerformanceReport(BaseModel):
    generated_at: str
    disclaimer: str
    strategies: List[StrategyStats]


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=PerformanceReport)
async def get_performance():
    """
    Return real backtested performance data.

    Currently returns an empty strategies list — no simulated or synthetic
    figures are served. Connect a real trade-history database or verified
    historical options dataset to populate this endpoint.
    """
    return PerformanceReport(
        generated_at=datetime.utcnow().isoformat() + "Z",
        disclaimer=(
            "No performance data available yet. "
            "This section will display verified results once real trade history "
            "is connected. No simulated or hypothetical figures are shown."
        ),
        strategies=[],
    )

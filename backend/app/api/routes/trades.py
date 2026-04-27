"""
API Routes — Trades

Only actionable (DO_TAKE) setups are returned. DONT_TAKE setups are evaluated
by the decision engine but never stored or surfaced — they add noise, not value.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Query
from app.models.schemas import TradesResponse, TradeSetup, TradeDecision

router = APIRouter()


@router.get("", response_model=TradesResponse)
async def get_trades(
    request: Request,
    min_confidence: float = Query(0.0, ge=0, le=1),
    golden_only: bool  = Query(False, description="Return only Golden Hour setups"),
    limit: int         = Query(50, ge=1, le=200),
):
    """
    Get all currently active, actionable trade callouts.

    - All returned setups have decision = DO_TAKE.
    - Stale 0DTE setups (previous ET trading day or past 4 PM ET) are
      automatically purged by the scanner before this endpoint is hit.
    - Use golden_only=true to see only Golden Hour trades.
    """
    scanner = request.app.state.market_scanner
    trades  = scanner.get_active_setups()   # already sorted, DO_TAKE only

    if golden_only:
        trades = [t for t in trades if t.is_golden_hour]

    if min_confidence > 0:
        trades = [t for t in trades if t.confidence_score >= min_confidence]

    trades = trades[:limit]

    return TradesResponse(
        trades=trades,
        total=len(trades),
        actionable_count=len(trades),        # every returned trade IS actionable
        last_updated=scanner.last_scan or datetime.utcnow(),
    )


@router.get("/{trade_id}", response_model=TradeSetup)
async def get_trade_detail(request: Request, trade_id: str):
    """Get full detail for a specific trade setup."""
    scanner = request.app.state.market_scanner
    # active_setups is now keyed by ticker_direction; support both key forms
    trade = (
        scanner.active_setups.get(trade_id) or
        next((v for v in scanner.active_setups.values() if v.id == trade_id), None)
    )
    if not trade:
        raise HTTPException(404, "Trade not found or has expired")
    return trade



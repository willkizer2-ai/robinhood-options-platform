"""
Valuation API — Fundamental Analysis Tool (NOT investment advice)
═══════════════════════════════════════════════════════════════════════════════
  GET /api/valuation/{symbol} → composite fundamental valuation for a ticker.

Results are framed as analysis ("what the fundamentals show"), never as buy/sell
recommendations. Data is real (Finnhub); missing datapoints are marked, not faked.

A simple in-memory day-cache limits repeated API calls for the same ticker.
"""

import time
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.core.valuation_engine import valuate

router = APIRouter()

# ticker → (timestamp, result). Cache for the trading day to conserve API calls.
_CACHE: Dict[str, tuple] = {}
_CACHE_TTL = 6 * 3600  # 6 hours

_DISCLAIMER = (
    "This is a fundamental analysis tool, not investment advice. Scores reflect "
    "what public financial metrics show under a fixed, transparent methodology "
    "applied identically to every stock. It does not account for your personal "
    "circumstances. Web Trace is not a registered investment adviser. Do your own "
    "research and consult a licensed professional before making investment decisions."
)


@router.get("/{symbol}")
async def get_valuation(symbol: str) -> Dict[str, Any]:
    symbol = (symbol or "").strip().upper()
    if not symbol or not symbol.isalnum() or len(symbol) > 8:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")

    now = time.time()
    cached = _CACHE.get(symbol)
    if cached and (now - cached[0]) < _CACHE_TTL:
        result = dict(cached[1])
        result["cached"] = True
        result["disclaimer"] = _DISCLAIMER
        return result

    result = valuate(symbol)
    if result.get("ok"):
        _CACHE[symbol] = (now, result)
    result = dict(result)
    result["cached"] = False
    result["disclaimer"] = _DISCLAIMER
    return result

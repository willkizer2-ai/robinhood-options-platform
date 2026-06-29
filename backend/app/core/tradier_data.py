"""
Tradier Intraday Data Provider
═══════════════════════════════════════════════════════════════════════════════
Fetches real 1-minute OHLC bars from Tradier's timesales endpoint for replay use.

IMPORTANT — real data limits (verified against the live API):
  • Tradier 1-minute history only goes back ~30 days (the API rejects earlier
    start dates: "must be on or after <date>").
  • Therefore this provider returns real 1-minute bars ONLY for recent dates.
    For older trades, callers must fall back to a daily source. Bars are never
    synthesized to fill the gap.

The key lives in the environment (TRADIER_API_KEY), never in the repo or frontend.
"""

import os
import datetime as dt
from typing import List, Dict, Optional

import httpx

TRADIER_BASE = "https://api.tradier.com/v1"
# Conservative client-side guard mirroring the API's ~30-day intraday limit.
INTRADAY_MAX_AGE_DAYS = 28


def _token() -> str:
    return os.getenv("TRADIER_API_KEY", "")


def intraday_available(trade_date: str) -> bool:
    """True if the date is recent enough for Tradier to serve 1-minute bars."""
    try:
        d = dt.date.fromisoformat(trade_date[:10])
    except Exception:
        return False
    return (dt.date.today() - d).days <= INTRADAY_MAX_AGE_DAYS


def fetch_1min_bars(symbol: str, trade_date: str) -> Optional[List[Dict]]:
    """
    Return real 1-minute bars for the regular session of `trade_date`,
    or None if unavailable (no token, out of window, or API error).
    Each bar: {t, o, h, l, c}.
    """
    token = _token()
    if not token or not intraday_available(trade_date):
        return None

    day = trade_date[:10]
    params = {
        "symbol": symbol,
        "interval": "1min",
        "start": f"{day} 09:30",
        "end": f"{day} 16:00",
        "session_filter": "open",
    }
    try:
        r = httpx.get(
            f"{TRADIER_BASE}/markets/timesales",
            params=params,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=15,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        series = (data or {}).get("series")
        if not series or not series.get("data"):
            return None
        raw = series["data"]
        if not isinstance(raw, list):
            raw = [raw]
        bars = []
        for b in raw:
            bars.append({
                "t": str(b.get("time", ""))[11:16],  # HH:MM
                "o": round(float(b["open"]), 2),
                "h": round(float(b["high"]), 2),
                "l": round(float(b["low"]), 2),
                "c": round(float(b["close"]), 2),
            })
        return bars if bars else None
    except Exception:
        return None

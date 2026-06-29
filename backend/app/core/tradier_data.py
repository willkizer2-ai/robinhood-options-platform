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
# Verified intraday lookback limits (the API rejects earlier start dates):
#   1-minute → ~31 days   |   5-minute → ~59 days
# Kept slightly conservative to avoid edge rejections.
ONE_MIN_MAX_AGE_DAYS = 29
FIVE_MIN_MAX_AGE_DAYS = 56


def _token() -> str:
    return os.getenv("TRADIER_API_KEY", "")


def best_interval(trade_date: str) -> Optional[str]:
    """
    Return the finest Tradier interval whose history covers `trade_date`:
      '1min' for very recent, '5min' for moderately recent, else None (→ daily).
    """
    try:
        d = dt.date.fromisoformat(trade_date[:10])
    except Exception:
        return None
    age = (dt.date.today() - d).days
    if age <= ONE_MIN_MAX_AGE_DAYS:
        return "1min"
    if age <= FIVE_MIN_MAX_AGE_DAYS:
        return "5min"
    return None


def intraday_available(trade_date: str) -> bool:
    """True if Tradier can serve any intraday (1m or 5m) bars for the date."""
    return best_interval(trade_date) is not None


def fetch_intraday_bars(symbol: str, trade_date: str) -> Optional[tuple]:
    """
    Return (bars, interval_label) using the finest real Tradier interval available
    for the date, or None. interval_label is '1m' or '5m'. Each bar: {t,o,h,l,c}.
    """
    token = _token()
    if not token:
        return None
    interval = best_interval(trade_date)
    if not interval:
        return None

    day = trade_date[:10]
    params = {
        "symbol": symbol,
        "interval": interval,
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
                "t": str(b.get("time", ""))[11:16],
                "o": round(float(b["open"]), 2),
                "h": round(float(b["high"]), 2),
                "l": round(float(b["low"]), 2),
                "c": round(float(b["close"]), 2),
            })
        if not bars:
            return None
        label = "1m" if interval == "1min" else "5m"
        return bars, label
    except Exception:
        return None


def fetch_1min_bars(symbol: str, trade_date: str) -> Optional[List[Dict]]:
    """Back-compat: 1-minute bars only, or None. Prefer fetch_intraday_bars()."""
    res = fetch_intraday_bars(symbol, trade_date)
    if res and res[1] == "1m":
        return res[0]
    return None

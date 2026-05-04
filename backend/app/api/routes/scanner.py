import time
import logging
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Request, HTTPException, Query
from app.models.schemas import ScannerStatus

router = APIRouter()
logger = logging.getLogger(__name__)

# ── In-memory price cache (15-second TTL avoids hammering yfinance) ───────────
_price_cache: Dict[str, dict] = {}
_PRICE_TTL = 15  # seconds

# ── In-memory candle cache (30-second TTL) ────────────────────────────────────
_candles_cache: Dict[str, dict] = {}
_CANDLES_TTL = 30  # seconds


@router.get("/status", response_model=ScannerStatus)
async def get_scanner_status(request: Request):
    scanner = request.app.state.market_scanner
    return ScannerStatus(
        is_running=scanner.is_running,
        last_scan=scanner.last_scan,
        tickers_tracked=len(scanner.watchlist),
        setups_found=len(scanner.active_setups),
        low_memory_mode=scanner.low_memory_mode,
        small_account_mode=scanner.small_account_mode,
    )


@router.get("/price/{ticker}")
async def get_ticker_price(ticker: str):
    """
    Current underlying price including extended-hours data.
    Cached for 15 s per ticker to avoid yfinance rate limits.
    """
    import yfinance as yf  # local import — yfinance already in venv

    key = ticker.upper().strip()
    now = time.time()

    # Serve from cache if fresh
    cached = _price_cache.get(key)
    if cached and now - cached["ts"] < _PRICE_TTL:
        return cached["data"]

    try:
        import math

        tk = yf.Ticker(key)
        fi = tk.fast_info

        # FastInfo is NOT a dict — use getattr; guard against NaN/None
        def _safe_attr(obj, *attrs):
            for a in attrs:
                try:
                    v = getattr(obj, a, None)
                    if v is not None:
                        f = float(v)
                        if not math.isnan(f) and f > 0:
                            return f
                except (TypeError, ValueError):
                    continue
            return None

        price = _safe_attr(fi, "last_price", "regular_market_price")

        # Fallback: use most-recent close from history (works on weekends + after-hours)
        if not price:
            hist = tk.history(period="5d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])

        if not price:
            raise ValueError("No valid price from fast_info or history")

        prev = _safe_attr(fi, "previous_close", "regular_market_previous_close")
        # If fast_info gave no prev_close either, derive from history
        if not prev:
            hist = tk.history(period="5d")
            if not hist.empty and len(hist) >= 2:
                prev = float(hist["Close"].iloc[-2])

        chg     = round(price - prev, 2)        if prev else 0.0
        chg_pct = round((chg / prev) * 100, 2)  if prev else 0.0

        result = {
            "ticker":     key,
            "price":      round(price, 2),
            "prev_close": round(prev, 2) if prev else None,
            "change":     chg,
            "change_pct": chg_pct,
            "timestamp":  datetime.now().isoformat(),
        }
        _price_cache[key] = {"data": result, "ts": now}
        return result

    except Exception as exc:
        logger.warning("Price fetch failed for %s: %s", key, exc)
        # Return partial from cache if available (even if stale)
        if cached:
            return cached["data"]
        raise HTTPException(status_code=503, detail=f"Price unavailable for {key}")


@router.get("/candles/{ticker}")
async def get_ticker_candles(ticker: str):
    """
    1-minute OHLCV candles for today's session.

    Used by the live trade chart overlay on each trade card.
    Returns all candles from market open to now (or the last available bar).
    Results are cached for 30 s per ticker to limit yfinance calls.
    """
    import yfinance as yf

    key = ticker.upper().strip()
    now_ts = time.time()

    # Serve from cache if fresh
    cached = _candles_cache.get(key)
    if cached and now_ts - cached["ts"] < _CANDLES_TTL:
        return cached["data"]

    try:
        hist = yf.Ticker(key).history(period="1d", interval="1m", prepost=False)
        candles = []
        for ts_idx, row in hist.iterrows():
            try:
                candles.append({
                    "t": ts_idx.isoformat(),
                    "o": round(float(row["Open"]),   2),
                    "h": round(float(row["High"]),   2),
                    "l": round(float(row["Low"]),    2),
                    "c": round(float(row["Close"]),  2),
                    "v": int(row["Volume"]),
                })
            except Exception:
                continue

        result = {"ticker": key, "interval": "1m", "candles": candles}
        _candles_cache[key] = {"data": result, "ts": now_ts}
        return result

    except Exception as exc:
        logger.warning("Candle fetch failed for %s: %s", key, exc)
        if cached:
            return cached["data"]
        raise HTTPException(status_code=503, detail=f"Candle data unavailable for {key}")


@router.post("/mode/low-memory")
async def set_low_memory_mode(request: Request, enabled: bool):
    scanner = request.app.state.market_scanner
    scanner.set_low_memory_mode(enabled)
    return {"status": "updated", "low_memory_mode": enabled}


@router.post("/mode/small-account")
async def set_small_account_mode(request: Request, enabled: bool):
    scanner = request.app.state.market_scanner
    scanner.set_small_account_mode(enabled)
    return {"status": "updated", "small_account_mode": enabled}

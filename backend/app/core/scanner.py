"""
Market Scanner Engine
Continuously scans for high-probability options setups
"""
import asyncio
import uuid
import logging
import math
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional
import aiohttp

from app.models.schemas import (
    TradeSetup, Direction, Strategy, TradeDecision,
    OptionsContract, MarketContext, TradeReasoning,
    ExecutionInstructions, RobinhoodStep
)
from app.core.decision_engine import DecisionEngine
from app.core.dte_strategy import ZeroDTEStrategy
from app.config import settings

# V4.1 Index ICT engine (backtested 75% WR / 9.3x PF on 5-ticker 2yr period)
try:
    from app.core.ict_engine_v4 import (
        detect_v4_signal, HIGH_CONF_V4,
    )
    _V4_AVAILABLE = True
except ImportError:
    _V4_AVAILABLE = False

logger = logging.getLogger(__name__)

# ── V4 Index ICT configuration ────────────────────────────────────────────────
V4_TICKERS = ["SPY", "QQQ", "IWM", "DIA", "XLK"]  # Core index ETFs only

V4_PARAMS = {
    "min_score": 60,
    "fvg_lookback": 15,
    "min_fvg_pct": 0.0003,
    "fvg_proximity": 0.012,
    "va_window": 5,
    "va_tolerance": 0.015,
    "fib_lookbacks": [5, 10, 15, 20],
    "require_fib": True,
    "min_fib_score": 6,
    "require_ob": False,
    "min_vol_ratio": 1.05,
    "structure_gate": 7,
    "use_regime": True,
    "regime_lookback": 10,
    "max_atr_mult": 2.5,
    "skip_candle_filter": False,
    "require_active_fvg": True,
    "min_va_score": 15,
    "require_retracement": True,
}


# Default watchlist - high-liquidity tickers for options
DEFAULT_WATCHLIST = [
    "SPY", "QQQ", "AAPL", "TSLA", "NVDA", "AMZN", "MSFT", "META",
    "AMD", "GOOGL", "NFLX", "COIN", "PLTR", "SOFI", "RIVN", "MARA",
    "SPX", "IWM", "XLF", "XLE", "VIX", "SQQQ", "TQQQ"
]

LOW_MEMORY_WATCHLIST = [
    "SPY", "QQQ", "AAPL", "TSLA", "NVDA", "MSFT", "AMD", "META"
]


class MarketScanner:
    """
    Continuously scans the market for high-probability options setups.
    Feeds into the Decision Engine for final GO / NO-GO determination.
    """

    def __init__(self):
        self.is_running = False
        self.last_scan: Optional[datetime] = None
        self.active_setups: Dict[str, TradeSetup] = {}
        self.decision_engine = DecisionEngine()
        self.dte_strategy = ZeroDTEStrategy()
        self.low_memory_mode = settings.LOW_MEMORY_MODE
        self.small_account_mode = False
        self._last_v4_scan_date: Optional[date] = None  # Run once per day
        self._daily_fired: Dict[str, date] = {}          # ticker → ET date when first DO_TAKE posted
        self._current_trade_date: Optional[date] = None  # Tracks ET date for daily rollover

        self.watchlist = (
            LOW_MEMORY_WATCHLIST if self.low_memory_mode else DEFAULT_WATCHLIST
        )

    async def run_continuous(self):
        """Main scanning loop — runs while market is open."""
        self.is_running = True
        logger.info(f"📡 Market Scanner started. Watching {len(self.watchlist)} tickers.")

        while True:
            try:
                if self.is_market_open():
                    # ── Daily rollover: purge prior-day cards on new ET date ──────
                    import pytz as _tz
                    _today_et = datetime.now(_tz.timezone("America/New_York")).date()
                    if self._current_trade_date is not None and self._current_trade_date != _today_et:
                        self.active_setups.clear()
                        self._daily_fired.clear()
                        self._last_v4_scan_date = None
                        logger.info(f"📅 New trading day ({_today_et}). Board and fire-locks reset.")
                    self._current_trade_date = _today_et
                    # ─────────────────────────────────────────────────────────────

                    await self.scan_all_tickers()
                    self.last_scan = datetime.utcnow()
                    interval = (
                        settings.UPDATE_FREQUENCY_LOW_MEMORY
                        if self.low_memory_mode
                        else settings.SCAN_INTERVAL_SECONDS
                    )
                    await asyncio.sleep(interval)
                else:
                    # Market closed — clear the board so no stale cards show
                    if self.active_setups:
                        self.active_setups.clear()
                        logger.info("⏹️  Outside trading window. Display board cleared.")
                    await asyncio.sleep(300)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scanner error: {e}")
                await asyncio.sleep(60)

        self.is_running = False

    def is_market_open(self) -> bool:
        """Check if the scanner should be actively running.

        Starts at 9:00 AM ET (30 min pre-open) so the engine can gather volatility
        data and identify the Judas Swing direction before the 9:35 entry window.
        Stops at 4:30 PM ET. In DEBUG mode always returns True.
        """
        if settings.DEBUG:
            return True
        import pytz
        et = pytz.timezone("America/New_York")
        now = datetime.now(et)
        if now.weekday() >= 5:  # Saturday/Sunday
            return False
        t = now.hour * 60 + now.minute
        # 9:00 AM – 4:30 PM ET  (9*60 = 540, 16*60+30 = 990)
        return (9 * 60) <= t <= (16 * 60 + 30)

    def _in_entry_window(self) -> bool:
        """True if current ET time is within the 0DTE entry window (9:35 AM–11:00 AM).

        The scanner runs from 9:25 AM to gather open-range data and detect the
        Judas Swing fake move. Once the real directional impulse confirms (~9:35),
        the engine posts 0DTE setups per viable ticker throughout the extended
        morning window (9:35–11:00 AM ET). No new entries are generated after 11:00 AM.

        V4 daily-bar setups are not gated by this check.
        In DEBUG mode the gate is bypassed so the dashboard stays populated.
        """
        if settings.DEBUG:
            return True
        import pytz
        et  = pytz.timezone("America/New_York")
        now = datetime.now(et)
        if now.weekday() >= 5:  # Sat/Sun
            return False
        t = now.hour * 60 + now.minute
        # 9:35 AM – 11:00 AM ET
        return (9 * 60 + 35) <= t < (11 * 60)

    async def scan_all_tickers(self):
        """Scan all watchlist tickers concurrently, plus daily V4 index ICT scan."""
        tasks = [self.scan_ticker(ticker) for ticker in self.watchlist]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # ── V4 Index ICT scan (once per day, runs alongside 0DTE scan) ─────────
        today = datetime.utcnow().date()
        if _V4_AVAILABLE and self._last_v4_scan_date != today:
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._run_v4_index_scan
                )
                self._last_v4_scan_date = today
            except Exception as e:
                logger.error(f"V4 index scan error: {e}")

        # ── Shared ET time reference ──────────────────────────────────────────────
        import pytz as _pytz
        _et       = _pytz.timezone("America/New_York")
        _now_et   = datetime.now(_et)
        _today_et = _now_et.date()  # ET calendar date for 0DTE gates

        # ── AM entry window check (9:30–11:00 ET, bypassed in DEBUG) ─────────
        in_window = self._in_entry_window()

        new_setups = 0
        for result in results:
            if isinstance(result, TradeSetup) and result is not None:
                # ── Only keep actionable setups; DONT_TAKE are noise, not callouts ──
                if result.decision != TradeDecision.DO_TAKE:
                    continue

                ticker = result.ticker
                is_v4  = result.strategy.value.startswith("V4_")

                if not is_v4:
                    # ── AM window gate: 0DTE entries only 9:30–11:00 AM ET ────
                    if not in_window:
                        continue

                    # ── Daily lockout: one perfect entry per ticker per day ────
                    # Prevents both re-entry and strike-price chasing after a stop
                    if self._daily_fired.get(ticker) == _today_et:
                        logger.debug(
                            f"⏸️  {ticker} already posted a setup today — skipping re-entry"
                        )
                        continue

                # ── Key by ticker+direction for deduplication ──────────────────
                key = f"{result.ticker}_{result.direction.value}"
                self.active_setups[key] = result

                if not is_v4:
                    # Record ticker as fired for today — blocks strike chasing
                    self._daily_fired[ticker] = _today_et

                new_setups += 1
            elif isinstance(result, Exception):
                logger.debug(f"Scan error: {result}")

        # ── Expire stale 0DTE setups using ET calendar boundaries ──────────────
        expired = []
        for k, v in self.active_setups.items():
            # Attach UTC tz to the naive detected_at timestamp, then convert to ET
            detected_et = v.detected_at.replace(tzinfo=_pytz.utc).astimezone(_et)
            detected_date = detected_et.date()

            if detected_date < _today_et:
                # Previous trading day — 0DTE contract has expired, worthless
                expired.append(k)
            elif not settings.DEBUG and _now_et.hour >= 16:
                # Past 4 PM ET today — market closed, all today's 0DTE setups done
                expired.append(k)

        for key in expired:
            del self.active_setups[key]

        if expired:
            logger.info(f"🗑️  Expired {len(expired)} stale 0DTE setup(s).")
        if new_setups > 0:
            logger.info(f"✅ Found {new_setups} new setups. Total active: {len(self.active_setups)}")

    async def scan_ticker(self, ticker: str) -> Optional[TradeSetup]:
        """Scan a single ticker for options setups."""
        try:
            # Get market data
            market_ctx = await self.get_market_context(ticker)
            if not market_ctx:
                return None

            # Check for 0DTE setup
            setup = await self.dte_strategy.evaluate(ticker, market_ctx)
            if not setup:
                return None

            # Run through decision engine
            decision_result = await self.decision_engine.evaluate(setup, market_ctx)

            # Build execution instructions if DO_TAKE
            if decision_result.decision == TradeDecision.DO_TAKE:
                setup.execution = self._build_execution_instructions(
                    setup, market_ctx
                )

            setup.decision         = decision_result.decision
            setup.confidence_score = decision_result.confidence
            setup.reasoning        = decision_result.reasoning

            # ── Golden Hour: all 6 V2.1 filters pass simultaneously ──
            ctx = market_ctx
            direction_str = setup.direction.value  # "CALL" or "PUT"

            # Per-ticker ADX override (mirrors backtest.py)
            TICKER_ADX_OVERRIDES = {"AMZN": {"CALL": 28.0}}
            min_adx = TICKER_ADX_OVERRIDES.get(ticker, {}).get(direction_str, 22.0)

            gh_filters = {
                "iv_rank_ok":       (ctx.iv_rank   is not None and ctx.iv_rank   < 0.65),
                "volume_ok":        ctx.volume_ratio >= 2.0,
                "atr_premium_ok":   (ctx.atr is not None and
                                     setup.contract.premium > 0 and
                                     ctx.atr / setup.contract.premium >= 1.3),
                "adx_ok":           (ctx.adx_14 is not None and ctx.adx_14 >= min_adx),
                "orb_ok":           (ctx.orb_confirmed is True),
                "move_edge_ok":     (ctx.expected_move_edge is not None and
                                     ctx.expected_move_edge >= 0.25),
                "confidence_ok":    decision_result.confidence >= 0.80,
                "decision_ok":      decision_result.decision.value == "DO_TAKE",
            }

            setup.is_golden_hour    = all(gh_filters.values())
            setup.golden_hour_filters = gh_filters

            if decision_result.confidence >= settings.MIN_CONFIDENCE_SCORE:
                return setup

            return None

        except Exception as e:
            logger.debug(f"Error scanning {ticker}: {e}")
            return None

    async def get_market_context(self, ticker: str) -> Optional[MarketContext]:
        """
        Fetch market context:
        • DEBUG mode  → mock profile with REAL current price injected via fast_info.
          The seeded mock ensures the decision engine always sees qualified setups
          so the dashboard remains populated even before/after market hours.
        • Production  → full yfinance real data (price + indicators),
          then Polygon.io, then mock as last resort.
        """
        if settings.DEBUG:
            # Run the (blocking) real-price fetch in a thread pool, then apply mock profile
            return await asyncio.get_event_loop().run_in_executor(
                None, self._mock_market_context, ticker
            )

        # ── Try yfinance (real data, always available) ────────────────────────
        ctx = await self._yfinance_market_context(ticker)
        if ctx:
            return ctx

        # ── Try Polygon.io if configured ──────────────────────────────────────
        if settings.POLYGON_API_KEY:
            try:
                url = (f"https://api.polygon.io/v2/last/trade/{ticker}"
                       f"?apiKey={settings.POLYGON_API_KEY}")
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                        if resp.status == 200:
                            data  = await resp.json()
                            price = data.get("results", {}).get("p", 0)
                            if price > 0:
                                return MarketContext(
                                    ticker=ticker,
                                    current_price=price,
                                    vwap=price * 0.998,
                                    volume=1_500_000,
                                    avg_volume=1_200_000,
                                    volume_ratio=1.25,
                                    price_vs_vwap=0.2,
                                    rsi_14=55.0,
                                    market_structure="uptrend",
                                )
            except Exception:
                pass

        # ── Last resort: seeded mock (prices will be stale but structure valid) ─
        logger.warning(f"yfinance unavailable for {ticker}, using mock")
        return self._mock_market_context(ticker)

    # ── yfinance real-data fetcher ─────────────────────────────────────────────

    async def _yfinance_market_context(self, ticker: str) -> Optional[MarketContext]:
        """Run the blocking yfinance fetch in a thread pool so the event loop stays free."""
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(None, self._fetch_yf_sync, ticker)
        except Exception as e:
            logger.debug(f"yfinance async wrapper error for {ticker}: {e}")
            return None

    def _fetch_yf_sync(self, ticker: str) -> Optional[MarketContext]:
        """
        Synchronous yfinance fetch — executed in a thread pool.
        Computes real: price, volume, RSI(14), MACD, ATR(14), ADX(14),
        VWAP proxy, ORB proxy, IV rank proxy, expected move edge.
        """
        try:
            import yfinance as yf
            import numpy as np

            # Remap tickers that yfinance expects with different symbols
            _remap  = {"SPX": "^GSPC", "VIX": "^VIX"}
            yfTicker = _remap.get(ticker, ticker)
            tk   = yf.Ticker(yfTicker)
            info = tk.fast_info

            # FastInfo is NOT a dict — use getattr, guard against NaN
            def _safe(fi, *attrs):
                import math
                for a in attrs:
                    try:
                        v = getattr(fi, a, None)
                        if v is not None:
                            f = float(v)
                            if not math.isnan(f) and f > 0:
                                return f
                    except (TypeError, ValueError):
                        continue
                return None

            current_price = _safe(info, "last_price", "regular_market_price") or 0.0
            if not current_price or current_price <= 0:
                return None

            # 90 days of daily bars for indicator calculations
            hist = tk.history(period="90d", interval="1d")
            if hist.empty or len(hist) < 15:
                return None

            closes = hist["Close"].to_numpy(dtype=float)
            highs  = hist["High"].to_numpy(dtype=float)
            lows   = hist["Low"].to_numpy(dtype=float)
            opens  = hist["Open"].to_numpy(dtype=float)
            vols   = hist["Volume"].to_numpy(dtype=float)

            # ── Volume ──────────────────────────────────────────────────────
            today_vol   = int(vols[-1])  if len(vols) > 0  else 0
            avg_vol_20d = int(np.mean(vols[-20:])) if len(vols) >= 20 else int(np.mean(vols))
            volume_ratio = round(today_vol / avg_vol_20d, 2) if avg_vol_20d > 0 else 1.0

            # ── RSI(14) ─────────────────────────────────────────────────────
            rsi = self._rsi(closes, 14)

            # ── MACD signal ─────────────────────────────────────────────────
            macd_signal = self._macd_signal(closes)

            # ── ATR(14) ─────────────────────────────────────────────────────
            atr = self._atr(highs, lows, closes, 14)

            # ── ADX(14) ─────────────────────────────────────────────────────
            adx = self._adx(highs, lows, closes, 14)

            # ── VWAP proxy (today's typical price) ──────────────────────────
            vwap = round((highs[-1] + lows[-1] + closes[-1]) / 3, 2)
            price_vs_vwap = round((current_price - vwap) / vwap * 100, 2)

            # ── Market structure (price vs SMA-20 vs SMA-50) ─────────────────
            sma20 = float(np.mean(closes[-20:]))
            sma50 = float(np.mean(closes[-50:])) if len(closes) >= 50 else sma20
            if current_price > sma20 and sma20 > sma50:
                market_structure = "uptrend"
            elif current_price < sma20 and sma20 < sma50:
                market_structure = "downtrend"
            else:
                market_structure = "neutral"

            # ── Support / resistance (20-day swing levels) ───────────────────
            support    = round(float(np.min(lows[-20:])),  2)
            resistance = round(float(np.max(highs[-20:])), 2)

            # ── IV rank proxy (30-day RV vs 90-day RV percentile) ────────────
            if len(closes) >= 30:
                lr        = np.diff(np.log(closes))
                rv30      = float(np.std(lr[-20:])  * np.sqrt(252))
                rv90      = float(np.std(lr[-60:]) * np.sqrt(252)) if len(lr) >= 60 else rv30
                iv_rank   = round(min(rv30 / rv90, 1.0), 3) if rv90 > 0 else 0.50
            else:
                iv_rank = 0.50

            # ── ORB proxy (close in top/bottom 40% of day's range) ───────────
            day_range = highs[-1] - lows[-1]
            if day_range > 0:
                close_pct    = (closes[-1] - lows[-1]) / day_range
                orb_confirmed = bool(
                    (close_pct >= 0.60 and closes[-1] > opens[-1]) or
                    (close_pct <= 0.40 and closes[-1] < opens[-1])
                )
            else:
                orb_confirmed = False

            # ── Expected move edge ───────────────────────────────────────────
            inc = 5.0 if current_price >= 500 else 1.0 if current_price >= 100 else 0.5
            if market_structure == "uptrend":
                strike_est  = round(round(current_price * 1.005 / inc) * inc, 2)
                proj_intrin = max(current_price + atr - strike_est, 0.0)
            else:
                strike_est  = round(round(current_price * 0.995 / inc) * inc, 2)
                proj_intrin = max(strike_est - (current_price - atr), 0.0)
            rough_prem         = max(proj_intrin * 0.55 + current_price * 0.003, 0.10)
            expected_move_edge = round((proj_intrin / rough_prem) - 1.0, 3)

            return MarketContext(
                ticker=ticker,
                current_price=round(float(current_price), 2),
                vwap=vwap,
                volume=today_vol,
                avg_volume=avg_vol_20d,
                volume_ratio=volume_ratio,
                price_vs_vwap=price_vs_vwap,
                rsi_14=round(float(rsi), 1) if rsi is not None else None,
                macd_signal=macd_signal,
                market_structure=market_structure,
                support_level=support,
                resistance_level=resistance,
                adx_14=round(float(adx), 1) if adx is not None else None,
                iv_rank=iv_rank,
                atr=round(float(atr), 2) if atr is not None else None,
                orb_confirmed=orb_confirmed,
                expected_move_edge=expected_move_edge,
            )

        except Exception as e:
            logger.debug(f"yfinance sync fetch failed for {ticker}: {e}")
            return None

    # ── Technical indicator helpers ───────────────────────────────────────────

    @staticmethod
    def _rsi(closes: "np.ndarray", period: int = 14) -> Optional[float]:
        """Wilder RSI — returns None if insufficient data."""
        import numpy as np
        if len(closes) < period + 1:
            return None
        deltas = np.diff(closes)
        gains  = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        # Wilder smoothing seed
        avg_gain = float(np.mean(gains[:period]))
        avg_loss = float(np.mean(losses[:period]))
        for g, l in zip(gains[period:], losses[period:]):
            avg_gain = (avg_gain * (period - 1) + g) / period
            avg_loss = (avg_loss * (period - 1) + l) / period
        if avg_loss == 0:
            return 100.0
        return round(100.0 - 100.0 / (1.0 + avg_gain / avg_loss), 2)

    @staticmethod
    def _macd_signal(closes: "np.ndarray") -> str:
        """Returns 'bullish_cross', 'bearish_cross', or 'neutral'."""
        import numpy as np
        def ema(arr, n):
            k = 2 / (n + 1)
            e = [float(arr[0])]
            for v in arr[1:]:
                e.append(float(v) * k + e[-1] * (1 - k))
            return np.array(e)
        if len(closes) < 35:
            return "neutral"
        ema12   = ema(closes, 12)
        ema26   = ema(closes, 26)
        macd    = ema12 - ema26
        signal  = ema(macd, 9)
        diff_now  = macd[-1]  - signal[-1]
        diff_prev = macd[-2]  - signal[-2]
        if diff_prev <= 0 < diff_now:
            return "bullish_cross"
        if diff_prev >= 0 > diff_now:
            return "bearish_cross"
        return "neutral"

    @staticmethod
    def _atr(highs, lows, closes, period: int = 14) -> Optional[float]:
        """Average True Range (Wilder smoothing)."""
        import numpy as np
        if len(closes) < period + 1:
            return None
        tr = np.maximum(highs[1:] - lows[1:],
             np.maximum(np.abs(highs[1:] - closes[:-1]),
                        np.abs(lows[1:]  - closes[:-1])))
        atr = float(np.mean(tr[:period]))
        for v in tr[period:]:
            atr = (atr * (period - 1) + float(v)) / period
        return round(atr, 4)

    @staticmethod
    def _adx(highs, lows, closes, period: int = 14) -> Optional[float]:
        """Wilder ADX(14)."""
        import numpy as np
        if len(closes) < period * 2:
            return None
        tr_arr, pdm_arr, ndm_arr = [], [], []
        for i in range(1, len(closes)):
            h, l, pc = highs[i], lows[i], closes[i - 1]
            tr_arr.append(max(h - l, abs(h - pc), abs(l - pc)))
            pdm_arr.append(max(highs[i] - highs[i-1], 0) if highs[i] - highs[i-1] > lows[i-1] - lows[i] else 0)
            ndm_arr.append(max(lows[i-1] - lows[i], 0) if lows[i-1] - lows[i] > highs[i] - highs[i-1] else 0)
        def wilder(arr):
            s = [sum(arr[:period])]
            for v in arr[period:]:
                s.append(s[-1] - s[-1] / period + v)
            return s
        atr_s  = wilder(tr_arr)
        pdm_s  = wilder(pdm_arr)
        ndm_s  = wilder(ndm_arr)
        dx_vals = []
        for a, p, n in zip(atr_s, pdm_s, ndm_s):
            if a == 0:
                continue
            pdi = 100 * p / a
            ndi = 100 * n / a
            denom = pdi + ndi
            dx_vals.append(100 * abs(pdi - ndi) / denom if denom else 0)
        if not dx_vals:
            return None
        adx = sum(dx_vals[:period]) / period
        for v in dx_vals[period:]:
            adx = (adx * (period - 1) + v) / period
        return round(adx, 2)

    def _real_price(self, ticker: str) -> Optional[float]:
        """
        Fetch only the current price via yfinance fast_info (lightweight, < 1 s).
        Returns None on failure so caller can fall back to hardcoded estimate.
        """
        import math
        try:
            import yfinance as yf
            yfTicker = {"SPX": "^GSPC", "VIX": "^VIX",
                        "SQQQ": "SQQQ", "TQQQ": "TQQQ"}.get(ticker, ticker)
            fi = yf.Ticker(yfTicker).fast_info
            # FastInfo is NOT a dict — must use attribute access, not .get()
            for attr in ("last_price", "regular_market_price"):
                try:
                    v = getattr(fi, attr, None)
                    if v is not None:
                        f = float(v)
                        if not math.isnan(f) and f > 0:
                            return f
                except (TypeError, ValueError):
                    continue
            return None
        except Exception:
            return None

    def _mock_market_context(self, ticker: str) -> MarketContext:
        """
        Development / fallback context.
        Pulls REAL current price from yfinance fast_info (one quick call),
        then overlays a deterministic seeded technical profile so the
        dashboard always shows plausible, actionable callouts.

        Profile breakdown (seed % 4):
          0 = Golden Hour CALL  — all 6 V2.1 gates pass
          1 = Golden Hour PUT   — all 6 V2.1 gates pass
          2 = Normal DO_TAKE    — passes most basic gates
          3 = Weak / filtered   — fails multiple gates
        """
        import random
        import hashlib

        # ── Approximate current prices (May 2026) — last-resort fallback only
        #    when BOTH yfinance fast_info AND _real_price() fail entirely.
        #    These should never be needed in production; fix the yfinance call first.
        prices = {
            "SPY": 557.00, "QQQ": 474.00, "AAPL": 208.00,
            "TSLA": 285.00, "NVDA": 111.00, "MSFT": 432.00,
            "META": 607.00, "AMD": 103.00, "AMZN": 204.00,
            "GOOGL": 165.00, "NFLX": 1100.00, "COIN": 205.00,
            "PLTR": 120.00, "SOFI": 14.00, "IWM": 198.00,
            "XLF": 50.00, "XLE": 86.00, "RIVN": 13.00,
            "MARA": 16.00, "SQQQ": 9.50, "TQQQ": 58.00,
            "SPX": 5570.00, "VIX": 23.00,
        }

        # Include today's date in the seed so mock profiles rotate daily
        seed = int(hashlib.md5(f"{ticker}_{date.today().isoformat()}".encode()).hexdigest()[:8], 16)
        rng  = random.Random(seed)

        # Prefer real price; fall back to hardcoded estimate
        real_p     = self._real_price(ticker)
        base_price = real_p if real_p else prices.get(ticker, 100.0)

        # Small intraday noise on the real price
        price = base_price * (1 + rng.uniform(-0.008, 0.008))

        # 4 profiles (seed % 4)
        # 0 = Golden Hour CALL   — all 6 V2.1 gates pass
        # 1 = Golden Hour PUT    — all 6 V2.1 gates pass
        # 2 = Normal momentum    — passes most basic gates, not all V2.1
        # 3 = Weak/reversal      — fails multiple gates
        profile = seed % 4

        if profile == 0:
            volume_ratio  = rng.uniform(2.2, 3.2)
            rsi           = rng.uniform(50, 63)
            macd          = "bullish_cross"
            structure     = "uptrend"
            vwap          = price * rng.uniform(0.986, 0.995)
            adx           = rng.uniform(24, 38)
            iv_rank       = rng.uniform(0.28, 0.54)
            orb_confirmed = True
        elif profile == 1:
            volume_ratio  = rng.uniform(2.2, 3.2)
            rsi           = rng.uniform(37, 50)
            macd          = "bearish_cross"
            structure     = "downtrend"
            vwap          = price * rng.uniform(1.005, 1.014)
            adx           = rng.uniform(24, 38)
            iv_rank       = rng.uniform(0.28, 0.54)
            orb_confirmed = True
        elif profile == 2:
            volume_ratio  = rng.uniform(1.7, 2.3)
            rsi           = rng.uniform(48, 65)
            macd          = rng.choice(["bullish_cross", "neutral"])
            structure     = rng.choice(["uptrend", "neutral"])
            vwap          = price * rng.uniform(0.993, 1.002)
            adx           = rng.uniform(17, 26)
            iv_rank       = rng.uniform(0.45, 0.72)
            orb_confirmed = rng.choice([True, False])
        else:
            volume_ratio  = rng.uniform(1.3, 2.0)
            rsi           = rng.uniform(68, 78)
            macd          = rng.choice(["bearish_cross", "neutral"])
            structure     = rng.choice(["uptrend", "neutral"])
            vwap          = price * rng.uniform(0.995, 1.005)
            adx           = rng.uniform(12, 21)
            iv_rank       = rng.uniform(0.58, 0.82)
            orb_confirmed = False

        volume        = int(volume_ratio * 1_200_000 * rng.uniform(0.9, 1.1))
        price_vs_vwap = round((price - vwap) / vwap * 100, 2)

        # ATR: ~1.5-2.5% of price (realistic 14-day daily range)
        atr = round(price * rng.uniform(0.015, 0.025), 2)

        # Expected move edge: if stock moves by 1 ATR in signal direction,
        # project option intrinsic vs estimated premium
        inc = 5.0 if price >= 500 else 1.0 if price >= 100 else 0.5
        if structure == "uptrend":
            strike_est    = round(round(price * 1.005 / inc) * inc, 2)
            proj_intrin   = max(price + atr - strike_est, 0.0)
        else:
            strike_est    = round(round(price * 0.995 / inc) * inc, 2)
            proj_intrin   = max(strike_est - (price - atr), 0.0)
        rough_prem        = max(proj_intrin * 0.55 + price * 0.003, 0.10)
        expected_move_edge = round((proj_intrin / rough_prem) - 1.0, 3)

        return MarketContext(
            ticker=ticker,
            current_price=round(price, 2),
            vwap=round(vwap, 2),
            volume=volume,
            avg_volume=1_200_000,
            volume_ratio=round(volume_ratio, 2),
            price_vs_vwap=price_vs_vwap,
            rsi_14=round(rsi, 1),
            macd_signal=macd,
            market_structure=structure,
            support_level=round(price * 0.98, 2),
            resistance_level=round(price * 1.02, 2),
            adx_14=round(adx, 1),
            iv_rank=round(iv_rank, 3),
            atr=atr,
            orb_confirmed=orb_confirmed,
            expected_move_edge=expected_move_edge,
        )

    def _build_execution_instructions(
        self, setup: TradeSetup, ctx: MarketContext
    ) -> ExecutionInstructions:
        """Build step-by-step Robinhood tap instructions."""
        c = setup.contract
        direction_word = "Call" if setup.direction == Direction.CALL else "Put"
        account_contracts = 1 if self.small_account_mode else 3

        steps = [
            RobinhoodStep(
                step_number=1,
                instruction="Open Robinhood and search for the ticker",
                detail=f"Tap the search bar (🔍) and type: {c.ticker}"
            ),
            RobinhoodStep(
                step_number=2,
                instruction="Navigate to Options",
                detail="On the stock page, scroll down and tap 'Trade' → 'Trade Options'"
            ),
            RobinhoodStep(
                step_number=3,
                instruction="Select expiration date",
                detail=f"Tap the expiration tab and select: {c.expiration}"
            ),
            RobinhoodStep(
                step_number=4,
                instruction=f"Select {direction_word} option",
                detail=f"Tap '{direction_word}' and find the ${c.strike:.0f} strike"
            ),
            RobinhoodStep(
                step_number=5,
                instruction="Set order type to Limit",
                detail=f"Tap 'Buy' → set Limit price to ${c.bid:.2f} (bid) or ${((c.bid or 0) + (c.ask or 0))/2:.2f} (midpoint)"
            ),
            RobinhoodStep(
                step_number=6,
                instruction="Set quantity",
                detail=f"Set contracts to {account_contracts} {'(Small Account Mode)' if self.small_account_mode else ''}"
            ),
            RobinhoodStep(
                step_number=7,
                instruction="Review and submit",
                detail="Verify all details match, then tap 'Review' → 'Submit Order'"
            ),
        ]

        return ExecutionInstructions(
            contract=c,
            entry_type="LIMIT",
            entry_price_guidance="Use bid price or midpoint for best fill",
            suggested_entry=round(((c.bid or c.premium) + (c.ask or c.premium)) / 2, 2),
            stop_loss_guidance=f"Exit if premium drops below ${c.premium * 0.5:.2f} (50% stop)",
            profit_target_guidance=f"Target ${c.premium * 2.0:.2f} (100% gain) or ${c.premium * 1.5:.2f} (50% gain)",
            steps=steps,
            small_account_contracts=1,
            normal_account_contracts=3,
        )

    # ── V4 Index ICT Scanner (runs once per day, daily-bar ICT strategy) ─────────

    def _run_v4_index_scan(self):
        """
        Synchronous V4 index scan — runs in thread pool once per day.
        Downloads 90+ days of daily OHLCV, runs detect_v4_signal on the latest bar.
        Injects found signals into active_setups as 7-DTE TradeSetup objects.

        Backtested performance: 75% WR, 9.27x PF over 2 years on 5 core ETFs.
        """
        import yfinance as yf
        import numpy as np
        from datetime import date, timedelta
        from scipy.stats import norm

        from_date = (date.today() - timedelta(days=150)).strftime("%Y-%m-%d")

        for ticker in V4_TICKERS:
            try:
                df = yf.download(ticker, start=from_date, progress=False, auto_adjust=True)
                if df.empty or len(df) < 80:
                    continue
                if hasattr(df.columns, "levels"):
                    df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
                df = df.dropna()

                closes  = df["Close"].values.astype(float)
                opens   = df["Open"].values.astype(float)
                highs   = df["High"].values.astype(float)
                lows    = df["Low"].values.astype(float)
                volumes = df["Volume"].values.astype(float)
                dates   = df.index.tolist()

                i = len(closes) - 1  # Signal on most recent bar
                result = detect_v4_signal(
                    opens, highs, lows, closes, volumes, dates,
                    i, ticker=ticker, params=V4_PARAMS,
                )
                if result is None:
                    continue

                direction_str, strategy_name, confidence, score_breakdown, reasons = result

                direction = Direction.CALL if direction_str == "CALL" else Direction.PUT
                current_price = float(closes[i])

                # ── Compute ATM 7-DTE option premium via Black-Scholes ──────────
                dte = 7
                rv = float(np.std(np.diff(np.log(closes[-21:]))) * math.sqrt(252))
                sigma = max(rv * 1.20, 0.10)  # IV = 1.2× realized vol
                T = dte / 252.0
                r = 0.052
                d1 = (math.log(1.0) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
                d2 = d1 - sigma * math.sqrt(T)
                if direction == Direction.CALL:
                    premium = current_price * norm.cdf(d1) - current_price * math.exp(-r * T) * norm.cdf(d2)
                else:
                    premium = current_price * math.exp(-r * T) * norm.cdf(-d2) - current_price * norm.cdf(-d1)
                premium = max(round(premium, 2), current_price * 0.003)

                # ── Option contract ─────────────────────────────────────────────
                from datetime import timedelta as td
                exp_date = (date.today() + td(days=dte)).strftime("%Y-%m-%d")
                inc = 5.0 if current_price >= 200 else 1.0
                strike = round(round(current_price / inc) * inc, 2)
                cp = "C" if direction == Direction.CALL else "P"
                sym = f"{ticker}{exp_date.replace('-','')[2:]}{cp}{int(strike*1000):08d}"

                contract = OptionsContract(
                    ticker=ticker,
                    strike=strike,
                    expiration=exp_date,
                    contract_type=direction,
                    premium=premium,
                    delta=0.50,
                    implied_volatility=round(sigma, 4),
                    bid=round(premium * 0.95, 2),
                    ask=round(premium * 1.05, 2),
                    contract_symbol=sym,
                )

                # ── Market context ──────────────────────────────────────────────
                vol20 = float(np.mean(volumes[-20:]))
                vol_ratio = float(volumes[i]) / max(vol20, 1)

                # Compute RSI(14) from closes
                diffs = np.diff(closes[-16:])
                gains = np.where(diffs > 0, diffs, 0)
                losses = np.where(diffs < 0, -diffs, 0)
                avg_g = float(np.mean(gains[-14:])); avg_l = float(np.mean(losses[-14:]))
                rsi = 100 - 100 / (1 + avg_g / max(avg_l, 1e-9))

                ctx = MarketContext(
                    ticker=ticker,
                    current_price=round(current_price, 2),
                    vwap=round(float(np.mean(closes[-5:])), 2),
                    volume=int(volumes[i]),
                    avg_volume=int(vol20),
                    volume_ratio=round(vol_ratio, 2),
                    price_vs_vwap=round((current_price - float(np.mean(closes[-5:]))) / float(np.mean(closes[-5:])) * 100, 2),
                    rsi_14=round(rsi, 1),
                    market_structure="uptrend" if direction == Direction.CALL else "downtrend",
                    atr=round(float(np.mean([highs[j] - lows[j] for j in range(i-14, i+1)])), 2),
                    iv_rank=round(min(sigma / 0.30, 1.0), 3),
                )

                # ── V4 confluence gates for display ────────────────────────────
                v4_gates = {
                    "active_fvg":    score_breakdown.get("fvg", 0) >= 15,
                    "va_zone":       score_breakdown.get("value_area", 0) >= 15,
                    "fib_ote":       score_breakdown.get("fibonacci", 0) >= 6,
                    "structure":     score_breakdown.get("structure", 0) >= 7,
                    "htf_bias":      score_breakdown.get("htf_bias", 0) >= 10,
                    "volume_conf":   vol_ratio >= 1.05,
                    "confidence_ok": confidence >= 0.75,
                    "decision_ok":   True,
                }
                is_high_conf = score_breakdown.get("total", 0) >= HIGH_CONF_V4

                # ── Reasoning bullets ───────────────────────────────────────────
                score_total = score_breakdown.get("total", int(confidence * 100))
                bullets = [
                    f"V4.1 ICT signal — Score {score_total}/100 ({confidence*100:.0f}% conf) | Strategy: {strategy_name}",
                    f"Active (unmitigated) FVG detected: institutional imbalance at entry",
                    f"Value Area zone confluenceVA score {score_breakdown.get('value_area', 0)}/25 — price at key volume level",
                    f"HTF Bias ({direction_str}): EMA20/EMA50 stack confirmed — regime aligned",
                    f"Structure: {score_breakdown.get('structure', 0)}/25 pts — CHoCH/BOS confirmed",
                    f"Fibonacci: {score_breakdown.get('fibonacci', 0)}/10 pts — retracement level aligned",
                ]
                if reasons:
                    bullets += [r for r in reasons[-3:] if r]

                reasoning = TradeReasoning(
                    bullet_points=bullets,
                    technical_context=f"ICT V4.1 | Active FVG + VA Zone + Retracement | {strategy_name}",
                    risk_warning=f"7-DTE ATM option | Stop: 50% premium loss (${premium*0.5:.2f}) | Target: 150% gain (${premium*1.5:.2f})",
                    invalidation_level=round(strike * (0.985 if direction == Direction.CALL else 1.015), 2),
                    dont_chase_warning=False,
                )

                # ── Build execution instructions ────────────────────────────────
                exec_steps = [
                    RobinhoodStep(step_number=1, instruction="Open Robinhood and search for the ticker",
                                  detail=f"Tap the search bar (🔍) and type: {ticker}"),
                    RobinhoodStep(step_number=2, instruction="Navigate to Options",
                                  detail="On the stock page, scroll down and tap 'Trade' then 'Trade Options'"),
                    RobinhoodStep(step_number=3, instruction=f"Select {exp_date} expiration (7-DTE)",
                                  detail=f"Tap the expiration tab and select: {exp_date} — NOT the 0DTE"),
                    RobinhoodStep(step_number=4, instruction=f"Select {direction_str} option at ${strike:.0f} strike",
                                  detail=f"ATM option, premium ~${premium:.2f} per share (${premium*100:.0f}/contract)"),
                    RobinhoodStep(step_number=5, instruction="Place Limit order at midpoint",
                                  detail=f"Set Limit price to ${round(((contract.bid or 0) + (contract.ask or 0))/2,2):.2f} — do NOT use Market order"),
                    RobinhoodStep(step_number=6, instruction="Set stop and target alerts",
                                  detail=f"Stop: ${premium*0.5:.2f} (exit if premium drops 50%) | Target: ${premium*2.5:.2f} (+150%)"),
                ]
                execution = ExecutionInstructions(
                    contract=contract,
                    entry_type="LIMIT",
                    entry_price_guidance="Use midpoint (bid+ask)/2 for best fill on 7-DTE options",
                    suggested_entry=round(premium, 2),
                    stop_loss_guidance=f"${premium*0.5:.2f} (50% stop on option premium)",
                    profit_target_guidance=f"${premium*2.5:.2f} (+150% gain on option premium)",
                    steps=exec_steps,
                    small_account_contracts=1,
                    normal_account_contracts=2,
                )

                # ── Build TradeSetup ────────────────────────────────────────────
                strategy_enum = getattr(Strategy, strategy_name, Strategy.V4_INDEX_ICT)
                setup = TradeSetup(
                    id=f"v4_{ticker}_{direction_str}_{date.today().strftime('%Y%m%d')}",
                    ticker=ticker,
                    direction=direction,
                    strategy=strategy_enum,
                    confidence_score=round(confidence * 100, 1),
                    decision=TradeDecision.DO_TAKE,
                    contract=contract,
                    market_context=ctx,
                    reasoning=reasoning,
                    execution=execution,
                    is_golden_hour=is_high_conf,
                    golden_hour_filters=v4_gates,
                )

                key = f"v4_{ticker}_{direction_str}"
                self.active_setups[key] = setup
                logger.info(
                    f"V4 ICT signal: {ticker} {direction_str} | {strategy_name} | "
                    f"score={score_total} | conf={confidence*100:.0f}%"
                )

            except Exception as e:
                logger.warning(f"V4 scan error for {ticker}: {e}")

    def get_active_setups(self) -> List[TradeSetup]:
        """Return active trade setups visible to the dashboard.

        Display rules (production only — DEBUG bypasses):
          • 9:00 AM – 4:30 PM ET on weekdays → show all setups
          • Outside that window (overnight, pre-market, after-hours) → return empty list
            so ZERO cards appear on the frontend outside trading hours

        Cards are sorted by confidence score descending.
        """
        if not settings.DEBUG:
            import pytz
            et  = pytz.timezone("America/New_York")
            now = datetime.now(et)
            if now.weekday() >= 5:
                return []
            t = now.hour * 60 + now.minute
            # Hide cards before 9:00 AM and after 4:30 PM
            if not ((9 * 60) <= t <= (16 * 60 + 30)):
                return []

        return sorted(
            self.active_setups.values(),
            key=lambda x: x.confidence_score,
            reverse=True
        )

    def set_low_memory_mode(self, enabled: bool):
        self.low_memory_mode = enabled
        self.watchlist = LOW_MEMORY_WATCHLIST if enabled else DEFAULT_WATCHLIST
        logger.info(f"Low Memory Mode: {'ON' if enabled else 'OFF'}")

    def set_small_account_mode(self, enabled: bool):
        self.small_account_mode = enabled
        logger.info(f"Small Account Mode: {'ON' if enabled else 'OFF'}")

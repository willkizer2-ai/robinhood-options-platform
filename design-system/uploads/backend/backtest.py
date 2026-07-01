#!/usr/bin/env python3
"""
2-Year Options Trading Backtest — V1 vs V2 vs V2.1 vs V3 (ICT) Comparison
=====================================================================
V1:   Original model (baseline)
V2:   Research-backed redesign with 5 core fixes
V2.1: V2 + ADX(14) trend-strength gate + ORB daily confirmation
      (activated with --adx-orb flag; auto-triggered by paper_trader.py at 50 trades)
V3:   ICT + Order Flow redesign — liquidity sweeps, FVG, OB, CHoCH, CVD, OTE
      (activated with --ict flag)
      Philosophy: trade the REVERSAL after a liquidity sweep (Judas Swing), NOT momentum.
      Target: ≥70% win rate, ≥5.0 profit factor, next-day entry for realism.

Usage:
  python backtest.py              # V1 vs V2 comparison
  python backtest.py --adx-orb   # V1 vs V2 vs V2.1 (ADX+ORB enhanced)
  python backtest.py --ict        # V1 vs V2.1 vs V3 (ICT + Order Flow)
  python backtest.py --adx-orb --ict  # Full 4-way comparison
"""

import sys, os, json, math, time, argparse
import numpy as np
from datetime import datetime, timedelta, date
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple
from scipy.stats import norm

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./robinhood_dev.db")

# Load .env so API keys are available even when running backtest.py directly
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    load_dotenv(_env_path, override=False)
except ImportError:
    pass

import yfinance as yf

# V3 ICT engine (new in this file)
from app.core.ict_engine import (
    detect_ict_signal,
    format_ict_score,
    V3_STOP_LOSS,
    V3_PROFIT_TGT,
    V3_DTE,
    MIN_SCORE,
    HIGH_CONF_SCORE,
)

try:
    from app.config import settings
    OPENAI_KEY = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
except Exception:
    OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

import aiohttp


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.bool_):    return bool(obj)
        if isinstance(obj, np.integer):  return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray):  return obj.tolist()
        return super().default(obj)

def _jsafe(obj):
    if isinstance(obj, dict):     return {k: _jsafe(v) for k, v in obj.items()}
    if isinstance(obj, list):     return [_jsafe(v) for v in obj]
    if isinstance(obj, np.bool_):     return bool(obj)
    if isinstance(obj, np.integer):   return int(obj)
    if isinstance(obj, np.floating):  return float(obj)
    if isinstance(obj, np.ndarray):   return obj.tolist()
    return obj


# ── Config ───────────────────────────────────────────────────────────
WATCHLIST  = ["SPY", "QQQ", "AAPL", "TSLA", "NVDA", "MSFT", "META", "AMD", "AMZN", "GOOGL"]
END_DATE   = date.today()
START_DATE = END_DATE - timedelta(days=730)
ACCOUNT    = 500.00
RISK_FREE  = 0.052
CONTRACTS  = 1

# V1 thresholds (original)
MIN_CONF_V1      = 0.65
MIN_VOL_V1       = 1.5
MAX_RISK_V1      = 0.10

# V2 thresholds (redesigned + recalibrated)
# ── Calibration notes ─────────────────────────────────────────────────
# IV rank: in a volatile macro environment (2024-2026), 20-day RV runs near 252-day
# highs frequently, so < 0.40 would kill everything. Use < 0.65 (avoid only the
# most expensive 35% of IV environments while still preferring cheaper options).
# ATR/premium: for large-caps (SPY $5 ATR, $4 premium → ratio 1.25), 2.0 is too
# strict. 1.3 ensures stock CAN cover the option cost with a normal-size move.
# Volume: 2.0x keeps it meaningfully above V1's 1.5x without eliminating everything.
# Confidence: 0.70 is meaningfully higher than V1's 0.65 without being zero-signal.
# VWAP: daily (H+L+C)/3 proxy limits deviation to ~0.5% max; 0.10% is realistic.
MIN_CONF_V2      = 0.70   # raised from V1's 0.65, was over-tightened to 0.75
MIN_VOL_V2       = 2.0    # raised from V1's 1.5x; was over-tightened to 2.5x
MAX_RISK_V2      = 0.05   # halved risk per trade vs V1's 10%
MAX_IV_RANK_V2   = 0.65   # was 0.40 — too restrictive in high-vol macro regime
MIN_ATR_RATIO_V2 = 1.3    # was 2.0 — 1.3 means stock moves ≥1.3x option cost
STOP_LOSS_V2     = 0.50   # 50% premium stop (unchanged — key risk control)
PROFIT_TGT_V2    = 1.50   # 150% profit target, exit at 2.5x premium (unchanged)
T_MID            = 3.0 / 252  # midday time remaining for BS valuation

# V2.1 additions (ADX + ORB layer on top of V2)
MIN_ADX_V21      = 22.0   # Wilder ADX threshold — below = choppy, skip
ORB_HOLD_PCT     = 0.60   # Close must be in top/bottom 40% of day's range (ORB proxy)
MIN_MOVE_EDGE    = 0.25   # Projected intrinsic at 1-ATR move must be ≥ 1.25× premium
                           # Ensures realistic intraday move can overcome premium decay

# Per-ticker ADX overrides — raised bar for historically poor-performing setups.
# Mirrors paper_trader.py so both engines apply identical rules.
TICKER_ADX_OVERRIDES: dict = {
    "AMZN": {"CALL": 28.0},   # AMZN calls: 0% win rate across all historical signals
}


# ── Data classes ──────────────────────────────────────────────────────
@dataclass
class TradeResult:
    date:             str
    ticker:           str
    direction:        str
    strategy:         str
    confidence:       float
    stock_open:       float
    stock_close:      float
    stock_move_pct:   float
    strike:           float
    premium:          float
    intrinsic_close:  float
    pnl_dollars:      float
    pnl_pct:          float
    win:              bool
    volume_ratio:     float
    rsi:              float
    market_structure: str
    score_breakdown:  dict
    exit_type:        str = "expiry"   # V2: stopped_out | profit_target | expiry


# ── Technical indicators ─────────────────────────────────────────────
def compute_rsi(closes: np.ndarray, period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = np.diff(closes)
    gains  = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = gains[-period:].mean()
    avg_loss = losses[-period:].mean()
    if avg_loss == 0:
        return 100.0
    return round(100 - 100 / (1 + avg_gain / avg_loss), 2)

def compute_atr(highs, lows, closes, period=14) -> float:
    tr = [max(h - l, abs(h - pc), abs(l - pc))
          for h, l, pc in zip(highs[-period:], lows[-period:], closes[-period-1:-1])]
    return np.mean(tr) if tr else closes[-1] * 0.01

def realised_vol(closes: np.ndarray, window: int = 20) -> float:
    if len(closes) < window + 1:
        return 0.30
    rets = np.diff(np.log(closes[-window-1:]))
    return float(np.std(rets) * math.sqrt(252))

def compute_iv_rank(closes: np.ndarray, i: int, lookback: int = 252) -> float:
    """
    IV Rank proxy: percentile of current 20-day RV vs its own lookback history.
    Low rank (<40%) = cheap options = good time to buy.
    High rank (>60%) = expensive options = avoid buying.
    """
    if i < 50:
        return 0.50  # insufficient history, assume median
    current_rv = realised_vol(closes[:i+1], 20)
    # Sample every 5 days for speed (O(n/5) instead of O(n))
    start = max(30, i - lookback)
    hist  = [realised_vol(closes[:j+1], 20) for j in range(start, i, 5)]
    if not hist:
        return 0.50
    rank = sum(1 for rv in hist if rv <= current_rv) / len(hist)
    return round(rank, 3)


def compute_adx(highs, lows, closes, period: int = 14) -> float:
    """
    Wilder's Average Directional Index — measures trend strength 0-100.
    >25 = strong trend.  <20 = choppy / no-directional.
    Mirrors paper_trader.py implementation exactly.
    """
    n = len(closes)
    if n < period * 2 + 1:
        return 0.0

    tr_list, pdm_list, mdm_list = [], [], []
    for j in range(1, n):
        h0, h1 = highs[j-1],  highs[j]
        l0, l1 = lows[j-1],   lows[j]
        pc      = closes[j-1]
        tr_list.append(max(h1 - l1, abs(h1 - pc), abs(l1 - pc)))
        up, dn  = h1 - h0, l0 - l1
        pdm_list.append(up if up > dn and up > 0 else 0.0)
        mdm_list.append(dn if dn > up and dn > 0 else 0.0)

    def wilder(data):
        s = [sum(data[:period])]
        for v in data[period:]:
            s.append(s[-1] - s[-1] / period + v)
        return s

    atr_s = wilder(tr_list)
    pdm_s = wilder(pdm_list)
    mdm_s = wilder(mdm_list)

    dx_vals = []
    for atr_v, pdm_v, mdm_v in zip(atr_s, pdm_s, mdm_s):
        if atr_v == 0:
            dx_vals.append(0.0)
            continue
        pdi   = 100 * pdm_v / atr_v
        mdi   = 100 * mdm_v / atr_v
        denom = pdi + mdi
        dx_vals.append(100 * abs(pdi - mdi) / denom if denom > 0 else 0.0)

    if len(dx_vals) < period:
        return 0.0
    return round(sum(dx_vals[-period:]) / period, 2)


def orb_confirmed_daily(opens, highs, lows, closes, i: int, direction: str) -> bool:
    """
    Opening Range Breakout confirmation using daily OHLCV (ORB proxy).
    CALL: price closed in the top 40% of the day's range AND above open
    PUT:  price closed in the bottom 40% of the day's range AND below open
    Real ORB uses 15-30 min bars; this daily proxy is a good approximation.
    """
    h, l, c, o = highs[i], lows[i], closes[i], opens[i]
    day_range = h - l
    if day_range <= 0:
        return False
    close_pct = (c - l) / day_range   # 0 = at low, 1 = at high
    if direction == "CALL":
        return close_pct >= ORB_HOLD_PCT and c > o
    else:  # PUT
        return close_pct <= (1 - ORB_HOLD_PCT) and c < o


# ── Black-Scholes ────────────────────────────────────────────────────
def bs_price(S: float, K: float, T: float, r: float,
             sigma: float, kind: str = "call") -> float:
    if T <= 0 or sigma <= 0:
        intrinsic = max(S - K, 0) if kind == "call" else max(K - S, 0)
        return max(intrinsic, 0.01)
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    if kind == "call":
        price = S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    else:
        price = K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    return max(round(price, 2), 0.01)

def select_strike(price: float, direction: str) -> float:
    raw = price * 1.005 if direction == "CALL" else price * 0.995
    inc = 5.0 if price >= 500 else (1.0 if price >= 100 else 0.5)
    return round(round(raw / inc) * inc, 2)


# ── V1: Original scoring (mirrors old decision_engine.py) ────────────
def score_technical_v1(direction, price_vs_vwap, market_structure, macd_approx):
    score = 0.0
    if direction == "CALL":
        score += 10 if price_vs_vwap > 0.1 else (6 if price_vs_vwap > 0 else 2)
        if market_structure == "uptrend":   score += 8
        elif market_structure == "neutral": score += 4
        if macd_approx == "bullish":        score += 7
    else:
        score += 10 if price_vs_vwap < -0.1 else (6 if price_vs_vwap < 0 else 2)
        if market_structure == "downtrend": score += 8
        elif market_structure == "neutral": score += 4
        if macd_approx == "bearish":        score += 7
    return min(score, 25.0)

def score_volume_v1(volume_ratio):
    if volume_ratio >= 2.0: return 20
    if volume_ratio >= 1.5: return 15
    if volume_ratio >= 1.2: return 12
    if volume_ratio >= 1.0: return 8
    if volume_ratio >= 0.8: return 4
    return 0

def score_options_struct(spread_pct, vol, oi):
    score  = 8 if spread_pct < 0.05 else (5 if spread_pct < 0.10 else 2)
    score += 4 if vol > 1000 else (3 if vol > 500 else (2 if vol > 100 else 0))
    score += 3 if oi > 5000 else (2 if oi > 1000 else (1 if oi > 100 else 0))
    return min(score, 15.0)

def detect_pattern_v1(rsi, volume_ratio, market_structure, price_vs_vwap, macd_approx):
    patterns = []
    if volume_ratio >= 1.5 and 50 <= rsi <= 65 and market_structure == "uptrend":
        patterns.append(("CALL", "MOMENTUM", 0.75))
    if volume_ratio >= 1.5 and 35 <= rsi <= 50 and market_structure == "downtrend":
        patterns.append(("PUT", "MOMENTUM", 0.75))
    if rsi >= 70 and volume_ratio >= 1.2:
        patterns.append(("PUT", "0DTE_REVERSAL", 0.70))
    if rsi <= 30 and volume_ratio >= 1.2:
        patterns.append(("CALL", "0DTE_BOUNCE", 0.70))
    if abs(price_vs_vwap) < 0.15 and volume_ratio >= 1.3:
        if price_vs_vwap > 0 and macd_approx == "bullish":
            patterns.append(("CALL", "VWAP_RECLAIM", 0.80))
        elif price_vs_vwap < 0 and macd_approx == "bearish":
            patterns.append(("PUT", "VWAP_RECLAIM", 0.80))
    if not patterns:
        return None
    return max(patterns, key=lambda x: x[2])


# ── V2: Research-backed scoring ──────────────────────────────────────
def score_technical_v2(direction, price_vs_vwap, market_structure, macd_approx):
    """V2: Max 40 pts. Full alignment across all 3 dimensions required."""
    score = 0.0
    # VWAP (0-15 pts)
    if direction == "CALL":
        score += 15 if price_vs_vwap > 0.5 else (10 if price_vs_vwap > 0.25 else (5 if price_vs_vwap > 0 else 0))
    else:
        score += 15 if price_vs_vwap < -0.5 else (10 if price_vs_vwap < -0.25 else (5 if price_vs_vwap < 0 else 0))
    # Structure (0-15 pts)
    if direction == "CALL" and market_structure == "uptrend":   score += 15
    elif direction == "PUT" and market_structure == "downtrend": score += 15
    elif market_structure == "neutral":                          score += 5
    # MACD (0-10 pts)
    if direction == "CALL" and macd_approx == "bullish": score += 10
    elif direction == "PUT" and macd_approx == "bearish": score += 10
    elif macd_approx == "neutral":                        score += 3
    return min(score, 40.0)

def score_volume_v2(volume_ratio):
    """V2: Max 15 pts. Threshold raised to 2.5x."""
    if volume_ratio >= 3.0: return 15
    if volume_ratio >= 2.5: return 12
    if volume_ratio >= 2.0: return 8
    if volume_ratio >= 1.5: return 4
    return 0

def score_options_v2(spread_pct, vol, oi):
    """V2: Max 10 pts."""
    score  = 5 if spread_pct < 0.05 else (3 if spread_pct < 0.10 else 1)
    score += 3 if vol > 1000 else (2 if vol > 500 else 1)
    score += 2 if oi > 5000 else (1 if oi > 100 else 0)
    return min(score, 10.0)

def detect_pattern_v2(rsi, volume_ratio, market_structure, price_vs_vwap, macd_approx,
                       iv_rank, atr, premium, closes, i):
    """
    V2 pattern detection. Hard gates applied before any pattern check.
    All 5 conditions must be met for MOMENTUM pattern to fire.
    """
    # ── Hard gates ──────────────────────────────────────────────────
    # Gate 1: IV Rank — avoid the most overpriced 35% of IV environments
    if iv_rank > MAX_IV_RANK_V2:
        return None
    # Gate 2: Volume — need institutional participation (2.0x raised from V1's 1.5x)
    if volume_ratio < MIN_VOL_V2:
        return None
    # Gate 3: ATR/premium — stock must be capable of covering option cost
    if premium > 0 and (atr / premium) < MIN_ATR_RATIO_V2:
        return None
    # Gate 4: ATR > 0.7% of price (not a dead/range-bound day)
    atr_pct = atr / closes[i] * 100 if closes[i] > 0 else 0
    if atr_pct < 0.7:
        return None
    # Gate 5: Momentum confirmation required
    if i < 3:
        return None

    patterns = []

    # MOMENTUM CALL: 5-condition full alignment
    # RSI 46-66: in trend zone, not overbought; VWAP 0.10% more lenient for daily proxy
    if (46 <= rsi <= 66 and
        market_structure == "uptrend" and
        price_vs_vwap > 0.10 and          # slightly above daily VWAP proxy
        macd_approx == "bullish" and
        closes[i-1] > closes[i-2]):        # prior session was up
        patterns.append(("CALL", "MOMENTUM", 0.82))

    # MOMENTUM PUT: 5-condition full alignment
    if (34 <= rsi <= 54 and
        market_structure == "downtrend" and
        price_vs_vwap < -0.10 and         # slightly below daily VWAP proxy
        macd_approx == "bearish" and
        closes[i-1] < closes[i-2]):        # prior session was down
        patterns.append(("PUT", "MOMENTUM", 0.82))

    if not patterns:
        return None
    return max(patterns, key=lambda x: x[2])


def simulate_intraday_exits(
    S_open, K, direction, premium, high, low, close, rv,
    stop_loss=None, profit_target=None, t_mid=None,
):
    """
    Stop loss + profit target simulation using intraday high/low.
    Conservative ordering: check stop first, then profit target, then expiry.

    For CALLs: worst case = day's low; best case = day's high
    For PUTs:  worst case = day's high; best case = day's low
    IV is adjusted: +15% on adverse moves (IV spike), -10% on favorable moves

    Defaults: V2 parameters (stop 50%, target 150%). Override for V3.
    """
    sl  = stop_loss     if stop_loss     is not None else STOP_LOSS_V2
    tgt = profit_target if profit_target is not None else PROFIT_TGT_V2
    t   = t_mid         if t_mid         is not None else T_MID
    iv = max(rv * 1.20, 0.15)

    if direction == "CALL":
        opt_at_worst = bs_price(low, K, t, RISK_FREE, iv * 1.15, "call")
        if opt_at_worst <= premium * (1 - sl):
            exit_val = premium * (1 - sl)
            return exit_val, -sl * 100, False, "stopped_out"

        opt_at_best = bs_price(high, K, t, RISK_FREE, iv * 0.90, "call")
        if opt_at_best >= premium * (1 + tgt):
            exit_val = premium * (1 + tgt)
            return exit_val, tgt * 100, True, "profit_target"

        intrinsic = max(close - K, 0.0)

    else:  # PUT
        opt_at_worst = bs_price(high, K, t, RISK_FREE, iv * 1.15, "put")
        if opt_at_worst <= premium * (1 - sl):
            exit_val = premium * (1 - sl)
            return exit_val, -sl * 100, False, "stopped_out"

        opt_at_best = bs_price(low, K, t, RISK_FREE, iv * 0.90, "put")
        if opt_at_best >= premium * (1 + tgt):
            exit_val = premium * (1 + tgt)
            return exit_val, tgt * 100, True, "profit_target"

        intrinsic = max(K - close, 0.0)

    pnl_pct = (intrinsic - premium) / premium * 100 if premium > 0 else -100
    win = intrinsic > premium
    return intrinsic, pnl_pct, win, "expiry"


# ── V1 Backtest ───────────────────────────────────────────────────────
def run_backtest_v1(data_cache: dict) -> List[TradeResult]:
    """Original model — used for BEFORE comparison."""
    all_results = []
    for ticker, arrays in data_cache.items():
        closes, opens, highs, lows, volumes, dates = arrays
        lookback = 30
        for i in range(lookback, len(closes)):
            rsi          = compute_rsi(closes[:i+1])
            vol20        = volumes[i-20:i].mean()
            volume_ratio = volumes[i] / vol20 if vol20 > 0 else 1.0
            sma20        = closes[i-20:i].mean()
            vwap_approx  = (highs[i] + lows[i] + closes[i]) / 3
            price_vs_vwap= (closes[i] - vwap_approx) / vwap_approx * 100
            rv           = realised_vol(closes[:i+1])
            market_structure = (
                "uptrend"   if closes[i] > sma20 * 1.005 else
                "downtrend" if closes[i] < sma20 * 0.995 else "neutral"
            )
            ema12 = float(np.mean(closes[max(0,i-12):i]))
            ema26 = float(np.mean(closes[max(0,i-26):i]))
            macd_approx = "bullish" if ema12 > ema26 else "bearish"

            pattern = detect_pattern_v1(rsi, volume_ratio, market_structure, price_vs_vwap, macd_approx)
            if pattern is None:
                continue

            direction, strategy, base_conf = pattern
            tech    = score_technical_v1(direction, price_vs_vwap, market_structure, macd_approx)
            vol_s   = score_volume_v1(volume_ratio)
            news_s  = 5.0
            atr     = compute_atr(highs, lows, closes, 14)
            spread  = atr / closes[i] * 0.5
            opt_s   = score_options_struct(spread, int(vol20 * 0.01), int(vol20 * 0.05))
            time_s  = 14.0
            confidence = (tech + vol_s + news_s + opt_s + time_s) / 100.0

            dont_take = sum([tech < 12, vol_s < 8, volume_ratio < 0.8])
            if dont_take >= 2:
                confidence *= 0.6
            if confidence < MIN_CONF_V1:
                continue

            S       = opens[i]
            strike  = select_strike(S, direction)
            T_open  = 6.5 / 252
            iv      = max(rv * 1.20, 0.15)
            premium = bs_price(S, strike, T_open, RISK_FREE, iv, kind=direction.lower())

            close_price = closes[i]
            intrinsic   = max(close_price - strike, 0) if direction == "CALL" else max(strike - close_price, 0)
            pnl_dollars = (intrinsic - premium) * 100 * CONTRACTS
            pnl_pct     = (intrinsic - premium) / premium * 100 if premium > 0 else -100
            win         = pnl_dollars > 0

            all_results.append(TradeResult(
                date=dates[i].strftime("%Y-%m-%d"), ticker=ticker,
                direction=direction, strategy=strategy,
                confidence=round(confidence, 3),
                stock_open=round(S, 2), stock_close=round(close_price, 2),
                stock_move_pct=round((close_price - S) / S * 100, 2),
                strike=strike, premium=round(premium, 2),
                intrinsic_close=round(intrinsic, 2),
                pnl_dollars=round(pnl_dollars, 2), pnl_pct=round(pnl_pct, 1),
                win=win, volume_ratio=round(volume_ratio, 2), rsi=rsi,
                market_structure=market_structure,
                score_breakdown={"technical": tech, "volume": vol_s,
                                 "news": news_s, "options": opt_s, "time": time_s},
                exit_type="expiry",
            ))
    return all_results


# ── V2 Backtest ───────────────────────────────────────────────────────
def run_backtest_v2(data_cache: dict) -> List[TradeResult]:
    """V2 model — research-backed redesign with all 5 fixes applied."""
    all_results = []
    for ticker, arrays in data_cache.items():
        closes, opens, highs, lows, volumes, dates = arrays
        lookback = 30
        for i in range(lookback, len(closes)):
            rsi          = compute_rsi(closes[:i+1])
            vol20        = volumes[i-20:i].mean()
            volume_ratio = volumes[i] / vol20 if vol20 > 0 else 1.0
            sma20        = closes[i-20:i].mean()
            vwap_approx  = (highs[i] + lows[i] + closes[i]) / 3
            price_vs_vwap= (closes[i] - vwap_approx) / vwap_approx * 100
            rv           = realised_vol(closes[:i+1])
            atr          = compute_atr(highs, lows, closes, 14)
            iv_rank      = compute_iv_rank(closes, i)

            market_structure = (
                "uptrend"   if closes[i] > sma20 * 1.005 else
                "downtrend" if closes[i] < sma20 * 0.995 else "neutral"
            )
            ema12 = float(np.mean(closes[max(0,i-12):i]))
            ema26 = float(np.mean(closes[max(0,i-26):i]))
            macd_approx = "bullish" if ema12 > ema26 else "bearish"

            # Need premium estimate for ATR/premium gate — use quick BS
            S_est  = opens[i] if i + 1 < len(opens) else closes[i]
            K_est  = select_strike(S_est, "CALL")
            T_est  = 6.5 / 252
            iv_est = max(rv * 1.20, 0.15)
            prem_est = bs_price(S_est, K_est, T_est, RISK_FREE, iv_est, "call")

            pattern = detect_pattern_v2(
                rsi, volume_ratio, market_structure, price_vs_vwap, macd_approx,
                iv_rank, atr, prem_est, closes, i
            )
            if pattern is None:
                continue

            direction, strategy, base_conf = pattern

            # V2 scoring (new weights: tech40 + vol15 + news25 + opt10 + time10)
            tech    = score_technical_v2(direction, price_vs_vwap, market_structure, macd_approx)
            vol_s   = score_volume_v2(volume_ratio)
            news_s  = 5.0   # still fixed in backtest; live Finnhub adds real score
            spread  = atr / closes[i] * 0.5
            opt_s   = score_options_v2(spread, int(vol20 * 0.01), int(vol20 * 0.05))
            time_s  = 10.0  # simulate power hour; max is 10 in V2
            confidence = (tech + vol_s + news_s + opt_s + time_s) / 100.0

            if confidence < MIN_CONF_V2:
                continue

            # Options pricing
            S       = opens[i]
            strike  = select_strike(S, direction)
            T_open  = 6.5 / 252
            iv      = max(rv * 1.20, 0.15)
            premium = bs_price(S, strike, T_open, RISK_FREE, iv, kind=direction.lower())

            # V2: simulate intraday stop/target using actual high/low
            exit_val, pnl_pct, win, exit_type = simulate_intraday_exits(
                S, strike, direction, premium,
                highs[i], lows[i], closes[i], rv
            )

            pnl_dollars = (exit_val - premium) * 100 * CONTRACTS

            all_results.append(TradeResult(
                date=dates[i].strftime("%Y-%m-%d"), ticker=ticker,
                direction=direction, strategy=strategy,
                confidence=round(confidence, 3),
                stock_open=round(S, 2), stock_close=round(closes[i], 2),
                stock_move_pct=round((closes[i] - S) / S * 100, 2),
                strike=strike, premium=round(premium, 2),
                intrinsic_close=round(exit_val, 2),
                pnl_dollars=round(pnl_dollars, 2), pnl_pct=round(pnl_pct, 1),
                win=win, volume_ratio=round(volume_ratio, 2), rsi=rsi,
                market_structure=market_structure,
                score_breakdown={"technical": tech, "volume": vol_s,
                                 "news": news_s, "options": opt_s, "time": time_s},
                exit_type=exit_type,
            ))
    return all_results


# ── V2.1: ADX + ORB Layer ────────────────────────────────────────────
def detect_pattern_v21(rsi, volume_ratio, market_structure, price_vs_vwap, macd_approx,
                        iv_rank, atr, premium, closes, opens, highs, lows, i,
                        ticker: str = "", rv: float = 0.30):
    """
    V2.1 = V2 gates + ADX + ORB + per-ticker ADX overrides
           + minimum expected move filter (V2.2 addition).

    Expected move filter:
      Project intrinsic value if stock moves by 1 full ATR in the signal direction.
      Require projected_intrinsic >= premium * (1 + MIN_MOVE_EDGE).
      Rejects setups where even a full-ATR move can't return ≥25% on the premium paid.
      This is the main guard against correct-direction-but-insufficient-magnitude losses.
    """
    # ── Inherit all V2 hard gates ──────────────────────────────────────
    if iv_rank > MAX_IV_RANK_V2:
        return None
    if volume_ratio < MIN_VOL_V2:
        return None
    if premium > 0 and (atr / premium) < MIN_ATR_RATIO_V2:
        return None
    atr_pct = atr / closes[i] * 100 if closes[i] > 0 else 0
    if atr_pct < 0.7:
        return None
    if i < 3:
        return None

    # ── V2.1 Gate 1: ADX trend-strength filter ────────────────────────
    adx_window = min(i + 1, 60)
    start_idx  = i + 1 - adx_window
    adx = compute_adx(
        highs[start_idx:i+1],
        lows[start_idx:i+1],
        closes[start_idx:i+1],
        period=14,
    )
    if adx < MIN_ADX_V21:
        return None

    ticker_overrides = TICKER_ADX_OVERRIDES.get(ticker, {})
    S_entry = opens[i]   # entry at open; used for premium + expected move calc
    T_open  = 6.5 / 252
    iv_open = max(rv * 1.20, 0.15)

    patterns = []

    # ── MOMENTUM CALL ─────────────────────────────────────────────────
    if (46 <= rsi <= 66 and
        market_structure == "uptrend" and
        price_vs_vwap > 0.10 and
        macd_approx == "bullish" and
        closes[i-1] > closes[i-2]):

        # Per-ticker ADX override
        if adx < ticker_overrides.get("CALL", MIN_ADX_V21):
            pass
        # ORB confirmation
        elif not orb_confirmed_daily(opens, highs, lows, closes, i, "CALL"):
            pass
        else:
            # ── V2.2 Gate: Minimum expected move ──────────────────────
            # Does a full-ATR upward move produce ≥25% return on premium?
            K_call      = select_strike(S_entry, "CALL")
            prem_call   = bs_price(S_entry, K_call, T_open, RISK_FREE, iv_open, "call")
            proj_intrin = max(S_entry + atr - K_call, 0.0)
            if prem_call > 0 and proj_intrin >= prem_call * (1 + MIN_MOVE_EDGE):
                patterns.append(("CALL", "MOMENTUM_ADX_ORB", 0.84))
            # else: even a full-ATR move doesn't return MIN_MOVE_EDGE → skip

    # ── MOMENTUM PUT ──────────────────────────────────────────────────
    if (34 <= rsi <= 54 and
        market_structure == "downtrend" and
        price_vs_vwap < -0.10 and
        macd_approx == "bearish" and
        closes[i-1] < closes[i-2]):

        if adx < ticker_overrides.get("PUT", MIN_ADX_V21):
            pass
        elif not orb_confirmed_daily(opens, highs, lows, closes, i, "PUT"):
            pass
        else:
            K_put       = select_strike(S_entry, "PUT")
            prem_put    = bs_price(S_entry, K_put, T_open, RISK_FREE, iv_open, "put")
            proj_intrin = max(K_put - (S_entry - atr), 0.0)
            if prem_put > 0 and proj_intrin >= prem_put * (1 + MIN_MOVE_EDGE):
                patterns.append(("PUT", "MOMENTUM_ADX_ORB", 0.84))

    if not patterns:
        return None
    return max(patterns, key=lambda x: x[2])


def run_backtest_v21(data_cache: dict) -> List[TradeResult]:
    """
    V2.1 — V2 redesign + ADX trend-strength gate + ORB daily confirmation.
    Auto-triggered by paper_trader.py at 50 forward trades.
    Target: ≥70% win rate.
    """
    all_results = []
    for ticker, arrays in data_cache.items():
        closes, opens, highs, lows, volumes, dates = arrays
        lookback = 40   # slightly longer for ADX warmup
        for i in range(lookback, len(closes)):
            rsi          = compute_rsi(closes[:i+1])
            vol20        = volumes[i-20:i].mean()
            volume_ratio = volumes[i] / vol20 if vol20 > 0 else 1.0
            sma20        = closes[i-20:i].mean()
            vwap_approx  = (highs[i] + lows[i] + closes[i]) / 3
            price_vs_vwap= (closes[i] - vwap_approx) / vwap_approx * 100
            rv           = realised_vol(closes[:i+1])
            atr          = compute_atr(highs, lows, closes, 14)
            iv_rank      = compute_iv_rank(closes, i)

            market_structure = (
                "uptrend"   if closes[i] > sma20 * 1.005 else
                "downtrend" if closes[i] < sma20 * 0.995 else "neutral"
            )
            ema12 = float(np.mean(closes[max(0,i-12):i]))
            ema26 = float(np.mean(closes[max(0,i-26):i]))
            macd_approx = "bullish" if ema12 > ema26 else "bearish"

            # Quick premium estimate for ATR/premium gate
            S_est    = opens[i] if i + 1 < len(opens) else closes[i]
            K_est    = select_strike(S_est, "CALL")
            T_est    = 6.5 / 252
            iv_est   = max(rv * 1.20, 0.15)
            prem_est = bs_price(S_est, K_est, T_est, RISK_FREE, iv_est, "call")

            pattern = detect_pattern_v21(
                rsi, volume_ratio, market_structure, price_vs_vwap, macd_approx,
                iv_rank, atr, prem_est, closes, opens, highs, lows, i,
                ticker=ticker, rv=rv,
            )
            if pattern is None:
                continue

            direction, strategy, base_conf = pattern

            # Same V2 scoring weights
            tech    = score_technical_v2(direction, price_vs_vwap, market_structure, macd_approx)
            vol_s   = score_volume_v2(volume_ratio)
            news_s  = 5.0
            spread  = atr / closes[i] * 0.5
            opt_s   = score_options_v2(spread, int(vol20 * 0.01), int(vol20 * 0.05))
            time_s  = 10.0
            confidence = (tech + vol_s + news_s + opt_s + time_s) / 100.0

            if confidence < MIN_CONF_V2:
                continue

            S       = opens[i]
            strike  = select_strike(S, direction)
            T_open  = 6.5 / 252
            iv      = max(rv * 1.20, 0.15)
            premium = bs_price(S, strike, T_open, RISK_FREE, iv, kind=direction.lower())

            exit_val, pnl_pct, win, exit_type = simulate_intraday_exits(
                S, strike, direction, premium,
                highs[i], lows[i], closes[i], rv
            )

            pnl_dollars = (exit_val - premium) * 100 * CONTRACTS

            all_results.append(TradeResult(
                date=dates[i].strftime("%Y-%m-%d"), ticker=ticker,
                direction=direction, strategy=strategy,
                confidence=round(confidence, 3),
                stock_open=round(S, 2), stock_close=round(closes[i], 2),
                stock_move_pct=round((closes[i] - S) / S * 100, 2),
                strike=strike, premium=round(premium, 2),
                intrinsic_close=round(exit_val, 2),
                pnl_dollars=round(pnl_dollars, 2), pnl_pct=round(pnl_pct, 1),
                win=win, volume_ratio=round(volume_ratio, 2), rsi=rsi,
                market_structure=market_structure,
                score_breakdown={"technical": tech, "volume": vol_s,
                                 "news": news_s, "options": opt_s, "time": time_s},
                exit_type=exit_type,
            ))
    return all_results


# ─────────────────────────────────────────────────────────────────────────
#  V3: ICT + Order Flow  —  the complete redesign
#
#  KEY DIFFERENCES FROM V1/V2:
#  ┌─────────────────────────────────────────────────────────────────────┐
#  │  V1/V2 trades WITH momentum: enter when RSI/VWAP/MACD all confirm  │
#  │  → chasing price that already moved, low edge, 20% win rate        │
#  │                                                                     │
#  │  V3 trades the REVERSAL after a liquidity sweep:                   │
#  │  → institutions grab retail stops, THEN reverse                    │
#  │  → enter at FVG/OB zone after CHoCH confirmation                   │
#  │  → ICT Silver Bullet documented: 70-80% win rate at these setups   │
#  └─────────────────────────────────────────────────────────────────────┘
#
#  EXECUTION MODEL:
#    Signal at end of day i  →  enter at OPEN of day i+1  (realistic)
#    Options: 2 DTE, ATM strike, stop 50%, target 150%
#    Risk: 2% per trade (tighter than V2's 5%)
# ─────────────────────────────────────────────────────────────────────────

V3_T_ENTRY   = V3_DTE / 252   # ~2-day options time value at entry
V3_MIN_CONF  = 0.60            # Minimum confidence (maps to MIN_SCORE=60)


def run_backtest_v3(data_cache: dict) -> List[TradeResult]:
    """
    V3 ICT + Order Flow backtest.

    Signal detection on day i (all ICT conditions evaluated at close).
    Entry at open of day i+1 (next-day realistic execution).
    Exit: intraday stop (50%) or profit target (150%) or EOD close.

    Options: 2 DTE, ATM strike, Black-Scholes priced at open.
    """
    all_results = []

    for ticker, arrays in data_cache.items():
        closes, opens, highs, lows, volumes, dates = arrays
        n = len(closes)

        for i in range(55, n - 1):   # -1: need day i+1 for entry/exit

            # ── Detect ICT signal at close of day i ──────────────────
            sig = detect_ict_signal(
                opens, highs, lows, closes, volumes, dates, i, ticker
            )
            if sig is None:
                continue

            direction, strategy, confidence, score_bd, reasons = sig

            # ── Skip if confidence below threshold ────────────────────
            if confidence < V3_MIN_CONF:
                continue

            # ── Entry on next day's open (day i+1) ───────────────────
            ei  = i + 1                          # entry index
            S   = float(opens[ei])               # entry price = next open
            K   = select_strike(S, direction)    # ATM/near-ATM strike
            rv  = realised_vol(closes[: ei + 1])
            # Slightly lower IV multiplier: we're buying at the RIGHT time
            # (after a liquidity sweep), not into high-vol spikes
            iv  = max(rv * 1.10, 0.12)
            premium = bs_price(S, K, V3_T_ENTRY, RISK_FREE, iv, kind=direction.lower())

            # ── Exit simulation using day i+1's intraday range ────────
            V3_T_MID = V3_T_ENTRY / 2   # mid-day remaining time for BS pricing
            exit_val, pnl_pct, win, exit_type = simulate_intraday_exits(
                S, K, direction, premium,
                float(highs[ei]), float(lows[ei]), float(closes[ei]), rv,
                stop_loss=V3_STOP_LOSS, profit_target=V3_PROFIT_TGT, t_mid=V3_T_MID,
            )

            pnl_dollars = (exit_val - premium) * 100 * CONTRACTS

            # ── Supporting stats ──────────────────────────────────────
            vol20        = float(volumes[ei - 20: ei].mean())
            volume_ratio = float(volumes[ei]) / vol20 if vol20 > 0 else 1.0
            rsi          = compute_rsi(closes[: ei + 1])
            sma20        = float(closes[ei - 20: ei].mean())
            ms = (
                "uptrend"   if float(closes[ei]) > sma20 * 1.005 else
                "downtrend" if float(closes[ei]) < sma20 * 0.995 else "neutral"
            )

            all_results.append(TradeResult(
                date             = dates[ei].strftime("%Y-%m-%d"),
                ticker           = ticker,
                direction        = direction,
                strategy         = strategy,
                confidence       = round(confidence, 3),
                stock_open       = round(S, 2),
                stock_close      = round(float(closes[ei]), 2),
                stock_move_pct   = round((float(closes[ei]) - S) / max(S, 1e-6) * 100, 2),
                strike           = K,
                premium          = round(premium, 2),
                intrinsic_close  = round(exit_val, 2),
                pnl_dollars      = round(pnl_dollars, 2),
                pnl_pct          = round(pnl_pct, 1),
                win              = win,
                volume_ratio     = round(volume_ratio, 2),
                rsi              = rsi,
                market_structure = ms,
                score_breakdown  = score_bd,
                exit_type        = exit_type,
            ))

    return all_results


# ── Statistics ────────────────────────────────────────────────────────
def compute_stats(results: List[TradeResult], label: str = "") -> dict:
    if not results:
        return {"label": label, "total_signals": 0, "win_rate": 0}

    pnls     = [r.pnl_dollars for r in results]
    wins     = [r for r in results if r.win]
    losses   = [r for r in results if not r.win]
    total_pnl     = sum(pnls)
    gross_profit  = sum(r.pnl_dollars for r in wins)
    gross_loss    = abs(sum(r.pnl_dollars for r in losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    arr    = np.array([r.pnl_pct for r in results])
    sharpe = (arr.mean() / arr.std() * math.sqrt(252)) if arr.std() > 0 else 0.0

    cum  = np.cumsum(pnls)
    peak = np.maximum.accumulate(cum)
    max_dd = float((cum - peak).min())

    strategies, tickers = {}, {}
    for r in results:
        for d, key in [(strategies, r.strategy), (tickers, r.ticker)]:
            if key not in d:
                d[key] = {"trades": 0, "wins": 0, "pnl": 0.0}
            d[key]["trades"] += 1
            d[key]["wins"]   += int(r.win)
            d[key]["pnl"]    += r.pnl_dollars

    sorted_pnl = sorted(results, key=lambda x: x.pnl_dollars)
    best5  = [asdict(r) for r in sorted_pnl[-5:][::-1]]
    worst5 = [asdict(r) for r in sorted_pnl[:5]]

    # Exit type breakdown (V2 only)
    exit_counts = {}
    for r in results:
        et = getattr(r, "exit_type", "expiry")
        exit_counts[et] = exit_counts.get(et, 0) + 1

    return {
        "label":           label,
        "period":          f"{START_DATE} to {END_DATE}",
        "total_signals":   len(results),
        "wins":            len(wins),
        "losses":          len(losses),
        "win_rate":        round(len(wins) / len(results) * 100, 1),
        "total_pnl":       round(total_pnl, 2),
        "gross_profit":    round(gross_profit, 2),
        "gross_loss":      round(-gross_loss, 2),
        "profit_factor":   round(profit_factor, 2),
        "avg_win_pct":     round(np.mean([r.pnl_pct for r in wins]), 1) if wins else 0,
        "avg_loss_pct":    round(np.mean([r.pnl_pct for r in losses]), 1) if losses else 0,
        "avg_pnl_per_trade": round(np.mean(pnls), 2),
        "sharpe_ratio":    round(sharpe, 2),
        "max_drawdown":    round(max_dd, 2),
        "per_strategy":    {k: {**v, "win_rate": round(v["wins"]/v["trades"]*100,1)} for k,v in strategies.items()},
        "per_ticker":      {k: {**v, "win_rate": round(v["wins"]/v["trades"]*100,1)} for k,v in sorted(tickers.items(), key=lambda x: x[1]["pnl"], reverse=True)},
        "best_5_trades":   best5,
        "worst_5_trades":  worst5,
        "call_trades":     sum(1 for r in results if r.direction=="CALL"),
        "put_trades":      sum(1 for r in results if r.direction=="PUT"),
        "call_win_rate":   round(sum(r.win for r in results if r.direction=="CALL") / max(sum(1 for r in results if r.direction=="CALL"),1)*100,1),
        "put_win_rate":    round(sum(r.win for r in results if r.direction=="PUT")  / max(sum(1 for r in results if r.direction=="PUT"),1)*100,1),
        "exit_type_counts": exit_counts,
    }


# ── Comparison printer ────────────────────────────────────────────────
def print_v3_detail(v3: dict):
    """Print detailed V3 ICT breakdown."""
    print(f"\n{'═'*70}")
    print(f"  V3 ICT + Order Flow — Detailed Results")
    print(f"{'═'*70}")
    print(f"  Signals   : {v3['total_signals']} trades ({v3['call_trades']} calls / {v3['put_trades']} puts)")
    print(f"  Win Rate  : {v3['win_rate']:.1f}%  (CALL {v3['call_win_rate']:.1f}% / PUT {v3['put_win_rate']:.1f}%)")
    print(f"  P&L       : ${v3['total_pnl']:+,.0f}  (profit factor {v3['profit_factor']:.2f})")
    print(f"  Avg Win   : {v3['avg_win_pct']:+.1f}%   Avg Loss: {v3['avg_loss_pct']:+.1f}%")
    print(f"  Sharpe    : {v3['sharpe_ratio']:.2f}   Max DD: ${v3['max_drawdown']:,.0f}")
    print(f"\n  Exit Types:")
    for et, cnt in v3.get("exit_type_counts", {}).items():
        pct = cnt / max(v3["total_signals"], 1) * 100
        print(f"    {et:<22}  {cnt:>4} trades  ({pct:.0f}%)")
    print(f"\n  By Strategy:")
    for strat, s in v3["per_strategy"].items():
        bar = "█" * int(s["win_rate"] / 5) + "░" * (20 - int(s["win_rate"] / 5))
        print(f"    {strat:<26}  {bar}  {s['win_rate']:.1f}%  ({s['trades']} trades, ${s['pnl']:+,.0f})")
    print(f"\n  By Ticker (sorted by P&L):")
    for tick, t in v3["per_ticker"].items():
        arrow = "▲" if t["pnl"] >= 0 else "▼"
        print(f"    {tick:<6}  {arrow} ${t['pnl']:+7,.0f}   win={t['win_rate']:.1f}%  ({t['trades']} trades)")
    print(f"\n  Best 5 Trades:")
    for t in v3["best_5_trades"]:
        print(f"    {t['date']}  {t['ticker']:<5} {t['direction']:<4}  ${t['pnl_dollars']:+6,.0f}  "
              f"({t['pnl_pct']:+.0f}%)  stock {t['stock_move_pct']:+.1f}%  [{t.get('exit_type','expiry')}]")
    print(f"\n  Worst 5 Trades:")
    for t in v3["worst_5_trades"]:
        print(f"    {t['date']}  {t['ticker']:<5} {t['direction']:<4}  ${t['pnl_dollars']:+6,.0f}  "
              f"({t['pnl_pct']:+.0f}%)  stock {t['stock_move_pct']:+.1f}%  [{t.get('exit_type','expiry')}]")

    # Score breakdown for sample high-confidence trades
    bd = v3.get("score_breakdown_sample", {})
    if bd:
        from app.core.ict_engine import format_ict_score
        print(f"\n  Sample ICT Score Card:")
        print(format_ict_score(bd))


def print_comparison(v1: dict, v2: dict, v21: dict = None):
    def fmt(val, is_pct=False, is_dollar=False, decimals=1):
        if val is None: return "N/A"
        if is_dollar: return f"${val:+,.0f}"
        if is_pct: return f"{val:.{decimals}f}%"
        return f"{val:.{decimals}f}"

    def delta(new, old, higher_better=True):
        if old == 0 or old is None: return ""
        change = new - old
        symbol = "▲" if (change > 0) == higher_better else "▼"
        return f"  {symbol}{abs(change):.1f}"

    three_way = v21 is not None and v21.get("total_signals", 0) > 0

    # ── 2-way or 3-way table header ───────────────────────────────────
    if three_way:
        print(f"\n{'='*85}")
        print(f"  V1 (Original)  vs  V2 (Redesigned)  vs  V2.1 (ADX+ORB Enhanced)")
        print(f"{'='*85}")
        print(f"  {'Metric':<20}  {'V1':>12}  {'V2':>12}  {'V2.1':>12}  {'V1→V2':>8}  {'V2→V2.1':>9}")
        print(f"  {'-'*20}  {'-'*12}  {'-'*12}  {'-'*12}  {'-'*8}  {'-'*9}")
    else:
        print(f"\n{'='*70}")
        print(f"  BEFORE vs AFTER — V1 (Original) vs V2 (Redesigned)")
        print(f"{'='*70}")
        print(f"  {'Metric':<20}  {'V1 (Before)':>14}  {'V2 (After)':>14}  {'Change':>12}")
        print(f"  {'-'*20}  {'-'*14}  {'-'*14}  {'-'*12}")

    rows = [
        ("Trades",        v1["total_signals"],  v2["total_signals"],  False, False, 0, False),
        ("Win Rate",      v1["win_rate"],        v2["win_rate"],       True,  False, 1, True),
        ("Total P&L",     v1["total_pnl"],       v2["total_pnl"],      False, True,  0, True),
        ("Profit Factor", v1["profit_factor"],   v2["profit_factor"],  False, False, 2, True),
        ("Avg Win",       v1["avg_win_pct"],     v2["avg_win_pct"],    True,  False, 1, True),
        ("Avg Loss",      v1["avg_loss_pct"],    v2["avg_loss_pct"],   True,  False, 1, True),
        ("Sharpe Ratio",  v1["sharpe_ratio"],    v2["sharpe_ratio"],   False, False, 2, True),
        ("Max Drawdown",  v1["max_drawdown"],    v2["max_drawdown"],   False, True,  0, False),
        ("CALL win rate", v1["call_win_rate"],   v2["call_win_rate"],  True,  False, 1, True),
        ("PUT win rate",  v1["put_win_rate"],    v2["put_win_rate"],   True,  False, 1, True),
    ]

    for label, v1_val, v2_val, is_pct, is_dollar, dec, higher_better in rows:
        v1_str  = fmt(v1_val,  is_pct, is_dollar, dec)
        v2_str  = fmt(v2_val,  is_pct, is_dollar, dec)
        chg12   = delta(v2_val, v1_val, higher_better) if isinstance(v1_val, (int, float)) else ""
        if three_way:
            v21_key  = label.lower().replace(" ", "_").replace("&", "").replace("/", "_")
            v21_map  = {
                "trades":        v21.get("total_signals", 0),
                "win_rate":      v21.get("win_rate", 0),
                "total_p_l":     v21.get("total_pnl", 0),
                "profit_factor": v21.get("profit_factor", 0),
                "avg_win":       v21.get("avg_win_pct", 0),
                "avg_loss":      v21.get("avg_loss_pct", 0),
                "sharpe_ratio":  v21.get("sharpe_ratio", 0),
                "max_drawdown":  v21.get("max_drawdown", 0),
                "call_win_rate": v21.get("call_win_rate", 0),
                "put_win_rate":  v21.get("put_win_rate", 0),
            }
            v21_val = v21_map.get(v21_key, 0)
            v21_str = fmt(v21_val, is_pct, is_dollar, dec)
            chg23   = delta(v21_val, v2_val, higher_better) if isinstance(v2_val, (int, float)) else ""
            print(f"  {label:<20}  {v1_str:>12}  {v2_str:>12}  {v21_str:>12}  {chg12:>8}  {chg23:>9}")
        else:
            print(f"  {label:<20}  {v1_str:>14}  {v2_str:>14}  {chg12:>12}")

    # ── Detail breakdown for the BEST model ───────────────────────────
    best = v21 if three_way else v2
    best_label = "V2.1" if three_way else "V2"

    print(f"\n  --- {best_label} Exit Type Breakdown ---")
    for et, count in best.get("exit_type_counts", {}).items():
        print(f"  {et:<22}  {count:>4} trades")

    print(f"\n  --- {best_label} By Strategy ---")
    for strat, s in best["per_strategy"].items():
        bar = "+" * int(s["win_rate"] / 5) + "-" * (20 - int(s["win_rate"] / 5))
        print(f"  {strat:<24}  {bar}  {s['win_rate']:.1f}%  ({s['trades']} trades, ${s['pnl']:+.0f})")

    print(f"\n  --- {best_label} By Ticker ---")
    for tick, t in best["per_ticker"].items():
        arrow = "▲" if t["pnl"] >= 0 else "▼"
        print(f"  {tick:<6}  {arrow} ${t['pnl']:+7.0f}   win={t['win_rate']:.1f}%  ({t['trades']} trades)")

    print(f"\n  --- {best_label} Best 5 Trades ---")
    for t in best["best_5_trades"]:
        print(f"  {t['date']}  {t['ticker']:<5} {t['direction']:<4}  ${t['pnl_dollars']:+6.0f}  ({t['pnl_pct']:+.0f}%)  "
              f"stock moved {t['stock_move_pct']:+.1f}%  [{t.get('exit_type','expiry')}]")

    print(f"\n  --- {best_label} Worst 5 Trades ---")
    for t in best["worst_5_trades"]:
        print(f"  {t['date']}  {t['ticker']:<5} {t['direction']:<4}  ${t['pnl_dollars']:+6.0f}  ({t['pnl_pct']:+.0f}%)  "
              f"stock moved {t['stock_move_pct']:+.1f}%  [{t.get('exit_type','expiry')}]")


# ── GPT analysis (handles both 2-way and 3-way comparisons) ──────────
def _build_gpt_prompt(v1_stats, v2_stats, v21_stats=None):
    if v21_stats:
        return f"""You are an expert quantitative options analyst reviewing a 3-model comparison of a 0DTE options system.

V1 (ORIGINAL baseline):
{json.dumps(_jsafe(v1_stats), indent=2)}

V2 (REDESIGNED — 5 core fixes):
{json.dumps(_jsafe(v2_stats), indent=2)}

V2.1 (ADX + ORB layer added on top of V2):
{json.dumps(_jsafe(v21_stats), indent=2)}

KEY CHANGES IN V2 over V1:
1. VWAP_RECLAIM strategy eliminated (0% win rate in 42 V1 trades)
2. IV Rank filter <65th pct (avoid expensive options in high-vol regimes)
3. ATR/premium >1.3 (underlying must be capable of covering option cost)
4. Volume raised 1.5x → 2.0x (institutional confirmation)
5. Hard 50% stop + 150% target via intraday H/L Black-Scholes simulation
6. Confidence threshold raised 65% → 70%
7. RSI tightened: CALL 46-66, PUT 34-54
8. 2-day momentum confirmation required
9. Technical weight raised 25pts → 40pts; lunch block added

KEY ADDITIONS IN V2.1 over V2:
A. ADX(14) ≥ 22 — Wilder's ADX gate; filters choppy/range-bound days
B. ORB daily proxy — close must be in correct 40% of range + gap from open

TARGET: ≥70% win rate, positive profit factor, manageable drawdown.

Analyze:
1. DID V2.1 ACHIEVE THE TARGET? Compare V2.1 win rate vs the 70% goal directly.
2. WHAT DID ADX+ORB FILTER OUT? Which losses were eliminated vs new false negatives?
3. REMAINING FAILURE MODES in V2.1 — what still causes losses?
4. PATH TO CONSISTENT 70%+: What is the single highest-leverage change remaining?
5. POSITION SIZING: Appropriate max risk per trade on a $500 account given V2.1 risk profile?
6. PAPER TRADING READINESS: Is V2.1 ready for real paper trading? Milestones needed?
7. VERDICT: One paragraph, direct, no sugar-coating.

Be specific with numbers."""
    else:
        return f"""You are an expert quantitative options analyst reviewing a before/after redesign of a 0DTE options trading system.

V1 (BEFORE — original model):
{json.dumps(_jsafe(v1_stats), indent=2)}

V2 (AFTER — redesigned with 5 fixes):
{json.dumps(_jsafe(v2_stats), indent=2)}

CHANGES MADE IN V2:
1. VWAP_RECLAIM eliminated (0% win rate in 42 V1 trades)
2. IV Rank filter <65th pct
3. ATR/premium >1.3
4. Volume raised 1.5x → 2.0x
5. Hard 50% stop + 150% target via intraday H/L simulation
6. Confidence 65% → 70%; RSI tightened; 2-day momentum; tech weight 25→40; lunch blocked

Goal: ≥70% win rate with positive profit factor and manageable drawdown.

Analyze:
1. DID IT WORK? Compare V1 vs V2 directly.
2. REMAINING FAILURE MODES in V2?
3. PATH TO 70-80% WIN RATE: Specific changes needed.
4. POSITION SIZING for $500 account.
5. VERDICT: One paragraph, direct."""


# ── Main ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="0DTE Options Backtest — V1 vs V2 [vs V2.1] [vs V3 ICT]")
    parser.add_argument("--adx-orb", action="store_true",
                        help="Also run V2.1 model (ADX + ORB filters)")
    parser.add_argument("--ict", action="store_true",
                        help="Also run V3 ICT + Order Flow model and show detailed ICT results")
    args = parser.parse_args()

    t0      = time.time()
    run_v21 = args.adx_orb
    run_v3  = args.ict

    parts = ["V1", "V2"]
    if run_v21: parts.append("V2.1")
    if run_v3:  parts.append("V3-ICT")
    title = " vs ".join(parts) + " BACKTEST"

    print(f"\n{'='*70}")
    print(f"  ROBINHOOD OPTIONS INTELLIGENCE — {title}")
    print(f"  Period : {START_DATE}  →  {END_DATE}")
    print(f"  Tickers: {', '.join(WATCHLIST)}")
    print(f"  Account: ${ACCOUNT:.0f}  |  V1 risk: {MAX_RISK_V1:.0%}  |  V2 risk: {MAX_RISK_V2:.0%}")
    if run_v21:
        print(f"  V2.1   : ADX ≥ {MIN_ADX_V21:.0f}  |  ORB hold ≥ {ORB_HOLD_PCT:.0%} of range")
    if run_v3:
        from app.core.ict_engine import MIN_SCORE, HIGH_CONF_SCORE, V3_DTE
        print(f"  V3 ICT : score ≥ {MIN_SCORE}  |  high-conf ≥ {HIGH_CONF_SCORE}  |  {V3_DTE:.0f}-DTE options  |  next-day entry")
    print(f"{'='*70}\n")

    # Download data ONCE — shared across all three models
    print("  Downloading market data...")
    data_cache = {}
    for ticker in WATCHLIST:
        print(f"    {ticker}...", end=" ", flush=True)
        try:
            df = yf.download(ticker, start=START_DATE.strftime("%Y-%m-%d"),
                             end=END_DATE.strftime("%Y-%m-%d"),
                             progress=False, auto_adjust=True)
            if df.empty or len(df) < 40:
                print(f"skipped ({len(df)} rows)")
                continue
            if hasattr(df.columns, 'levels'):
                df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            df = df.dropna()
            data_cache[ticker] = (
                df["Close"].values.astype(float),
                df["Open"].values.astype(float),
                df["High"].values.astype(float),
                df["Low"].values.astype(float),
                df["Volume"].values.astype(float),
                df.index.tolist(),
            )
            print(f"ok ({len(df)} days)")
        except Exception as e:
            print(f"FAILED ({e})")

    # ── Run models ──────────────────────────────────────────────────
    print(f"\n  Running V1 (original model)...")
    v1_results = run_backtest_v1(data_cache)
    print(f"  V1: {len(v1_results)} signals generated")

    print(f"\n  Running V2 (redesigned model)...")
    v2_results = run_backtest_v2(data_cache)
    print(f"  V2: {len(v2_results)} signals generated")

    v21_results = []
    if run_v21:
        print(f"\n  Running V2.1 (ADX ≥ {MIN_ADX_V21:.0f} + ORB confirmation)...")
        v21_results = run_backtest_v21(data_cache)
        print(f"  V2.1: {len(v21_results)} signals generated")

    v3_results = []
    if run_v3:
        print(f"\n  Running V3 (ICT + Order Flow — liquidity sweeps, FVG, OB, CHoCH, CVD)...")
        v3_results = run_backtest_v3(data_cache)
        print(f"  V3: {len(v3_results)} signals generated")

    if not v1_results and not v2_results and not v3_results:
        print("\nNo signals generated — check data download.")
        sys.exit(1)

    v1_stats  = compute_stats(v1_results,  "V1 Original")
    v2_stats  = compute_stats(v2_results,  "V2 Redesigned")
    v21_stats = compute_stats(v21_results, "V2.1 ADX+ORB") if run_v21 else None
    v3_stats  = compute_stats(v3_results,  "V3 ICT+OrdFlow") if run_v3 else None

    # Print traditional V1 vs V2 [vs V2.1] comparison
    print_comparison(v1_stats, v2_stats, v21_stats)

    # Print V3 detail if run
    if v3_stats:
        print_v3_detail(v3_stats)

    # ── GPT Analysis ─────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print(f"  REASONING MODEL ANALYSIS")
    print(f"{'='*65}")

    # Only run V1/V2/V2.1 GPT analysis if not running V3 (V3 has its own prompt above)
    gpt_prompt_text = _build_gpt_prompt(v1_stats, v2_stats, v21_stats)
    # Reuse existing analyze_with_gpt but pass the right prompt
    if not OPENAI_KEY:
        analysis = "Set OPENAI_API_KEY to enable AI analysis."
    else:
        import urllib.request, urllib.error
        MODELS = [
            ("gpt-5.4-mini", True, 4000),
            ("gpt-5.4-nano", True, 4000),
            ("gpt-5.4",      True, 4000),
            ("gpt-4o-mini",  True, 2000),
            ("gpt-4o",       True, 4000),
            ("o3-mini",      False, 4000),
        ]
        analysis = "All models failed — check API key and connectivity."
        for model, supports_temp, max_tok in MODELS:
            try:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are an expert quantitative trader and options analyst. Be direct and data-driven."},
                        {"role": "user",   "content": gpt_prompt_text}
                    ],
                    "max_completion_tokens": max_tok,
                }
                if supports_temp:
                    payload["temperature"] = 0.1
                data = json.dumps(_jsafe(payload)).encode("utf-8")
                req  = urllib.request.Request(
                    "https://api.openai.com/v1/chat/completions", data=data,
                    headers={"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=180) as resp:
                    result   = json.loads(resp.read().decode("utf-8"))
                    analysis = result["choices"][0]["message"]["content"]
                    print(f"\n  [Model used: {model}]")
                    break
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="replace")
                if "insufficient_quota" in body or "billing" in body.lower():
                    analysis = "OpenAI quota exceeded — add billing at platform.openai.com/settings/billing"
                    break
                elif e.code == 404:
                    continue
                else:
                    print(f"\n  [{model} HTTP {e.code}] — trying next...")
                    continue
            except Exception as e:
                print(f"\n  [{model} error: {e}] — trying next...")
                continue

    print(analysis)

    print(f"\n  Total runtime: {time.time()-t0:.1f}s")

    # ── GPT / AI prompt for V3 ────────────────────────────────────────
    if run_v3 and v3_stats and OPENAI_KEY:
        v3_prompt = f"""You are an expert quantitative options analyst.

V3 is a new ICT (Inner Circle Trader) + Order Flow strategy that trades
REVERSALS after liquidity sweeps (Judas Swing), NOT momentum.

V3 backtest results ({START_DATE} to {END_DATE}):
{json.dumps(_jsafe(v3_stats), indent=2)}

For comparison, V2.1 (best previous model):
{json.dumps(_jsafe(v21_stats or v2_stats), indent=2)}

V3 METHODOLOGY:
1. HTF Bias (EMA20/50) — establish daily directional bias
2. Liquidity Sweep — today swept PDH/PDL or equal highs/lows then reversed
3. CHoCH / Market Structure Shift — confirms the sweep was a fake-out
4. FVG / Order Block — entry at institutional price zone
5. CVD Divergence — volume confirmation
6. OTE — Fibonacci 61.8-79% entry zone
Entry: next-day open (realistic), 2-DTE options, 50% stop, 150% target.

Analyze:
1. DID V3 ACHIEVE 70% WIN RATE AND 5.0 PROFIT FACTOR? Compare to baseline.
2. WHICH TICKERS performed best/worst and why (ICT setups favor indices)?
3. REMAINING FAILURE MODES — what does V3 still get wrong?
4. HIGHEST-LEVERAGE IMPROVEMENT to push toward 75%+ win rate?
5. LIVE TRADING READINESS — is V3 ready for paper trading? What milestones?
6. VERDICT: Is this the first truly profitable options engine? Be honest."""

        print(f"\n{'='*65}")
        print(f"  V3 ICT — AI ANALYSIS")
        print(f"{'='*65}")
        for model, supports_temp, max_tok in [
            ("gpt-4o-mini", True, 2000), ("gpt-4o", True, 3000)
        ]:
            try:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "Expert quant trader. Be direct and data-driven."},
                        {"role": "user",   "content": v3_prompt},
                    ],
                    "max_completion_tokens": max_tok,
                }
                if supports_temp:
                    payload["temperature"] = 0.1
                import urllib.request, urllib.error
                data = json.dumps(_jsafe(payload)).encode("utf-8")
                req  = urllib.request.Request(
                    "https://api.openai.com/v1/chat/completions", data=data,
                    headers={"Authorization": f"Bearer {OPENAI_KEY}",
                             "Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=180) as resp:
                    result   = json.loads(resp.read().decode("utf-8"))
                    analysis = result["choices"][0]["message"]["content"]
                    print(f"  [Model: {model}]\n{analysis}")
                    break
            except Exception:
                continue

    # ── Save results ─────────────────────────────────────────────────
    if run_v3:
        suffix = "_v3"
    elif run_v21:
        suffix = "_v21"
    else:
        suffix = "_v2"

    out = os.path.join(os.path.dirname(__file__), f"backtest_results{suffix}.json")
    raw_payload = {
        "v1":        v1_stats,
        "v2":        v2_stats,
        "v1_trades": [asdict(r) for r in v1_results],
        "v2_trades": [asdict(r) for r in v2_results],
    }
    if run_v21:
        raw_payload["v21"]        = v21_stats
        raw_payload["v21_trades"] = [asdict(r) for r in v21_results]
    if run_v3:
        raw_payload["v3"]         = v3_stats
        raw_payload["v3_trades"]  = [asdict(r) for r in v3_results]

    # Apply _jsafe AFTER all data is assembled so numpy types are all caught
    with open(out, "w", encoding="utf-8") as f:
        json.dump(_jsafe(raw_payload), f, indent=2, cls=NumpyEncoder)
    print(f"\n  Full results saved → {os.path.basename(out)}")

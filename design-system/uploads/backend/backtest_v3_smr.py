#!/usr/bin/env python3
"""
V3 Options Strategy — Structural Mean Reversion (SMR)
═══════════════════════════════════════════════════════════════════
5-Year Backtest: 2020-01-01 to 2025-12-31
Universe: SPY, QQQ, IWM
Target: 75%+ win rate | 5X+ profit factor | consistent equity curve

STRATEGY PHILOSOPHY
───────────────────
Trade index options ONLY in direction of the macro trend (EMA50 vs EMA200),
entering when price pulls back to a convergence of institutional levels:
  • Weekly Value Area Low (for calls) or High (for puts)
  • Active (unmitigated) Fair Value Gap at that level
  • Reversal candle confirming buying/selling intent
  • Fibonacci OTE zone for bonus confidence

This is a SELECTIVE, HIGH-QUALITY strategy. We prefer fewer, better trades.
Target: 15-30 trades/year across 3 tickers = 75-150 trades over 5 years.

ENTRY CONDITIONS (ALL required except Fib which is scored)
──────────────────────────────────────────────────────────
  1. MACRO REGIME: EMA50 > EMA200 → CALLS only | EMA50 < EMA200 → PUTS only
  2. PULLBACK: Price within 3% of EMA20 (not chasing extended moves)
  3. VALUE AREA: Price at or below weekly VAL (calls) / at or above VAH (puts)
  4. ACTIVE FVG: Unmitigated bullish FVG within 2% below price (calls), vice versa
  5. REVERSAL CANDLE: Close in top 50%+ of range with body (calls) or bottom (puts)
  6. VOLUME: Today's volume ≥ 0.90× 20-day average
  7. NOT CRISIS: Today's range < 3.0× 14-day ATR average

EXIT MODEL
──────────────────────────────────────────────────────────
  Stop:    50% premium loss (checked daily at close — structural invalidation)
  Target:  150% gain (checked daily using best intraday price)
  Time:    7 DTE maximum hold (ATM options, rolled to next week)

SCORING (0-100 pts, min 58 to take trade)
──────────────────────────────────────────────────────────
  Macro trend strength:    0-20 pts
  Value area position:     0-25 pts
  FVG quality:             0-25 pts
  Reversal candle quality: 0-15 pts
  Volume confirmation:     0-10 pts
  Fibonacci OTE bonus:     0-5 pts
"""

import sys, os, json, math, argparse
import numpy as np
from datetime import date, timedelta, datetime
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Tuple
from scipy.stats import norm

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import yfinance as yf

# ── Config ────────────────────────────────────────────────────────────────────

TICKERS      = ["SPY", "QQQ", "IWM"]
START_DATE   = date(2020, 1, 1)
END_DATE     = date(2025, 12, 31)
ACCOUNT      = 10_000.0
RISK_FREE    = 0.04       # avg risk-free rate 2020-2025

# Option parameters
DTE          = 7          # 7 trading days to expiration
STOP_LOSS    = 0.50       # 50% premium stop
PROFIT_TGT   = 1.50       # 150% profit target (2.5× exit)
CONTRACTS    = 1

# Signal parameters (tuned for quality over quantity)
MIN_SCORE    = 58         # Minimum score to take trade
EMA_SHORT    = 50         # Short EMA for regime
EMA_LONG     = 200        # Long EMA for regime
WARMUP       = 215        # Bars needed before first signal

# Filters
MAX_ATR_MULT = 3.0        # Skip crisis days (range > 3× ATR)
MIN_VOL_RATIO= 0.85       # Min volume ratio vs 20-day avg
FVG_PROX     = 0.018      # 1.8% proximity to FVG counts
VA_TOL       = 0.018      # Value area tolerance (1.8% near VAL/VAH)
FVG_MIN_PCT  = 0.0003     # 0.03% min gap size
FVG_LOOKBACK = 15         # Look back N bars for FVGs
PULLBACK_MAX = 0.035      # Price can't be more than 3.5% from EMA20


# ── Black-Scholes ─────────────────────────────────────────────────────────────

def bs_price(S: float, K: float, T: float, r: float, sigma: float, cp: str = "C") -> float:
    if T <= 0 or sigma <= 0:
        return max(0.0, (S - K) if cp == "C" else (K - S))
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    if cp == "C":
        return max(S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2), 0.01)
    return max(K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1), 0.01)


def estimate_iv(closes: np.ndarray, i: int, window: int = 20) -> float:
    """Realized vol proxy + vol risk premium."""
    if i < window + 1:
        return 0.20
    rets = np.diff(np.log(closes[max(0, i - window): i + 1]))
    rv = float(np.std(rets) * math.sqrt(252))
    # Volatility risk premium: IV ≈ RV × 1.15-1.25 for indices
    return max(rv * 1.18, 0.12)


# ── Technical Indicators ──────────────────────────────────────────────────────

def compute_ema(prices: np.ndarray, period: int) -> float:
    if len(prices) <= 0:
        return 0.0
    if len(prices) <= period:
        return float(np.mean(prices))
    k = 2.0 / (period + 1)
    e = float(np.mean(prices[:period]))
    for p in prices[period:]:
        e = p * k + e * (1 - k)
    return e


def compute_atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
                period: int = 14) -> float:
    n = min(period, len(closes) - 1)
    if n < 1:
        return float(closes[-1]) * 0.01
    trs = [
        max(
            float(highs[i]) - float(lows[i]),
            abs(float(highs[i]) - float(closes[i - 1])),
            abs(float(lows[i]) - float(closes[i - 1]))
        )
        for i in range(-n, 0)
    ]
    return float(np.mean(trs)) if trs else float(closes[-1]) * 0.01


def compute_volume_profile(highs: np.ndarray, lows: np.ndarray,
                            volumes: np.ndarray, i: int,
                            window: int = 5, n_bins: int = 25) -> Dict:
    """Volume profile → VAH, VAL, POC using daily OHLCV approximation."""
    s = max(0, i - window + 1)
    e = i + 1
    w_high = float(np.max(highs[s:e]))
    w_low  = float(np.min(lows[s:e]))
    rng    = w_high - w_low
    if rng < 1e-6:
        mid = (w_high + w_low) / 2
        return {"vah": w_high, "val": w_low, "poc": mid}

    bin_size = rng / n_bins
    bin_vols = [0.0] * n_bins

    for j in range(s, e):
        h = float(highs[j]); l = float(lows[j]); v = float(volumes[j])
        day_rng = max(h - l, 1e-8)
        for k in range(n_bins):
            bl = w_low + k * bin_size
            bh = bl + bin_size
            ol = max(l, bl); oh = min(h, bh)
            if oh > ol:
                bin_vols[k] += v * (oh - ol) / day_rng

    total = sum(bin_vols)
    if total < 1e-6:
        mid = (w_high + w_low) / 2
        return {"vah": w_high, "val": w_low, "poc": mid}

    poc_idx = bin_vols.index(max(bin_vols))
    poc = w_low + (poc_idx + 0.5) * bin_size

    # Expand from POC until 70% of volume captured
    target = total * 0.70
    va = {poc_idx}; vv = bin_vols[poc_idx]; lo = poc_idx - 1; hi = poc_idx + 1
    while vv < target:
        lv = bin_vols[lo] if lo >= 0     else 0.0
        hv = bin_vols[hi] if hi < n_bins else 0.0
        if lv == 0 and hv == 0:
            break
        if hv >= lv and hi < n_bins:
            va.add(hi); vv += hv; hi += 1
        elif lo >= 0:
            va.add(lo); vv += lv; lo -= 1
        else:
            break

    vah = w_low + (max(va) + 1) * bin_size
    val = w_low + min(va) * bin_size
    return {"vah": round(vah, 4), "val": round(val, 4), "poc": round(poc, 4)}


def find_active_fvgs(highs: np.ndarray, lows: np.ndarray,
                     closes: np.ndarray, volumes: np.ndarray,
                     i: int, lookback: int = 15,
                     min_pct: float = 0.0003) -> List[Dict]:
    """Detect active (unmitigated) FVGs near current price."""
    fvgs = []
    vol20 = float(np.mean(volumes[max(0, i - 20): i])) if i >= 5 else float(volumes[i])

    for j in range(max(2, i - lookback + 1), i + 1):
        h2 = float(highs[j - 2]); l2 = float(lows[j - 2])
        h0 = float(highs[j]);     l0 = float(lows[j])

        # Bullish FVG: h2 < l0 (gap up)
        if h2 < l0:
            gp = (l0 - h2) / max(h2, 1e-6)
            if gp >= min_pct:
                mid = (h2 + l0) / 2
                # Active = price hasn't traded through midpoint since j
                active = not any(float(lows[k]) <= mid for k in range(j + 1, i + 1))
                if active:
                    vr = float(volumes[max(0, j-1)]) / max(vol20, 1e-6)
                    age = i - j
                    age_f = max(0.0, 1.0 - age / lookback)
                    quality = gp * 100 * age_f * min(vr, 3.0) * 1.5
                    fvgs.append({
                        "type": "bullish", "low": h2, "high": l0, "mid": mid,
                        "gap_pct": round(gp * 100, 4), "age": age,
                        "vol_ratio": round(vr, 2), "quality": round(quality, 4)
                    })

        # Bearish FVG: l2 > h0 (gap down)
        elif l2 > h0:
            gp = (l2 - h0) / max(h0, 1e-6)
            if gp >= min_pct:
                mid = (h0 + l2) / 2
                active = not any(float(highs[k]) >= mid for k in range(j + 1, i + 1))
                if active:
                    vr = float(volumes[max(0, j-1)]) / max(vol20, 1e-6)
                    age = i - j
                    age_f = max(0.0, 1.0 - age / lookback)
                    quality = gp * 100 * age_f * min(vr, 3.0) * 1.5
                    fvgs.append({
                        "type": "bearish", "low": h0, "high": l2, "mid": mid,
                        "gap_pct": round(gp * 100, 4), "age": age,
                        "vol_ratio": round(vr, 2), "quality": round(quality, 4)
                    })

    fvgs.sort(key=lambda x: x["quality"], reverse=True)
    return fvgs


def find_fvg_at_price(fvgs: List[Dict], price: float,
                      ftype: str, prox: float = 0.018) -> Optional[Dict]:
    """Find best FVG of type where price is near the zone."""
    candidates = []
    for f in fvgs:
        if f["type"] != ftype:
            continue
        lo = f["low"]  * (1 - prox)
        hi = f["high"] * (1 + prox)
        if lo <= price <= hi:
            candidates.append(f)
    return max(candidates, key=lambda x: x["quality"]) if candidates else None


def score_value_area(price: float, direction: str, vp: Dict,
                     tol: float = 0.018) -> Tuple[int, str]:
    """Score current price position relative to Value Area."""
    val = vp["val"]; vah = vp["vah"]; poc = vp["poc"]
    if direction == "CALL":
        if price <= val * (1 + tol):       return 25, "at_VAL"
        elif price <= poc:                  return 15, "below_POC"
        elif price <= vah:                  return 8,  "inside_VA"
        else:                               return 0,  "above_VAH"
    else:
        if price >= vah * (1 - tol):       return 25, "at_VAH"
        elif price >= poc:                  return 15, "above_POC"
        elif price >= val:                  return 8,  "inside_VA"
        else:                               return 0,  "below_VAL"


def is_reversal_candle(opens: np.ndarray, highs: np.ndarray,
                       lows: np.ndarray, closes: np.ndarray,
                       i: int, direction: str) -> Tuple[bool, int]:
    """
    Reversal candle quality check + score.
    CALL: Bullish — close in top half of range, body up, or hammer
    PUT:  Bearish — close in bottom half of range, body down, or shooting star
    """
    c = float(closes[i]); o = float(opens[i])
    h = float(highs[i]);  l = float(lows[i])
    dr = max(h - l, 1e-8)
    cp = (c - l) / dr  # 0 = at low, 1 = at high

    if direction == "CALL":
        # Bullish body
        is_bull_body = c > o
        # Long lower wick relative to body (hammer)
        lower_wick = min(o, c) - l
        upper_wick = h - max(o, c)
        is_hammer = lower_wick > dr * 0.40 and lower_wick > upper_wick * 2

        # Engulfing: today's close > yesterday's high, yesterday was bearish
        is_engulf = (i > 0 and
                     float(closes[i-1]) < float(opens[i-1]) and
                     c > float(highs[i-1]))

        if not (is_bull_body or is_hammer):
            return False, 0

        score = 0
        if cp >= 0.70: score = 15       # Strong close in top 30%
        elif cp >= 0.55: score = 10     # Decent close in top 45%
        elif cp >= 0.45: score = 6      # Marginal
        else: return False, 0

        if is_engulf: score = min(score + 3, 15)
        if is_hammer: score = min(score + 2, 15)
        return True, score

    else:  # PUT
        is_bear_body = c < o
        upper_wick = h - max(o, c)
        lower_wick = min(o, c) - l
        is_star = upper_wick > dr * 0.40 and upper_wick > lower_wick * 2

        is_engulf = (i > 0 and
                     float(closes[i-1]) > float(opens[i-1]) and
                     c < float(lows[i-1]))

        if not (is_bear_body or is_star):
            return False, 0

        score = 0
        if cp <= 0.30: score = 15
        elif cp <= 0.45: score = 10
        elif cp <= 0.55: score = 6
        else: return False, 0

        if is_engulf: score = min(score + 3, 15)
        if is_star:   score = min(score + 2, 15)
        return True, score


def fibonacci_score(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray,
                    i: int, direction: str,
                    lookbacks: List[int] = [5, 10, 20]) -> int:
    """Score fibonacci retracement confluence (0-5 pts bonus)."""
    best = 0
    curr = float(closes[i])

    for lb in lookbacks:
        if i < lb:
            continue
        sw_h = float(np.max(highs[i - lb: i + 1]))
        sw_l = float(np.min(lows[i  - lb: i + 1]))
        rng = sw_h - sw_l
        if rng < 1e-6 or rng / max(sw_l, 1) < 0.005:
            continue

        if direction == "CALL":
            retrace = (sw_h - curr) / rng  # 0=at high, 1=at low
            if 0.55 <= retrace <= 0.88:    # OTE zone (widened)
                best = max(best, 5)
            elif 0.43 <= retrace <= 0.57:  # Equilibrium
                best = max(best, 3)
            elif 0.35 <= retrace <= 0.43:  # 38.2%
                best = max(best, 2)
        else:
            rf = (curr - sw_l) / rng      # 0=at low, 1=at high
            if 0.55 <= rf <= 0.88:
                best = max(best, 5)
            elif 0.43 <= rf <= 0.57:
                best = max(best, 3)
            elif 0.35 <= rf <= 0.43:
                best = max(best, 2)

    return best


# ── Master Signal Detector ────────────────────────────────────────────────────

def detect_signal(
    opens:   np.ndarray,
    highs:   np.ndarray,
    lows:    np.ndarray,
    closes:  np.ndarray,
    volumes: np.ndarray,
    dates,
    i:       int,
) -> Optional[Tuple]:
    """
    Detect V3 SMR signal at close of bar i.
    Entry will be at open of bar i+1.

    Returns (direction, score, score_breakdown) or None.
    """
    if i < WARMUP or i >= len(closes) - 1:
        return None

    c = float(closes[i]); h = float(highs[i])
    l = float(lows[i]);   o = float(opens[i])

    # ── Gate 1: Volume (need institutional participation) ─────────────────
    vol20 = float(np.mean(volumes[max(0, i - 20): i]))
    vr = float(volumes[i]) / max(vol20, 1e-6)
    if vr < MIN_VOL_RATIO:
        return None

    # ── Gate 2: Not a crisis/gap day ─────────────────────────────────────
    if i >= 15:
        avg_range = float(np.mean([
            float(highs[j]) - float(lows[j]) for j in range(i - 14, i)
        ]))
        if avg_range > 0 and (h - l) > avg_range * MAX_ATR_MULT:
            return None

    # ── Gate 3: Day-of-week (skip Friday) ────────────────────────────────
    try:
        d   = dates[i]
        dow = d.weekday() if hasattr(d, "weekday") else 2
    except Exception:
        dow = 2
    if dow == 4:  # Friday — pre-weekend risk for weekly options
        return None

    # ── Gate 4: MACRO REGIME — EMA50 vs EMA200 ───────────────────────────
    e50  = compute_ema(closes[: i + 1], EMA_SHORT)
    e200 = compute_ema(closes[: i + 1], EMA_LONG)

    bull_margin = (e50 - e200) / max(e200, 1e-6) * 100
    bear_margin = (e200 - e50) / max(e200, 1e-6) * 100

    if bull_margin > 0.5:      # EMA50 at least 0.5% above EMA200 → BULL
        direction = "CALL"
        htf_score = 20 if bull_margin > 3.0 else (15 if bull_margin > 1.5 else 10)
    elif bear_margin > 0.5:    # EMA50 at least 0.5% below EMA200 → BEAR
        direction = "PUT"
        htf_score = 20 if bear_margin > 3.0 else (15 if bear_margin > 1.5 else 10)
    else:
        return None  # Transition / choppy — no trade

    # ── Gate 5: PULLBACK check — price near EMA20 (mean reversion zone) ──
    e20 = compute_ema(closes[: i + 1], 20)
    dist_from_e20 = abs(c - e20) / max(e20, 1e-6)

    if dist_from_e20 > PULLBACK_MAX:
        return None  # Too far from EMA20 — not a pullback entry

    # ── Gate 6: VALUE AREA position ───────────────────────────────────────
    vp_weekly  = compute_volume_profile(highs, lows, volumes, i, window=5)
    vp_monthly = compute_volume_profile(highs, lows, volumes, i, window=20)

    va_score_w, va_label_w = score_value_area(c, direction, vp_weekly,  tol=VA_TOL)
    va_score_m, va_label_m = score_value_area(c, direction, vp_monthly, tol=VA_TOL)

    # Use best of weekly and monthly
    if va_score_w >= va_score_m:
        va_score, va_label = va_score_w, va_label_w
    else:
        va_score, va_label = va_score_m, va_label_m

    # Require at least "inside value area" position
    if va_score < 8:
        return None

    # ── Gate 7: ACTIVE FVG at price level ────────────────────────────────
    arr_type = "bullish" if direction == "CALL" else "bearish"
    fvgs = find_active_fvgs(highs, lows, closes, volumes, i,
                            lookback=FVG_LOOKBACK, min_pct=FVG_MIN_PCT)
    best_fvg = find_fvg_at_price(fvgs, c, arr_type, prox=FVG_PROX)

    if best_fvg is None:
        return None  # No active FVG → no trade

    # FVG quality scoring (0-25 pts)
    fvg_score = 15  # Base: active FVG present
    if best_fvg["gap_pct"] > 0.25:   fvg_score += 5
    elif best_fvg["gap_pct"] > 0.12: fvg_score += 3
    if best_fvg["age"] <= 3:  fvg_score += 5
    elif best_fvg["age"] <= 7: fvg_score += 3
    if best_fvg["vol_ratio"] > 1.5: fvg_score += 2
    fvg_score = min(fvg_score, 25)

    # ── Gate 8: REVERSAL CANDLE confirmation ──────────────────────────────
    rev_ok, candle_score = is_reversal_candle(opens, highs, lows, closes, i, direction)
    if not rev_ok:
        return None  # No reversal pattern — skip

    # ── Gate 9: Prior candle context (strengthen signal) ──────────────────
    # For CALL: ideally yesterday was bearish (we're buying the dip)
    # For PUT: ideally yesterday was bullish (we're shorting the bounce)
    context_bonus = 0
    if i > 0:
        prev_c = float(closes[i - 1]); prev_o = float(opens[i - 1])
        if direction == "CALL" and prev_c < prev_o:   context_bonus = 3
        elif direction == "PUT" and prev_c > prev_o:  context_bonus = 3

    candle_score = min(candle_score + context_bonus, 15)

    # ── Volume score (0-10 pts) ───────────────────────────────────────────
    vol_score = 10 if vr >= 1.5 else (7 if vr >= 1.2 else (5 if vr >= 1.0 else 3))

    # ── Fibonacci bonus (0-5 pts) ─────────────────────────────────────────
    fib_bonus = fibonacci_score(highs, lows, closes, i, direction)

    # ── TOTAL SCORE ───────────────────────────────────────────────────────
    # Alignment bonus: FVG inside value area = institutional confluence
    align_bonus = 3 if (va_score >= 15 and best_fvg["age"] <= 7) else 0

    total = htf_score + va_score + fvg_score + candle_score + vol_score + fib_bonus + align_bonus
    total = min(total, 100)

    if total < MIN_SCORE:
        return None

    return direction, total, {
        "htf":        htf_score,
        "value_area": va_score,
        "fvg":        fvg_score,
        "candle":     candle_score,
        "volume":     vol_score,
        "fib_bonus":  fib_bonus,
        "align":      align_bonus,
        "total":      total,
        "e50":        round(e50, 2),
        "e200":       round(e200, 2),
        "vp_weekly":  vp_weekly,
        "fvg_detail": best_fvg,
        "va_label":   va_label,
    }


# ── Trade Dataclass ───────────────────────────────────────────────────────────

@dataclass
class Trade:
    date:          str
    ticker:        str
    direction:     str
    score:         int
    entry_price:   float
    exit_price:    float
    premium:       float
    exit_premium:  float
    pnl_pct:       float
    pnl_dollars:   float
    win:           bool
    exit_type:     str    # "profit_target" | "stopped_out" | "expiry"
    hold_days:     int
    sigma:         float


# ── Trade Simulator ───────────────────────────────────────────────────────────

def simulate_trade(
    opens:   np.ndarray,
    highs:   np.ndarray,
    lows:    np.ndarray,
    closes:  np.ndarray,
    signal_bar: int,
    direction:  str,
    sigma:      float,
) -> Optional[Tuple]:
    """
    Simulate a 7-DTE options trade entered on next-day open.

    Entry: bar (signal_bar + 1) at open price
    Exit:  daily check for stop (close-based) or target (intraday best)
    """
    ei = signal_bar + 1
    if ei >= len(closes):
        return None

    S = float(opens[ei])
    if S <= 0:
        return None

    T0      = DTE / 252.0
    cp      = "C" if direction == "CALL" else "P"
    K       = S                  # ATM strike
    premium = bs_price(S, K, T0, RISK_FREE, sigma, cp)
    if premium < 0.05:
        premium = S * 0.004      # Fallback floor (0.4% of underlying)

    exit_bar     = min(ei + DTE, len(closes) - 1)
    exit_type    = "expiry"
    exit_premium = 0.0
    exit_price   = S
    hold_days    = 0

    for bar in range(ei + 1, exit_bar + 1):
        T_rem = max((exit_bar - bar) / 252.0, 0.5 / 252.0)
        h = float(highs[bar])
        l = float(lows[bar])
        c = float(closes[bar])
        hold_days = bar - ei

        # ── Check profit target using best intraday price ─────────────
        S_best  = h if direction == "CALL" else l
        p_best  = bs_price(S_best, K, T_rem, RISK_FREE, sigma, cp)
        pnl_best = (p_best - premium) / premium

        if pnl_best >= PROFIT_TGT:
            exit_type    = "profit_target"
            exit_premium = p_best
            exit_price   = S_best
            break

        # ── Check stop loss using CLOSE (structural invalidation) ──────
        p_close  = bs_price(c, K, T_rem, RISK_FREE, sigma, cp)
        pnl_close = (p_close - premium) / premium

        if pnl_close <= -STOP_LOSS:
            exit_type    = "stopped_out"
            exit_premium = premium * (1 - STOP_LOSS)
            exit_price   = c
            break

        # ── Final day: exit at close ───────────────────────────────────
        if bar == exit_bar:
            exit_premium = bs_price(c, K, max(0.5 / 252.0, 0.0), RISK_FREE, sigma, cp)
            exit_price   = c

    pnl_pct     = (exit_premium - premium) / max(premium, 1e-6) * 100
    pnl_dollars = pnl_pct / 100 * premium * 100 * CONTRACTS  # per contract

    return exit_premium, pnl_pct, pnl_dollars, exit_type, exit_price, premium, hold_days


# ── Per-Ticker Backtest ───────────────────────────────────────────────────────

def run_ticker(ticker: str, closes: np.ndarray, opens: np.ndarray,
               highs: np.ndarray, lows: np.ndarray, volumes: np.ndarray,
               dates, verbose: bool = False) -> List[Trade]:
    trades = []
    n = len(closes)
    in_trade_until = -1

    for i in range(WARMUP, n - 1):
        if i <= in_trade_until:
            continue

        sig = detect_signal(opens, highs, lows, closes, volumes, dates, i)
        if sig is None:
            continue

        direction, score, breakdown = sig

        # Estimate IV at entry bar (next bar)
        ei    = i + 1
        sigma = estimate_iv(closes, ei)

        result = simulate_trade(opens, highs, lows, closes, i, direction, sigma)
        if result is None:
            continue

        exit_premium, pnl_pct, pnl_dollars, exit_type, exit_price, premium, hold_days = result

        try:
            entry_date = str(dates[ei])[:10]
        except Exception:
            entry_date = str(dates[i])[:10]

        t = Trade(
            date         = entry_date,
            ticker       = ticker,
            direction    = direction,
            score        = score,
            entry_price  = round(float(opens[ei]), 2),
            exit_price   = round(float(exit_price), 2),
            premium      = round(float(premium), 4),
            exit_premium = round(float(exit_premium), 4),
            pnl_pct      = round(float(pnl_pct), 2),
            pnl_dollars  = round(float(pnl_dollars), 2),
            win          = pnl_pct > 0,
            exit_type    = exit_type,
            hold_days    = hold_days,
            sigma        = round(sigma, 4),
        )
        trades.append(t)

        if verbose:
            icon = "✓" if t.win else "✗"
            print(f"  {icon} {ticker} {t.date} {direction:4s} sc={score}"
                  f" | prem=${premium:.2f} | {exit_type:<14}"
                  f" | {pnl_pct:+.1f}%  (${pnl_dollars:+.0f})")

        # Don't stack trades on same ticker
        in_trade_until = i + DTE

    return trades


# ── Statistics ────────────────────────────────────────────────────────────────

def compute_stats(trades: List[Trade], label: str = "") -> Dict:
    if not trades:
        return {"label": label, "total_signals": 0, "win_rate": 0.0,
                "profit_factor": 0.0, "total_pnl": 0.0}

    wins   = [t for t in trades if t.win]
    losses = [t for t in trades if not t.win]

    gross_profit = sum(t.pnl_dollars for t in wins)   if wins   else 0.0
    gross_loss   = abs(sum(t.pnl_dollars for t in losses)) if losses else 0.0

    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else float("inf")
    total_pnl     = sum(t.pnl_dollars for t in trades)
    win_rate      = len(wins) / len(trades) * 100

    # Per-year breakdown
    by_year: Dict[int, Dict] = {}
    for t in trades:
        yr = int(t.date[:4]) if len(t.date) >= 4 else 0
        if yr not in by_year:
            by_year[yr] = {"trades": 0, "wins": 0, "pnl": 0.0}
        by_year[yr]["trades"] += 1
        if t.win: by_year[yr]["wins"] += 1
        by_year[yr]["pnl"] += t.pnl_dollars
    for yr in by_year:
        by_year[yr]["win_rate"] = round(
            by_year[yr]["wins"] / max(by_year[yr]["trades"], 1) * 100, 1)
        by_year[yr]["pnl"] = round(by_year[yr]["pnl"], 2)

    # Per-ticker
    by_ticker: Dict[str, Dict] = {}
    for t in trades:
        if t.ticker not in by_ticker:
            by_ticker[t.ticker] = {"trades": 0, "wins": 0, "pnl": 0.0}
        by_ticker[t.ticker]["trades"] += 1
        if t.win: by_ticker[t.ticker]["wins"] += 1
        by_ticker[t.ticker]["pnl"] += t.pnl_dollars
    for tk in by_ticker:
        by_ticker[tk]["win_rate"] = round(
            by_ticker[tk]["wins"] / max(by_ticker[tk]["trades"], 1) * 100, 1)
        by_ticker[tk]["pnl"] = round(by_ticker[tk]["pnl"], 2)

    # By direction
    calls = [t for t in trades if t.direction == "CALL"]
    puts  = [t for t in trades if t.direction == "PUT"]
    call_wr = len([t for t in calls if t.win]) / max(len(calls), 1) * 100
    put_wr  = len([t for t in puts  if t.win]) / max(len(puts),  1) * 100

    # Exit type breakdown
    exit_types: Dict[str, int] = {}
    for t in trades:
        exit_types[t.exit_type] = exit_types.get(t.exit_type, 0) + 1

    # Equity curve + drawdown
    running = 0.0; peak = 0.0; max_dd = 0.0
    equity_curve = []
    for t in sorted(trades, key=lambda x: x.date):
        running += t.pnl_dollars
        equity_curve.append(running)
        if running > peak: peak = running
        dd = peak - running
        if dd > max_dd: max_dd = dd

    # Sharpe ratio
    pnl_pcts = [t.pnl_pct for t in trades]
    sr = 0.0
    if len(pnl_pcts) > 1:
        mu = float(np.mean(pnl_pcts))
        sd = float(np.std(pnl_pcts))
        sr = (mu - RISK_FREE / 252) / max(sd, 1e-9) * math.sqrt(252)

    # Avg hold time
    avg_hold = float(np.mean([t.hold_days for t in trades]))

    # Best and worst
    sorted_t = sorted(trades, key=lambda x: x.pnl_dollars, reverse=True)
    best5    = [asdict(t) for t in sorted_t[:5]]
    worst5   = [asdict(t) for t in sorted_t[-5:]]

    return {
        "label":           label,
        "period":          f"{START_DATE} → {END_DATE}",
        "total_signals":   len(trades),
        "wins":            len(wins),
        "losses":          len(losses),
        "win_rate":        round(win_rate, 1),
        "profit_factor":   round(profit_factor, 2),
        "total_pnl":       round(total_pnl, 2),
        "gross_profit":    round(gross_profit, 2),
        "gross_loss":      round(-gross_loss, 2),
        "avg_win_pct":     round(float(np.mean([t.pnl_pct for t in wins])), 1) if wins else 0.0,
        "avg_loss_pct":    round(float(np.mean([t.pnl_pct for t in losses])), 1) if losses else 0.0,
        "avg_pnl_per_trade": round(total_pnl / len(trades), 2),
        "max_drawdown":    round(max_dd, 2),
        "sharpe_ratio":    round(sr, 2),
        "avg_hold_days":   round(avg_hold, 1),
        "call_trades":     len(calls),
        "put_trades":      len(puts),
        "call_win_rate":   round(call_wr, 1),
        "put_win_rate":    round(put_wr, 1),
        "exit_types":      exit_types,
        "by_year":         by_year,
        "by_ticker":       by_ticker,
        "best_5":          best5,
        "worst_5":         worst5,
        "equity_curve_final": round(equity_curve[-1], 2) if equity_curve else 0.0,
    }


def print_stats(stats: Dict) -> None:
    if stats["total_signals"] == 0:
        print("  No trades generated.")
        return

    wr  = stats["win_rate"]
    pf  = stats["profit_factor"]
    n   = stats["total_signals"]
    pnl = stats["total_pnl"]

    wr_icon = "✅" if wr >= 75 else ("⚡" if wr >= 65 else "❌")
    pf_icon = "✅" if pf >= 5.0 else ("⚡" if pf >= 3.0 else "❌")

    print(f"\n{'═'*68}")
    print(f"  {stats['label']:^64}")
    print(f"{'═'*68}")
    print(f"  Period:        {stats['period']}")
    print(f"{'─'*68}")
    print(f"  Total Trades:  {n}  ({stats['call_trades']} CALL / {stats['put_trades']} PUT)")
    print(f"  Win Rate:      {wr:.1f}%  {wr_icon}  (CALL {stats['call_win_rate']:.1f}% / PUT {stats['put_win_rate']:.1f}%)")
    print(f"  Profit Factor: {pf:.2f}x  {pf_icon}")
    print(f"  Total P&L:     ${pnl:+,.2f}")
    print(f"  Avg P&L/trade: ${stats['avg_pnl_per_trade']:+.2f}")
    print(f"  Avg Win:       +{stats['avg_win_pct']:.1f}%    Avg Loss: {stats['avg_loss_pct']:.1f}%")
    print(f"  Max Drawdown:  ${stats['max_drawdown']:.2f}")
    print(f"  Sharpe Ratio:  {stats['sharpe_ratio']:.2f}")
    print(f"  Avg Hold:      {stats['avg_hold_days']:.1f} days")
    print(f"{'─'*68}")

    print(f"  Exit Types:  {stats['exit_types']}")
    print(f"{'─'*68}")

    print(f"  By Year:")
    for yr, d in sorted(stats["by_year"].items()):
        trades_per_yr = d["trades"]
        bar_fill = "█" * int(d["win_rate"] / 10) + "░" * (10 - int(d["win_rate"] / 10))
        print(f"    {yr}: {trades_per_yr:>3} trades  WR {bar_fill} {d['win_rate']:.1f}%  P&L ${d['pnl']:+.0f}")
    print(f"{'─'*68}")

    print(f"  By Ticker:")
    for tk, d in stats["by_ticker"].items():
        bar = "█" * int(d["win_rate"] / 10) + "░" * (10 - int(d["win_rate"] / 10))
        print(f"    {tk:>4}: {d['trades']:>3} trades  WR {bar} {d['win_rate']:.1f}%  P&L ${d['pnl']:+.0f}")
    print(f"{'─'*68}")

    print(f"  Top 5 Trades:")
    for t in stats["best_5"]:
        print(f"    {t['date']}  {t['ticker']:<4} {t['direction']:<4}  "
              f"${t['pnl_dollars']:+6.0f}  ({t['pnl_pct']:+.1f}%)  sc={t['score']}  [{t['exit_type']}]")

    print(f"  Worst 5 Trades:")
    for t in stats["worst_5"]:
        print(f"    {t['date']}  {t['ticker']:<4} {t['direction']:<4}  "
              f"${t['pnl_dollars']:+6.0f}  ({t['pnl_pct']:+.1f}%)  sc={t['score']}  [{t['exit_type']}]")

    print(f"{'═'*68}")
    targets_met = wr >= 75.0 and pf >= 5.0 and n >= 50
    if targets_met:
        print(f"  🎯 TARGETS MET: WR={wr:.1f}% ≥ 75%  |  PF={pf:.2f}x ≥ 5x  |  N={n} ≥ 50")
    else:
        gap_wr = max(0, 75 - wr)
        gap_pf = max(0, 5.0 - pf)
        missing = []
        if wr < 75:   missing.append(f"WR needs +{gap_wr:.1f}%")
        if pf < 5.0:  missing.append(f"PF needs +{gap_pf:.2f}x")
        if n < 50:    missing.append(f"Need {50-n} more trades")
        print(f"  ⚡ Gap: {' | '.join(missing)}")
    print(f"{'═'*68}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    import time
    parser = argparse.ArgumentParser(description="V3 SMR Options Backtest — 5-Year 2020-2025")
    parser.add_argument("--tickers", nargs="+", default=TICKERS, help="Tickers")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--min-score", type=int, default=MIN_SCORE)
    args = parser.parse_args()

    tickers = [t.upper() for t in args.tickers]

    print(f"\n{'='*68}")
    print(f"  V3 OPTIONS STRATEGY — STRUCTURAL MEAN REVERSION (SMR)")
    print(f"  Universe: {', '.join(tickers)}")
    print(f"  Period:   {START_DATE}  →  {END_DATE}")
    print(f"  Account:  ${ACCOUNT:,.0f}")
    print(f"  DTE:      {DTE} days  |  Stop: {STOP_LOSS:.0%}  |  Target: {PROFIT_TGT:.0%}")
    print(f"  Min Score: {args.min_score}/100")
    print(f"{'='*68}\n")

    # ── Download data ──────────────────────────────────────────────────────
    print("  Downloading 5-year market data (2020-2025)...")
    data_cache = {}
    for ticker in tickers:
        print(f"    {ticker}...", end=" ", flush=True)
        try:
            df = yf.download(
                ticker,
                start=START_DATE.strftime("%Y-%m-%d"),
                end=(END_DATE + timedelta(days=30)).strftime("%Y-%m-%d"),
                progress=False, auto_adjust=True
            )
            if df.empty or len(df) < 250:
                print(f"skipped ({len(df)} rows)")
                continue
            if hasattr(df.columns, "levels"):
                df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            df = df.dropna()
            # Filter to period
            df = df[df.index <= str(END_DATE)]
            data_cache[ticker] = (
                df["Close"].values.astype(float),
                df["Open"].values.astype(float),
                df["High"].values.astype(float),
                df["Low"].values.astype(float),
                df["Volume"].values.astype(float),
                df.index.tolist(),
            )
            print(f"ok ({len(df)} days, {df.index[0].date()} to {df.index[-1].date()})")
        except Exception as e:
            print(f"FAILED ({e})")

    if not data_cache:
        print("ERROR: No data. Check internet connection.")
        return

    # ── Run backtest ────────────────────────────────────────────────────────
    t0 = time.time()
    all_trades: List[Trade] = []

    for ticker, (closes, opens, highs, lows, volumes, dates) in data_cache.items():
        print(f"\n  [{ticker}] Running V3 SMR backtest ({len(closes)} bars)...")
        ticker_trades = run_ticker(
            ticker, closes, opens, highs, lows, volumes, dates,
            verbose=args.verbose
        )
        print(f"  [{ticker}] {len(ticker_trades)} signals generated")
        all_trades.extend(ticker_trades)

    if not all_trades:
        print("\n  No trades — check parameters.")
        return

    # Sort by date
    all_trades.sort(key=lambda x: x.date)

    stats = compute_stats(all_trades, "V3 SMR — Structural Mean Reversion")
    print_stats(stats)

    print(f"\n  Runtime: {time.time()-t0:.1f}s")

    # Save results
    import json

    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, (np.integer,)): return int(obj)
            if isinstance(obj, (np.floating,)): return float(obj)
            if isinstance(obj, np.ndarray): return obj.tolist()
            if isinstance(obj, np.bool_): return bool(obj)
            return super().default(obj)

    out = os.path.join(os.path.dirname(__file__), "backtest_v3_smr_results.json")
    payload = {
        "stats":  stats,
        "params": {
            "tickers": tickers, "start": str(START_DATE), "end": str(END_DATE),
            "dte": DTE, "stop_loss": STOP_LOSS, "profit_target": PROFIT_TGT,
            "min_score": args.min_score, "warmup": WARMUP,
        },
        "trades": [asdict(t) for t in all_trades],
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, cls=NumpyEncoder)
    print(f"\n  Results saved → backtest_v3_smr_results.json")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Paper Trading Engine — V2 Model
==================================
Tracks live forward performance of the V2 0DTE model using real market data.

HOW IT WORKS
  • Runs daily (ideal: 4:15 PM ET, after market close, any time after works)
  • Downloads real OHLCV data (daily + 1h intraday) via yfinance
  • Applies V2 filters to generate signals as of 10:30 AM ET (after 1st hour ORB)
  • Simulates entry at 10:30 AM price; exit via 50% stop / 150% target or close
  • Saves every trade to paper_trades.json
  • Auto-runs the enhanced backtest (ADX+ORB) once 50 trades are collected

USAGE
  python paper_trader.py               # Log today's paper trades (run after close)
  python paper_trader.py --status      # Show running stats only (no new trades)
  python paper_trader.py --backtest    # Force-run enhanced ADX+ORB backtest now
  python paper_trader.py --schedule    # Print Windows Task Scheduler setup command

SCHEDULE (auto-run daily at 4:15 PM ET on weekdays)
  See: python paper_trader.py --schedule
"""

import sys, os, json, math, time, argparse
import numpy as np
from datetime import datetime, timedelta, date
from dataclasses import dataclass, asdict
from typing import List, Optional
import pytz

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./robinhood_dev.db")

import yfinance as yf
from scipy.stats import norm

# ── Config ────────────────────────────────────────────────────────────
WATCHLIST        = ["SPY", "QQQ", "AAPL", "TSLA", "NVDA", "MSFT", "META", "AMD", "AMZN", "GOOGL"]
PAPER_FILE       = os.path.join(os.path.dirname(__file__), "paper_trades.json")
BACKTEST_TRIGGER = 50        # auto-run enhanced backtest at this count
RISK_FREE        = 0.052
CONTRACTS        = 1
STOP_LOSS        = 0.50      # 50% premium stop
PROFIT_TARGET    = 1.50      # 150% profit target → exit at 2.5x premium
T_MID            = 3.0 / 252 # midday BS time-to-expiry
ET               = pytz.timezone("America/New_York")

# V2 filter thresholds (mirrors backtest.py V2)
MIN_VOL_RATIO    = 2.0
MAX_IV_RANK      = 0.65
MIN_ATR_RATIO    = 1.3
MIN_ADX          = 22.0      # trend strength gate (V2.1 addition)
MIN_CONF         = 0.70
ORB_HOLD_PCT     = 0.60      # close must be in top/bottom 40% of day's range
MIN_MOVE_EDGE    = 0.25      # projected intrinsic at 1-ATR move must be ≥ 1.25× premium

# Per-ticker ADX overrides — tickers that historically generate weak-continuation
# false positives require a stricter trend-strength gate before entry.
# Key = ticker, value = dict of direction → minimum ADX required.
# "CALL" in AMZN requires ADX > 28 because AMZN uptrend CALLs have 0% win rate
# across 5 historical signals (all small-move failures).
TICKER_ADX_OVERRIDES: dict = {
    "AMZN": {"CALL": 28.0},   # AMZN calls only in high-conviction uptrends
}


# ── Data class ────────────────────────────────────────────────────────
@dataclass
class PaperTrade:
    trade_id:        str
    date:            str
    ticker:          str
    direction:       str       # CALL / PUT
    strategy:        str
    entry_time:      str       # "10:30 AM ET"
    entry_price:     float     # stock price at entry
    strike:          float
    premium:         float     # option premium at entry (BS estimate)
    exit_val:        float     # option value at exit
    pnl_dollars:     float
    pnl_pct:         float
    win:             bool
    exit_type:       str       # stopped_out | profit_target | expiry
    stock_close:     float
    stock_move_pct:  float
    confidence:      float
    volume_ratio:    float
    rsi:             float
    adx:             float
    iv_rank:         float
    market_structure: str
    orb_confirmed:   bool


# ── Indicators ────────────────────────────────────────────────────────
def compute_rsi(closes: np.ndarray, period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas    = np.diff(closes)
    gains     = np.where(deltas > 0, deltas, 0.0)
    losses    = np.where(deltas < 0, -deltas, 0.0)
    avg_gain  = gains[-period:].mean()
    avg_loss  = losses[-period:].mean()
    if avg_loss == 0:
        return 100.0
    return round(100 - 100 / (1 + avg_gain / avg_loss), 2)


def compute_atr(highs, lows, closes, period=14) -> float:
    if len(closes) < period + 1:
        return closes[-1] * 0.01
    tr = [max(highs[j] - lows[j], abs(highs[j] - closes[j-1]), abs(lows[j] - closes[j-1]))
          for j in range(1, min(period + 1, len(closes)))]
    return float(np.mean(tr)) if tr else closes[-1] * 0.01


def compute_adx(highs, lows, closes, period=14) -> float:
    """
    Wilder's Average Directional Index — measures trend strength 0-100.
    > 25 = strong trend.  < 20 = no trend / choppy.
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
    for atr, pdm, mdm in zip(atr_s, pdm_s, mdm_s):
        if atr == 0:
            dx_vals.append(0.0)
            continue
        pdi = 100 * pdm / atr
        mdi = 100 * mdm / atr
        denom = pdi + mdi
        dx_vals.append(100 * abs(pdi - mdi) / denom if denom > 0 else 0.0)

    if len(dx_vals) < period:
        return 0.0
    adx = sum(dx_vals[-period:]) / period
    return round(adx, 2)


def realised_vol(closes: np.ndarray, window: int = 20) -> float:
    if len(closes) < window + 1:
        return 0.30
    rets = np.diff(np.log(closes[-window-1:]))
    return float(np.std(rets) * math.sqrt(252))


def compute_iv_rank(closes: np.ndarray, lookback: int = 252) -> float:
    if len(closes) < 50:
        return 0.50
    current_rv = realised_vol(closes, 20)
    start      = max(30, len(closes) - lookback)
    hist       = [realised_vol(closes[:j+1], 20) for j in range(start, len(closes) - 1, 5)]
    if not hist:
        return 0.50
    return round(sum(1 for rv in hist if rv <= current_rv) / len(hist), 3)


# ── Black-Scholes ─────────────────────────────────────────────────────
def bs_price(S, K, T, r, sigma, kind="call") -> float:
    if T <= 0 or sigma <= 0:
        return max((S - K if kind == "call" else K - S), 0.01)
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


# ── V2 Scoring (mirrors backtest.py V2) ──────────────────────────────
def score_technical(direction, price_vs_vwap, market_structure, macd_approx) -> float:
    score = 0.0
    if direction == "CALL":
        score += 15 if price_vs_vwap > 0.5 else (10 if price_vs_vwap > 0.25 else (5 if price_vs_vwap > 0.10 else 0))
        if market_structure == "uptrend":    score += 15
        elif market_structure == "neutral":  score += 5
        if macd_approx == "bullish":         score += 10
    else:
        score += 15 if price_vs_vwap < -0.5 else (10 if price_vs_vwap < -0.25 else (5 if price_vs_vwap < -0.10 else 0))
        if market_structure == "downtrend":  score += 15
        elif market_structure == "neutral":  score += 5
        if macd_approx == "bearish":         score += 10
    return min(score, 40.0)


def score_volume(volume_ratio) -> float:
    if volume_ratio >= 3.0: return 15
    if volume_ratio >= 2.5: return 12
    if volume_ratio >= 2.0: return 8
    if volume_ratio >= 1.5: return 4
    return 0


# ── Signal detection ──────────────────────────────────────────────────
def detect_signal(
    ticker: str, closes: np.ndarray, opens: np.ndarray,
    highs: np.ndarray, lows: np.ndarray, volumes: np.ndarray
) -> Optional[dict]:
    """
    Apply V2 + ADX + ORB filters to today's data.
    Returns signal dict or None.
    """
    if len(closes) < 35:
        return None

    i = len(closes) - 1   # today

    # ── Indicators ───────────────────────────────────────────────────
    rsi           = compute_rsi(closes)
    vol20         = volumes[i-20:i].mean()
    volume_ratio  = volumes[i] / vol20 if vol20 > 0 else 1.0
    sma20         = closes[i-20:i].mean()
    vwap_proxy    = (highs[i] + lows[i] + closes[i]) / 3
    price_vs_vwap = (closes[i] - vwap_proxy) / vwap_proxy * 100
    rv            = realised_vol(closes)
    atr           = compute_atr(highs, lows, closes)
    adx           = compute_adx(highs, lows, closes)
    iv_rank       = compute_iv_rank(closes)

    market_structure = (
        "uptrend"   if closes[i] > sma20 * 1.005 else
        "downtrend" if closes[i] < sma20 * 0.995 else "neutral"
    )
    ema12       = float(np.mean(closes[max(0,i-12):i]))
    ema26       = float(np.mean(closes[max(0,i-26):i]))
    macd_approx = "bullish" if ema12 > ema26 else "bearish"

    # ── Hard gates ───────────────────────────────────────────────────
    if iv_rank > MAX_IV_RANK:                              return None
    if volume_ratio < MIN_VOL_RATIO:                       return None
    if adx < MIN_ADX:                                      return None

    S_est  = closes[i]
    K_est  = select_strike(S_est, "CALL")
    prem_e = bs_price(S_est, K_est, 6.5/252, RISK_FREE, max(rv*1.20, 0.15), "call")
    if atr / max(prem_e, 0.01) < MIN_ATR_RATIO:           return None
    if (atr / closes[i] * 100) < 0.7:                     return None
    if i < 3:                                              return None

    # ── ORB confirmation (daily proxy) ───────────────────────────────
    day_range = highs[i] - lows[i]
    close_pct = (closes[i] - lows[i]) / day_range if day_range > 0 else 0.5

    direction, strategy = None, "MOMENTUM"

    # CALL signal
    if (46 <= rsi <= 66 and
        market_structure == "uptrend" and
        price_vs_vwap > 0.10 and
        macd_approx == "bullish" and
        closes[i-1] > closes[i-2]):
        direction = "CALL"

    # PUT signal
    elif (34 <= rsi <= 54 and
          market_structure == "downtrend" and
          price_vs_vwap < -0.10 and
          macd_approx == "bearish" and
          closes[i-1] < closes[i-2]):
        direction = "PUT"

    if direction is None:
        return None

    # ── Per-ticker ADX override (e.g., AMZN CALL needs ADX > 28) ────
    ticker_overrides = TICKER_ADX_OVERRIDES.get(ticker, {})
    min_adx_required = ticker_overrides.get(direction, MIN_ADX)
    if adx < min_adx_required:
        return None

    # ── Minimum expected move filter (V2.2) ──────────────────────────
    # Entry proxy: today's close (we don't have tomorrow's open yet at scan time).
    # Project intrinsic if stock moves by 1 full ATR in the signal direction.
    # Reject if even a full-ATR move can't return MIN_MOVE_EDGE above premium paid.
    # This eliminates "right direction, insufficient magnitude" losses.
    S_scan     = closes[i]
    K_dir      = select_strike(S_scan, direction)
    iv_scan    = max(rv * 1.20, 0.15)
    prem_dir   = bs_price(S_scan, K_dir, 6.5 / 252, RISK_FREE, iv_scan,
                          kind=direction.lower())
    if direction == "CALL":
        proj_intrinsic = max(S_scan + atr - K_dir, 0.0)
    else:
        proj_intrinsic = max(K_dir - (S_scan - atr), 0.0)
    if prem_dir > 0 and proj_intrinsic < prem_dir * (1 + MIN_MOVE_EDGE):
        return None  # full-ATR move can't cover premium + 25% edge → skip

    # ── ORB confirmation check ───────────────────────────────────────
    orb_ok = (
        (direction == "CALL" and close_pct >= ORB_HOLD_PCT and closes[i] > opens[i]) or
        (direction == "PUT"  and close_pct <= (1 - ORB_HOLD_PCT) and closes[i] < opens[i])
    )

    # ── Scoring ──────────────────────────────────────────────────────
    tech   = score_technical(direction, price_vs_vwap, market_structure, macd_approx)
    vol_s  = score_volume(volume_ratio)
    news_s = 5.0    # no live news in paper mode
    time_s = 10.0   # assume power hour
    opt_s  = 8.0    # assume decent liquidity
    conf   = (tech + vol_s + news_s + time_s + opt_s) / 100.0

    if conf < MIN_CONF:
        return None

    return {
        "ticker":           ticker,
        "direction":        direction,
        "strategy":         strategy,
        "rsi":              rsi,
        "volume_ratio":     round(volume_ratio, 2),
        "adx":              adx,
        "iv_rank":          iv_rank,
        "price_vs_vwap":    round(price_vs_vwap, 3),
        "market_structure": market_structure,
        "macd":             macd_approx,
        "orb_confirmed":    orb_ok,
        "confidence":       round(conf, 3),
        "rv":               rv,
        "atr":              atr,
        "close":            closes[i],
        "high":             highs[i],
        "low":              lows[i],
        "open":             opens[i],
    }


# ── Intraday exit simulation ──────────────────────────────────────────
def simulate_exit(S_open, K, direction, premium, high, low, close, rv) -> tuple:
    """Simulate 50% stop + 150% target using day's high/low."""
    iv = max(rv * 1.20, 0.15)

    if direction == "CALL":
        opt_worst = bs_price(low,  K, T_MID, RISK_FREE, iv * 1.15, "call")
        if opt_worst <= premium * (1 - STOP_LOSS):
            ev = premium * (1 - STOP_LOSS)
            return ev, -STOP_LOSS * 100, False, "stopped_out"
        opt_best = bs_price(high, K, T_MID, RISK_FREE, iv * 0.90, "call")
        if opt_best >= premium * (1 + PROFIT_TARGET):
            ev = premium * (1 + PROFIT_TARGET)
            return ev, PROFIT_TARGET * 100, True, "profit_target"
        intrinsic = max(close - K, 0.0)
    else:
        opt_worst = bs_price(high, K, T_MID, RISK_FREE, iv * 1.15, "put")
        if opt_worst <= premium * (1 - STOP_LOSS):
            ev = premium * (1 - STOP_LOSS)
            return ev, -STOP_LOSS * 100, False, "stopped_out"
        opt_best = bs_price(low,  K, T_MID, RISK_FREE, iv * 0.90, "put")
        if opt_best >= premium * (1 + PROFIT_TARGET):
            ev = premium * (1 + PROFIT_TARGET)
            return ev, PROFIT_TARGET * 100, True, "profit_target"
        intrinsic = max(K - close, 0.0)

    pnl_pct = (intrinsic - premium) / premium * 100 if premium > 0 else -100.0
    return intrinsic, pnl_pct, intrinsic > premium, "expiry"


# ── Paper trade storage ───────────────────────────────────────────────
def load_paper_trades() -> List[dict]:
    if not os.path.exists(PAPER_FILE):
        return []
    with open(PAPER_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_paper_trades(trades: List[dict]):
    with open(PAPER_FILE, "w", encoding="utf-8") as f:
        json.dump(trades, f, indent=2)


def already_logged(ticker: str, direction: str, trade_date: str, trades: List[dict]) -> bool:
    """Prevent duplicate entries for same ticker+direction on same day."""
    return any(
        t["ticker"] == ticker and
        t["direction"] == direction and
        t["date"] == trade_date
        for t in trades
    )


# ── Stats printer ─────────────────────────────────────────────────────
def print_stats(trades: List[dict]):
    if not trades:
        print("\n  No paper trades logged yet.\n")
        return

    wins   = [t for t in trades if t["win"]]
    losses = [t for t in trades if not t["win"]]
    pnls   = [t["pnl_dollars"] for t in trades]
    total  = sum(pnls)
    gp     = sum(t["pnl_dollars"] for t in wins)
    gl     = abs(sum(t["pnl_dollars"] for t in losses))
    pf     = gp / gl if gl > 0 else float("inf")
    wr     = len(wins) / len(trades) * 100

    by_ticker = {}
    by_exit   = {}
    for t in trades:
        tk = t["ticker"]
        by_ticker.setdefault(tk, {"wins": 0, "trades": 0, "pnl": 0.0})
        by_ticker[tk]["trades"] += 1
        by_ticker[tk]["wins"]   += int(t["win"])
        by_ticker[tk]["pnl"]    += t["pnl_dollars"]
        et = t.get("exit_type", "expiry")
        by_exit[et] = by_exit.get(et, 0) + 1

    orb_wins   = sum(1 for t in wins   if t.get("orb_confirmed"))
    orb_total  = sum(1 for t in trades if t.get("orb_confirmed"))
    adx_avg    = np.mean([t.get("adx", 0) for t in trades])
    remaining  = max(0, BACKTEST_TRIGGER - len(trades))

    print(f"\n{'='*60}")
    print(f"  PAPER TRADING — LIVE FORWARD PERFORMANCE")
    print(f"  {len(trades)} trades logged  |  {remaining} until enhanced backtest")
    print(f"{'='*60}")
    print(f"  Win Rate         : {wr:.1f}%  ({len(wins)}W / {len(losses)}L)")
    print(f"  Total P&L        : ${total:+,.2f}")
    print(f"  Profit Factor    : {pf:.2f}x")
    print(f"  Avg Win          : +{np.mean([t['pnl_pct'] for t in wins]):.1f}%"  if wins   else "  Avg Win         : —")
    print(f"  Avg Loss         : {np.mean([t['pnl_pct'] for t in losses]):.1f}%" if losses else "  Avg Loss         : —")
    print(f"  Max Drawdown     : ${min(0, min(np.cumsum(pnls) - np.maximum.accumulate(np.cumsum(pnls)))):.2f}")
    print(f"  Avg ADX          : {adx_avg:.1f}")
    print(f"  ORB Confirmed    : {orb_total} trades  ({orb_wins} wins, {orb_wins/orb_total*100:.0f}% wr)" if orb_total > 0 else "  ORB Confirmed    : 0 trades")
    print(f"\n  --- Exit Types ---")
    for et, cnt in by_exit.items():
        print(f"  {et:<20}  {cnt:3d} trades")
    print(f"\n  --- By Ticker ---")
    for tk, s in sorted(by_ticker.items(), key=lambda x: x[1]["pnl"], reverse=True):
        wr_tk = s["wins"] / s["trades"] * 100
        arrow = "▲" if s["pnl"] >= 0 else "▼"
        print(f"  {tk:<6}  {arrow} ${s['pnl']:+7.2f}  win={wr_tk:.0f}%  ({s['trades']} trades)")

    print(f"\n  --- Last 10 Trades ---")
    for t in trades[-10:]:
        arrow = "✅" if t["win"] else "❌"
        print(f"  {arrow}  {t['date']}  {t['ticker']:<5} {t['direction']:<4}  "
              f"${t['pnl_dollars']:+7.2f}  ({t['pnl_pct']:+.0f}%)  "
              f"[{t.get('exit_type','?')}]  ADX={t.get('adx',0):.0f}  ORB={'Y' if t.get('orb_confirmed') else 'N'}")
    print()

    if len(trades) >= BACKTEST_TRIGGER:
        print(f"  🎯 {BACKTEST_TRIGGER}+ TRADES COLLECTED — Enhanced backtest ready!")
        print(f"  Run: python paper_trader.py --backtest\n")


# ── Main daily scan ───────────────────────────────────────────────────
def run_daily_scan():
    """
    Download real data, detect V2 signals for today, compute paper P&L.
    Should be run at or after 4:15 PM ET on a market day.
    """
    today_str = date.today().strftime("%Y-%m-%d")
    now_et    = datetime.now(ET)

    print(f"\n{'='*60}")
    print(f"  PAPER TRADER — Daily Scan  ({today_str})")
    print(f"{'='*60}\n")

    trades = load_paper_trades()
    new_trades = []

    for ticker in WATCHLIST:
        print(f"  {ticker}...", end=" ", flush=True)
        try:
            # Download 90 days of daily data for indicator computation
            df = yf.download(
                ticker,
                period="90d",
                interval="1d",
                progress=False,
                auto_adjust=True,
            )
            if df.empty or len(df) < 35:
                print(f"no data")
                continue

            # Flatten multi-index columns
            if hasattr(df.columns, "levels"):
                df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            df = df.dropna()

            closes  = df["Close"].values.astype(float)
            opens   = df["Open"].values.astype(float)
            highs   = df["High"].values.astype(float)
            lows    = df["Low"].values.astype(float)
            volumes = df["Volume"].values.astype(float)

            # Detect signal on the most recent complete day
            signal = detect_signal(ticker, closes, opens, highs, lows, volumes)

            if signal is None:
                print(f"no signal")
                continue

            direction  = signal["direction"]
            trade_date = df.index[-1].strftime("%Y-%m-%d")

            if already_logged(ticker, direction, trade_date, trades):
                print(f"already logged")
                continue

            # ── Build paper trade ────────────────────────────────────
            S      = signal["open"]     # entry at open (10:30 AM proxy)
            K      = select_strike(S, direction)
            T_open = 6.5 / 252
            iv     = max(signal["rv"] * 1.20, 0.15)
            prem   = bs_price(S, K, T_open, RISK_FREE, iv, kind=direction.lower())

            exit_val, pnl_pct, win, exit_type = simulate_exit(
                S, K, direction, prem,
                signal["high"], signal["low"], signal["close"], signal["rv"]
            )

            pnl_dollars  = (exit_val - prem) * 100 * CONTRACTS
            stock_move   = (signal["close"] - S) / S * 100

            import uuid
            trade = PaperTrade(
                trade_id        = str(uuid.uuid4())[:8],
                date            = trade_date,
                ticker          = ticker,
                direction       = direction,
                strategy        = signal["strategy"],
                entry_time      = "10:30 AM ET",
                entry_price     = round(S, 2),
                strike          = K,
                premium         = round(prem, 2),
                exit_val        = round(exit_val, 2),
                pnl_dollars     = round(pnl_dollars, 2),
                pnl_pct         = round(pnl_pct, 1),
                win             = win,
                exit_type       = exit_type,
                stock_close     = round(signal["close"], 2),
                stock_move_pct  = round(stock_move, 2),
                confidence      = signal["confidence"],
                volume_ratio    = signal["volume_ratio"],
                rsi             = signal["rsi"],
                adx             = signal["adx"],
                iv_rank         = signal["iv_rank"],
                market_structure= signal["market_structure"],
                orb_confirmed   = signal["orb_confirmed"],
            )

            arrow  = "✅" if win else "❌"
            print(f"{arrow}  {direction}  ${pnl_dollars:+.2f}  ({pnl_pct:+.0f}%)  [{exit_type}]  ADX={signal['adx']:.0f}  ORB={'Y' if signal['orb_confirmed'] else 'N'}")
            new_trades.append(asdict(trade))

        except Exception as e:
            print(f"ERROR: {e}")

    if new_trades:
        trades.extend(new_trades)
        save_paper_trades(trades)
        print(f"\n  ✅ {len(new_trades)} new paper trades logged → paper_trades.json")
    else:
        print(f"\n  No new signals today.")

    print_stats(trades)

    # Auto-trigger enhanced backtest at 50+ trades
    if len(trades) >= BACKTEST_TRIGGER:
        print(f"\n  🚀 Threshold reached — running enhanced ADX+ORB backtest...\n")
        os.system(f'"{sys.executable}" backtest.py --adx-orb')


# ── Status only ───────────────────────────────────────────────────────
def show_status():
    trades = load_paper_trades()
    print_stats(trades)


# ── Enhanced backtest trigger ─────────────────────────────────────────
def run_enhanced_backtest():
    print("\n  Launching enhanced ADX+ORB backtest...\n")
    os.system(f'"{sys.executable}" backtest.py --adx-orb')


# ── Windows Task Scheduler setup ──────────────────────────────────────
def print_schedule_cmd():
    python = sys.executable.replace("\\", "\\\\")
    script = os.path.abspath(__file__).replace("\\", "\\\\")
    print(f"""
  ╔══════════════════════════════════════════════════════════╗
  ║  AUTO-SCHEDULE — Run daily at 4:15 PM ET (weekdays)     ║
  ╚══════════════════════════════════════════════════════════╝

  Option A — Windows Task Scheduler (copy & run in CMD as Admin):

    schtasks /create /tn "PaperTrader" /tr "\"{python}\" \"{script}\"" /sc weekly /d MON,TUE,WED,THU,FRI /st 16:15 /f

  Option B — Run manually each day after market close:

    python paper_trader.py

  Option C — Check status any time:

    python paper_trader.py --status
""")


# ── Entry point ───────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Paper Trading Engine — V2")
    parser.add_argument("--status",   action="store_true", help="Show running stats only")
    parser.add_argument("--backtest", action="store_true", help="Force-run enhanced backtest")
    parser.add_argument("--schedule", action="store_true", help="Print Task Scheduler setup")
    args = parser.parse_args()

    if args.status:
        show_status()
    elif args.backtest:
        run_enhanced_backtest()
    elif args.schedule:
        print_schedule_cmd()
    else:
        run_daily_scan()

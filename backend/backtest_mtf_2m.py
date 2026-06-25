"""
ICT V4.1 — Multi-Timeframe (MTF) Backtest
═══════════════════════════════════════════════════════════════════════════════
Higher-timeframe confluences (HTF bias, regime, value area, daily FVG) define the
WHERE and the DIRECTION; entries are timed on the LOWER timeframe (2-minute) where
a fresh intraday FVG + structure shift aligns with the daily context.

This is the genuine ICT workflow AND it solves the data problem: HTF context comes
from daily bars (available for years); entry timing comes from 2-minute bars
(available for the last ~60 days). We therefore backtest the last ~55 days, where
BOTH exist — so every trade has real 2-minute data to replay.

NO FABRICATION: every bar is real (yfinance). Trades only fire when real intraday
structure aligns with real daily context. If few fire, that's the honest result.
"""

import sys, os, json, math
sys.path.insert(0, os.getcwd())
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")

import numpy as np
import yfinance as yf
from datetime import date, timedelta, datetime
from collections import Counter

import backtest_indices_v4 as bt
from backtest_indices_v4 import bs_price, estimate_iv
from app.core.ict_engine_v4 import (
    detect_fvg_with_mitigation,
    detect_regime,
    compute_fibonacci_confluence,
)

TICKERS = ["SPY", "QQQ", "IWM", "DIA", "XLK"]
RISK_FREE = 0.052

# ── HTF (daily) context ───────────────────────────────────────────────────────

def ema(arr, span):
    a = np.asarray(arr, dtype=float)
    k = 2.0 / (span + 1.0)
    out = np.empty_like(a)
    out[0] = a[0]
    for i in range(1, len(a)):
        out[i] = a[i] * k + out[i-1] * (1 - k)
    return out

def daily_htf_context(dcloses, dhighs, dlows):
    """Compute HTF bias + regime + a value-area band from daily bars (most recent)."""
    if len(dcloses) < 55:
        return None
    ema20 = ema(dcloses, 20)
    ema50 = ema(dcloses, 50)
    c = float(dcloses[-1]); e20 = float(ema20[-1]); e50 = float(ema50[-1])

    bias, score = None, 0
    if e20 > e50 * 1.002 and c > e20 * 0.998:   bias, score = "bullish", 15
    elif e20 > e50 * 1.001 and c > e20:         bias, score = "bullish", 10
    elif e20 > e50 and c > e50:                 bias, score = "bullish", 6
    elif e20 < e50 * 0.998 and c < e20 * 1.002: bias, score = "bearish", 15
    elif e20 < e50 * 0.999 and c < e20:         bias, score = "bearish", 10
    elif e20 < e50 and c < e50:                 bias, score = "bearish", 6
    if bias is None:
        return None

    regime = detect_regime(np.asarray(dcloses), len(dcloses)-1, lookback=10)

    # Value-area band: 70% of the recent daily range (a simple, honest proxy)
    lookback = min(20, len(dhighs))
    hi = float(np.max(dhighs[-lookback:])); lo = float(np.min(dlows[-lookback:]))
    rng = hi - lo
    va_high = hi - rng * 0.15
    va_low  = lo + rng * 0.15

    return {"bias": bias, "htf_score": score, "regime": regime,
            "va_high": va_high, "va_low": va_low, "daily_close": c,
            "ema20": e20, "ema50": e50}


# ── LTF (2-minute) entry detection aligned to HTF ─────────────────────────────

def scan_ltf_entries(tk, o, h, l, c, v, dts, htf, params):
    """
    Scan 2-minute bars for entries that align with daily HTF context.
    Returns a list of trade dicts with full confluence breakdown.
    """
    direction = "CALL" if htf["bias"] == "bullish" else "PUT"

    # Regime gate (same rule as daily engine): don't fight a confirmed regime
    if htf["regime"] == "bull" and direction == "PUT":  return []
    if htf["regime"] == "bear" and direction == "CALL": return []

    trades = []
    WARMUP = 40
    cooldown_until = 0
    n = len(c)

    for i in range(WARMUP, n - 20):
        if i < cooldown_until:
            continue

        ts = dts[i]
        # Only enter during the regular session, and not in the last 30 min
        # (need room to resolve intraday). dts are tz-aware strings.
        try:
            hhmm = ts[11:16]
            if hhmm < "09:40" or hhmm > "15:30":
                continue
        except Exception:
            pass

        price = float(c[i])

        # ── Confluence 1: HTF bias (from daily) — always present by construction
        htf_score = htf["htf_score"]

        # ── Confluence 2: Value Area (price in/near daily VA on the correct side)
        va_score = 0
        in_va = htf["va_low"] <= price <= htf["va_high"]
        if direction == "CALL" and price <= htf["va_low"] * 1.005:
            va_score = 22  # discount — buy at/under value low
        elif direction == "PUT" and price >= htf["va_high"] * 0.995:
            va_score = 22  # premium — sell at/over value high
        elif in_va:
            va_score = 12

        # ── Confluence 3: intraday FVG (the lower-timeframe trigger) ──────────
        fvgs = detect_fvg_with_mitigation(
            np.asarray(h[:i+1]), np.asarray(l[:i+1]), np.asarray(c[:i+1]),
            np.asarray(v[:i+1]), i, lookback=params.get("fvg_lookback", 20),
            min_gap_pct=params.get("min_fvg_pct", 0.0003),
        )
        active = [f for f in fvgs if f.get("active")]
        # Directional FVG aligned to bias
        want = "bullish" if direction == "CALL" else "bearish"
        aligned = [f for f in active if f.get("type") == want]
        if not aligned:
            continue
        best = max(aligned, key=lambda f: f.get("gap_pct", 0))
        gap_pct = best.get("gap_pct", 0)
        fvg_score = min(25, int(6 + gap_pct * 4000))  # scale; ≥6 means present

        # ── Confluence 4: market structure (intraday momentum shift) ─────────
        struct_score = 0
        win = 12
        if i >= win:
            recent_hi = float(np.max(h[i-win:i])); recent_lo = float(np.min(l[i-win:i]))
            if direction == "CALL" and price > recent_hi * 0.999:
                struct_score = 22   # break of intraday structure up
            elif direction == "PUT" and price < recent_lo * 1.001:
                struct_score = 22
            elif direction == "CALL" and c[i] > c[i-1] > c[i-2]:
                struct_score = 12
            elif direction == "PUT" and c[i] < c[i-1] < c[i-2]:
                struct_score = 12
        if struct_score == 0:
            continue  # structure confirmation mandatory

        # ── Confluence 5: Fibonacci OTE (intraday) ───────────────────────────
        fib_score, fib_label, _ = compute_fibonacci_confluence(
            np.asarray(h[:i+1]), np.asarray(l[:i+1]), np.asarray(c[:i+1]), i,
            lookbacks=[10, 20, 30, 40], direction=direction,
        )

        # ── Confluence 6: volume confirmation ────────────────────────────────
        vol20 = float(np.mean(v[max(0,i-20):i])) if i >= 20 else float(v[i])
        vol_ratio = float(v[i]) / max(vol20, 1e-6)
        vol_score = 10 if vol_ratio >= 1.3 else (5 if vol_ratio >= 1.0 else 0)

        total = htf_score + va_score + fvg_score + struct_score + fib_score + vol_score
        if total < params.get("min_score", 65):
            continue
        if fvg_score < 6:
            continue  # mandatory FVG

        # ── Simulate the option trade on the 2-minute path ───────────────────
        entry_bar = i + 1
        if entry_bar >= n:
            continue
        S_entry = float(o[entry_bar])
        sigma = bt.estimate_iv(np.asarray(c), entry_bar) if hasattr(bt, "estimate_iv") else 0.18
        # 0DTE-style intraday: short time value
        T_entry = 1.0 / 252.0
        cp = "C" if direction == "CALL" else "P"
        premium = bs_price(S_entry, S_entry, T_entry, RISK_FREE, sigma, cp)
        if premium < 0.05:
            premium = S_entry * 0.003
        K = S_entry

        sl = params.get("stop_loss", 0.5)
        tp = params.get("profit_target", 1.5)
        max_hold = params.get("max_hold_bars", 60)  # up to 2 hours of 2m bars
        exit_bar = min(entry_bar + max_hold, n - 1)
        exit_type, exit_prem, exit_px = "time", premium * 0.4, S_entry

        for b in range(entry_bar + 1, exit_bar + 1):
            T_rem = max((exit_bar - b) / (252.0 * 195), 0.2/252.0)  # decay over session
            S_best = float(h[b]) if direction == "CALL" else float(l[b])
            prem_best = bs_price(S_best, K, T_rem, RISK_FREE, sigma, cp)
            if (prem_best - premium)/max(premium,1e-6) >= tp:
                exit_type, exit_prem, exit_px = "profit_target", prem_best, S_best
                break
            S_c = float(c[b])
            prem_c = bs_price(S_c, K, T_rem, RISK_FREE, sigma, cp)
            if (prem_c - premium)/max(premium,1e-6) <= -sl:
                exit_type, exit_prem, exit_px = "stopped_out", premium*(1-sl), S_c
                break
            if b == exit_bar:
                exit_prem, exit_px = prem_c, S_c

        pnl_pct = (exit_prem - premium)/max(premium,1e-6)
        pnl_dollars = pnl_pct * premium * 100
        win = pnl_pct > 0

        trades.append({
            "ticker": tk, "direction": direction,
            "entry_time": dts[entry_bar], "exit_bar_offset": None,
            "entry_price": round(S_entry, 2), "exit_price": round(exit_px, 2),
            "premium": round(premium, 3), "exit_premium": round(exit_prem, 3),
            "pnl_pct": round(pnl_pct*100, 2), "pnl_dollars": round(pnl_dollars, 2),
            "win": win, "exit_type": exit_type, "score": total,
            "confluences": {
                "htf_bias":   {"weight": 15, "earned": htf_score,   "label": f"HTF {htf['bias']} (daily EMA stack)"},
                "value_area": {"weight": 25, "earned": va_score,    "label": "Daily Value Area zone"},
                "fvg":        {"weight": 25, "earned": fvg_score,   "label": f"2m Fair Value Gap ({gap_pct*100:.2f}%)"},
                "structure":  {"weight": 25, "earned": struct_score,"label": "Intraday structure shift"},
                "fibonacci":  {"weight": 10, "earned": fib_score,   "label": fib_label or "Fib OTE"},
                "volume":     {"weight": 10, "earned": vol_score,   "label": f"Volume {vol_ratio:.1f}x"},
            },
            "entry_index": entry_bar,
        })
        cooldown_until = entry_bar + max_hold  # no overlapping trades
    return trades


def main():
    print(f"ICT V4.1 MTF backtest — daily HTF context + 2-minute entries")
    print(f"Window: last ~55 days (where both daily history and 2m bars exist)\n")

    params = {
        "min_score": 65, "fvg_lookback": 20, "min_fvg_pct": 0.0002,
        "stop_loss": 0.5, "profit_target": 1.5, "max_hold_bars": 60,
    }

    all_trades = []
    replay_bars = {}
    for tk in TICKERS:
        # Daily history for HTF context
        ddf = yf.download(tk, period="6mo", interval="1d", progress=False, auto_adjust=True)
        # 2-minute for entries + replay
        idf = yf.download(tk, period="55d", interval="2m", progress=False, auto_adjust=True)
        for df in (ddf, idf):
            if hasattr(df.columns, "levels"):
                df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
        ddf = ddf.dropna(); idf = idf.dropna()
        if len(ddf) < 55 or len(idf) < 100:
            print(f"  [{tk}] insufficient data"); continue

        htf = daily_htf_context(ddf["Close"].values, ddf["High"].values, ddf["Low"].values)
        if not htf:
            print(f"  [{tk}] no clear daily HTF bias → skip"); continue

        o = idf["Open"].values.astype(float); h = idf["High"].values.astype(float)
        l = idf["Low"].values.astype(float);  c = idf["Close"].values.astype(float)
        vv = idf["Volume"].values.astype(float); dts = [str(x) for x in idf.index]

        trades = scan_ltf_entries(tk, o, h, l, c, vv, dts, htf, params)
        for t in trades:
            # attach a small replay window of real 2m bars around the entry
            ei = t.pop("entry_index")
            s = max(0, ei - 40); e = min(len(c), ei + 65)
            t["replay"] = {
                "bars": [{"t": dts[j][11:16], "o": round(float(o[j]),2), "h": round(float(h[j]),2),
                          "l": round(float(l[j]),2), "c": round(float(c[j]),2)} for j in range(s, e)],
                "entry_offset": ei - s,
            }
        all_trades.extend(trades)
        print(f"  [{tk}] HTF={htf['bias']}/{htf['regime']} → {len(trades)} intraday entries")

    # Stats
    n = len(all_trades)
    wins = sum(1 for t in all_trades if t["win"])
    wr = (wins / n * 100) if n else 0
    gross_win = sum(t["pnl_dollars"] for t in all_trades if t["pnl_dollars"] > 0)
    gross_loss = abs(sum(t["pnl_dollars"] for t in all_trades if t["pnl_dollars"] < 0))
    pf = (gross_win / gross_loss) if gross_loss else (gross_win if gross_win else 0)
    total_pnl = sum(t["pnl_dollars"] for t in all_trades)

    print(f"\n{'='*60}")
    print(f"MTF 2-MINUTE BACKTEST RESULTS (real data, last ~55 days)")
    print(f"{'='*60}")
    print(f"  Total trades:  {n}")
    print(f"  Win rate:      {wr:.1f}%")
    print(f"  Profit factor: {pf:.2f}x")
    print(f"  Total P&L:     ${total_pnl:.2f}")
    if n:
        print(f"  By ticker:     {dict(Counter(t['ticker'] for t in all_trades))}")
        print(f"  By direction:  {dict(Counter(t['direction'] for t in all_trades))}")
        print(f"  Exit types:    {dict(Counter(t['exit_type'] for t in all_trades))}")

    # Save (without replay bars in the summary print, but keep in file)
    out = {
        "stats": {"total_trades": n, "win_rate": round(wr,1), "profit_factor": round(pf,2),
                  "total_pnl": round(total_pnl,2), "timeframe": "2m entries / daily HTF",
                  "window": "last ~55 days"},
        "trades": all_trades,
    }
    with open("backtest_mtf_2m_results.json", "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\n  Saved → backtest_mtf_2m_results.json")
    return n


if __name__ == "__main__":
    main()

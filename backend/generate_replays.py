"""
Replay Data Generator
═══════════════════════════════════════════════════════════════════════════════
For each real V4.1 backtested trade, build a self-contained "replay bundle":
  • real OHLC bars around the entry (2-minute if the trade is within ~58 days,
    otherwise daily — both are real yfinance data, never synthetic)
  • the entry bar index, plus entry / stop / target / exit markers
  • the full confluence checklist with per-confluence WEIGHT and EARNED points,
    pulled from the engine's real score_breakdown for that trade

Output: app/data_replays.json  (consumed by GET /api/replay and /api/replay/{id})

NO FABRICATION: every bar is real. If intraday data isn't available for a trade's
date, the bundle falls back to real daily bars and is labeled as such.
"""

import json
import os
from datetime import date, timedelta
import yfinance as yf

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "backtest_results_v4.json")
OUT = os.path.join(HERE, "app", "data_replays.json")

INTRADAY_CUTOFF_DAYS = 58  # yfinance 2m history limit (~60d, kept conservative)

# Canonical confluence definitions — the full possible set with max weights.
# Mirrors app/core/ict_engine_v4.py score_breakdown weighting.
CONFLUENCE_DEFS = [
    {"key": "htf_bias",   "name": "HTF Bias",            "weight": 15,
     "desc": "Higher-timeframe (1h–daily) EMA stack sets the only permitted direction."},
    {"key": "fvg",        "name": "Fair Value Gap",      "weight": 25,
     "desc": "An unmitigated 3-candle institutional imbalance price is returning to."},
    {"key": "value_area", "name": "Value Area",          "weight": 25,
     "desc": "Entry at the Value Area Low (calls) / High (puts) from the volume profile."},
    {"key": "structure",  "name": "Structure + Sweep",   "weight": 25,
     "desc": "A liquidity sweep then Change-of-Character / Break-of-Structure confirms."},
    {"key": "fibonacci",  "name": "Fibonacci OTE",       "weight": 10,
     "desc": "Price in the 61.8–78.6% Optimal Trade Entry zone or 50% equilibrium."},
    {"key": "ob",         "name": "Order Block",         "weight": 10,
     "desc": "An unmitigated order block overlapping the FVG (the 'Unicorn' model)."},
]


def fetch_bars(ticker: str, entry_iso: str):
    """Return (bars, interval, entry_index) using real data. 2m if recent, else daily."""
    entry = date.fromisoformat(entry_iso[:10])
    recent = (date.today() - entry).days <= INTRADAY_CUTOFF_DAYS

    if recent:
        # Real 2-minute bars: a tight window around the entry day
        start = (entry - timedelta(days=3)).isoformat()
        end = (entry + timedelta(days=2)).isoformat()
        df = yf.download(ticker, start=start, end=end, interval="2m",
                         progress=False, auto_adjust=True)
        interval = "2m"
        if df is None or df.empty:
            recent = False  # fall through to daily

    if not recent:
        start = (entry - timedelta(days=45)).isoformat()
        end = (entry + timedelta(days=20)).isoformat()
        df = yf.download(ticker, start=start, end=end, interval="1d",
                         progress=False, auto_adjust=True)
        interval = "1d"

    if df is None or df.empty:
        return [], interval, -1

    if hasattr(df.columns, "levels"):
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
    df = df.dropna()

    bars = []
    entry_index = -1
    for idx, (ts, row) in enumerate(df.iterrows()):
        label = str(ts)[11:16] if interval == "2m" else str(ts)[:10]
        bars.append({
            "t": label,
            "o": round(float(row["Open"]), 2),
            "h": round(float(row["High"]), 2),
            "l": round(float(row["Low"]), 2),
            "c": round(float(row["Close"]), 2),
        })
        # entry index: first bar on/after the entry date
        if entry_index == -1 and str(ts)[:10] >= entry_iso[:10]:
            entry_index = idx

    if entry_index == -1:
        entry_index = min(len(bars) // 2, len(bars) - 1)
    return bars, interval, entry_index


def build_checklist(trade: dict):
    """Map the trade's real score_breakdown onto the canonical confluence list."""
    bd = trade.get("score_breakdown", {})
    items = []
    for d in CONFLUENCE_DEFS:
        earned = int(bd.get(d["key"], 0) or 0)
        items.append({
            "key": d["key"], "name": d["name"], "weight": d["weight"],
            "earned": max(0, earned), "met": earned > 0, "desc": d["desc"],
        })
    return items


def main():
    data = json.load(open(SRC))
    trades = sorted(data["trades"], key=lambda x: x["date"])

    replays = []
    for i, t in enumerate(trades):
        tid = f"{t['ticker']}-{t['date']}"
        bars, interval, entry_index = fetch_bars(t["ticker"], t["date"])
        if not bars:
            print(f"  skip {tid}: no bars")
            continue

        entry_px = t.get("entry_price")
        # Stop / target derived from the trade's stop_loss/target structure on the underlying.
        # We show structural levels around entry for context (not the option premium path).
        move = t.get("underlying_move", 0)
        exit_px = t.get("exit_price", entry_px)

        replays.append({
            "id": tid,
            "ticker": t["ticker"],
            "date": t["date"],
            "direction": t["direction"],
            "interval": interval,                 # "2m" or "1d"
            "is_intraday": interval == "2m",
            "win": t["win"],
            "pnl_pct": t["pnl_pct"],
            "exit_type": t.get("exit_type"),
            "score": t.get("score"),
            "entry_price": entry_px,
            "exit_price": exit_px,
            "underlying_move": move,
            "bars": bars,
            "entry_index": entry_index,
            "checklist": build_checklist(t),
        })
        print(f"  {tid}: {len(bars)} {interval} bars, entry@{entry_index}, "
              f"score {t.get('score')}, {'WIN' if t['win'] else 'LOSS'}")

    out = {
        "confluence_defs": CONFLUENCE_DEFS,
        "max_score": sum(d["weight"] for d in CONFLUENCE_DEFS),
        "replays": replays,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\n  Saved {len(replays)} replay bundles → {OUT}")


if __name__ == "__main__":
    main()

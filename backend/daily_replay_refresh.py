"""
Daily Replay Refresh Job
═══════════════════════════════════════════════════════════════════════════════
Maintains the "Watch a session" replay menu as a truthful rolling window of the
most recent COMPLETED trades (known win/loss only).

Behavior (per product decisions):
  • Records only completed trades with a real outcome — never open/pending signals.
  • Each trade's replay uses the finest REAL timeframe for its age:
        Tradier 1-min (≤~29d) → Tradier 5-min (≤~56d) → daily (older).
  • If a run finds no new completed dashboard trades, BACKFILL from the most
    recent backtest so the menu stays full (real backtested trades, real outcomes).
  • Cap the menu at 30. Eviction is CHRONOLOGICAL (oldest first) so the set stays
    a representative rolling record — wins and losses in their true proportion.
    (We deliberately do NOT drop losses first; that would bias the record.)

NO FABRICATION: outcomes come from real trade results; bars are real or the trade
falls back to a coarser real timeframe. Nothing is synthesized.

Intended to run once per weekday (e.g. via Render Cron). Idempotent: re-running
the same day does not duplicate trades (dedup by id).
"""

import os
import json
from datetime import date, datetime, timedelta

HERE = os.path.dirname(__file__)
REPLAYS_PATH = os.path.join(HERE, "app", "data_replays.json")
BACKTEST_PATH = os.path.join(HERE, "backtest_results_v4.json")

MAX_MENU = 30

# Import the existing generator's helpers so bundle-building stays consistent.
import generate_replays as gen


def _load_replays() -> dict:
    if os.path.exists(REPLAYS_PATH):
        try:
            return json.load(open(REPLAYS_PATH))
        except Exception:
            pass
    return {"confluence_defs": gen.CONFLUENCE_DEFS,
            "max_score": sum(d["weight"] for d in gen.CONFLUENCE_DEFS),
            "replays": []}


def _completed_trades_from_dashboard() -> list:
    """
    Collect completed trades (known win/loss) that the dashboard surfaced.

    In the current architecture the dashboard's closed-trade history lives in the
    backtest result set (the live scanner posts signals, but realized outcomes are
    recorded through the backtest pipeline). We therefore read completed trades
    from backtest_results_v4.json. When a true live closed-trade store exists,
    point this function at it instead — the rest of the job is unchanged.
    """
    if not os.path.exists(BACKTEST_PATH):
        return []
    data = json.load(open(BACKTEST_PATH))
    out = []
    for t in data.get("trades", []):
        # Only completed trades have an exit_type / win flag set.
        if t.get("exit_type") and ("win" in t):
            out.append(t)
    return out


def _trade_id(t: dict) -> str:
    return f"{t['ticker']}-{t['date'][:10]}"


def build_bundle_for(trade: dict) -> dict | None:
    """Build a single replay bundle (real bars + checklist + overlays)."""
    tid = _trade_id(trade)
    bars, interval, entry_index = gen.fetch_bars(trade["ticker"], trade["date"])
    if not bars:
        return None
    return {
        "id": tid,
        "ticker": trade["ticker"],
        "date": trade["date"],
        "direction": trade["direction"],
        "interval": interval,
        "is_intraday": interval in ("1m", "5m"),
        "win": trade["win"],
        "pnl_pct": trade["pnl_pct"],
        "exit_type": trade.get("exit_type"),
        "score": trade.get("score"),
        "entry_price": trade.get("entry_price"),
        "exit_price": trade.get("exit_price"),
        "underlying_move": trade.get("underlying_move"),
        "bars": bars,
        "entry_index": entry_index,
        "checklist": gen.build_checklist(trade),
        "overlays": gen.build_overlays(trade, bars, entry_index, trade["direction"]),
    }


def run():
    print(f"[{datetime.utcnow().isoformat()}Z] Daily replay refresh starting…")
    store = _load_replays()
    existing = {r["id"]: r for r in store.get("replays", [])}

    completed = _completed_trades_from_dashboard()
    print(f"  Completed trades available: {len(completed)}")

    # ── Add any completed trades not already captured ────────────────────────
    added = 0
    for t in sorted(completed, key=lambda x: x["date"]):
        tid = _trade_id(t)
        if tid in existing:
            continue
        bundle = build_bundle_for(t)
        if bundle:
            existing[tid] = bundle
            added += 1
            print(f"  + captured {tid} ({bundle['interval']}, "
                  f"{'WIN' if bundle['win'] else 'LOSS'})")

    # ── Backfill: if nothing new today, ensure the menu is as full as possible ─
    if added == 0:
        print("  No new completed trades — backfilling from recent backtest to keep menu full.")
        for t in sorted(completed, key=lambda x: x["date"], reverse=True):
            if len(existing) >= MAX_MENU:
                break
            tid = _trade_id(t)
            if tid in existing:
                continue
            bundle = build_bundle_for(t)
            if bundle:
                existing[tid] = bundle
                print(f"  + backfilled {tid}")

    # ── Cap at MAX_MENU — CHRONOLOGICAL eviction (oldest first) ───────────────
    ordered = sorted(existing.values(), key=lambda r: r["date"], reverse=True)
    kept = ordered[:MAX_MENU]
    dropped = ordered[MAX_MENU:]
    for d in dropped:
        print(f"  - evicted (oldest) {d['id']} ({d['date'][:10]})")

    # Store newest-first so the menu shows most recent at top
    store["replays"] = kept
    store["confluence_defs"] = gen.CONFLUENCE_DEFS
    store["max_score"] = sum(d["weight"] for d in gen.CONFLUENCE_DEFS)
    store["updated_at"] = datetime.utcnow().isoformat() + "Z"

    json.dump(store, open(REPLAYS_PATH, "w"), indent=2)
    print(f"  Menu now holds {len(kept)} trades (cap {MAX_MENU}). "
          f"Added {added}, evicted {len(dropped)}.")
    print("  Done.")


if __name__ == "__main__":
    run()

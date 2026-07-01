"""
Fundamental Valuation Engine — Composite Score
═══════════════════════════════════════════════════════════════════════════════
An ANALYSIS TOOL (not investment advice). Given a ticker, it pulls real licensed
fundamental data and computes a transparent composite valuation, applying the
SAME rules to every stock so no ticker/sector is favored:

  1. Relative value   — P/E, PEG, EV/EBITDA, P/B scored vs neutral anchors.
  2. Quality & growth — margins, ROE, revenue/earnings growth.
  3. Intrinsic (DCF)  — DEFERRED: needs full cash-flow statements. Shown as
     "coming soon" until a cash-flow data source is wired (Finnhub free tier
     doesn't include it; Alpha Vantage has it but its 25/day limit can't support
     a paid multi-user feature).

Primary data source: Finnhub (60 calls/min free — supports real usage).
The provider layer is abstracted so a scraper or premium feed could be added
later without touching the scoring logic.

NO FABRICATION: missing datapoints are marked unavailable, never guessed. A
valuation with too little real data returns "insufficient data".
"""

import os
from typing import Optional, Dict, Any

import httpx

FINNHUB_BASE = "https://finnhub.io/api/v1"


def _finnhub_key() -> str:
    return os.getenv("FINNHUB_API_KEY", "")


def _f(v, default=None):
    """Safe float parse; returns default on None/'None'/''/junk."""
    try:
        if v is None or v == "None" or v == "":
            return default
        return float(v)
    except (ValueError, TypeError):
        return default


# ── Data providers (abstracted so a scraper/premium feed could slot in later) ──

def fetch_finnhub_metrics(symbol: str) -> Optional[dict]:
    key = _finnhub_key()
    if not key:
        return None
    try:
        r = httpx.get(f"{FINNHUB_BASE}/stock/metric",
                      params={"symbol": symbol, "metric": "all", "token": key}, timeout=15)
        d = r.json()
        return d.get("metric") if d and d.get("metric") else None
    except Exception:
        return None


def fetch_finnhub_profile(symbol: str) -> Optional[dict]:
    key = _finnhub_key()
    if not key:
        return None
    try:
        r = httpx.get(f"{FINNHUB_BASE}/stock/profile2",
                      params={"symbol": symbol, "token": key}, timeout=15)
        d = r.json()
        return d if d and d.get("name") else None
    except Exception:
        return None


def fetch_finnhub_quote(symbol: str) -> Optional[float]:
    key = _finnhub_key()
    if not key:
        return None
    try:
        r = httpx.get(f"{FINNHUB_BASE}/quote",
                      params={"symbol": symbol, "token": key}, timeout=15)
        d = r.json()
        return _f(d.get("c")) if d else None
    except Exception:
        return None


# ── Scoring components (each returns 0–100 + explanation, or unavailable) ──────

def score_relative(m: dict) -> dict:
    """Relative value via multiples scored against explicit neutral anchors.
    Lower multiple = cheaper = higher score. Same anchors for every stock."""
    pe = _f(m.get("peBasicExclExtraTTM")) or _f(m.get("peTTM"))
    peg = _f(m.get("pegTTM"))
    pb = _f(m.get("pbAnnual")) or _f(m.get("pbQuarterly"))
    ev_ebitda = _f(m.get("evEbitdaTTM"))

    parts = []
    if pe is not None and pe > 0:
        parts.append(("P/E", pe, max(0, min(100, 100 - (pe - 15) * 2.5))))
    if peg is not None and peg > 0:
        parts.append(("PEG", peg, max(0, min(100, 100 - (peg - 1.0) * 40))))
    if pb is not None and pb > 0:
        parts.append(("P/B", pb, max(0, min(100, 100 - (pb - 2.0) * 12))))
    if ev_ebitda is not None and ev_ebitda > 0:
        parts.append(("EV/EBITDA", ev_ebitda, max(0, min(100, 100 - (ev_ebitda - 10) * 3))))

    if not parts:
        return {"available": False, "reason": "no valuation multiples available"}
    score = sum(p[2] for p in parts) / len(parts)
    return {
        "available": True, "score": round(score, 1),
        "metrics": [{"name": n, "value": round(v, 2), "score": round(s, 1)} for n, v, s in parts],
    }


def score_quality(m: dict) -> dict:
    """Quality & growth: margins, ROE, revenue/earnings growth."""
    net_margin = _f(m.get("netProfitMarginTTM"))       # already in %
    roe = _f(m.get("roeTTM"))                            # already in %
    rev_growth = _f(m.get("revenueGrowthTTMYoy"))        # already in %
    eps_growth = _f(m.get("epsGrowthTTMYoy"))            # already in %

    parts = []
    if net_margin is not None:
        parts.append(("Net Margin", net_margin, max(0, min(100, net_margin * 4))))
    if roe is not None:
        parts.append(("ROE", roe, max(0, min(100, roe * 2.5))))
    if rev_growth is not None:
        parts.append(("Revenue Growth", rev_growth, max(0, min(100, 50 + rev_growth * 2))))
    if eps_growth is not None:
        parts.append(("EPS Growth", eps_growth, max(0, min(100, 50 + eps_growth * 1.5))))

    if not parts:
        return {"available": False, "reason": "no quality metrics available"}
    score = sum(p[2] for p in parts) / len(parts)
    return {
        "available": True, "score": round(score, 1),
        "metrics": [{"name": n, "value": round(v, 1), "score": round(s, 1)} for n, v, s in parts],
    }


def valuate(symbol: str) -> Dict[str, Any]:
    """Run the composite valuation for a ticker. Returns a structured report."""
    symbol = symbol.strip().upper()
    metrics = fetch_finnhub_metrics(symbol)
    profile = fetch_finnhub_profile(symbol)
    if not metrics and not profile:
        return {"ok": False, "symbol": symbol, "error": "No fundamental data found for this ticker."}
    metrics = metrics or {}

    price = fetch_finnhub_quote(symbol)

    rel = score_relative(metrics)
    qual = score_quality(metrics)
    # DCF deferred until a cash-flow data source is available.
    dcf = {"available": False, "reason": "DCF coming soon — awaiting cash-flow data source",
           "coming_soon": True}

    weights = {"relative": 0.55, "quality": 0.45}  # renormalized (DCF absent for now)
    available = []
    if rel.get("available"): available.append((rel["score"], weights["relative"]))
    if qual.get("available"): available.append((qual["score"], weights["quality"]))

    if len(available) < 2:
        return {"ok": False, "symbol": symbol,
                "error": "Insufficient fundamental data for a reliable composite valuation.",
                "components": {"dcf": dcf, "relative": rel, "quality": qual}}

    wsum = sum(w for _, w in available)
    composite = sum(s * w for s, w in available) / wsum

    if composite >= 65:
        read = "Fundamentals suggest the stock may be undervalued at current levels."
    elif composite >= 45:
        read = "Fundamentals suggest the stock appears roughly fairly valued."
    else:
        read = "Fundamentals suggest the stock may be overvalued at current levels."

    return {
        "ok": True,
        "symbol": symbol,
        "name": (profile or {}).get("name"),
        "sector": (profile or {}).get("finnhubIndustry"),
        "current_price": round(price, 2) if price else None,
        "composite_score": round(composite, 1),
        "read": read,
        "components": {"relative": rel, "quality": qual, "dcf": dcf},
        "weights": weights,
    }


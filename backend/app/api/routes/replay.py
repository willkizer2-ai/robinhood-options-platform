"""
Replay API — Trade Session Replays
═══════════════════════════════════════════════════════════════════════════════
Serves pre-computed replay bundles (real OHLC bars + confluence checklist) for
each backtested V4.1 trade. Data is produced by generate_replays.py from real
yfinance bars — never synthetic. If the data file is missing, returns an empty
list (per the platform's no-mock-data rule).

  GET /api/replay            → list of all replays (metadata only, no bars)
  GET /api/replay/{replay_id} → one full replay bundle (bars + checklist)
"""

import os
import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data_replays.json")


class ConfluenceItem(BaseModel):
    key: str
    name: str
    weight: int
    earned: int
    met: bool
    desc: str


class Bar(BaseModel):
    t: str
    o: float
    h: float
    l: float
    c: float


class ReplayBundle(BaseModel):
    id: str
    ticker: str
    date: str
    direction: str
    interval: str
    is_intraday: bool
    win: bool
    pnl_pct: float
    exit_type: Optional[str] = None
    score: Optional[int] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    underlying_move: Optional[float] = None
    bars: List[Bar] = []
    entry_index: int = 0
    checklist: List[ConfluenceItem] = []
    overlays: List[dict] = []


class ReplaySummary(BaseModel):
    id: str
    ticker: str
    date: str
    direction: str
    interval: str
    is_intraday: bool
    win: bool
    pnl_pct: float
    score: Optional[int] = None


class ReplayListResponse(BaseModel):
    max_score: int
    confluence_defs: list
    replays: List[ReplaySummary]


def _load() -> Optional[dict]:
    try:
        path = os.path.abspath(_DATA_PATH)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


@router.get("", response_model=ReplayListResponse)
async def list_replays():
    """List all available trade replays (metadata only — bars omitted for size)."""
    data = _load()
    if not data:
        return ReplayListResponse(max_score=100, confluence_defs=[], replays=[])
    summaries = [
        ReplaySummary(
            id=r["id"], ticker=r["ticker"], date=r["date"], direction=r["direction"],
            interval=r["interval"], is_intraday=r["is_intraday"], win=r["win"],
            pnl_pct=r["pnl_pct"], score=r.get("score"),
        )
        for r in data.get("replays", [])
    ]
    return ReplayListResponse(
        max_score=data.get("max_score", 100),
        confluence_defs=data.get("confluence_defs", []),
        replays=summaries,
    )


@router.get("/{replay_id}", response_model=ReplayBundle)
async def get_replay(replay_id: str):
    """Return one full replay bundle (real bars + confluence checklist)."""
    data = _load()
    if not data:
        raise HTTPException(status_code=404, detail="No replay data available")
    for r in data.get("replays", []):
        if r["id"] == replay_id:
            return ReplayBundle(**r)
    raise HTTPException(status_code=404, detail=f"Replay '{replay_id}' not found")

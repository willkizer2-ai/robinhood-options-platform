from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Request, Query
from app.models.schemas import NewsResponse, NewsImpact

router = APIRouter()

@router.get("", response_model=NewsResponse)
async def get_news(
    request: Request,
    impact: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    engine = request.app.state.news_engine
    if engine is None:
        raise HTTPException(503, "News engine is initializing — please retry in a moment")
    impact_filter = NewsImpact(impact) if impact else None
    items = engine.get_news(impact_filter=impact_filter, limit=limit)
    high_impact = sum(1 for i in items if i.impact == NewsImpact.HIGH)
    return NewsResponse(
        items=items,
        total=len(items),
        high_impact_count=high_impact,
        last_updated=engine.last_fetch or datetime.utcnow(),
    )

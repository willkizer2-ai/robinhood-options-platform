from fastapi import APIRouter, Request, Query
from app.models.schemas import AlertsResponse

router = APIRouter()

@router.get("", response_model=AlertsResponse)
async def get_alerts(request: Request, limit: int = Query(20, ge=1, le=100)):
    alert_system = request.app.state.alert_system
    alerts = alert_system.get_recent_alerts(limit=limit)
    unread = sum(1 for a in alerts if not a.is_read)
    return AlertsResponse(alerts=alerts, total=len(alerts), unread_count=unread)

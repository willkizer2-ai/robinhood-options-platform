from fastapi import APIRouter, Request, HTTPException
from app.models.schemas import OvernightResearchReport

router = APIRouter()

@router.get("/overnight", response_model=OvernightResearchReport)
async def get_overnight_research(request: Request):
    agent = request.app.state.research_agent
    if agent is None:
        raise HTTPException(503, "Research agent is initializing — please retry in a moment")
    if not agent.latest_report:
        # Generate on-demand if not available
        report = await agent.generate_report()
        return report
    return agent.latest_report

"""
Robinhood Options Intelligence Platform
Main FastAPI Backend Entry Point
"""

import sys
import asyncio
import logging

# Force UTF-8 output on Windows (prevents emoji/unicode crashes)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.routes import trades, news, scanner, alerts, research, health, performance
from app.core.scanner import MarketScanner
from app.core.news_engine import NewsIntelligenceEngine
from app.core.research_agent import OvernightResearchAgent
from app.core.alerts import AlertSystem
from app.db.database import init_db
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global engine instances
market_scanner: MarketScanner = None
news_engine: NewsIntelligenceEngine = None
research_agent: OvernightResearchAgent = None
alert_system: AlertSystem = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle manager — fault-tolerant."""
    global market_scanner, news_engine, research_agent, alert_system

    logger.info("Starting Robinhood Options Intelligence Platform...")

    # Initialize database — non-fatal if it fails (serves mock data)
    try:
        await init_db()
        logger.info("Database ready.")
    except Exception as e:
        logger.error(f"DB init error (continuing with in-memory mode): {e}")

    # Initialize core engines — each wrapped so one bad engine never kills the app
    tasks = []

    try:
        market_scanner = MarketScanner()
        tasks.append(asyncio.create_task(market_scanner.run_continuous()))
        logger.info("MarketScanner started.")
    except Exception as e:
        logger.error(f"MarketScanner init failed: {e}")

    try:
        news_engine = NewsIntelligenceEngine()
        tasks.append(asyncio.create_task(news_engine.run_continuous()))
        logger.info("NewsEngine started.")
    except Exception as e:
        logger.error(f"NewsEngine init failed: {e}")

    try:
        research_agent = OvernightResearchAgent()
        tasks.append(asyncio.create_task(research_agent.run_overnight()))
        logger.info("ResearchAgent started.")
    except Exception as e:
        logger.error(f"ResearchAgent init failed: {e}")

    try:
        alert_system = AlertSystem()
        tasks.append(asyncio.create_task(alert_system.run_continuous()))
        logger.info("AlertSystem started.")
    except Exception as e:
        logger.error(f"AlertSystem init failed: {e}")

    # Store in app state for route access (may be None if init failed)
    app.state.market_scanner = market_scanner
    app.state.news_engine = news_engine
    app.state.research_agent = research_agent
    app.state.alert_system = alert_system

    logger.info("Platform is LIVE. All engines active.")
    yield

    # Shutdown
    logger.info("Shutting down engines...")
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(
    title="Robinhood Options Intelligence Platform",
    description="Institutional-grade options trading intelligence for retail traders",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,  # prevents 307s to localhost URLs that break external access
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # allows all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Register routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(trades.router, prefix="/api/trades", tags=["Trades"])
app.include_router(news.router, prefix="/api/news", tags=["News"])
app.include_router(scanner.router, prefix="/api/scanner", tags=["Scanner"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(research.router,     prefix="/api/research",     tags=["Research"])
app.include_router(performance.router,  prefix="/api/performance",  tags=["Performance"])


if __name__ == "__main__":
    import os
    import uvicorn
    # Render (and most cloud platforms) inject $PORT — fall back to 8000 locally
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # reload=True spawns child processes that lose the UTF-8 fix
        log_level="info",
    )

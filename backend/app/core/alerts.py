"""
Real-Time Alert System
Sends alerts ONLY for DO_TAKE setups and major news catalysts
"""
import asyncio
import uuid
import logging
from datetime import datetime
from typing import List, Optional, Dict
import aiohttp

from app.models.schemas import Alert, TradeSetup, NewsItem, TradeDecision
from app.config import settings

logger = logging.getLogger(__name__)


class AlertSystem:
    """
    Monitors the scanner and news engine.
    Fires alerts only for high-quality, actionable events.
    """

    def __init__(self):
        self.alert_history: Dict[str, Alert] = {}
        self.fired_trade_ids: set = set()
        self.fired_news_ids: set = set()

    async def run_continuous(self):
        """Poll for new actionable events every 15 seconds."""
        logger.info("🔔 Alert System active.")
        while True:
            try:
                await asyncio.sleep(15)
            except asyncio.CancelledError:
                break

    async def check_and_fire(
        self,
        trades: List[TradeSetup],
        news: List[NewsItem],
    ):
        """Check for new actionable items and fire alerts."""
        # Trade alerts — only DO_TAKE
        for trade in trades:
            if (
                trade.decision == TradeDecision.DO_TAKE
                and trade.id not in self.fired_trade_ids
                and trade.confidence_score >= 0.70
            ):
                alert = Alert(
                    id=str(uuid.uuid4()),
                    alert_type="TRADE",
                    title=f"🎯 {trade.ticker} {trade.direction.value} Setup",
                    message=(
                        f"{trade.strategy.value} | "
                        f"Confidence: {trade.confidence_score:.0%} | "
                        f"Strike: ${trade.contract.strike:.0f} | "
                        f"Exp: {trade.contract.expiration}"
                    ),
                    ticker=trade.ticker,
                    trade_id=trade.id,
                    severity="HIGH",
                )
                self.alert_history[alert.id] = alert
                self.fired_trade_ids.add(trade.id)
                await self._dispatch_alert(alert)

        # News alerts — only HIGH impact
        for item in news:
            if (
                item.is_actionable
                and item.nlp
                and item.nlp.impact_score >= 8.0
                and item.id not in self.fired_news_ids
            ):
                alert = Alert(
                    id=str(uuid.uuid4()),
                    alert_type="NEWS",
                    title=f"🚨 High-Impact: {item.nlp.event_type.value}",
                    message=item.headline[:200],
                    ticker=item.related_tickers[0] if item.related_tickers else None,
                    news_id=item.id,
                    severity="HIGH",
                )
                self.alert_history[alert.id] = alert
                self.fired_news_ids.add(item.id)
                await self._dispatch_alert(alert)

    async def _dispatch_alert(self, alert: Alert):
        """Send alert via webhook if configured."""
        logger.info(f"🔔 ALERT: {alert.title} — {alert.message[:100]}")

        if settings.ALERT_WEBHOOK_URL:
            try:
                payload = {
                    "text": f"*{alert.title}*\n{alert.message}",
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                }
                async with aiohttp.ClientSession() as session:
                    await session.post(
                        settings.ALERT_WEBHOOK_URL,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=5)
                    )
            except Exception as e:
                logger.warning(f"Webhook dispatch error: {e}")

    def get_recent_alerts(self, limit: int = 20) -> List[Alert]:
        return sorted(
            self.alert_history.values(),
            key=lambda x: x.timestamp,
            reverse=True
        )[:limit]

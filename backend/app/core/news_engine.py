"""
News Intelligence Engine + Advanced Context-Aware NLP Engine
Continuously fetches, filters, and analyzes market-moving news.
"""
import asyncio
import json
import time
import uuid
import logging
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import List, Dict, Optional, Tuple
import aiohttp

from app.models.schemas import (
    NewsItem, NLPAnalysis, NewsImpact, EventType,
    Sentiment, PriceConfirmation
)
from app.config import settings

logger = logging.getLogger(__name__)


# ─── NLP Keyword Patterns ────────────────────────────────────────────────────

BULLISH_KEYWORDS = [
    "beat", "exceeds", "raises guidance", "record revenue", "blowout",
    "strong earnings", "upgrade", "buy rating", "price target raised",
    "partnership", "acquisition", "positive", "surge", "breakout",
    "approval", "cleared", "wins contract", "expanding", "growth"
]

BEARISH_KEYWORDS = [
    "miss", "below expectations", "lowers guidance", "layoffs", "downgrade",
    "sell rating", "price target cut", "investigation", "lawsuit", "fine",
    "recall", "decline", "slump", "disappointing", "cut", "loss",
    "deficit", "warning", "concern", "weak demand"
]

HIGH_IMPACT_EVENTS = [
    "earnings", "fed", "fomc", "cpi", "ppi", "jobs report", "gdp",
    "merger", "acquisition", "fda approval", "sec investigation",
    "bankruptcy", "dividend", "buyback", "ipo", "split"
]

EVENT_TYPE_MAP = {
    "earnings": EventType.EARNINGS,
    "revenue": EventType.EARNINGS,
    "eps": EventType.EARNINGS,
    "fed": EventType.FED_ANNOUNCEMENT,
    "fomc": EventType.FED_ANNOUNCEMENT,
    "interest rate": EventType.FED_ANNOUNCEMENT,
    "cpi": EventType.ECONOMIC_DATA,
    "inflation": EventType.ECONOMIC_DATA,
    "jobs": EventType.ECONOMIC_DATA,
    "gdp": EventType.ECONOMIC_DATA,
    "merger": EventType.M_AND_A,
    "acquisition": EventType.M_AND_A,
    "buyout": EventType.M_AND_A,
    "upgrade": EventType.ANALYST_UPGRADE,
    "downgrade": EventType.ANALYST_DOWNGRADE,
    "launch": EventType.PRODUCT_LAUNCH,
    "fda": EventType.BREAKING_NEWS,
    "lawsuit": EventType.LEGAL,
    "sec": EventType.LEGAL,
    "investigation": EventType.LEGAL,
}


class NLPEngine:
    """
    Context-aware NLP engine for financial news.
    Uses OpenAI GPT when OPENAI_API_KEY is set; falls back to rule-based analysis.
    """

    async def analyze_async(self, headline: str, ticker: Optional[str] = None) -> NLPAnalysis:
        """Async entry point — uses OpenAI if key is available, else rule-based."""
        if settings.OPENAI_API_KEY:
            try:
                return await self._analyze_with_openai(headline, ticker)
            except Exception as e:
                logger.warning(f"OpenAI NLP failed, falling back to rules: {e}")
        return self.analyze(headline, ticker)

    async def _analyze_with_openai(self, headline: str, ticker: Optional[str] = None) -> NLPAnalysis:
        """Use GPT-4o-mini to classify sentiment, event type, and impact.
        System message is required — OpenAI JSON mode errors without it mentioning JSON.
        """
        system_msg = (
            "You are a financial news analyst. Always respond with valid JSON only. "
            "No prose, no markdown — pure JSON object."
        )
        user_msg = (
            "Analyze this financial news headline and return a JSON object with these exact keys:\n"
            "sentiment (one of: STRONG_BULLISH, BULLISH, MIXED, BEARISH, STRONG_BEARISH),\n"
            "sentiment_confidence (float 0-1),\n"
            "event_type (one of: EARNINGS, FED_ANNOUNCEMENT, ECONOMIC_DATA, M&A, "
            "ANALYST_UPGRADE, ANALYST_DOWNGRADE, PRODUCT_LAUNCH, LEGAL, BREAKING_NEWS, SECTOR_ROTATION),\n"
            "impact_score (float 0-10),\n"
            "context_interpretation (short string like 'Strong Bullish' or 'Mixed Signal'),\n"
            "key_phrases (list of up to 3 strings),\n"
            "risk_factors (list of up to 3 strings),\n"
            "summary (one sentence)\n\n"
            f"Headline: {headline}"
        )
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 300,
                    "temperature": 0.1,
                },
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    raise ValueError(f"OpenAI returned HTTP {resp.status}: {body[:200]}")
                data = await resp.json()

        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw)

        affected = self._extract_tickers(headline)
        if ticker and ticker not in affected:
            affected.insert(0, ticker)

        return NLPAnalysis(
            headline=headline,
            event_type=EventType(parsed.get("event_type", "BREAKING_NEWS")),
            sentiment=Sentiment(parsed.get("sentiment", "MIXED")),
            sentiment_confidence=float(parsed.get("sentiment_confidence", 0.5)),
            context_interpretation=parsed.get("context_interpretation", "Mixed Signal"),
            price_confirmation=PriceConfirmation.PENDING,
            impact_score=float(parsed.get("impact_score", 5.0)),
            affected_tickers=affected,
            key_phrases=parsed.get("key_phrases", [])[:5],
            summary=parsed.get("summary", headline),
            risk_factors=parsed.get("risk_factors", [])[:3],
        )

    def analyze(self, headline: str, ticker: Optional[str] = None) -> NLPAnalysis:
        """Full NLP analysis of a news headline."""
        headline_lower = headline.lower()

        event_type = self._classify_event(headline_lower)
        sentiment, sent_confidence = self._classify_sentiment(headline_lower)
        impact_score = self._calculate_impact(headline_lower, event_type, sentiment)
        context_interpretation = self._interpret_context(sentiment, impact_score, event_type)
        key_phrases = self._extract_key_phrases(headline)
        affected_tickers = self._extract_tickers(headline)
        price_conf = PriceConfirmation.PENDING  # Updated after price check

        if ticker and ticker not in affected_tickers:
            affected_tickers.insert(0, ticker)

        # Build summary
        summary = self._build_summary(headline, event_type, sentiment, impact_score)

        # Risk factors
        risk_factors = self._identify_risks(headline_lower, sentiment)

        return NLPAnalysis(
            headline=headline,
            event_type=event_type,
            sentiment=sentiment,
            sentiment_confidence=round(sent_confidence, 2),
            context_interpretation=context_interpretation,
            price_confirmation=price_conf,
            impact_score=round(impact_score, 1),
            affected_tickers=affected_tickers,
            key_phrases=key_phrases,
            summary=summary,
            risk_factors=risk_factors,
        )

    def _classify_event(self, text: str) -> EventType:
        for keyword, event_type in EVENT_TYPE_MAP.items():
            if keyword in text:
                return event_type
        return EventType.BREAKING_NEWS

    def _classify_sentiment(self, text: str) -> Tuple[Sentiment, float]:
        bullish_count = sum(1 for kw in BULLISH_KEYWORDS if kw in text)
        bearish_count = sum(1 for kw in BEARISH_KEYWORDS if kw in text)

        total = bullish_count + bearish_count
        if total == 0:
            return Sentiment.MIXED, 0.45

        bull_ratio = bullish_count / total

        if bull_ratio >= 0.85:
            return Sentiment.STRONG_BULLISH, min(0.60 + bullish_count * 0.05, 0.95)
        elif bull_ratio >= 0.6:
            return Sentiment.BULLISH, min(0.55 + bullish_count * 0.04, 0.88)
        elif bull_ratio <= 0.15:
            return Sentiment.STRONG_BEARISH, min(0.60 + bearish_count * 0.05, 0.95)
        elif bull_ratio <= 0.4:
            return Sentiment.BEARISH, min(0.55 + bearish_count * 0.04, 0.88)
        else:
            return Sentiment.MIXED, 0.45

    def _calculate_impact(
        self, text: str, event_type: EventType, sentiment: Sentiment
    ) -> float:
        """Calculate 0-10 impact score."""
        base_scores = {
            EventType.FED_ANNOUNCEMENT: 9.0,
            EventType.EARNINGS: 8.0,
            EventType.ECONOMIC_DATA: 7.5,
            EventType.M_AND_A: 8.5,
            EventType.ANALYST_UPGRADE: 5.0,
            EventType.ANALYST_DOWNGRADE: 5.5,
            EventType.PRODUCT_LAUNCH: 4.5,
            EventType.LEGAL: 6.0,
            EventType.BREAKING_NEWS: 5.0,
            EventType.SECTOR_ROTATION: 4.0,
        }
        score = base_scores.get(event_type, 5.0)

        # Boost for strong sentiment
        if sentiment in [Sentiment.STRONG_BULLISH, Sentiment.STRONG_BEARISH]:
            score *= 1.2
        elif sentiment == Sentiment.MIXED:
            score *= 0.8

        # Boost for high-impact words
        power_words = ["record", "historic", "unprecedented", "massive", "massive beat",
                       "shock", "surprise", "breaking"]
        for word in power_words:
            if word in text:
                score = min(score + 0.5, 10.0)

        return min(score, 10.0)

    def _interpret_context(
        self, sentiment: Sentiment, impact: float, event_type: EventType
    ) -> str:
        if sentiment == Sentiment.STRONG_BULLISH and impact >= 7:
            return "Strong Bullish"
        elif sentiment == Sentiment.BULLISH and impact >= 5:
            return "Bullish"
        elif sentiment == Sentiment.STRONG_BEARISH and impact >= 7:
            return "Strong Bearish"
        elif sentiment == Sentiment.BEARISH and impact >= 5:
            return "Bearish"
        elif sentiment == Sentiment.MIXED:
            return "Mixed Signal"
        else:
            return "Weak"

    def _extract_key_phrases(self, headline: str) -> List[str]:
        """Extract key phrases from headline."""
        phrases = []
        # Look for quoted text
        quotes = re.findall(r'"([^"]+)"', headline)
        phrases.extend(quotes[:2])

        # Look for percentage changes
        pct_matches = re.findall(r'\d+(?:\.\d+)?%', headline)
        phrases.extend(pct_matches[:2])

        # Look for dollar amounts
        dollar_matches = re.findall(r'\$[\d,]+(?:\.\d+)?[BMK]?', headline)
        phrases.extend(dollar_matches[:2])

        return phrases[:5]

    def _extract_tickers(self, headline: str) -> List[str]:
        """Extract ticker symbols from headline."""
        # Match 1-5 uppercase letters that look like tickers
        candidates = re.findall(r'\b([A-Z]{1,5})\b', headline)
        known_tickers = {
            "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "GOOGL",
            "AMD", "NFLX", "COIN", "SPY", "QQQ", "SPX", "IWM"
        }
        return [t for t in candidates if t in known_tickers][:5]

    def _build_summary(
        self, headline: str, event_type: EventType, sentiment: Sentiment, impact: float
    ) -> str:
        sentiment_word = {
            Sentiment.STRONG_BULLISH: "strongly bullish",
            Sentiment.BULLISH: "bullish",
            Sentiment.MIXED: "mixed",
            Sentiment.BEARISH: "bearish",
            Sentiment.STRONG_BEARISH: "strongly bearish",
        }.get(sentiment, "neutral")

        return (
            f"{event_type.value} event with {sentiment_word} implications. "
            f"Impact score: {impact:.1f}/10."
        )

    def _identify_risks(self, text: str, sentiment: Sentiment) -> List[str]:
        risks = []
        if "after hours" in text or "pre-market" in text:
            risks.append("Gap risk — news released outside market hours")
        if "expected" in text or "forecast" in text:
            risks.append("Already priced in — buy the rumor, sell the news risk")
        if sentiment == Sentiment.MIXED:
            risks.append("Mixed signals — direction unclear, reduce size")
        if "fed" in text or "fomc" in text:
            risks.append("Fed events can reverse quickly — use tight stops")
        return risks


class NewsIntelligenceEngine:
    """
    Continuously fetches, filters, and analyzes financial news.
    Keeps a rolling window of the last 4 hours of high-impact news.
    """

    def __init__(self):
        self.nlp = NLPEngine()
        self.news_cache: Dict[str, NewsItem] = {}
        self.last_fetch: Optional[datetime] = None

    async def run_continuous(self):
        """Background loop: fetch news every 60 seconds."""
        logger.info("📰 News Intelligence Engine started.")
        while True:
            try:
                await self.fetch_and_analyze()
                await asyncio.sleep(60 if not settings.LOW_MEMORY_MODE else 180)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"News engine error: {e}")
                await asyncio.sleep(120)

    async def fetch_and_analyze(self):
        """Fetch latest news and run NLP on each item."""
        items = await self._fetch_news()
        for item in items:
            if item.id not in self.news_cache:
                item.nlp = await self.nlp.analyze_async(item.headline)
                item.impact = self._classify_impact(item.nlp)
                item.is_actionable = (
                    item.nlp.impact_score >= 6.0
                    and item.nlp.sentiment != Sentiment.MIXED
                )
                self.news_cache[item.id] = item

        # Expire items older than 4 hours
        cutoff = datetime.utcnow() - timedelta(hours=4)
        expired = [k for k, v in self.news_cache.items() if v.published_at < cutoff]
        for k in expired:
            del self.news_cache[k]

        self.last_fetch = datetime.utcnow()
        if items:
            logger.debug(f"Fetched {len(items)} news items. Cache: {len(self.news_cache)}")

    async def _fetch_news(self) -> List[NewsItem]:
        """
        Fetch from all configured sources in priority order:
          1. Benzinga (best for market-moving stock news)
          2. Finnhub  (good company-specific coverage)
          3. NewsAPI  (broad business headlines)
          4. Mock     (fallback when no keys are set)
        Results from multiple sources are merged and deduplicated.
        """
        all_items: List[NewsItem] = []
        any_key = False

        if settings.BENZINGA_API_KEY:
            any_key = True
            items = await self._fetch_benzinga_news()
            all_items.extend(items)

        if settings.FINNHUB_API_KEY:
            any_key = True
            items = await self._fetch_finnhub_news()
            all_items.extend(items)

        if settings.NEWSAPI_KEY:
            any_key = True
            items = await self._fetch_newsapi_news()
            all_items.extend(items)

        if not any_key:
            # No API keys configured — return empty rather than fabricated headlines
            logger.warning("No news API keys configured — returning empty news feed (no mock fallback)")
            return []

        # Deduplicate by normalized headline prefix (first 60 chars)
        seen: set = set()
        unique: List[NewsItem] = []
        for item in all_items:
            key = item.headline[:60].lower().strip()
            if key not in seen:
                seen.add(key)
                unique.append(item)

        return unique  # empty list is fine — no mock fallback

    async def _fetch_benzinga_news(self) -> List[NewsItem]:
        """Fetch from Benzinga Pro API — best for market-moving stock news.
        Auth: header 'Authorization: token KEY' + 'Accept: application/json'
        updatedSince: Unix timestamp — fetches only news from the last hour (delta polling).
        Response: list of articles; headline=title, tickers=stocks[].name, date=created (RFC-822).
        """
        try:
            headers = {
                "Authorization": f"token {settings.BENZINGA_API_KEY}",
                "Accept": "application/json",
            }
            params = {
                "displayOutput": "full",
                "pageSize": 25,
                "updatedSince": int(time.time()) - 3600,  # last 1 hour only
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.benzinga.com/api/v2/news",
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
                        logger.warning(f"Benzinga returned HTTP {resp.status}")
                        return []
                    data = await resp.json()

            items = []
            for article in data if isinstance(data, list) else []:
                title = article.get("title", "").strip()
                if not title:
                    continue
                # Parse RFC-822 date e.g. "Wed, 17 May 2023 14:20:15 -0400"
                raw_date = article.get("created", "")
                try:
                    published_at = parsedate_to_datetime(raw_date).astimezone(timezone.utc).replace(tzinfo=None)
                except Exception:
                    published_at = datetime.utcnow()

                tickers = [
                    s.get("name", "") for s in article.get("stocks", [])
                    if s.get("name")
                ]
                items.append(NewsItem(
                    id=str(uuid.uuid4()),
                    source="Benzinga",
                    headline=title,
                    url=article.get("url", ""),
                    published_at=published_at,
                    related_tickers=tickers[:5],
                ))
            return items
        except Exception as e:
            logger.warning(f"Benzinga fetch error: {e}")
            return []

    async def _fetch_finnhub_news(self) -> List[NewsItem]:
        """Fetch from Finnhub — general market news + company-specific news for watchlist.
        Auth: header 'X-Finnhub-Token: KEY' (cleaner than query param).
        datetime field is Unix timestamp — convert with datetime.fromtimestamp().
        Company news uses date range from=today-1 to=today for fresh articles.
        Free tier: 60 calls/minute — we batch general + top tickers only.
        """
        headers = {"X-Finnhub-Token": settings.FINNHUB_API_KEY}
        today = datetime.utcnow().strftime("%Y-%m-%d")
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

        # Top tickers to fetch company-specific news for (keep under rate limit)
        company_tickers = ["AAPL", "TSLA", "NVDA", "MSFT", "META", "AMD", "SPY", "QQQ"]

        all_articles: list = []
        try:
            async with aiohttp.ClientSession() as session:
                # 1. General market news
                async with session.get(
                    "https://finnhub.io/api/v1/news",
                    headers=headers,
                    params={"category": "general"},
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        all_articles.extend((data or [])[:20])
                    else:
                        logger.warning(f"Finnhub general news returned HTTP {resp.status}")

                # 2. Company-specific news for watchlist tickers
                for ticker in company_tickers:
                    try:
                        async with session.get(
                            "https://finnhub.io/api/v1/company-news",
                            headers=headers,
                            params={"symbol": ticker, "from": yesterday, "to": today},
                            timeout=aiohttp.ClientTimeout(total=5),
                        ) as resp:
                            if resp.status == 200:
                                data = await resp.json()
                                all_articles.extend((data or [])[:3])  # top 3 per ticker
                    except Exception:
                        pass  # skip individual ticker failures silently

        except Exception as e:
            logger.warning(f"Finnhub fetch error: {e}")
            return []

        items = []
        for article in all_articles:
            headline = article.get("headline", "").strip()
            if not headline:
                continue
            # Parse Unix timestamp
            ts = article.get("datetime", 0)
            try:
                published_at = datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)
            except Exception:
                published_at = datetime.utcnow()

            related = article.get("related", "")
            items.append(NewsItem(
                id=str(uuid.uuid4()),
                source=article.get("source", "Finnhub"),
                headline=headline,
                url=article.get("url", ""),
                published_at=published_at,
                related_tickers=[related] if related else [],
            ))
        return items

    async def _fetch_newsapi_news(self) -> List[NewsItem]:
        """Fetch top business headlines from NewsAPI."""
        try:
            url = (
                "https://newsapi.org/v2/top-headlines"
                "?category=business&language=en&pageSize=20"
                f"&apiKey={settings.NEWSAPI_KEY}"
            )
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        logger.warning(f"NewsAPI returned HTTP {resp.status}")
                        return []
                    data = await resp.json()

            items = []
            for article in data.get("articles", []):
                title = article.get("title", "").strip()
                if not title:
                    continue
                items.append(NewsItem(
                    id=str(uuid.uuid4()),
                    source=article.get("source", {}).get("name", "NewsAPI"),
                    headline=title,
                    url=article.get("url", ""),
                    published_at=datetime.utcnow(),
                ))
            return items
        except Exception as e:
            logger.warning(f"NewsAPI fetch error: {e}")
            return []

    def _mock_news(self) -> List[NewsItem]:
        """Realistic mock news for development."""
        mock_headlines = [
            ("AAPL", "Apple beats Q1 earnings estimates by 12%, raises full-year guidance"),
            ("NVDA", "NVIDIA reports record data center revenue, stock surges in after-hours"),
            ("TSLA", "Tesla misses delivery estimates for Q4, raises concerns about demand"),
            ("META", "Meta Platforms upgrade to Buy at Goldman Sachs, price target raised to $650"),
            ("SPY", "Fed signals two rate cuts in 2025, markets rally sharply"),
            ("QQQ", "CPI data comes in below expectations at 2.8%, tech stocks pop"),
            ("AMD", "AMD announces new AI chip partnership with Microsoft, shares jump 8%"),
            ("MSFT", "Microsoft Azure growth accelerates to 33%, beating consensus estimates"),
        ]
        items = []
        for ticker, headline in mock_headlines:
            items.append(NewsItem(
                id=str(uuid.uuid4()),
                source="Mock News",
                headline=headline,
                url=f"https://example.com/news/{ticker.lower()}",
                published_at=datetime.utcnow(),
                related_tickers=[ticker],
            ))
        return items

    def _classify_impact(self, nlp: NLPAnalysis) -> NewsImpact:
        if nlp.impact_score >= 7:
            return NewsImpact.HIGH
        elif nlp.impact_score >= 4:
            return NewsImpact.MEDIUM
        return NewsImpact.LOW

    def get_news(
        self,
        impact_filter: Optional[NewsImpact] = None,
        limit: int = 50,
    ) -> List[NewsItem]:
        """Return filtered news items."""
        items = list(self.news_cache.values())
        if impact_filter:
            items = [i for i in items if i.impact == impact_filter]
        return sorted(items, key=lambda x: x.published_at, reverse=True)[:limit]

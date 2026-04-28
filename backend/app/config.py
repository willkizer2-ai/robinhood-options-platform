"""
Application Configuration
"""
import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Robinhood Options Intelligence"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")

    # Database
    # Defaults to SQLite for local dev — set DATABASE_URL in .env to use PostgreSQL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite+aiosqlite:///./robinhood_dev.db"
    )
    DATABASE_URL_SYNC: str = os.getenv(
        "DATABASE_URL_SYNC", "postgresql://postgres:password@localhost:5432/robinhood_options"
    )

    # Redis (optional - falls back to in-memory)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    USE_REDIS: bool = os.getenv("USE_REDIS", "false").lower() == "true"

    # CORS
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    ALLOWED_ORIGINS: List[str] = list({
        "http://localhost:3000",
        "http://localhost:3001",
        "https://robinhood-options.vercel.app",
        "https://robinhood-intel.vercel.app",
        # Production frontend URL (set FRONTEND_URL env var on your host)
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    })

    # Market Data APIs
    POLYGON_API_KEY: str = os.getenv("POLYGON_API_KEY", "")
    ALPHA_VANTAGE_KEY: str = os.getenv("ALPHA_VANTAGE_KEY", "")
    TRADIER_API_KEY: str = os.getenv("TRADIER_API_KEY", "")
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "")

    # News APIs
    NEWSAPI_KEY: str = os.getenv("NEWSAPI_KEY", "")
    BENZINGA_API_KEY: str = os.getenv("BENZINGA_API_KEY", "")

    # NLP / AI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Scanner settings
    SCAN_INTERVAL_SECONDS: int = 30
    MAX_TICKERS_NORMAL: int = 100
    MAX_TICKERS_LOW_MEMORY: int = 25
    MIN_CONFIDENCE_SCORE: float = 0.65

    # Low Memory Mode
    LOW_MEMORY_MODE: bool = os.getenv("LOW_MEMORY_MODE", "false").lower() == "true"
    UPDATE_FREQUENCY_LOW_MEMORY: int = 120  # seconds

    # Small Account Mode
    SMALL_ACCOUNT_MAX: float = 500.0
    SMALL_ACCOUNT_MIN: float = 50.0
    SMALL_ACCOUNT_MAX_RISK_PCT: float = 0.10  # 10% max per trade

    # Alert settings
    ALERT_WEBHOOK_URL: str = os.getenv("ALERT_WEBHOOK_URL", "")
    ALERT_EMAIL: str = os.getenv("ALERT_EMAIL", "")

    # Market hours (Eastern)
    MARKET_OPEN_HOUR: int = 9
    MARKET_OPEN_MINUTE: int = 30
    MARKET_CLOSE_HOUR: int = 16
    MARKET_CLOSE_MINUTE: int = 0

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # silently ignore any unknown .env keys


settings = Settings()

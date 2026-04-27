"""
0DTE Strategy Engine
Identifies and structures zero day-to-expiration options setups.
These are the highest-probability, highest-reward intraday setups.
"""
import random
import uuid
import logging
from datetime import datetime, date, timedelta
from typing import Optional

from app.models.schemas import (
    TradeSetup, Direction, Strategy, TradeDecision,
    OptionsContract, MarketContext, TradeReasoning
)

logger = logging.getLogger(__name__)


class ZeroDTEStrategy:
    """
    Specializes in 0DTE (same-day expiration) options setups.

    Key patterns:
    1. Momentum Continuation — strong directional move with full V2.1 alignment
    2. News Catalyst Play — high-impact news with price/volume confirmation

    V2.1 thresholds (matches decision_engine.py + backtest.py):
      Volume     ≥ 2.0x  (was 2.5x)
      RSI CALL   46-66   (was 48-64)
      RSI PUT    34-54   (was 36-52)
      VWAP dev   > 0.10% (was 0.25%)
    Hard gates (IV rank, ADX, ORB, move edge) applied downstream by DecisionEngine.
    """

    # Tickers with 0DTE options (major ETFs and large caps)
    ZERO_DTE_ELIGIBLE = {
        "SPY", "QQQ", "IWM", "AAPL", "TSLA", "NVDA", "AMZN",
        "MSFT", "META", "GOOGL", "AMD", "NFLX", "SPX"
    }

    # Ideal delta range for 0DTE
    TARGET_DELTA_LOW  = 0.30
    TARGET_DELTA_HIGH = 0.55

    # V2.1 pattern thresholds (must match decision_engine + backtest)
    MIN_VOLUME_RATIO  = 2.0    # was 2.5x
    RSI_CALL_MIN      = 46.0   # was 48
    RSI_CALL_MAX      = 66.0   # was 64
    RSI_PUT_MIN       = 34.0   # was 36
    RSI_PUT_MAX       = 54.0   # was 52
    MIN_VWAP_DEV      = 0.10   # was 0.25 (%)

    async def evaluate(
        self,
        ticker: str,
        market_ctx: MarketContext,
    ) -> Optional[TradeSetup]:
        """
        Evaluate a ticker for a 0DTE setup.
        Returns a TradeSetup if a valid pattern is found, else None.
        """
        if ticker not in self.ZERO_DTE_ELIGIBLE:
            return self._evaluate_1dte(ticker, market_ctx)

        pattern = self._identify_pattern(market_ctx)
        if not pattern:
            return None

        direction, strategy, catalyst_tag = pattern

        # Build the options contract
        contract = self._select_contract(ticker, market_ctx, direction)
        if not contract:
            return None

        # Build placeholder reasoning (will be overwritten by decision engine)
        reasoning = TradeReasoning(
            bullet_points=[f"Pattern detected: {strategy.value}"],
            technical_context=f"Price: ${market_ctx.current_price:.2f} | VWAP: ${market_ctx.vwap:.2f}",
        )

        # ── Compute 4:00 PM ET expiry (DST-aware) stored as UTC naive ──────────
        import pytz as _pytz
        _et      = _pytz.timezone("America/New_York")
        _now_et  = datetime.now(_et)
        _exp_et  = _now_et.replace(hour=16, minute=0, second=0, microsecond=0)
        _exp_utc = _exp_et.astimezone(_pytz.utc).replace(tzinfo=None)  # naive UTC

        setup = TradeSetup(
            id=str(uuid.uuid4()),
            ticker=ticker,
            direction=direction,
            strategy=strategy,
            confidence_score=0.0,  # Set by decision engine
            decision=TradeDecision.DONT_TAKE,  # Default, overwritten
            news_catalyst_tag=catalyst_tag,
            contract=contract,
            market_context=market_ctx,
            reasoning=reasoning,
            detected_at=datetime.utcnow(),
            expires_at=_exp_utc,
        )

        return setup

    def _identify_pattern(
        self, ctx: MarketContext
    ) -> Optional[tuple]:
        """
        V2.1: Pattern detection using recalibrated thresholds.
        VWAP_RECLAIM removed (0% win rate in 42 trades).
        Volume/RSI/VWAP thresholds now match decision_engine.py and backtest.py.
        IV rank, ADX, ORB, and move-edge hard gates applied downstream by DecisionEngine.
        """
        patterns_found = []

        # Pattern 1: Momentum Continuation
        # V2.1: volume ≥ 2.0x (was 2.5x), RSI CALL 46-66 (was 48-64), VWAP > 0.10% (was 0.25%)
        if ctx.volume_ratio >= self.MIN_VOLUME_RATIO:
            if (ctx.market_structure == "uptrend" and
                ctx.rsi_14 and self.RSI_CALL_MIN <= ctx.rsi_14 <= self.RSI_CALL_MAX and
                ctx.macd_signal == "bullish_cross" and
                ctx.price_vs_vwap > self.MIN_VWAP_DEV):
                patterns_found.append((
                    Direction.CALL,
                    Strategy.MOMENTUM,
                    "Momentum Continuation — Full Alignment",
                    self._pattern_confidence(ctx, Direction.CALL, 0.82)
                ))
            elif (ctx.market_structure == "downtrend" and
                  ctx.rsi_14 and self.RSI_PUT_MIN <= ctx.rsi_14 <= self.RSI_PUT_MAX and
                  ctx.macd_signal == "bearish_cross" and
                  ctx.price_vs_vwap < -self.MIN_VWAP_DEV):
                patterns_found.append((
                    Direction.PUT,
                    Strategy.MOMENTUM,
                    "Momentum Continuation — Full Alignment",
                    self._pattern_confidence(ctx, Direction.PUT, 0.82)
                ))

        # Pattern 2: News Catalyst Play (volume ≥ 2.0x + structure aligned)
        # V2.1 RSI bounds applied here to pre-filter obvious overbought/oversold entries
        if ctx.volume_ratio >= self.MIN_VOLUME_RATIO and ctx.market_structure in ["uptrend", "downtrend"]:
            if (ctx.market_structure == "uptrend" and
                ctx.rsi_14 and ctx.rsi_14 <= self.RSI_CALL_MAX):
                patterns_found.append((
                    Direction.CALL,
                    Strategy.MOMENTUM,
                    "News Catalyst Play",
                    self._pattern_confidence(ctx, Direction.CALL, 0.76)
                ))
            elif (ctx.market_structure == "downtrend" and
                  ctx.rsi_14 and ctx.rsi_14 >= self.RSI_PUT_MIN):
                patterns_found.append((
                    Direction.PUT,
                    Strategy.MOMENTUM,
                    "News Catalyst Play",
                    self._pattern_confidence(ctx, Direction.PUT, 0.76)
                ))

        if not patterns_found:
            return None

        best = max(patterns_found, key=lambda x: x[3])
        return best[0], best[1], best[2]

    def _pattern_confidence(
        self, ctx: MarketContext, direction: Direction, base: float
    ) -> float:
        conf = base
        # V2.1 volume bonuses (thresholds lowered to match recalibrated MIN_VOLUME_RATIO)
        if ctx.volume_ratio >= 3.0:    conf += 0.05
        elif ctx.volume_ratio >= 2.5:  conf += 0.03
        elif ctx.volume_ratio >= 2.0:  conf += 0.01
        if ctx.macd_signal in ["bullish_cross", "bearish_cross"]: conf += 0.04
        if abs(ctx.price_vs_vwap) > 0.5:  conf += 0.03
        # ADX bonus when available
        if ctx.adx_14 is not None and ctx.adx_14 >= 28:  conf += 0.03
        elif ctx.adx_14 is not None and ctx.adx_14 >= 22: conf += 0.01
        # ORB confirmation bonus
        if ctx.orb_confirmed:  conf += 0.02
        return min(conf, 0.95)

    def _select_contract(
        self,
        ticker: str,
        ctx: MarketContext,
        direction: Direction,
    ) -> Optional[OptionsContract]:
        """
        Select the optimal 0DTE contract.
        Target: slightly OTM, delta 0.35-0.50, high liquidity.
        """
        today = date.today().strftime("%Y-%m-%d")
        price = ctx.current_price

        # Select strike based on direction
        if direction == Direction.CALL:
            # Slightly OTM call
            strike = self._round_to_strike(price * 1.005)
        else:
            # Slightly OTM put
            strike = self._round_to_strike(price * 0.995)

        # Estimate premium (simplified - use real options chain in production)
        premium = self._estimate_premium(price, strike, direction)
        delta = 0.45 if direction == Direction.CALL else -0.45

        # Build contract symbol
        exp_compact = date.today().strftime("%y%m%d")
        type_char = "C" if direction == Direction.CALL else "P"
        strike_padded = f"{int(strike * 1000):08d}"
        symbol = f"{ticker}{exp_compact}{type_char}{strike_padded}"

        bid = round(premium * 0.95, 2)
        ask = round(premium * 1.05, 2)

        return OptionsContract(
            ticker=ticker,
            strike=strike,
            expiration=today,
            contract_type=direction,
            premium=premium,
            delta=delta,
            implied_volatility=round(random.uniform(0.25, 0.85), 2),
            volume=random.randint(200, 5000),
            open_interest=random.randint(500, 15000),
            bid=bid,
            ask=ask,
            contract_symbol=symbol,
        )

    def _round_to_strike(self, price: float) -> float:
        """Round to nearest valid strike increment."""
        if price >= 500:
            increment = 5.0
        elif price >= 100:
            increment = 1.0
        elif price >= 50:
            increment = 0.5
        else:
            increment = 0.5
        return round(round(price / increment) * increment, 2)

    def _estimate_premium(
        self, price: float, strike: float, direction: Direction
    ) -> float:
        """
        Simplified premium estimate using intrinsic + time value.
        In production, use real options chain data.
        """
        intrinsic = max(0, price - strike) if direction == Direction.CALL else max(0, strike - price)
        time_value = price * 0.003  # ~0.3% of price as 0DTE time value
        premium = intrinsic + time_value
        return max(round(premium, 2), 0.05)  # Min $0.05

    def _evaluate_1dte(
        self, ticker: str, ctx: MarketContext
    ) -> Optional[TradeSetup]:
        """For non-0DTE eligible tickers, look for 1DTE setups."""
        # Simplified — same logic, next trading day expiry
        # Return None for now; extend as needed
        return None

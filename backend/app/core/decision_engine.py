"""
Binary Decision Engine — V2.1 (Full backtest-proven filter stack)
Every trade MUST get a clear: DO TAKE or DON'T TAKE

V2 gates:  spread, volume ≥2.0x, RSI zone, lunch block, VWAP deviation
V2.1 adds: IV rank <0.65, ADX ≥22 (28 for AMZN CALL), expected move edge ≥25%

Golden Hour = all V2.1 gates pass simultaneously + confidence ≥ 80% + DO_TAKE.
"""
import logging
from dataclasses import dataclass
from typing import Optional

from app.models.schemas import (
    TradeSetup, MarketContext, TradeDecision, TradeReasoning,
    Direction, Strategy
)

logger = logging.getLogger(__name__)


@dataclass
class DecisionResult:
    decision: TradeDecision
    confidence: float
    reasoning: TradeReasoning
    score_breakdown: dict


class DecisionEngine:
    """
    Scores every potential trade across multiple dimensions.
    Applies hard filters (immediate DONT_TAKE triggers).
    Returns a binary DO / DONT decision with full reasoning.

    V2 Scoring (total 100 pts):
      Technical      40 pts  (was 25)
      Volume         15 pts  (was 20)
      News catalyst  25 pts  (unchanged)
      Options struct 10 pts  (was 15)
      Time of day    10 pts  (was 15)
    """

    # ── V2 hard filter thresholds ─────────────────────────────────────
    MIN_VOLUME_RATIO       = 2.0    # Recalibrated: 2.0x is meaningful without over-filtering
    MIN_CONFIDENCE_TO_TAKE = 0.75   # Raised from 0.65
    MAX_SPREAD_PCT         = 0.12   # Max 12% bid/ask spread
    MIN_OPTION_VOLUME      = 50
    MIN_OPEN_INTEREST      = 100
    RSI_CALL_MIN           = 46.0   # RSI trend zone for CALLs (recalibrated: 46-66)
    RSI_CALL_MAX           = 66.0
    RSI_PUT_MIN            = 34.0   # RSI trend zone for PUTs (recalibrated: 34-54)
    RSI_PUT_MAX            = 54.0
    MIN_VWAP_DEVIATION     = 0.10   # Realistic for daily-bar VWAP proxy

    # ── V2.1 additional hard gates (backtest-proven) ──────────────────
    MAX_IV_RANK            = 0.65   # Only trade when options aren't expensive
    MIN_ADX                = 22.0   # Wilder ADX — require trend strength
    MIN_MOVE_EDGE          = 0.25   # Proj. intrinsic at 1-ATR move ≥ 1.25× premium
    TICKER_ADX_OVERRIDES   = {      # Per-ticker tighter ADX gate
        "AMZN": {"CALL": 28.0},     # AMZN calls: 0% historical win rate below ADX 28
    }

    async def evaluate(
        self,
        setup: TradeSetup,
        market_ctx: MarketContext,
    ) -> DecisionResult:
        scores = {}
        dont_take_reasons = []
        do_take_reasons = []

        # ── HARD FILTERS ──────────────────────────────────────────────────────

        # 0. IV Rank — avoid expensive option environments (V2.1)
        if market_ctx.iv_rank is not None and market_ctx.iv_rank > self.MAX_IV_RANK:
            dont_take_reasons.append(
                f"⚠️ IV Rank {market_ctx.iv_rank:.0%} — options overpriced (need <65th pct)"
            )
            return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                         "IV Rank too high — avoid expensive options")

        # 1. Bid/ask spread too wide
        if setup.contract.spread_pct > self.MAX_SPREAD_PCT:
            dont_take_reasons.append(
                f"⚠️ Spread {setup.contract.spread_pct:.1%} too wide — bad fill risk"
            )
            return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                         "Spread too wide")

        # 2. Volume too low — V2 raises this to 2.5x (institutional confirmation)
        if market_ctx.volume_ratio < self.MIN_VOLUME_RATIO:
            dont_take_reasons.append(
                f"⚠️ Volume {market_ctx.volume_ratio:.1f}x average — need ≥2.5x for signal quality"
            )
            return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                         "Insufficient volume — not institutional-grade participation")

        # 3. RSI out of valid range for direction
        if market_ctx.rsi_14:
            if setup.direction == Direction.CALL:
                if not (self.RSI_CALL_MIN <= market_ctx.rsi_14 <= self.RSI_CALL_MAX):
                    dont_take_reasons.append(
                        f"⚠️ RSI {market_ctx.rsi_14:.0f} outside CALL zone ({self.RSI_CALL_MIN:.0f}-{self.RSI_CALL_MAX:.0f}) — chasing or oversold"
                    )
                    return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                                 "RSI out of valid call zone")
            else:  # PUT
                if not (self.RSI_PUT_MIN <= market_ctx.rsi_14 <= self.RSI_PUT_MAX):
                    dont_take_reasons.append(
                        f"⚠️ RSI {market_ctx.rsi_14:.0f} outside PUT zone ({self.RSI_PUT_MIN:.0f}-{self.RSI_PUT_MAX:.0f})"
                    )
                    return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                                 "RSI out of valid put zone")

        # 4a. ADX trend-strength gate (V2.1)
        if market_ctx.adx_14 is not None:
            direction_str = setup.direction.value
            min_adx = self.TICKER_ADX_OVERRIDES.get(
                setup.ticker, {}
            ).get(direction_str, self.MIN_ADX)
            if market_ctx.adx_14 < min_adx:
                dont_take_reasons.append(
                    f"⚠️ ADX {market_ctx.adx_14:.1f} below {min_adx:.0f} — no clear trend"
                )
                return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                             "ADX too low — choppy / range-bound market")

        # 4b. Expected move edge gate (V2.1) — proj. intrinsic ≥ 1.25× premium
        if market_ctx.expected_move_edge is not None:
            if market_ctx.expected_move_edge < self.MIN_MOVE_EDGE:
                dont_take_reasons.append(
                    f"⚠️ Move edge {market_ctx.expected_move_edge:+.0%} — "
                    f"full-ATR move can't return ≥25% on premium paid"
                )
                return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                             "Insufficient expected move vs premium")

        # 4c. Lunch hour block (11:30–13:30 ET) — highest noise, lowest follow-through
        time_score = self._score_time_of_day()
        if time_score < 0:
            dont_take_reasons.append("⚠️ Lunch hour (11:30–13:30 ET) — avoid 0DTE during low-volume chop")
            return self._build_dont_take(dont_take_reasons, scores, setup, market_ctx,
                                         "Lunch-hour no-trade window")
        scores["time_of_day"] = time_score

        # ── SCORING ──────────────────────────────────────────────────────────

        tech_score    = self._score_technical(setup, market_ctx)
        vol_score     = self._score_volume(market_ctx)
        news_score    = self._score_news_catalyst(setup)
        options_score = self._score_options_structure(setup.contract)

        scores["technical"]       = tech_score
        scores["volume"]          = vol_score
        scores["news_catalyst"]   = news_score
        scores["options_structure"] = options_score

        raw_total  = sum(scores.values())
        confidence = raw_total / 100.0

        # ── REASONING ────────────────────────────────────────────────────────

        if tech_score >= 30:
            do_take_reasons.append(f"✅ Strong technical alignment: {market_ctx.market_structure} + VWAP + MACD all confirmed")
        elif tech_score >= 20:
            do_take_reasons.append(f"✅ Moderate technical setup — partial alignment on {setup.ticker}")
        else:
            dont_take_reasons.append(f"❌ Weak technical setup — structure not confirmed across all dimensions")

        if vol_score >= 12:
            do_take_reasons.append(f"✅ Volume {market_ctx.volume_ratio:.1f}x — institutional participation confirmed")
        else:
            dont_take_reasons.append(f"❌ Volume {market_ctx.volume_ratio:.1f}x — below conviction threshold")

        if news_score >= 20:
            do_take_reasons.append(f"✅ High-impact catalyst: {setup.news_catalyst_tag or 'Confirmed'}")
        elif news_score >= 10:
            do_take_reasons.append(f"✅ Moderate news support")

        vwap_side_ok = (
            (setup.direction == Direction.CALL and market_ctx.price_vs_vwap > self.MIN_VWAP_DEVIATION) or
            (setup.direction == Direction.PUT  and market_ctx.price_vs_vwap < -self.MIN_VWAP_DEVIATION)
        )
        if not vwap_side_ok:
            dont_take_reasons.append(
                f"⚠️ Price only {market_ctx.price_vs_vwap:+.2f}% from VWAP — need >{self.MIN_VWAP_DEVIATION:.2f}% for clean setup"
            )

        # ── BINARY DECISION ───────────────────────────────────────────────────

        if confidence >= self.MIN_CONFIDENCE_TO_TAKE and len(dont_take_reasons) == 0:
            decision = TradeDecision.DO_TAKE
            final_reasons = do_take_reasons
            risk_warning  = None
            dont_chase    = False
        else:
            decision = TradeDecision.DONT_TAKE
            final_reasons = dont_take_reasons if dont_take_reasons else [
                "❌ Insufficient confidence — wait for cleaner setup",
            ]
            risk_warning = "Setup does not meet V2 quality thresholds."
            dont_chase   = True

        invalidation = None
        if market_ctx.support_level and setup.direction == Direction.CALL:
            invalidation = market_ctx.support_level
            if decision == TradeDecision.DO_TAKE:
                final_reasons.append(f"⚠️ Exit if price breaks below ${invalidation:.2f}")
        elif market_ctx.resistance_level and setup.direction == Direction.PUT:
            invalidation = market_ctx.resistance_level
            if decision == TradeDecision.DO_TAKE:
                final_reasons.append(f"⚠️ Exit if price breaks above ${invalidation:.2f}")

        reasoning = TradeReasoning(
            bullet_points=final_reasons,
            technical_context=(
                f"{market_ctx.market_structure.upper()} | "
                f"VWAP {market_ctx.price_vs_vwap:+.2f}% | "
                f"RSI {market_ctx.rsi_14:.0f} | "
                f"Vol {market_ctx.volume_ratio:.1f}x"
            ),
            risk_warning=risk_warning,
            invalidation_level=invalidation,
            dont_chase_warning=dont_chase,
            setup_invalidated=False,
        )

        return DecisionResult(
            decision=decision,
            confidence=round(confidence, 3),
            reasoning=reasoning,
            score_breakdown=scores,
        )

    # ── SCORING HELPERS (V2 weights) ──────────────────────────────────────────

    def _score_technical(self, setup: TradeSetup, ctx: MarketContext) -> float:
        """
        Technical score: max 40 pts (was 25).
        Requires full alignment across VWAP position, structure, and MACD.
        """
        score = 0.0

        # VWAP position (0-15 pts)
        if setup.direction == Direction.CALL:
            if ctx.price_vs_vwap > 0.5:
                score += 15   # strongly above VWAP
            elif ctx.price_vs_vwap > 0.25:
                score += 10   # clearly above VWAP
            elif ctx.price_vs_vwap > 0:
                score += 5    # barely above — weak
            else:
                score += 0    # below VWAP — wrong side
        else:  # PUT
            if ctx.price_vs_vwap < -0.5:
                score += 15
            elif ctx.price_vs_vwap < -0.25:
                score += 10
            elif ctx.price_vs_vwap < 0:
                score += 5
            else:
                score += 0

        # Market structure (0-15 pts)
        if setup.direction == Direction.CALL and ctx.market_structure == "uptrend":
            score += 15
        elif setup.direction == Direction.PUT and ctx.market_structure == "downtrend":
            score += 15
        elif ctx.market_structure == "neutral":
            score += 5   # partial credit

        # MACD signal (0-10 pts)
        if setup.direction == Direction.CALL and ctx.macd_signal == "bullish_cross":
            score += 10
        elif setup.direction == Direction.PUT and ctx.macd_signal == "bearish_cross":
            score += 10
        elif ctx.macd_signal == "neutral":
            score += 3

        return min(score, 40.0)

    def _score_volume(self, ctx: MarketContext) -> float:
        """Volume score: max 15 pts (was 20). Threshold raised to 2.5x."""
        ratio = ctx.volume_ratio
        if ratio >= 3.0:   return 15
        elif ratio >= 2.5: return 12
        elif ratio >= 2.0: return 8
        elif ratio >= 1.5: return 4
        return 0

    def _score_news_catalyst(self, setup: TradeSetup) -> float:
        """News score: max 25 pts (unchanged)."""
        if not setup.news_catalyst_tag:
            return 5
        if setup.nlp_analysis:
            return min(setup.nlp_analysis.impact_score * 2.5, 25)
        return 12

    def _score_options_structure(self, contract) -> float:
        """Options structure: max 10 pts (was 15)."""
        score = 0.0
        if contract.spread_pct < 0.05:   score += 5
        elif contract.spread_pct < 0.10: score += 3
        else:                             score += 1
        vol = contract.volume or 0
        if vol > 1000:   score += 3
        elif vol > 500:  score += 2
        elif vol > 100:  score += 1
        oi = contract.open_interest or 0
        if oi > 5000:   score += 2
        elif oi > 1000: score += 1
        return min(score, 10.0)

    def _score_time_of_day(self) -> float:
        """
        Time score: max 10 pts.
        Returns -1 during lunch hour (11:30-13:30 ET) — hard no-trade block.
        Uses DST-aware America/New_York (EST/EDT) — never hardcodes UTC offset.
        DEBUG mode always returns peak-hour score so the dashboard stays populated.
        """
        from app.config import settings
        if settings.DEBUG:
            return 10

        import pytz, datetime as _dt
        et     = pytz.timezone("America/New_York")
        now_et = _dt.datetime.now(et)
        t      = now_et.hour + now_et.minute / 60.0

        if   9.5  <= t < 10.5: return 10  # Opening power hour
        elif 10.5 <= t < 11.5: return 8   # Pre-lunch momentum
        elif 11.5 <= t < 13.5: return -1  # LUNCH BLOCK — hard no-trade
        elif 13.5 <= t < 15.0: return 7   # Afternoon re-open
        elif 15.0 <= t < 16.0: return 9   # Closing power hour
        return 3

    def _build_dont_take(self, reasons, scores, setup, ctx, override_reason="") -> DecisionResult:
        reasoning = TradeReasoning(
            bullet_points=reasons,
            risk_warning=override_reason or "Hard filter triggered",
            dont_chase_warning=True,
            setup_invalidated=True,
        )
        return DecisionResult(
            decision=TradeDecision.DONT_TAKE,
            confidence=0.0,
            reasoning=reasoning,
            score_breakdown=scores,
        )

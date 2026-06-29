"""
Daily Replay Scheduler (in-process)
═══════════════════════════════════════════════════════════════════════════════
Runs the replay refresh once per day from within the web service, so the updated
data_replays.json is written to the same filesystem the API serves from.

A Render Cron Job would run in a SEPARATE container with its own ephemeral disk,
so its writes wouldn't reach the web service — hence the in-process approach.

Schedule: every day shortly after the US market close + settle (21:30 UTC ≈
4:30pm ET). The refresh itself is idempotent, so an extra run is harmless.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Target run time in UTC (≈ 4:30pm ET, after close).
RUN_HOUR_UTC = 21
RUN_MINUTE_UTC = 30


def _seconds_until_next_run() -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=RUN_HOUR_UTC, minute=RUN_MINUTE_UTC, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


def _run_refresh_sync():
    """Run the (synchronous, network + file I/O) refresh job."""
    try:
        import daily_replay_refresh
        daily_replay_refresh.run()
    except Exception as e:
        logger.error(f"Daily replay refresh failed: {e}")


async def run_daily_replay_scheduler():
    """Background task: sleep until the daily slot, run refresh, repeat."""
    logger.info("Daily replay scheduler started.")
    while True:
        try:
            wait = _seconds_until_next_run()
            logger.info(f"Next replay refresh in {wait/3600:.1f}h.")
            await asyncio.sleep(wait)
            # Run the blocking refresh off the event loop.
            await asyncio.to_thread(_run_refresh_sync)
        except asyncio.CancelledError:
            logger.info("Daily replay scheduler stopped.")
            break
        except Exception as e:
            logger.error(f"Replay scheduler loop error: {e}")
            # Avoid a tight crash-loop; wait an hour before retrying.
            await asyncio.sleep(3600)

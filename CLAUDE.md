# Robinhood Options Intelligence Platform — Project Rules

## Stack
- **Backend**: FastAPI + Python 3.11, deployed on Render (`robinhood-options-backend.onrender.com`)
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind, deployed on Vercel (`robinhood-options.vercel.app`)
- **Data**: yfinance (real market data only — no mocks, no synthetic fallbacks)

---

## RULE 1 — Minimum 3 real trade cards per session (MANDATORY)

During every trading session, **at least 3 credible, non-mock 0DTE trade cards must
appear on the dashboard between 9:35 AM and 11:00 AM ET**.

### How this is enforced in code
1. **Primary scan** (strict V2.1 gates): volume ≥ 2.0×, RSI in zone, MACD regime
   aligned, ADX ≥ 22, IV rank < 0.65, ORB confirmed, move edge ≥ 25%.
   These are the highest-quality "Golden Hour" setups.

2. **Secondary backfill** (`_backfill_secondary_setups` in `scanner.py`): fires
   automatically if fewer than `MIN_DAILY_SETUPS` (default `3`) primary setups were
   found by the end of the first full scan cycle within the entry window.
   Relaxed thresholds — still 100% real yfinance data:
   - Volume ≥ 1.2× (primary: 2.0×)
   - RSI CALL 40–72, PUT 28–60 (primary: 46–66 / 34–54)
   - MACD not opposing direction (neutral accepted)
   - ADX / IV rank / ORB / move-edge not required (shown as yellow flags)
   - Confidence capped at 72% so secondary cards are never confused with primaries
   - Cards are labelled "Best Available Setup — secondary tier" with a size-down warning

### What is forbidden
- **No mock data** — `_mock_market_context` and `_mock_news` are permanently deleted.
  Never re-introduce them. If yfinance fails, the ticker is **skipped**, not faked.
- **No DEBUG=true in production** — `DEBUG` must be `"false"` in Render env vars.
  `DEBUG=true` bypasses time gates and inflates confidence scores.
- **No synthetic/seeded technical profiles** — all RSI, MACD, ADX, volume figures
  must come from real yfinance data.

---

## RULE 2 — Every morning at 8:00 AM ET, run an automated audit

A Claude Code scheduled task runs at **8:00 AM ET on weekdays** to verify the scanner
is production-ready before the 9:30 AM market open. It checks:

1. `DEBUG` env var is `"false"` on Render
2. No `_mock_market_context`, `_mock_news`, or `random.uniform` calls exist in
   production code paths (grep: `mock_market_context|_mock_news|random\.uniform`)
3. `scipy` is present in `backend/requirements.txt`
4. `_in_entry_window()` uses `(9 * 60 + 30)` not `(9 * 60 + 35)`
5. `MIN_DAILY_SETUPS` is set to ≥ 3
6. `_backfill_secondary_setups` method exists in `scanner.py`
7. yfinance is importable and returns a valid price for `SPY` (smoke test)

If any check fails, the task auto-remediates and commits the fix, then logs the
outcome to `audit_log.txt` at the project root.

---

## RULE 3 — No confidence-score inflation

- Primary setups: confidence range 0.65 – 1.00
- Secondary setups: confidence range 0.48 – 0.72 (hard cap enforced in code)
- V4 ICT setups: confidence range 0.65 – 1.00 (stored × 100, displayed /100)
- **Never** manually set `confidence_score = 1.0` or any static value; it must be
  computed from real signal scores.

---

## RULE 4 — Time windows (ET = America/New_York, DST-aware via pytz)

| Window               | Purpose                               |
|----------------------|---------------------------------------|
| 9:00 AM – 4:30 PM    | Scanner runs, cards visible           |
| **9:30 AM – 11:00 AM** | **0DTE entry window — cards posted**  |
| 11:30 AM – 1:30 PM   | Lunch block — no new 0DTE entries     |
| 4:00 PM expiry       | All 0DTE contracts expire             |
| 4:30 PM board clear  | Active setups purged until next day   |

Secondary backfill only runs within the 9:30–11:00 AM window, same as primary.

---

## RULE 5 — Deployment

Push to `master` → both services deploy automatically:
- **Backend** (Render): rebuilds Docker image, installs `requirements.txt` (includes scipy)
- **Frontend** (Vercel): GitHub Action triggers on `frontend/**` changes

Never commit with `DEBUG=true`. Never commit mock-data code paths.

---

## RULE 6 — No mock data anywhere — failed fetches return empty, never fake

**Every data path on the site must return real data or nothing at all.**

### What is forbidden
| Pattern | Example | Required fix |
|---------|---------|-------------|
| Hardcoded fallback strings | Rotating macro context text when SPY fails | Return `""` |
| Hardcoded fallback lists | Fake economic event pool | Return `[]` |
| Simulated / Monte Carlo results | Seeded-random "backtest" performance | Return `strategies: []` |
| `random.uniform` / `random.randint` | Synthetic IV, volume, open interest | Set field to `None` |
| `rng.gauss` / `rng.random` in response paths | Monte Carlo equity curve | Remove entirely |
| `random.Random(day_seed)` used in API responses | Date-seeded fake data | Remove; skip ticker instead |

### The rule in plain English
- If yfinance (or any external API) fails → **skip the ticker / return empty**.
- If a field has no real value → set it to `None`, not a random number.
- If an endpoint has no real data source yet → return an empty payload with a plain message.
- **Never** rotate through hardcoded text to simulate variety.

### Files cleaned under this rule (do not re-introduce)
| File | What was removed |
|------|-----------------|
| `backend/app/core/research_agent.py` | `_get_macro_context()` hardcoded context list; `_get_key_events_tomorrow()` fake event pool; `import random` |
| `backend/app/api/routes/performance.py` | Entire `_simulate()` Monte Carlo function; `_build_report()` seeded backtest; `import random` |
| `backend/app/core/dte_strategy.py` | `random.uniform` IV; `random.randint` volume + open_interest |
| `backend/app/core/news_engine.py` | `_mock_news()` fake headlines |

### Current empty-state behaviour
- **Macro context** (`/api/research/report`): `macro_context: ""` when SPY unavailable
- **Key events** (`/api/research/report`): `key_events_tomorrow: []` always (no real calendar API connected)
- **Performance** (`/api/performance`): `strategies: []` until real trade history is connected
- **Trade cards**: scanner skips ticker entirely if yfinance fails; secondary backfill fills minimum count with real-data setups only

---

## Key files

| File | Role |
|------|------|
| `backend/app/core/scanner.py` | Primary + secondary scan, yfinance fetch, V4 ICT |
| `backend/app/core/decision_engine.py` | V2.1 hard gates + scoring |
| `backend/app/core/dte_strategy.py` | Pattern detection + contract building |
| `backend/app/core/ict_engine_v4.py` | V4 daily-bar ICT strategy (scipy required) |
| `backend/app/config.py` | All settings including `MIN_DAILY_SETUPS` |
| `backend/requirements.txt` | Must include `scipy>=1.11.0` |
| `frontend/src/lib/useTradeOutcome.ts` | Display hours, trade persistence |

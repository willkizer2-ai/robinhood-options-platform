# Trading Dashboard — UI kit

A high-fidelity recreation of the **Web Trace** options-intelligence desk, rebuilt
on the design system. Recreated from the original Next.js codebase
(`willkizer2-ai/robinhood-options-project`) — the same five surfaces, restyled into
the dark, cool, periwinkle palette.

## Run
Open `index.html`. It loads the compiled bundle (`../../_ds_bundle.js`), Lucide
icons, and `desk.jsx`, then renders the full desk. Tabs and the trade-card
"Full details" toggle are interactive.

## Files
- `index.html` — entry; loads bundle + lucide + `api.js` + `desk.jsx`.
- `api.js` — backend data layer (`window.WebTraceAPI`): endpoint wrappers, response
  mappers, and per-screen loaders.
- `desk.jsx` — the desk UI: `DeskHeader`, `TradeCard`, and the five data-driven
  screens, each with loading skeletons and a Live/Offline connection chip.

## Backend wiring
The desk pulls live data from the FastAPI backend (the uploaded `backend/`
service). Endpoints used: `/api/trades`, `/api/scanner/status`,
`/api/scanner/price/{ticker}`, `/api/performance`, `/api/research/overnight`,
`/api/alerts`, `/api/news`. Polling: signals 30s, alerts 20s, news 60s, status 15s.

**API base** resolves in this order: `?api=<url>` query param (persisted) →
`localStorage['wt_api_base']` → `window.WEB_TRACE_API_BASE` → `/api` (same-origin
default). Point it at a running backend to see live data, e.g.
`index.html?api=http://localhost:8000/api`.

**No mock data.** When the backend is unreachable, every screen shows an empty
state and an “Offline” chip — never fabricated cards or figures, matching the
product's hard no-mock-data rule.

## Surfaces
- **Signals** — stat strip + grid of trade cards. Each card shows state banner,
  ticker, direction, confidence meter, live price, contract pills, entry/stop/target,
  and reasoning bullets. States: hold (gold) · take-profit (teal) · stop (magenta) ·
  awaiting entry (neutral).
- **Performance** — KPI stat tiles + a monthly-returns bar chart (teal/magenta).
- **Research** — overnight top-setups list + market-bias panel.
- **Alerts** — read/unread activity list.
- **News** — sentiment-scored market feed with related tickers.

## Components used
`Panel`, `Banner`, `DirectionTag`, `ConfidenceMeter`, `PriceTicker`, `Badge`,
`Button`, `StatTile`, `StatusPill`, `Tabs` — all from the design-system bundle.
Icons via Lucide (CDN), matching the source product's `lucide-react`.

> The desk renders only real backend data. With no backend reachable it shows
> empty states (no cards) and an Offline indicator — the deployed backend wiring
> will be owned by a code manager.

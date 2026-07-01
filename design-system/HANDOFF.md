# Web Trace — Hand-off for the Code Manager

This folder is the complete **Web Trace Portfolio Management** design system, ready
to drop into the GitHub repo. It was built to rebrand the existing
"Market Cyclops / Robinhood Options" project into **Web Trace** (dark charcoal +
periwinkle, new fonts, new name) and to wire the new dashboard to the **existing
backend** with no mock data.

Source repo this targets: https://github.com/willkizer2-ai/robinhood-options-project

---

## TL;DR — what to do

1. Copy this entire `design-system/` folder into the repo root.
2. Commit and push:
   ```bash
   git add design-system
   git commit -m "Add Web Trace design system + rebranded UI kits"
   git push origin master
   ```
3. (Optional, to actually ship the rebrand) follow **"Adopting it in the app"** below.

Nothing here overwrites existing app code — it's additive. Review, then integrate at
your pace.

---

## What's in here

- `styles.css` — the single stylesheet to link. It pulls in every design token
  (colors, type, spacing, effects) and the three webfonts.
- `tokens/` — the raw design variables (CSS custom properties) + `@font-face` rules.
- `assets/` — the Web Trace logo (SVG) and font files (`assets/fonts/`, with their
  open-source licenses).
- `components/` — reusable React UI pieces (Button, Badge, Panel, StatTile, etc.),
  each with a TypeScript types file (`.d.ts`) and a usage note (`.prompt.md`).
- `ui_kits/` — full-screen recreations you can preview by opening the `index.html`
  in each subfolder:
  - `dashboard/` — the trading desk (Signals, Performance, Research, Alerts, News),
    **already wired to the backend** (see below).
  - `marketing/` — the new dark landing page.
  - `auth/` — sign in / create account screens.
- `foundations/` — small specimen pages documenting colors, type, spacing, brand.
- `readme.md` — the full design guide (brand voice, visual rules, iconography).
- `SKILL.md` — lets an AI agent (e.g. Claude Code) load this brand context.
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` — generated build
  artifacts. Safe to commit; they're rebuilt by the design tooling.

---

## The backend wiring (important)

The dashboard reads **live data only** from the existing FastAPI backend. The data
layer is `ui_kits/dashboard/api.js`. It calls these endpoints:

- `GET /api/trades`  + `GET /api/scanner/price/{ticker}` (live quotes)
- `GET /api/scanner/status`
- `GET /api/performance`
- `GET /api/research/overnight`
- `GET /api/alerts`
- `GET /api/news`

**No mock data:** if the backend is unreachable, every screen shows an empty state
and an "Offline" chip — never fake cards or numbers. This matches the project's
hard no-mock-data rule.

**Where it points (API base), in priority order:**
1. `?api=<url>` in the page URL (saved for next time) — handy for testing.
2. `localStorage['wt_api_base']`.
3. `window.WEB_TRACE_API_BASE` — set this in production.
4. `/api` on the same domain (the default).

Quick local test against a running backend:
`ui_kits/dashboard/index.html?api=http://localhost:8000/api`

**CORS:** because the page fetches from the browser, the backend must allow the
page's origin. The backend's `ALLOWED_ORIGINS` already permits the deployed Vercel
frontends; add any new origin you serve these pages from.

---

## Adopting it in the Next.js app (when you're ready)

The `ui_kits/` previews use CDN React + a prebuilt bundle so they open standalone in
a browser. To use them inside the real Next.js frontend:

1. **Tokens/fonts:** import `design-system/styles.css` once (e.g. in the root layout)
   so the brand variables and fonts are available app-wide. Copy `assets/fonts/` to
   where the app serves static files and fix the `@font-face` URLs if needed.
2. **Logo + name:** swap the old Market Cyclops mark for `assets/logo-mark.svg` and
   update the product name to "Web Trace Portfolio Management".
3. **Components:** the files in `components/**` are normal React components — import
   them directly instead of loading `_ds_bundle.js`. (The bundle is only for the
   standalone HTML previews.)
4. **Dashboard data:** the mappers in `ui_kits/dashboard/api.js` show exactly how
   each backend response maps to the UI. Port that logic into the app's existing
   data-fetching (the original used SWR) — the endpoint paths are unchanged.

Existing backend behavior and routes are untouched; this is a frontend reskin plus a
data-mapping layer.

---

## Using Claude Code to push / iterate (optional)

`SKILL.md` is written so Claude Code (the developer CLI version) can load the full
brand context and keep building — and because it runs with your local git
credentials, it **can** commit and push directly. Point it at this folder and ask it
to integrate or extend the system.

---

Built with the attached codebase + the chart color reference. Questions for the
designer: see the "Notes & open decisions" and visual-foundations sections in
`readme.md`.

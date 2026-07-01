# Web Trace — Site Rework Guide (for the Code Manager)

**Read this first.** This is the build order for converting the existing
**Market Cyclops** site into **Web Trace Portfolio Management**. It is written to be
followed top to bottom.

Target repo: https://github.com/willkizer2-ai/robinhood-options-project
This `design-system/` folder ships the brand, components, and three reference
screens (dashboard, landing, auth) you will rebuild against.

---

## ⭐ COPY-PASTE BRIEF (Will → Code Manager)

> Paste this message to the code manager along with this folder. It's the whole ask
> in plain terms; the numbered sections below are the detailed how-to.

```text
Hi — we're rebranding the site from "Market Cyclops" to "Web Trace Portfolio
Management." The first attempt only changed the colors to dark; everything else from
the old site is still there and needs to be rebuilt. This folder (the design system)
has the new look, the new logo and fonts, and three reference screens to copy:
a landing page, the dashboard, and login screens.

Please do the following:

1. KEEP THE BACKEND EXACTLY AS-IS. The trading algorithm and the news engine must
   keep working — do not change backend logic. (Only later, when we add real logins,
   will the backend need a small auth addition.)

2. REPLACE THE FRONTEND with the new Web Trace design:
   - New name everywhere ("Web Trace Portfolio Management"), new logo, new fonts.
   - DELETE the old Cyclops "eye" animation, the old header, the old trade cards,
     and the Research and Alerts screens. Remove every mention of "Cyclops",
     "golden hour", and the old Inter font.
   - The dashboard should have ONLY three tabs: Signals, Performance, News.
   - Up = teal, Down = magenta (no green/red).

3. SITE FLOW: a public landing page ("Tracing the market's edge") is the homepage,
   with a button into the dashboard. Build the login/sign-up screens from the designs
   but DON'T wire real accounts yet — that's a later phase; for now the buttons just
   go to the dashboard.

4. NO FAKE DATA, EVER. Every number and card must come from the live backend. If the
   backend is unreachable, the screen shows an empty state and an "Offline" tag — not
   placeholder data.

5. PERFORMANCE HISTORY (do this part later, it's fine): the Performance chart is
   already built to show monthly results from January 2025 to today, updated at the
   end of each trading day. To make it real you'll persist closed trades, add a daily
   end-of-day job, and have /api/performance return the monthly history. Details and
   the exact data format are in section 6a. The chart fills in automatically once
   that's connected — no frontend change needed.

Open CODE-MANAGER-REWORK-GUIDE.md for the full step-by-step. If anything's unclear,
send the question back to me.
```

You can also reword/rework the whole current site from scratch if that's cleaner than
editing in place — see §8. Either way the end result must match the reference screens.

---

## 0) Context — what happened and what we want

A first attempt only applied the **dark color theme**. Every other piece of the old
UI is still live: the animated "Cyclops eye" background, the old header, the old
trade cards, the old tab layout, the "Market Cyclops" name, and the Inter font. We
are now doing a **full frontend rebuild** — new name, new fonts, new logo, new
components, new landing page — while **keeping the backend exactly as it is**.

### Decisions already made by Will (do not re-litigate)
- **Rework the existing repo in place.** Keep `backend/`. Replace `frontend/` UI.
- **Stack stays the same:** Next.js (App Router) + Tailwind + TypeScript. Lowest risk,
  backend wiring is unchanged.
- **The new site has three sections only:** **Signals, Performance, News.**
  Research and Alerts are removed from the UI for now (backend routes stay).
- **Public landing page first** ("Tracing the market's edge") → **Sign in** →
  **Dashboard.**
- **Auth (login/sign-up) is a later phase.** The screens are designed and included,
  but for now the landing-page buttons link straight to the dashboard. Wire real
  auth later.
- **Preserve the algorithm and the news data.** Everything else from the old
  frontend is fair game to delete.

### What "done" looks like (match these — see the design previews)
- Landing page identical in spirit to `design-system/ui_kits/marketing/index.html`
  ("Tracing the market's edge", dark hero, periwinkle gradient word, feature grid,
  stat band, footer). **No award medal. No invented stats unless they come from the
  backend.**
- Dashboard identical to `design-system/ui_kits/dashboard/index.html`: Web Trace
  header with Live/Offline chip, three tabs (Signals · Performance · News), trade
  cards in the new style, the monthly-returns bar chart, the news feed.
- No "Cyclops" anywhere. No animated eye. No Inter font. No green/red — directional
  colors are **teal (up/calls) / magenta (down/puts)**.

---

## 1) BACKEND — keep, do not touch

Leave the entire `backend/` tree as-is. For clarity, these are the pieces that
matter and **must keep working**:

- **The algorithm** — `backend/app/core/`:
  `scanner.py`, `ict_engine_v4.py`, `ict_engine.py`, `decision_engine.py`,
  `dte_strategy.py`, `research_agent.py`.
- **The news engine** — `backend/app/core/news_engine.py`.
- **Alerts engine** — `backend/app/core/alerts.py` (kept; just not shown in UI yet).
- **API routes** — `backend/app/api/routes/`: keep all of them. The new frontend
  calls `trades.py`, `news.py`, `performance.py`, `scanner.py`, `health.py`.
  `research.py` and `alerts.py` stay too (unused by the UI for now).
- Models, db, config, `main.py` — unchanged.

> Net: **zero backend code changes** are required for this rework. If you later wire
> auth, that's the only backend work — and it's a separate phase.

---

## 2) FRONTEND — what to DELETE

Delete these files (old brand / no longer used):

- `frontend/src/components/CyclopsBackground.tsx`  ← the animated eye; gone for good.
- `frontend/src/components/ResearchReport.tsx`     ← Research removed from UI.
- `frontend/src/components/AlertsPanel.tsx`        ← Alerts removed from UI.
- Any `favicon.ico` / logo assets that say Market Cyclops (replace with the new mark).
- Remove the `.scan-line` overlay and any "cyclops"/eye CSS from the old global CSS.

Search the whole `frontend/` for these strings and remove/replace every hit:
`Cyclops`, `cyclops`, `golden`, `Golden Hour`, `is_golden_hour`, `scan-line`,
`Inter`, `green-trade`, `red-trade`. (The backend may still emit `is_golden_hour` on
a trade object — just ignore the field in the UI; don't render it.)

---

## 3) FRONTEND — what to REWRITE (same purpose, new design)

Rebuild each of these using the matching reference in `design-system/`:

| Old file | Becomes | Reference to copy from |
|---|---|---|
| `src/app/globals.css` | imports the design system | `design-system/styles.css` + `tokens/*` |
| `src/app/layout.tsx` | new fonts, metadata, name | §4 below |
| `src/app/page.tsx` | the **landing page** (new home) | `ui_kits/marketing/index.html` |
| *(new)* `src/app/dashboard/page.tsx` | the 3-tab desk | `ui_kits/dashboard/desk.jsx` |
| `src/components/Header.tsx` | Web Trace header | `desk.jsx` → `DeskHeader` |
| `src/components/TradeCard.tsx` | new trade card | `desk.jsx` → `TradeCard` |
| `src/components/TradeList.tsx` | grid of new cards | `desk.jsx` → `SignalsScreen` |
| `src/components/Performance.tsx` | stat tiles + bar chart | `desk.jsx` → `PerformanceScreen` |
| `src/components/NewsFeed.tsx` | new news feed | `desk.jsx` → `NewsScreen` |
| `src/components/StatBar.tsx` | the signals stat strip | `desk.jsx` → top of `SignalsScreen` |
| `src/components/TradeChart.tsx` | restyle to new tokens | use teal/magenta, charcoal canvas |
| `src/lib/api.ts` | keep SWR hooks; remap shapes | `ui_kits/dashboard/api.js` (see §6) |

> The reference files use plain React + inline styles + CSS variables so they open in
> a browser without a build step. In the app, convert them to the project's
> conventions (Tailwind classes or the components in `design-system/components/`).
> The **structure, layout, and styling values** are what to copy — not the
> CDN/script-loading plumbing.

---

## 4) Brand basics to set once

**`layout.tsx`:**
- Replace the `Inter` font with the three Web Trace webfonts (in
  `design-system/assets/fonts/`): **Space Grotesk** (UI/headings), **JetBrains Mono**
  (all numbers/prices), **Eagle Lake** (the accent word, e.g. "Trace"). Load them via
  `next/font/local` from the copied font files, or via the `@font-face` rules already
  in `design-system/tokens/fonts.css`.
- `metadata.title` → `"Web Trace Portfolio Management"`,
  `description` → e.g. `"Real options intelligence — Web Trace, by Will Kizer."`
- Swap the favicon for the new mark (`design-system/assets/logo-mark.svg`).

**Global CSS:** import `design-system/styles.css` (it pulls in all color/type/spacing
tokens and the fonts). Then delete the old Market Cyclops variables.

**Logo + name everywhere:** use `design-system/assets/logo-mark.svg`; render the
wordmark as **Web** (Space Grotesk) + **Trace** (Eagle Lake, periwinkle gradient), as
shown in the header and landing references.

---

## 5) Routing / page structure (landing-first)

```
/             → Landing page  (public homepage; "Tracing the market's edge")
/dashboard    → The desk: Signals · Performance · News  (the old page.tsx content)
/login        → Sign in   ┐  designed now (ui_kits/auth), but LATER phase:
/signup       → Create acct┘  for now, landing CTAs link straight to /dashboard
```

- Move the current single-page dashboard out of `/` and into `/dashboard`.
- Make `/` render the new landing page.
- The landing "Open the desk" / "Sign in" buttons → `/dashboard` for now. When auth
  ships, point "Sign in" at `/login` and gate `/dashboard`.

---

## 6) Data wiring (keep it real — no mock data)

The dashboard must show **only live backend data**. `ui_kits/dashboard/api.js` is the
reference data layer; it documents exactly how each backend response maps to the UI.
Port that mapping into the app's existing `src/lib/api.ts` SWR hooks
(`useTrades`, `useNews`, plus a `usePerformance`). Endpoints are unchanged:

- `GET /api/trades` (+ `GET /api/scanner/price/{ticker}` for live quotes)
- `GET /api/scanner/status` (header "tickers / setups" + Live chip)
- `GET /api/performance` (stat tiles + monthly bar chart)
- `GET /api/news` (news feed)

**Empty states, never fakes:** if a request fails or returns nothing, show the empty
state and an "Offline" chip — do **not** render placeholder cards or invented
numbers. This matches the product's hard no-mock-data rule and is already implemented
in the reference (`desk.jsx`).

API base in production: set `NEXT_PUBLIC` env (or the existing `API_BASE`) the same
way the old frontend did — this rework does not change it.

### 6a) Trade history for the Performance chart (Jan 2025 → present, EOD daily)

The Performance chart is built to show a **monthly return timeline grouped by year**,
with an **"As of EOD {date}" stamp**, and to **fill itself in automatically** from
whatever range the backend returns. The frontend is done — this is a **backend +
data job** to make the history real:

1. **Persist closed trades.** Every time a setup closes (take-profit / stop / expiry),
   write a row with: ticker, direction, strategy, entry, exit, P&L, and the **close
   date**. (Historical Jan 2025 → today can be backfilled once from broker/records.)
2. **Daily EOD update.** Add a scheduled job that runs after **4:00 PM ET** each
   trading day, rolls up that day's closed trades, and updates the month's running
   return. (Cron, Render scheduled job, or GitHub Action — whatever the deploy uses.)
3. **Extend `GET /api/performance`** to return the full history the chart expects:
   ```jsonc
   {
     "strategies": [{
       "name": "ICT V4.1",
       "total_return_pct": 0, "win_rate": 0, "profit_factor": 0,
       "sharpe_ratio": 0, "max_drawdown_pct": 0,
       "monthly_returns": [               // ← ordered Jan 2025 → current month
         { "month": "2025-01", "return_pct": 4.2 },
         { "month": "2025-02", "return_pct": -1.8 }
         // …through the latest closed month
       ]
     }],
     "as_of": "2026-06-23"                // ← last EOD roll-up date (drives the stamp)
   }
   ```
   `month` **must** be `"YYYY-MM"`; the chart groups by the year prefix. `as_of` is the
   date shown in the "As of EOD …" stamp. No frontend change is needed when this lands.

> Until the backend serves it, the Performance screen shows its empty state — never
> fabricated history.

---

## 7) Step-by-step checklist (do in this order)

1. **Branch:** `git checkout -b web-trace-rebrand`.
2. **Drop in the design system:** copy this `design-system/` folder into the repo
   (it can live at repo root or under `frontend/`). Copy the fonts from
   `design-system/assets/fonts/` into `frontend/public/fonts/` (or wire `next/font/local`).
3. **Global styles + fonts:** import `design-system/styles.css` from `globals.css`;
   update `layout.tsx` (fonts, title, favicon). Confirm the app now renders in Space
   Grotesk on a charcoal background.
4. **Delete** the files in §2. App will have build errors where they were imported —
   that's expected; the next steps replace them.
5. **Header:** rewrite `Header.tsx` to the Web Trace header (logo lockup + Live/Offline
   chip + market status). Reference: `DeskHeader` in `desk.jsx`.
6. **Trade card + list:** rewrite `TradeCard.tsx` and `TradeList.tsx` to the new
   design (state banner, direction tag, confidence meter, contract pills,
   entry/stop/target, reasoning bullets). Reference: `TradeCard`/`SignalsScreen`.
7. **Performance + News:** rewrite `Performance.tsx` and `NewsFeed.tsx`. References:
   `PerformanceScreen`, `NewsScreen`.
8. **Dashboard page:** move the dashboard into `/dashboard/page.tsx` with the **three**
   tabs only (Signals · Performance · News). Remove the Research/Alerts tabs and the
   golden-hour stat from the strip.
9. **Landing page:** build `/` from `ui_kits/marketing/index.html`. Buttons → `/dashboard`.
10. **Auth (stub for now):** add `/login` and `/signup` from `ui_kits/auth/index.html`
    as static pages; don't wire real auth yet.
11. **Data:** fold the `api.js` mappers into `lib/api.ts`. Verify Signals, Performance,
    and News all show **live** data against a running backend, and clean **empty
    states** when the backend is off.
12. **Sweep:** grep the repo for the strings in §2; confirm zero "Cyclops"/golden/Inter
    /green-red remain. Check the favicon and page title.
13. **QA against the references:** open the three `design-system/ui_kits/*/index.html`
    files side by side with your build; they should match.
14. **PR** to `master` with before/after screenshots.

---

## 8) Alternative: brand-new project

Will is open to a fresh repo if that's cleaner for you. If you go that route: scaffold
a new Next.js app, copy `backend/` over unchanged, copy this `design-system/` in, and
build the three routes (`/`, `/dashboard`, auth stubs) directly from the references —
skipping the "delete old files" steps. Same end state. Use your judgment;
**in-place rework is the default plan** and is usually faster here since the backend,
deploy config, and env are already set up.

---

## Questions for the designer (me)
Anything in the references unclear, or want a screen I didn't include? Note it on the
PR or send it back through Will. The full brand rules (voice, color, type, spacing,
iconography) are in `design-system/readme.md`.

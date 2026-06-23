# Web Trace Portfolio Management — Design System

A dark, instrument-grade design system for **Web Trace Portfolio Management** — an
AI-powered options-trading intelligence desk created by **Will Kizer** (rebranded
from "Market Cyclops"). The product surfaces real, data-backed 0DTE and multi-day
options setups with live prices, confluence gates, and precise execution guidance.

This system gives design agents everything needed to build on-brand Web Trace
interfaces and assets: the color/type/spacing foundations, the real webfonts, the
logo, reusable React components, and full-screen UI kits.

---

## Sources (for deeper exploration)

The brand and product context were derived from:

- **Codebase** (attached, read-only): the original "Robinhood Options Intelligence
  Platform" — Next.js 14 + TypeScript + Tailwind frontend, FastAPI backend. Real
  market data via yfinance; **no mock data anywhere** (a hard product rule).
- **GitHub repo:** `willkizer2-ai/robinhood-options-project`
  (https://github.com/willkizer2-ai/robinhood-options-project) — explore for the
  full component implementations, scanner logic, and data models.
- **Color reference:** the user's own trading-chart screenshot — a cool charcoal
  canvas (`#2E2E2E`) with periwinkle/blue-gray candle bodies (`#B4B4CC`). This is
  the literal source of the palette.
- **Layout inspiration:** the SPINX digital-agency landing page (dark hero, large
  gradient headline). Used only as a layout/polish reference for the marketing
  surface — Web Trace uses its own distinctive type and color.

---

## Brand at a glance

- **Name:** Web Trace Portfolio Management (short form: **Web Trace**)
- **Identity mark:** an ascending price-**trace** line through candlestick hints —
  see `assets/logo-mark.svg` (glyph) and `assets/logo-tile.svg` (charcoal tile).
- **Voice:** precise, evidence-first, no hype. "Signals that earn their place."
- **Vibe:** a professional instrument panel — dark, cool, data-dense but calm.

---

## CONTENT FUNDAMENTALS

How Web Trace writes copy.

- **Tone:** confident, technical, and restrained. It reads like a disciplined desk,
  not a hype account. Claims are always tied to data ("75% WR · 9.3× PF backtested",
  "confidence 0.78", "Vol ≥ 2×").
- **Person:** addresses the trader as **you** for actions ("Place your limit order"),
  states the system's findings impersonally ("Three credible setups detected").
  Avoid "we"-heavy marketing speak inside the product.
- **Casing:** Sentence case for body and headings. **UPPERCASE** only for short
  labels, tags, and eyebrows (e.g. `0DTE`, `DO TAKE`, `CALL`, `ICT V4.1`),
  tracked wide (`letter-spacing: 0.18em`).
- **Numbers:** always tabular monospace. Prices `$591.42`, deltas signed `+1.28%` /
  `−0.94%`, confidence as a percent. Times are **ET** (EST/EDT), e.g. "Detected
  9:41 AM ET".
- **Directional language:** CALL/bullish/profit = "up"; PUT/bearish/loss = "down".
  Decisions are blunt: `DO TAKE` / `DON'T TAKE`, `HOLD`, `Take Profit Hit`,
  `Stop Loss Hit`.
- **Honesty rule (from the product):** never fabricate data. Empty states say so
  plainly ("No chart data yet · candles available 9:30 AM – 4:00 PM ET"). No
  rotating filler text, no fake stats.
- **Emoji:** none. Status is conveyed with color, icons, and tracked labels — never
  emoji. Unicode marks used sparingly and functionally: `✓` `✗` `★` `Δ` `×` `−` `→`.
- **Examples:**
  - Eyebrow → "OPTIONS INTELLIGENCE · 0DTE"
  - Headline → "Three credible setups, every session"
  - Body → "Web Trace surfaces only real, data-backed options setups — no mocks,
    no synthetic fills."
  - Caption → "Detected 9:41 AM ET · confidence 0.78"

---

## VISUAL FOUNDATIONS

- **Color mood:** cool, dark, monochromatic with a single periwinkle accent. The
  charcoal is slightly blue-neutral (not warm). Everything derives from the chart.
  - Surfaces: `--ink-900` page → `--ink-800` card → `--ink-700` elevated →
    `--ink-650` chips. Wells/chart canvases drop to `--ink-950`.
  - Accent: periwinkle ramp, base **`#B4B4CC` (`--periwinkle-400`)**, the chart's
    candle tone. Used for the logo, links, primary buttons, focus rings, gradient
    headline text.
  - Directional (cool-shifted, per brand decision): **teal `#2DD4BF`** = up / call /
    profit; **magenta `#F0508F`** = down / put / loss. **Gold `#E6B450`** =
    hold state, caution / warning.
- **Type:** display + UI is **Space Grotesk** (bold geometric sans, tight tracking on
  headings). Dense data is **JetBrains Mono** with `tabular-nums`. **Eagle Lake** is
  a distinctive calligraphic accent reserved for the wordmark flourish, hero accent
  words, and oversized feature numerals — **never** small text or tables.
- **Backgrounds:** flat near-black. Optional `.wt-grid-bg` hairline grid (44px) gives
  an instrument-panel texture. Hero uses a periwinkle→azure gradient on headline text
  (`--grad-hero`), not on backgrounds. No photographic imagery in-product; the
  marketing surface may use full-bleed dark gradients. No purple "AI" gradients.
- **Borders:** hairlines are periwinkle at low alpha (`--border-subtle` 8% →
  `--border-default` 14% → `--border-strong` 24%), never pure white/gray. They read
  as faint cool lines on charcoal.
- **Corner radii:** cards `--radius-lg` (14px), chips/buttons `--radius-sm/md`
  (6–10px), pills `--radius-pill`. Generous but not soft.
- **Shadows & glows:** real shadows are deep and dark (`--shadow-card/md/lg`) plus a
  faint periwinkle inset ring. Key live elements get an **accent glow**
  (`--glow-accent/up/down/gold`) — the instrument-panel signature.
- **Cards:** charcoal surface, hairline border, lg radius, `--shadow-card`. Active
  trade cards add a 3px top accent line and a state-colored border (teal/magenta/gold).
- **Transparency & blur:** `.wt-glass` (72% charcoal + 14px blur) for sticky headers
  and overlays only. Used sparingly.
- **Motion:** subtle and quick. `--dur-fast` 120ms / `--dur-base` 200ms, eased with
  `--ease-out`. Live dots blink (`wt-blink`), skeletons shimmer, content rises in
  (`wt-rise`). No bounces, no parallax, no infinite decorative loops. All animation
  respects `prefers-reduced-motion`.
- **Hover states:** buttons brighten (`brightness(1.08)`); ghost/tab items shift text
  from muted → secondary and reveal a border. **Press:** 1px downward nudge.
- **Focus:** 2px periwinkle ring (`--focus-ring`) at 2px offset.
- **Layout:** max width `--container-wide` (1280) for the app, `--container-content`
  for reading. 24px gutters. Sticky glass header + sticky tab bar.

---

## ICONOGRAPHY

- **System:** [**Lucide**](https://lucide.dev) — the icon set the original product
  ships (`lucide-react`). Thin, consistent 1.5–2px stroke, rounded joints. This is
  the canonical Web Trace icon language.
- **In HTML cards / UI kits:** load Lucide from CDN
  (`https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js`), place
  `<i data-lucide="line-chart"></i>`, then call `lucide.createIcons()` after render.
- **In React components:** icons are passed as `ReactNode` props (`leftIcon`,
  `rightIcon`, `icon`) so primitives stay icon-agnostic — the consumer supplies the
  Lucide node.
- **Common glyphs in product:** `bar-chart-2`, `line-chart`, `trending-up`,
  `trending-down`, `arrow-up-circle`, `arrow-down-circle`, `zap` (momentum),
  `bell`, `newspaper`, `book-open`, `clock`, `eye`, `activity`, `target`,
  `shield-alert`, `check-circle-2`, `x-circle`, `pause`, `layers`.
- **Color:** icons inherit text color or take a semantic tone (teal/magenta/gold).
  Never multicolor; never filled except small directional/status glyphs.
- **Unicode marks** (`✓ ✗ ★ Δ × − →`) are acceptable inline in dense data where an
  SVG icon would be too heavy. **No emoji.**
- **Logo** is bespoke SVG (`assets/logo-mark.svg`, `assets/logo-tile.svg`) — do not
  redraw it; reference the files.

---

## INDEX — what's in this system

**Root**
- `styles.css` — global entry point (import manifest only). Link this one file.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills-compatible wrapper.
**`tokens/`** (all `@import`ed by `styles.css`)
- `fonts.css` — `@font-face` for Space Grotesk, JetBrains Mono, Eagle Lake.
- `colors.css` — charcoal ramp, periwinkle accent, directional + state colors, all
  semantic aliases, hero gradient.
- `typography.css` — families, weights, type scale, line-height, tracking.
- `spacing.css` — 4px spacing scale, container widths, rhythm.
- `effects.css` — radii, shadows, glows, blur, motion, z-index.
- `base.css` — resets, document defaults, reusable patterns (`.wt-gradient-text`,
  `.wt-eyebrow`, `.wt-glass`, `.wt-grid-bg`, `.wt-mono`, animations).

**`assets/`**
- `logo-mark.svg`, `logo-tile.svg` — the brand mark.
- `fonts/` — the three variable TTFs + their OFL license files.

**`foundations/`** — specimen cards (Design System tab):
- Colors: surfaces, accent, directional & states, text-on-dark.
- Type: display, brand accent, data/mono, text roles.
- Spacing: scale, radii, shadows & glows.
- Brand: logo, wordmark lockup, hero gradient.

**`components/`** — reusable React primitives (namespace
`window.WebTracePortfolioManagementDesignSystem_29ffdf`):
- `core/` — **Button**, **Badge**, **StatusPill**.
- `data/` — **StatTile**, **ConfidenceMeter**, **DirectionTag**, **PriceTicker**.
- `layout/` — **Panel**. `navigation/` — **Tabs**. `feedback/` — **Banner**.

**`ui_kits/`** — full-screen recreations:
- `dashboard/` — the trading desk (Signals, Performance, Research, Alerts, News),
  recreated from the original codebase. Entry `index.html` + `desk.jsx`.
- `marketing/` — SPINX-style dark landing page. Self-contained `index.html`.
- `auth/` — split-panel login / sign-up. Self-contained `index.html`.
Each has its own `README.md`.

---

## Notes & open decisions

- **Eagle Lake** (the chosen "numbers/data" font) is calligraphic and not legible for
  dense tabular data, so it's reserved for display flourishes; **JetBrains Mono**
  carries all real data. Confirm this split.
- Directional colors are **cool-shifted** (teal/magenta) by request, not classic
  green/red.
- Icons currently use **Lucide via CDN** — matching the source product's `lucide-react`.

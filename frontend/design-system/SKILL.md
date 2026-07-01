---
name: web-trace-design
description: Use this skill to generate well-branded interfaces and assets for Web Trace Portfolio Management (an AI-powered options-trading intelligence desk by Will Kizer), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation
- **Brand:** Web Trace Portfolio Management ("Web Trace"). Dark, cool, instrument-grade.
- **Palette:** charcoal surfaces (`--ink-*`, base ~#2E2E2E family) + periwinkle accent
  (`--periwinkle-400` / #B4B4CC). Directional is cool-shifted: teal `--up` = call/profit,
  magenta `--down` = put/loss. Gold `--warn` for caution.
- **Type:** Space Grotesk (display/UI), JetBrains Mono (data/prices), Eagle Lake
  (`--font-brand`, distinctive accent — short display only, never dense data).
- **One stylesheet:** link `styles.css` (it `@import`s all tokens + fonts).
- **Components:** load `_ds_bundle.js`, then `const { Button, Badge, Panel, … } =
  window.WebTracePortfolioManagementDesignSystem_29ffdf`. Icons: Lucide.
- **Assets:** `assets/logo-mark.svg` (glyph, primary), `assets/logo-tile.svg`,
  `assets/fonts/` (the three TTFs + OFL licenses).

## What's here
- `tokens/` — colors, typography, spacing, effects, base, fonts.
- `foundations/` — specimen cards (Colors, Type, Spacing, Brand).
- `components/` — Button, Badge, StatusPill, StatTile, ConfidenceMeter, DirectionTag,
  PriceTicker, Panel, Tabs, Banner (each with `.d.ts` + `.prompt.md`).
- `ui_kits/` — `dashboard/` (the trading desk), `marketing/` (landing page), `auth/`.
- `README.md` — full design guide (content + visual foundations, iconography, index).

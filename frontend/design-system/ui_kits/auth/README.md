# Auth — UI kit

Split-panel authentication for **Web Trace** — a gradient brand panel beside a
form card that toggles between **Sign in** and **Create account**.

## Run
Open `index.html`. The segmented control swaps the form (adds a name field, changes
copy and CTA) live; inputs show focus rings.

## Layout
- **Brand side** — hairline-grid backdrop, logo lockup, market-status pill, gradient
  pitch headline, and the "Signals that earn their place" line. Hidden under 880px.
- **Form side** — segmented Sign in / Create account toggle, fields with uppercase
  micro-labels and periwinkle focus rings, primary CTA, OAuth row, legal note.

## Components used
`Button`, `StatusPill` from the bundle; inputs and the segmented control are
page-specific, styled with design-system tokens (focus ring = `--accent`).

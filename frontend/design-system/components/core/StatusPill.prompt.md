A rounded pill with an optional (optionally blinking) status dot — for market open/closed state, "Live" scanner status, and connection indicators.

```jsx
<StatusPill tone="up" pulse>Market Open</StatusPill>
<StatusPill tone="neutral" dot={false}>After-Hours</StatusPill>
```

Tones: `neutral` / `up` / `down` / `gold` / `accent`. `dot` toggles the leading dot; `pulse` makes it blink for live states.

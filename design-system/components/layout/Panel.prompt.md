The standard surface container — charcoal card with hairline border and lg radius, optional eyebrow/title header and a right-aligned action slot. `accent` adds a 3px semantic top line (used by active trade cards).

```jsx
<Panel eyebrow="Signals" title="Active Setups" action={<Button size="sm" variant="ghost">Refresh</Button>}>
  …rows…
</Panel>
<Panel accent="up" padded={false}>…</Panel>
```

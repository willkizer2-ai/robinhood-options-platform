The brand action button — use for any primary or secondary user action; `primary` is the periwinkle accent fill, `danger` is the magenta down-tone.

```jsx
<Button variant="primary" size="md" onClick={submit}>Place limit order</Button>
<Button variant="secondary" leftIcon={<Icon name="bar-chart-2" />}>View chart</Button>
<Button variant="ghost" size="sm">Dismiss</Button>
```

Variants: `primary` (periwinkle), `secondary` (elevated surface + border), `ghost` (transparent), `success` (teal soft), `danger` (magenta soft). Sizes: `sm` / `md` / `lg`. Supports `leftIcon`/`rightIcon` (ReactNode), `fullWidth`, `disabled`.

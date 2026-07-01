A symbol + live price block with a signed change in tabular mono; optional blinking live dot. Use in headers, watchlists, and trade cards.

```jsx
<PriceTicker ticker="SPY" price={591.42} change={1.28} changePct="0.22" live />
<PriceTicker price={524.07} change={-0.94} align="right" />
```

`change`/`changePct` color teal when positive, magenta when negative.

A labelled metric with a large tabular-mono value and optional signed delta — the workhorse for dashboards and stat strips.

```jsx
<StatTile label="Total Return" value="+247.8" suffix="%" tone="up" delta="+12.4%" />
<StatTile label="Max Drawdown" value="-18.2" suffix="%" tone="down" />
```

Delta direction is inferred from the sign unless `deltaDirection` is set. `tone`: default / up / down / accent. `size`: sm / md / lg.

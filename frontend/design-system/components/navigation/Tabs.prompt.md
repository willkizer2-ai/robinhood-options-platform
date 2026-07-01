Horizontal tab bar with an underline indicator and optional count badges; controlled via `value`/`onChange`.

```jsx
const [tab, setTab] = React.useState('signals');
<Tabs value={tab} onChange={setTab} tabs={[
  { id: 'signals', label: 'Signals', badge: 6 },
  { id: 'performance', label: 'Performance' },
  { id: 'news', label: 'News', badge: 3 },
]} />
```

Each tab may carry an `icon` (ReactNode) and a `badge`.

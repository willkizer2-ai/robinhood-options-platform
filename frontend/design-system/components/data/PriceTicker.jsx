import React from 'react';

/**
 * PriceTicker — symbol + live price with a signed change. Optional blinking
 * live dot. Numbers are tabular mono; change colors teal/magenta.
 */
export function PriceTicker({
  ticker,
  price,
  change,        // signed number or string, e.g. +1.28 or "-0.94%"
  changePct,
  live = false,
  align = 'left',
  style,
  ...rest
}) {
  const raw = typeof change === 'number' ? change : parseFloat(String(change));
  const down = !isNaN(raw) ? raw < 0 : String(change || '').includes('-');
  const c = down ? 'var(--down-text)' : 'var(--up-text)';
  const fmtPrice = typeof price === 'number'
    ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 2, ...style }} {...rest}>
      {ticker && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {live && <span className="wt-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--up)', boxShadow: '0 0 6px var(--up)' }} />}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>{ticker}</span>
        </span>
      )}
      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.1 }}>
        ${fmtPrice}
      </span>
      {(change != null || changePct != null) && (
        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: 700, color: c, display: 'inline-flex', gap: 5 }}>
          {change != null && <span>{!down && typeof change === 'number' ? '+' : ''}{change}</span>}
          {changePct != null && <span style={{ opacity: 0.85 }}>({!down ? '+' : ''}{changePct}%)</span>}
        </span>
      )}
    </div>
  );
}

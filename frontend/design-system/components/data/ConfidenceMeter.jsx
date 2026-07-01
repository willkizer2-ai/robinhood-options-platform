import React from 'react';

/**
 * ConfidenceMeter — percentage value with a thin progress bar. Color steps with
 * the score (teal high → periwinkle mid → muted low), matching the desk's
 * confidence scale (0–100).
 */
export function ConfidenceMeter({
  value = 0,           // 0–100
  showValue = true,
  width = 120,
  label,
  style,
  ...rest
}) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 75 ? 'var(--up)' : v >= 55 ? 'var(--accent)' : v >= 40 ? 'var(--gold-400)' : 'var(--text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }} {...rest}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        {label && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>}
        {showValue && (
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 700, color }}>
            {Math.round(v)}<span style={{ fontSize: '0.65em', color: 'var(--text-muted)' }}>%</span>
          </span>
        )}
      </div>
      <div style={{ width, height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--ink-650)', overflow: 'hidden' }}>
        <div style={{
          width: `${v}%`, height: '100%', borderRadius: 'var(--radius-pill)',
          background: color, boxShadow: `0 0 8px ${color}`,
          transition: 'width var(--dur-slow) var(--ease-out)',
        }} />
      </div>
    </div>
  );
}

import React from 'react';

/**
 * StatTile — a labelled metric with a large tabular-mono value and an optional
 * signed delta. The workhorse for dashboards, performance, and stat strips.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaDirection,   // 'up' | 'down' | auto from sign of delta
  suffix,
  tone = 'default', // 'default' | 'up' | 'down' | 'accent'
  size = 'md',
  style,
  ...rest
}) {
  const dir = deltaDirection
    || (typeof delta === 'string' && delta.trim().startsWith('-') ? 'down'
      : typeof delta === 'number' ? (delta < 0 ? 'down' : 'up') : 'up');
  const deltaColor = dir === 'down' ? 'var(--down-text)' : 'var(--up-text)';

  const valueColors = {
    default: 'var(--text-primary)',
    up: 'var(--up-text)',
    down: 'var(--down-text)',
    accent: 'var(--accent-text)',
  };
  const valueSize = size === 'lg' ? 34 : size === 'sm' ? 20 : 26;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: 'var(--card-padding)',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        minWidth: 0,
        ...style,
      }}
      {...rest}
    >
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        fontSize: valueSize, fontWeight: 700, lineHeight: 1.05,
        color: valueColors[tone] || valueColors.default,
      }}>
        {value}{suffix && <span style={{ fontSize: '0.55em', color: 'var(--text-muted)', marginLeft: 3 }}>{suffix}</span>}
      </span>
      {delta != null && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
          fontSize: 12, fontWeight: 700, color: deltaColor,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 9 }}>{dir === 'down' ? '▼' : '▲'}</span>{delta}
        </span>
      )}
    </div>
  );
}

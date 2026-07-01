import React from 'react';

/**
 * StatusPill — pill with an optional status dot. Used for market state,
 * "Live" indicators, and connection status across the desk.
 */
export function StatusPill({
  children,
  tone = 'neutral',
  dot = true,
  pulse = false,
  style,
  ...rest
}) {
  const tones = {
    neutral: 'var(--periwinkle-400)',
    up:      'var(--up)',
    down:    'var(--down)',
    gold:    'var(--gold-400)',
    accent:  'var(--periwinkle-400)',
  };
  const c = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '0.04em',
        color: tone === 'neutral' ? 'var(--text-secondary)' : c,
        padding: '5px 12px',
        borderRadius: 'var(--radius-pill)',
        background: `color-mix(in srgb, ${c} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 26%, transparent)`,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          className={pulse ? 'wt-live-dot' : undefined}
          style={{ width: 7, height: 7, borderRadius: '50%', background: c, flex: 'none', boxShadow: `0 0 8px ${c}` }}
        />
      )}
      {children}
    </span>
  );
}

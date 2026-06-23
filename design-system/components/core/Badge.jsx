import React from 'react';

/**
 * Badge — compact status / category label.
 * Tones map to the brand semantics; styles to fill weight.
 */
export function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon,
  style,
  ...rest
}) {
  const tones = {
    neutral: { base: 'var(--periwinkle-400)', text: 'var(--text-secondary)' },
    accent:  { base: 'var(--periwinkle-400)', text: 'var(--accent-text)' },
    up:      { base: 'var(--up)',   text: 'var(--up-text)' },
    down:    { base: 'var(--down)', text: 'var(--down-text)' },
    gold:    { base: 'var(--gold-400)', text: 'var(--gold-300)' },
  };
  const t = tones[tone] || tones.neutral;

  const sizes = {
    sm: { fontSize: 9,  padding: '2px 6px', gap: 3, icon: 10 },
    md: { fontSize: 10, padding: '3px 8px', gap: 4, icon: 12 },
  };
  const s = sizes[size] || sizes.md;

  const fills = {
    soft: {
      background: tone === 'neutral' ? 'var(--accent-muted)' : `color-mix(in srgb, ${t.base} 14%, transparent)`,
      color: t.text,
      border: `1px solid color-mix(in srgb, ${t.base} 32%, transparent)`,
    },
    solid: {
      background: t.base,
      color: 'var(--text-on-accent)',
      border: '1px solid transparent',
    },
    outline: {
      background: 'transparent',
      color: t.text,
      border: `1px solid color-mix(in srgb, ${t.base} 45%, transparent)`,
    },
  };
  const f = fills[variant] || fills.soft;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: s.fontSize,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: s.padding,
        borderRadius: 'var(--radius-sm)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...f,
        ...style,
      }}
      {...rest}
    >
      {icon && <span style={{ display: 'inline-flex', width: s.icon, height: s.icon }}>{icon}</span>}
      {children}
    </span>
  );
}

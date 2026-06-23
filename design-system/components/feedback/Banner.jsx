import React from 'react';

/**
 * Banner — a horizontal status strip used as the headline state on cards and
 * sections (DO TAKE, Stop Loss Hit, awaiting entry, info notes).
 */
export function Banner({ children, tone = 'info', icon, solid = false, align = 'center', style, ...rest }) {
  const tones = {
    info:    { c: 'var(--accent)',    t: 'var(--accent-text)' },
    success: { c: 'var(--up)',        t: 'var(--up-text)' },
    danger:  { c: 'var(--down)',      t: 'var(--down-text)' },
    warn:    { c: 'var(--gold-400)',  t: 'var(--gold-300)' },
    neutral: { c: 'var(--periwinkle-400)', t: 'var(--text-secondary)' },
  };
  const v = tones[tone] || tones.info;

  const base = solid
    ? { background: v.c, color: 'var(--text-on-accent)', borderBottom: '1px solid transparent' }
    : { background: `color-mix(in srgb, ${v.c} 11%, transparent)`, color: v.t, borderBottom: `1px solid color-mix(in srgb, ${v.c} 24%, transparent)` };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: 8, padding: '7px 14px',
        fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        ...base, ...style,
      }}
      {...rest}
    >
      {icon && <span style={{ display: 'inline-flex', width: 14, height: 14 }}>{icon}</span>}
      {children}
    </div>
  );
}

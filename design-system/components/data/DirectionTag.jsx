import React from 'react';

/**
 * DirectionTag — CALL / PUT chip with a directional caret. Teal for CALL (up),
 * magenta for PUT (down) — the desk's core directional signal.
 */
export function DirectionTag({ direction = 'CALL', size = 'md', style, ...rest }) {
  const isCall = String(direction).toUpperCase() === 'CALL';
  const c = isCall ? 'var(--up)' : 'var(--down)';
  const ct = isCall ? 'var(--up-text)' : 'var(--down-text)';
  const sizes = { sm: { fs: 10, pad: '2px 7px', car: 8 }, md: { fs: 11, pad: '3px 9px', car: 9 } };
  const s = sizes[size] || sizes.md;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: s.fs, letterSpacing: '0.06em',
      padding: s.pad, borderRadius: 'var(--radius-sm)', color: ct,
      background: `color-mix(in srgb, ${c} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${c} 34%, transparent)`,
      ...style,
    }} {...rest}>
      <span style={{ fontSize: s.car }}>{isCall ? '▲' : '▼'}</span>
      {String(direction).toUpperCase()}
    </span>
  );
}

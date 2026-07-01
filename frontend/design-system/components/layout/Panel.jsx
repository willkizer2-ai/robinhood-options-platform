import React from 'react';

/**
 * Panel — the standard surface container: charcoal card, hairline border, lg
 * radius. Optional eyebrow + title header and a right-aligned action slot.
 * An `accent` adds a 3px top line in a semantic tone (used by trade cards).
 */
export function Panel({
  children,
  eyebrow,
  title,
  action,
  accent,           // undefined | 'accent' | 'up' | 'down' | 'gold'
  padded = true,
  style,
  ...rest
}) {
  const accents = {
    accent: 'var(--accent)', up: 'var(--up)', down: 'var(--down)', gold: 'var(--gold-400)',
  };
  const accentColor = accent ? accents[accent] : null;

  return (
    <section
      style={{
        position: 'relative',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {accentColor && (
        <div style={{ position: 'absolute', insetInline: 0, top: 0, height: 3, background: accentColor }} />
      )}
      {(title || eyebrow || action) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>{eyebrow}</div>}
            {title && <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{title}</div>}
          </div>
          {action && <div style={{ flex: 'none' }}>{action}</div>}
        </header>
      )}
      <div style={{ padding: padded ? 16 : 0 }}>{children}</div>
    </section>
  );
}

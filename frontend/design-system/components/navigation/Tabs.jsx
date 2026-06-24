import React from 'react';

/**
 * Tabs — horizontal tab bar with an underline indicator and optional count
 * badges. Controlled via `value` / `onChange`.
 */
export function Tabs({ tabs = [], value, onChange, style, ...rest }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex', gap: 2, borderBottom: '1px solid var(--border-default)',
        ...style,
      }}
      {...rest}
    >
      {tabs.map((t) => {
        const id = t.id ?? t.label;
        const active = id === value;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '11px 16px', background: 'transparent', cursor: 'pointer',
              border: 'none', borderBottom: '2px solid',
              borderBottomColor: active ? 'var(--accent)' : 'transparent',
              marginBottom: -1,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
              letterSpacing: '0.01em',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'color var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {t.icon && <span style={{ display: 'inline-flex', width: 15, height: 15 }}>{t.icon}</span>}
            {t.label}
            {t.badge != null && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                fontSize: 10, fontWeight: 700, lineHeight: 1, padding: '2px 6px',
                borderRadius: 'var(--radius-pill)',
                background: active ? 'var(--accent-muted-2)' : 'var(--ink-650)',
                color: active ? 'var(--accent-text)' : 'var(--text-muted)',
              }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

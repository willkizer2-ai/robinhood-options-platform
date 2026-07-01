import React from 'react';

/**
 * Button — the primary action control for Web Trace.
 * Variants map to the brand: `primary` is the periwinkle accent, `danger`
 * the magenta down-tone. All sizes keep a >=44px hit target at `md`+.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const sizes = {
    sm: { fontSize: 13, padding: '7px 13px', gap: 6, radius: 'var(--radius-sm)', icon: 14 },
    md: { fontSize: 14, padding: '10px 18px', gap: 8, radius: 'var(--radius-md)', icon: 16 },
    lg: { fontSize: 15, padding: '13px 24px', gap: 9, radius: 'var(--radius-md)', icon: 18 },
  };
  const s = sizes[size] || sizes.md;

  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--text-on-accent)',
      border: '1px solid transparent',
    },
    secondary: {
      background: 'var(--surface-elevated)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'var(--down-bg)',
      color: 'var(--down-text)',
      border: '1px solid var(--down-border)',
    },
    success: {
      background: 'var(--up-bg)',
      color: 'var(--up-text)',
      border: '1px solid var(--up-border)',
    },
  };
  const v = variants[variant] || variants.primary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="wt-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        width: fullWidth ? '100%' : undefined,
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: s.fontSize,
        letterSpacing: '0.01em',
        padding: s.padding,
        borderRadius: s.radius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'filter var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        whiteSpace: 'nowrap',
        ...v,
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(1px)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none'; }}
      {...rest}
    >
      {leftIcon && <span style={{ display: 'inline-flex', width: s.icon, height: s.icon }}>{leftIcon}</span>}
      {children}
      {rightIcon && <span style={{ display: 'inline-flex', width: s.icon, height: s.icon }}>{rightIcon}</span>}
    </button>
  );
}

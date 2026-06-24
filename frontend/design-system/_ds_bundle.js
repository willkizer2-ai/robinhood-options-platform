/* @ds-bundle: {"format":3,"namespace":"WebTracePortfolioManagementDesignSystem_29ffdf","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"StatusPill","sourcePath":"components/core/StatusPill.jsx"},{"name":"ConfidenceMeter","sourcePath":"components/data/ConfidenceMeter.jsx"},{"name":"DirectionTag","sourcePath":"components/data/DirectionTag.jsx"},{"name":"PriceTicker","sourcePath":"components/data/PriceTicker.jsx"},{"name":"StatTile","sourcePath":"components/data/StatTile.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"Panel","sourcePath":"components/layout/Panel.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"aebc0d58ac8d","components/core/Button.jsx":"5e5649c12b67","components/core/StatusPill.jsx":"6542844211f4","components/data/ConfidenceMeter.jsx":"c23968587d51","components/data/DirectionTag.jsx":"dd2a9ecbf22a","components/data/PriceTicker.jsx":"26e10d4fe84a","components/data/StatTile.jsx":"2722d5de9610","components/feedback/Banner.jsx":"4e02ec66ba90","components/layout/Panel.jsx":"0e4e35ca4e73","components/navigation/Tabs.jsx":"4230c73ce1e2","ui_kits/dashboard/api.js":"75eb6bc92a1d","ui_kits/dashboard/desk.jsx":"e7ba05886e23"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.WebTracePortfolioManagementDesignSystem_29ffdf = window.WebTracePortfolioManagementDesignSystem_29ffdf || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — compact status / category label.
 * Tones map to the brand semantics; styles to fill weight.
 */
function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon,
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      base: 'var(--periwinkle-400)',
      text: 'var(--text-secondary)'
    },
    accent: {
      base: 'var(--periwinkle-400)',
      text: 'var(--accent-text)'
    },
    up: {
      base: 'var(--up)',
      text: 'var(--up-text)'
    },
    down: {
      base: 'var(--down)',
      text: 'var(--down-text)'
    },
    gold: {
      base: 'var(--gold-400)',
      text: 'var(--gold-300)'
    }
  };
  const t = tones[tone] || tones.neutral;
  const sizes = {
    sm: {
      fontSize: 9,
      padding: '2px 6px',
      gap: 3,
      icon: 10
    },
    md: {
      fontSize: 10,
      padding: '3px 8px',
      gap: 4,
      icon: 12
    }
  };
  const s = sizes[size] || sizes.md;
  const fills = {
    soft: {
      background: tone === 'neutral' ? 'var(--accent-muted)' : `color-mix(in srgb, ${t.base} 14%, transparent)`,
      color: t.text,
      border: `1px solid color-mix(in srgb, ${t.base} 32%, transparent)`
    },
    solid: {
      background: t.base,
      color: 'var(--text-on-accent)',
      border: '1px solid transparent'
    },
    outline: {
      background: 'transparent',
      color: t.text,
      border: `1px solid color-mix(in srgb, ${t.base} 45%, transparent)`
    }
  };
  const f = fills[variant] || fills.soft;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: s.icon,
      height: s.icon
    }
  }, icon), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — the primary action control for Web Trace.
 * Variants map to the brand: `primary` is the periwinkle accent, `danger`
 * the magenta down-tone. All sizes keep a >=44px hit target at `md`+.
 */
function Button({
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
    sm: {
      fontSize: 13,
      padding: '7px 13px',
      gap: 6,
      radius: 'var(--radius-sm)',
      icon: 14
    },
    md: {
      fontSize: 14,
      padding: '10px 18px',
      gap: 8,
      radius: 'var(--radius-md)',
      icon: 16
    },
    lg: {
      fontSize: 15,
      padding: '13px 24px',
      gap: 9,
      radius: 'var(--radius-md)',
      icon: 18
    }
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--text-on-accent)',
      border: '1px solid transparent'
    },
    secondary: {
      background: 'var(--surface-elevated)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-strong)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--down-bg)',
      color: 'var(--down-text)',
      border: '1px solid var(--down-border)'
    },
    success: {
      background: 'var(--up-bg)',
      color: 'var(--up-text)',
      border: '1px solid var(--up-border)'
    }
  };
  const v = variants[variant] || variants.primary;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    className: "wt-btn",
    style: {
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
      ...style
    },
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'translateY(1px)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'none';
    },
    onMouseEnter: e => {
      if (!disabled) e.currentTarget.style.filter = 'brightness(1.08)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.filter = 'none';
      e.currentTarget.style.transform = 'none';
    }
  }, rest), leftIcon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: s.icon,
      height: s.icon
    }
  }, leftIcon), children, rightIcon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: s.icon,
      height: s.icon
    }
  }, rightIcon));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * StatusPill — pill with an optional status dot. Used for market state,
 * "Live" indicators, and connection status across the desk.
 */
function StatusPill({
  children,
  tone = 'neutral',
  dot = true,
  pulse = false,
  style,
  ...rest
}) {
  const tones = {
    neutral: 'var(--periwinkle-400)',
    up: 'var(--up)',
    down: 'var(--down)',
    gold: 'var(--gold-400)',
    accent: 'var(--periwinkle-400)'
  };
  const c = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    className: pulse ? 'wt-live-dot' : undefined,
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: c,
      flex: 'none',
      boxShadow: `0 0 8px ${c}`
    }
  }), children);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/data/ConfidenceMeter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ConfidenceMeter — percentage value with a thin progress bar. Color steps with
 * the score (teal high → periwinkle mid → muted low), matching the desk's
 * confidence scale (0–100).
 */
function ConfidenceMeter({
  value = 0,
  // 0–100
  showValue = true,
  width = 120,
  label,
  style,
  ...rest
}) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 75 ? 'var(--up)' : v >= 55 ? 'var(--accent)' : v >= 40 ? 'var(--gold-400)' : 'var(--text-muted)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 8
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), showValue && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 15,
      fontWeight: 700,
      color
    }
  }, Math.round(v), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65em',
      color: 'var(--text-muted)'
    }
  }, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height: 4,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--ink-650)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${v}%`,
      height: '100%',
      borderRadius: 'var(--radius-pill)',
      background: color,
      boxShadow: `0 0 8px ${color}`,
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ConfidenceMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ConfidenceMeter.jsx", error: String((e && e.message) || e) }); }

// components/data/DirectionTag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * DirectionTag — CALL / PUT chip with a directional caret. Teal for CALL (up),
 * magenta for PUT (down) — the desk's core directional signal.
 */
function DirectionTag({
  direction = 'CALL',
  size = 'md',
  style,
  ...rest
}) {
  const isCall = String(direction).toUpperCase() === 'CALL';
  const c = isCall ? 'var(--up)' : 'var(--down)';
  const ct = isCall ? 'var(--up-text)' : 'var(--down-text)';
  const sizes = {
    sm: {
      fs: 10,
      pad: '2px 7px',
      car: 8
    },
    md: {
      fs: 11,
      pad: '3px 9px',
      car: 9
    }
  };
  const s = sizes[size] || sizes.md;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: s.fs,
      letterSpacing: '0.06em',
      padding: s.pad,
      borderRadius: 'var(--radius-sm)',
      color: ct,
      background: `color-mix(in srgb, ${c} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${c} 34%, transparent)`,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: s.car
    }
  }, isCall ? '▲' : '▼'), String(direction).toUpperCase());
}
Object.assign(__ds_scope, { DirectionTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DirectionTag.jsx", error: String((e && e.message) || e) }); }

// components/data/PriceTicker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * PriceTicker — symbol + live price with a signed change. Optional blinking
 * live dot. Numbers are tabular mono; change colors teal/magenta.
 */
function PriceTicker({
  ticker,
  price,
  change,
  // signed number or string, e.g. +1.28 or "-0.94%"
  changePct,
  live = false,
  align = 'left',
  style,
  ...rest
}) {
  const raw = typeof change === 'number' ? change : parseFloat(String(change));
  const down = !isNaN(raw) ? raw < 0 : String(change || '').includes('-');
  const c = down ? 'var(--down-text)' : 'var(--up-text)';
  const fmtPrice = typeof price === 'number' ? price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) : price;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'right' ? 'flex-end' : 'flex-start',
      gap: 2,
      ...style
    }
  }, rest), ticker && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, live && /*#__PURE__*/React.createElement("span", {
    className: "wt-live-dot",
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--up)',
      boxShadow: '0 0 6px var(--up)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: '0.02em',
      color: 'var(--text-primary)'
    }
  }, ticker)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 700,
      fontSize: 18,
      color: 'var(--text-primary)',
      lineHeight: 1.1
    }
  }, "$", fmtPrice), (change != null || changePct != null) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 11,
      fontWeight: 700,
      color: c,
      display: 'inline-flex',
      gap: 5
    }
  }, change != null && /*#__PURE__*/React.createElement("span", null, !down && typeof change === 'number' ? '+' : '', change), changePct != null && /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.85
    }
  }, "(", !down ? '+' : '', changePct, "%)")));
}
Object.assign(__ds_scope, { PriceTicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/PriceTicker.jsx", error: String((e && e.message) || e) }); }

// components/data/StatTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * StatTile — a labelled metric with a large tabular-mono value and an optional
 * signed delta. The workhorse for dashboards, performance, and stat strips.
 */
function StatTile({
  label,
  value,
  delta,
  deltaDirection,
  // 'up' | 'down' | auto from sign of delta
  suffix,
  tone = 'default',
  // 'default' | 'up' | 'down' | 'accent'
  size = 'md',
  style,
  ...rest
}) {
  const dir = deltaDirection || (typeof delta === 'string' && delta.trim().startsWith('-') ? 'down' : typeof delta === 'number' ? delta < 0 ? 'down' : 'up' : 'up');
  const deltaColor = dir === 'down' ? 'var(--down-text)' : 'var(--up-text)';
  const valueColors = {
    default: 'var(--text-primary)',
    up: 'var(--up-text)',
    down: 'var(--down-text)',
    accent: 'var(--accent-text)'
  };
  const valueSize = size === 'lg' ? 34 : size === 'sm' ? 20 : 26;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: 'var(--card-padding)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card)',
      minWidth: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: valueSize,
      fontWeight: 700,
      lineHeight: 1.05,
      color: valueColors[tone] || valueColors.default
    }
  }, value, suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.55em',
      color: 'var(--text-muted)',
      marginLeft: 3
    }
  }, suffix)), delta != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 12,
      fontWeight: 700,
      color: deltaColor,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9
    }
  }, dir === 'down' ? '▼' : '▲'), delta));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Banner.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Banner — a horizontal status strip used as the headline state on cards and
 * sections (DO TAKE, Stop Loss Hit, awaiting entry, info notes).
 */
function Banner({
  children,
  tone = 'info',
  icon,
  solid = false,
  align = 'center',
  style,
  ...rest
}) {
  const tones = {
    info: {
      c: 'var(--accent)',
      t: 'var(--accent-text)'
    },
    success: {
      c: 'var(--up)',
      t: 'var(--up-text)'
    },
    danger: {
      c: 'var(--down)',
      t: 'var(--down-text)'
    },
    warn: {
      c: 'var(--gold-400)',
      t: 'var(--gold-300)'
    },
    neutral: {
      c: 'var(--periwinkle-400)',
      t: 'var(--text-secondary)'
    }
  };
  const v = tones[tone] || tones.info;
  const base = solid ? {
    background: v.c,
    color: 'var(--text-on-accent)',
    borderBottom: '1px solid transparent'
  } : {
    background: `color-mix(in srgb, ${v.c} 11%, transparent)`,
    color: v.t,
    borderBottom: `1px solid color-mix(in srgb, ${v.c} 24%, transparent)`
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      gap: 8,
      padding: '7px 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      ...base,
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 14,
      height: 14
    }
  }, icon), children);
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Banner.jsx", error: String((e && e.message) || e) }); }

// components/layout/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Panel — the standard surface container: charcoal card, hairline border, lg
 * radius. Optional eyebrow + title header and a right-aligned action slot.
 * An `accent` adds a 3px top line in a semantic tone (used by trade cards).
 */
function Panel({
  children,
  eyebrow,
  title,
  action,
  accent,
  // undefined | 'accent' | 'up' | 'down' | 'gold'
  padded = true,
  style,
  ...rest
}) {
  const accents = {
    accent: 'var(--accent)',
    up: 'var(--up)',
    down: 'var(--down)',
    gold: 'var(--gold-400)'
  };
  const accentColor = accent ? accents[accent] : null;
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      position: 'relative',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
      ...style
    }
  }, rest), accentColor && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      insetInline: 0,
      top: 0,
      height: 3,
      background: accentColor
    }
  }), (title || eyebrow || action) && /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '14px 16px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 3
    }
  }, eyebrow), title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--text-primary)',
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap'
    }
  }, title)), action && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none'
    }
  }, action)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: padded ? 16 : 0
    }
  }, children));
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Panel.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tabs — horizontal tab bar with an underline indicator and optional count
 * badges. Controlled via `value` / `onChange`.
 */
function Tabs({
  tabs = [],
  value,
  onChange,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'flex',
      gap: 2,
      borderBottom: '1px solid var(--border-default)',
      ...style
    }
  }, rest), tabs.map(t => {
    const id = t.id ?? t.label;
    const active = id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(id),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '11px 16px',
        background: 'transparent',
        cursor: 'pointer',
        border: 'none',
        borderBottom: '2px solid',
        borderBottomColor: active ? 'var(--accent)' : 'transparent',
        marginBottom: -1,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'color var(--dur-fast) var(--ease-out)'
      },
      onMouseEnter: e => {
        if (!active) e.currentTarget.style.color = 'var(--text-secondary)';
      },
      onMouseLeave: e => {
        if (!active) e.currentTarget.style.color = 'var(--text-muted)';
      }
    }, t.icon && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        width: 15,
        height: 15
      }
    }, t.icon), t.label, t.badge != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        padding: '2px 6px',
        borderRadius: 'var(--radius-pill)',
        background: active ? 'var(--accent-muted-2)' : 'var(--ink-650)',
        color: active ? 'var(--accent-text)' : 'var(--text-muted)'
      }
    }, t.badge));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/api.js
try { (() => {
/* Web Trace — backend data layer.
   Talks to the FastAPI backend (the uploaded `backend/` service) and maps its
   responses into the shapes the desk UI renders. Plain JS (no JSX) so it loads
   synchronously before desk.jsx.

   API base resolution (first match wins):
     1. ?api=<url> query param  (also persisted to localStorage)
     2. localStorage 'wt_api_base'
     3. window.WEB_TRACE_API_BASE  (set this in production)
     4. '/api'  (same-origin default — works when the backend is proxied)

   Every loader degrades to EMPTY (never fabricated): if the backend is
   unreachable the screens show empty states with `live:false` — no mock cards,
   no synthetic figures. A code manager will own the deployed backend wiring.   */
window.WebTraceAPI = function () {
  function base() {
    try {
      const q = new URLSearchParams(location.search).get('api');
      if (q) {
        try {
          localStorage.setItem('wt_api_base', q);
        } catch (e) {}
        return q.replace(/\/$/, '');
      }
      const s = localStorage.getItem('wt_api_base');
      if (s) return s.replace(/\/$/, '');
    } catch (e) {}
    if (window.WEB_TRACE_API_BASE) return String(window.WEB_TRACE_API_BASE).replace(/\/$/, '');
    return '/api';
  }
  async function get(path, ms) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms || 4500);
    try {
      const r = await fetch(base() + path, {
        headers: {
          Accept: 'application/json'
        },
        signal: ctrl.signal
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(to);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  const n = x => x == null || isNaN(x) ? null : Number(x);
  function fmtET(iso) {
    if (!iso) return '—';
    try {
      const utc = iso.endsWith && (iso.endsWith('Z') || iso.includes('+')) ? iso : iso + 'Z';
      const t = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date(utc));
      return t + ' ET';
    } catch (e) {
      return '—';
    }
  }
  function firstDollar(s) {
    const m = String(s || '').match(/\$\d+(?:\.\d+)?/);
    return m ? m[0] : s || '—';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      const utc = iso.endsWith && (iso.endsWith('Z') || iso.includes('+')) ? iso : iso + 'T00:00:00Z';
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date(utc));
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }

  // ── mappers (API shape → card shape) ─────────────────────────────────────────
  function mapTrade(t) {
    const c = t.contract || {},
      ctx = t.market_context || {},
      ex = t.execution || {};
    const conf = t.confidence_score == null ? 0 : t.confidence_score <= 1 ? Math.round(t.confidence_score * 100) : Math.round(t.confidence_score);
    const tags = [];
    if (ctx.orb_confirmed) tags.push('ORB confirmed');
    if (n(ctx.volume_ratio) != null && ctx.volume_ratio >= 2) tags.push('Vol ≥ 2×');
    if (t.news_catalyst_tag) tags.push(t.news_catalyst_tag);
    return {
      id: t.id,
      ticker: t.ticker,
      direction: t.direction,
      strategy: t.strategy || 'Setup',
      confidence: conf,
      state: 'live',
      price: n(ctx.current_price),
      change: null,
      changePct: null,
      strike: n(c.strike),
      exp: c.expiration || '—',
      prem: n(c.premium),
      delta: n(c.delta),
      iv: c.implied_volatility != null ? +(c.implied_volatility * 100).toFixed(1) : null,
      entry: ex.suggested_entry != null ? '$' + Number(ex.suggested_entry).toFixed(2) : firstDollar(ex.entry_price_guidance),
      stop: firstDollar(ex.stop_loss_guidance),
      target: firstDollar(ex.profit_target_guidance),
      tags,
      bullets: t.reasoning && t.reasoning.bullet_points || [],
      detected: fmtET(t.detected_at)
    };
  }
  const SENT = {
    STRONG_BULLISH: ['Strong Bullish', 'up'],
    BULLISH: ['Bullish', 'up'],
    MIXED: ['Mixed', 'gold'],
    BEARISH: ['Bearish', 'down'],
    STRONG_BEARISH: ['Strong Bearish', 'down']
  };
  function mapNewsItem(x) {
    const s = SENT[x.nlp && x.nlp.sentiment || ''] || ['—', 'neutral'];
    return {
      src: x.source || '—',
      h: x.headline,
      sent: s[0],
      tone: s[1],
      impact: x.impact || '—',
      tickers: x.related_tickers || [],
      time: fmtET(x.published_at)
    };
  }
  function alertTone(sev) {
    const s = String(sev || '').toLowerCase();
    if (/(profit|success|win|take)/.test(s)) return 'up';
    if (/(loss|exit|stop|error|danger|critical)/.test(s)) return 'down';
    return 'accent';
  }
  function mapAlert(a) {
    return {
      sev: alertTone(a.severity || a.alert_type),
      t: a.title,
      m: a.message,
      time: fmtET(a.timestamp),
      unread: !a.is_read
    };
  }

  // ── loaders (fetch + map; on failure → EMPTY, never fabricated data) ─────────
  // Per the product's no-mock-data rule: an unreachable backend yields empty
  // states — no trade cards, no synthetic figures.
  async function loadStatus() {
    try {
      const s = await get('/scanner/status');
      return {
        live: true,
        tickers: s.tickers_tracked ?? 0,
        setups: s.setups_found ?? 0,
        running: !!s.is_running
      };
    } catch (e) {
      return {
        live: false,
        tickers: 0,
        setups: 0,
        running: false
      };
    }
  }
  async function loadSignals() {
    try {
      const d = await get('/trades');
      const setups = (d.trades || []).map(mapTrade);
      // best-effort live prices (parallel, non-fatal)
      await Promise.all(setups.map(async st => {
        try {
          const p = await get('/scanner/price/' + encodeURIComponent(st.ticker), 3000);
          if (p && p.price != null) {
            st.price = n(p.price);
            st.change = n(p.change);
            st.changePct = p.change_pct != null ? Math.abs(p.change_pct) : null;
          }
        } catch (e) {}
      }));
      return {
        live: true,
        setups,
        updated: fmtET(d.last_updated),
        active: d.total ?? setups.length,
        doTake: d.actionable_count ?? setups.length
      };
    } catch (e) {
      return {
        live: false,
        setups: [],
        updated: '—',
        active: 0,
        doTake: 0
      };
    }
  }
  async function loadNews() {
    try {
      const d = await get('/news');
      return {
        live: true,
        news: (d.items || []).map(mapNewsItem),
        actionable: d.high_impact_count ?? 0
      };
    } catch (e) {
      return {
        live: false,
        news: [],
        actionable: 0
      };
    }
  }
  async function loadAlerts() {
    try {
      const d = await get('/alerts');
      return {
        live: true,
        alerts: (d.alerts || []).map(mapAlert),
        unread: d.unread_count ?? 0
      };
    } catch (e) {
      return {
        live: false,
        alerts: [],
        unread: 0
      };
    }
  }
  async function loadResearch() {
    try {
      const d = await get('/research/overnight');
      const top = (d.top_setups || []).map(r => ({
        tk: r.ticker,
        dir: r.direction,
        cat: r.catalyst,
        strat: r.suggested_strategy,
        s: r.catalyst_strength != null ? Math.round(r.catalyst_strength <= 1 ? r.catalyst_strength * 100 : r.catalyst_strength) : 0
      }));
      return {
        live: true,
        top,
        bias: d.market_bias || '—',
        biasNote: d.macro_context || '',
        events: d.key_events_tomorrow || []
      };
    } catch (e) {
      return {
        live: false,
        top: [],
        bias: '—',
        biasNote: '',
        events: []
      };
    }
  }
  async function loadPerformance() {
    try {
      const d = await get('/performance');
      const s = (d.strategies || [])[0];
      if (!s) return {
        live: true,
        stats: [],
        months: [],
        empty: true
      };
      const stats = [{
        label: 'Total Return',
        value: (s.total_return_pct >= 0 ? '+' : '') + Number(s.total_return_pct).toFixed(1),
        suffix: '%',
        tone: s.total_return_pct >= 0 ? 'up' : 'down',
        delta: null
      }, {
        label: 'Win Rate',
        value: Number(s.win_rate <= 1 ? s.win_rate * 100 : s.win_rate).toFixed(1),
        suffix: '%',
        tone: 'accent'
      }, {
        label: 'Profit Factor',
        value: Number(s.profit_factor).toFixed(1),
        suffix: '×'
      }, {
        label: 'Sharpe',
        value: Number(s.sharpe_ratio).toFixed(2)
      }, {
        label: 'Max Drawdown',
        value: Number(s.max_drawdown_pct).toFixed(1),
        suffix: '%',
        tone: 'down'
      }];
      const months = (s.monthly_returns || []).map(m => {
        const ym = m.month || ''; // expected 'YYYY-MM'
        const [yr, mo] = ym.split('-');
        const mi = Math.max(0, (parseInt(mo, 10) || 1) - 1);
        const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          ym,
          year: yr || '',
          m: MON[mi],
          r: Math.round(m.return_pct)
        };
      });
      const asOf = d.as_of || s.as_of || d.last_updated || null;
      return {
        live: true,
        stats,
        months,
        name: s.name,
        asOf
      };
    } catch (e) {
      return {
        live: false,
        stats: [],
        months: [],
        empty: true
      };
    }
  }
  return {
    base,
    fmtDate,
    loadStatus,
    loadSignals,
    loadNews,
    loadAlerts,
    loadResearch,
    loadPerformance
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/api.js", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/desk.jsx
try { (() => {
/* Web Trace — Trading Desk (single-file UI kit).
   Composes the design-system components from the compiled bundle and pulls live
   data from the backend via window.WebTraceAPI (see api.js). Falls back to
   illustrative sample data when the backend is unreachable. */
const WT = window.WebTracePortfolioManagementDesignSystem_29ffdf;
const API = window.WebTraceAPI;
const {
  Tabs,
  Panel,
  Banner,
  DirectionTag,
  ConfidenceMeter,
  PriceTicker,
  Badge,
  Button,
  StatTile,
  StatusPill
} = WT;
const Ico = ({
  n,
  s
}) => /*#__PURE__*/React.createElement("i", {
  "data-lucide": n,
  style: {
    width: s || 15,
    height: s || 15,
    display: 'inline-flex'
  }
});
const useIcons = () => React.useEffect(() => {
  window.lucide && window.lucide.createIcons();
});

// data hook: load once, optionally poll
function useLoad(fn, intervalMs) {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    const run = () => fn().then(d => {
      if (alive) setData(d);
    }).catch(() => {});
    run();
    const id = intervalMs ? setInterval(run, intervalMs) : null;
    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
  }, []);
  return data;
}
function Skeleton({
  h,
  n
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, Array.from({
    length: n || 3
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "wt-skeleton",
    style: {
      height: h || 96,
      borderRadius: 'var(--radius-lg)'
    }
  })));
}

// connection chip — live backend vs not connected (no fabricated data shown)
function SourceTag({
  live
}) {
  if (live) return /*#__PURE__*/React.createElement(StatusPill, {
    tone: "up",
    pulse: true
  }, "Live");
  return /*#__PURE__*/React.createElement(StatusPill, {
    tone: "neutral",
    dot: false
  }, "Offline");
}
const STATE_BANNER = {
  live: {
    tone: 'success',
    label: 'Do Take — Live',
    icon: 'check-circle-2'
  },
  hold: {
    tone: 'warn',
    label: 'Holding — Neither Level Hit',
    icon: 'pause'
  },
  take_profit: {
    tone: 'success',
    label: 'Take Profit Hit ✓',
    icon: 'check-check'
  },
  terminated: {
    tone: 'danger',
    label: 'Stop Loss Hit',
    icon: 'x'
  },
  not_entered: {
    tone: 'neutral',
    label: 'Awaiting Entry Level',
    icon: 'clock'
  }
};
const STATE_ACCENT = {
  live: 'up',
  hold: 'gold',
  take_profit: 'up',
  terminated: 'down',
  not_entered: undefined
};
function Pill({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--text-muted)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-chip)',
      borderRadius: 'var(--radius-sm)',
      padding: '4px 8px',
      whiteSpace: 'nowrap'
    }
  }, children);
}
function Lvl({
  label,
  value,
  c,
  bg
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      borderRadius: 'var(--radius-md)',
      padding: '8px 4px',
      background: bg,
      border: `1px solid color-mix(in srgb, ${c} 22%, transparent)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 3
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 700,
      fontSize: 14,
      color: c
    }
  }, value));
}
function TradeCard({
  t
}) {
  const [open, setOpen] = React.useState(false);
  useIcons();
  const b = STATE_BANNER[t.state] || STATE_BANNER.live;
  const dim = t.state === 'terminated' || t.state === 'not_entered';
  return /*#__PURE__*/React.createElement(Panel, {
    accent: STATE_ACCENT[t.state],
    padded: false,
    style: {
      opacity: dim ? 0.82 : 1
    }
  }, /*#__PURE__*/React.createElement(Banner, {
    tone: b.tone,
    icon: /*#__PURE__*/React.createElement(Ico, {
      n: b.icon,
      s: 13
    })
  }, b.label), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: 'var(--text-primary)'
    }
  }, t.ticker), /*#__PURE__*/React.createElement(DirectionTag, {
    direction: t.direction
  }), /*#__PURE__*/React.createElement(ConfidenceMeter, {
    value: t.confidence,
    width: 70
  })), t.price != null && /*#__PURE__*/React.createElement(PriceTicker, {
    price: t.price,
    change: t.change,
    changePct: t.changePct != null ? Math.abs(t.changePct) : null,
    live: true,
    align: "right"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "accent",
    variant: "outline"
  }, t.strategy), (t.tags || []).map((tag, i) => /*#__PURE__*/React.createElement(Badge, {
    key: i,
    tone: "neutral"
  }, tag))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, t.strike != null && /*#__PURE__*/React.createElement(Pill, null, "STRIKE ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-primary)'
    }
  }, "$", t.strike)), /*#__PURE__*/React.createElement(Pill, null, "EXP ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-primary)'
    }
  }, t.exp)), t.prem != null && /*#__PURE__*/React.createElement(Pill, null, "PREM ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--gold-300)'
    }
  }, "$", t.prem.toFixed(2))), t.delta != null && /*#__PURE__*/React.createElement(Pill, null, "\u0394 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-primary)'
    }
  }, t.delta.toFixed(2))), t.iv != null && /*#__PURE__*/React.createElement(Pill, null, "IV ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-primary)'
    }
  }, t.iv, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Lvl, {
    label: "Entry",
    value: t.entry,
    c: "var(--accent-text)",
    bg: "var(--accent-muted)"
  }), /*#__PURE__*/React.createElement(Lvl, {
    label: "Stop",
    value: t.stop,
    c: "var(--down-text)",
    bg: "var(--down-bg)"
  }), /*#__PURE__*/React.createElement(Lvl, {
    label: "Target",
    value: t.target,
    c: "var(--up-text)",
    bg: "var(--up-bg)"
  })), (t.bullets || []).length > 0 && /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      padding: 0,
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, t.bullets.slice(0, open ? 9 : 2).map((pt, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: 'flex',
      gap: 8,
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 7,
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: 'var(--periwinkle-500)',
      flex: 'none'
    }
  }), pt))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    leftIcon: /*#__PURE__*/React.createElement(Ico, {
      n: "line-chart",
      s: 14
    }),
    onClick: () => setOpen(o => !o)
  }, open ? 'Hide details' : 'Full details'), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "success",
    leftIcon: /*#__PURE__*/React.createElement(Ico, {
      n: "check-circle-2",
      s: 14
    })
  }, "Place order")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 6,
      borderTop: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--text-faint)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    n: "clock",
    s: 12
  }), " Detected ", t.detected), /*#__PURE__*/React.createElement("span", null, "conf ", (t.confidence / 100).toFixed(2)))));
}
function DeskHeader({
  status
}) {
  useIcons();
  const live = status ? status.live : false;
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'rgba(22,22,25,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-default)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '11px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.svg",
    width: "34",
    height: "34",
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 2,
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 18,
      color: 'var(--text-primary)',
      letterSpacing: '-0.01em'
    }
  }, "Web"), /*#__PURE__*/React.createElement("span", {
    className: "wt-gradient-text",
    style: {
      fontFamily: 'var(--font-brand)',
      fontSize: 18
    }
  }, "\xA0Trace")), /*#__PURE__*/React.createElement(SourceTag, {
    live: live
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    tone: "up",
    pulse: true
  }, "Market Open"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text-muted)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    n: "clock",
    s: 13
  }), " 9:54 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent-text)',
      fontWeight: 700
    }
  }, "EDT")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-primary)'
    }
  }, status ? status.tickers : '—'), " tickers \xB7 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-primary)'
    }
  }, status ? status.setups : '—'), " setups"))));
}
function SignalsScreen() {
  const d = useLoad(API.loadSignals, 30000);
  useIcons();
  if (!d) return /*#__PURE__*/React.createElement(Skeleton, {
    n: 3,
    h: 300
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: '10px 14px',
      marginBottom: 16,
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-sunken)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-primary)',
      fontSize: 14
    }
  }, d.active), " active signals"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--up-text)',
      fontSize: 14
    }
  }, d.doTake), " DO TAKE"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(SourceTag, {
    live: d.live
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5,
      color: 'var(--text-faint)'
    }
  }, "Updated ", d.updated))), d.setups.length === 0 ? /*#__PURE__*/React.createElement(Panel, null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, d.live ? 'No actionable setups right now. Cards post during the 9:30–11:00 AM ET entry window.' : 'Not connected to the desk — no trades to show. Live setups appear once the backend is reachable.')) : /*#__PURE__*/React.createElement("div", {
    className: "cardgrid"
  }, d.setups.map(t => /*#__PURE__*/React.createElement(TradeCard, {
    key: t.id,
    t: t
  }))));
}
function PerformanceScreen() {
  const d = useLoad(API.loadPerformance);
  useIcons();
  if (!d) return /*#__PURE__*/React.createElement(Skeleton, {
    n: 2,
    h: 140
  });
  if (d.empty) return /*#__PURE__*/React.createElement(Panel, {
    eyebrow: "Performance",
    title: "No trade history yet"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, "Performance populates once real trade history is connected. The chart will fill in from Jan 2025 to the latest end-of-day once the backend serves it."));
  const max = Math.max(20, ...d.months.map(m => Math.abs(m.r)));
  // group months by year (preserves API order) for the scrollable timeline
  const groups = [];
  d.months.forEach(mo => {
    const last = groups[groups.length - 1];
    if (last && last.year === mo.year) last.items.push(mo);else groups.push({
      year: mo.year,
      items: [mo]
    });
  });
  const stamp = d.asOf ? 'As of EOD ' + (window.WebTraceAPI.fmtDate ? window.WebTraceAPI.fmtDate(d.asOf) : String(d.asOf).slice(0, 10)) : 'As of last end-of-day';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-faint)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    n: "calendar-clock",
    s: 13
  }), " ", stamp, " \xB7 updated daily"), /*#__PURE__*/React.createElement(SourceTag, {
    live: d.live
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))',
      gap: 12
    }
  }, d.stats.map((s, i) => /*#__PURE__*/React.createElement(StatTile, {
    key: i,
    label: s.label,
    value: s.value,
    suffix: s.suffix,
    tone: s.tone,
    delta: s.delta
  }))), /*#__PURE__*/React.createElement(Panel, {
    eyebrow: d.name || 'Strategy',
    title: "Monthly Returns",
    action: /*#__PURE__*/React.createElement(Badge, {
      tone: "up",
      variant: "soft"
    }, groups.length > 1 ? groups[0].year + '–' + groups[groups.length - 1].year : 'Live')
  }, d.months.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, "No monthly data available yet \u2014 history loads from Jan 2025 onward once connected.") : /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto',
      paddingBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      gap: 22,
      height: 200,
      minWidth: 'min-content',
      padding: '8px 4px'
    }
  }, groups.map((g, gi) => /*#__PURE__*/React.createElement("div", {
    key: gi,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      borderLeft: gi > 0 ? '1px solid var(--border-subtle)' : 'none',
      paddingLeft: gi > 0 ? 22 : 0,
      marginLeft: gi > 0 ? -22 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      flex: 1
    }
  }, g.items.map((mo, i) => {
    const up = mo.r >= 0;
    const h = Math.abs(mo.r) / max * 132 + 6;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      title: mo.m + ' ' + g.year + ': ' + (up ? '+' : '') + mo.r + '%',
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 7,
        height: '100%',
        width: 26
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 700,
        color: up ? 'var(--up-text)' : 'var(--down-text)'
      }
    }, up ? '+' : '', mo.r), /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        height: h,
        borderRadius: 'var(--radius-sm)',
        background: up ? 'var(--up)' : 'var(--down)',
        boxShadow: up ? 'var(--glow-up)' : 'var(--glow-down)',
        opacity: 0.92
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-faint)'
      }
    }, mo.m[0]));
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: '0.04em',
      color: 'var(--text-muted)',
      textAlign: 'center'
    }
  }, g.year))))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 2px 0',
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--text-faint)'
    }
  }, "Monthly net return per the live trade history. Past performance is not indicative of future results.")));
}
function ResearchScreen() {
  const d = useLoad(API.loadResearch);
  useIcons();
  if (!d) return /*#__PURE__*/React.createElement(Skeleton, {
    n: 2,
    h: 160
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    eyebrow: "Overnight Report",
    title: "Top Setups for Tomorrow",
    action: /*#__PURE__*/React.createElement(SourceTag, {
      live: d.live
    })
  }, d.top.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, "No setups generated yet.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, d.top.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-sunken)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 18,
      width: 56,
      color: 'var(--text-primary)'
    }
  }, r.tk), /*#__PURE__*/React.createElement(DirectionTag, {
    direction: r.dir,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, r.cat), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, r.strat)), /*#__PURE__*/React.createElement(ConfidenceMeter, {
    value: r.s,
    width: 64
  }))))), /*#__PURE__*/React.createElement(Panel, {
    eyebrow: "Context",
    title: "Market Bias"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "up",
    variant: "soft"
  }, d.bias), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13.5,
      lineHeight: 1.65,
      color: 'var(--text-secondary)'
    }
  }, d.biasNote || 'No macro context available.'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-faint)',
      borderTop: '1px solid var(--border-subtle)',
      paddingTop: 12
    }
  }, "Key events tomorrow: ", d.events && d.events.length ? d.events.join(', ') : 'none on the calendar'))));
}
function AlertsScreen() {
  const d = useLoad(API.loadAlerts, 20000);
  useIcons();
  if (!d) return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    n: 3,
    h: 72
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    eyebrow: "Alerts",
    title: "Activity",
    action: d.unread ? /*#__PURE__*/React.createElement(Badge, {
      tone: "down",
      variant: "soft"
    }, d.unread, " unread") : /*#__PURE__*/React.createElement(SourceTag, {
      live: d.live
    })
  }, d.alerts.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, "No alerts.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, d.alerts.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      background: a.unread ? 'var(--surface-chip)' : 'var(--surface-sunken)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 6,
      width: 8,
      height: 8,
      borderRadius: '50%',
      flex: 'none',
      background: `var(--${a.sev === 'accent' ? 'accent' : a.sev})`,
      boxShadow: a.unread ? `0 0 8px var(--${a.sev === 'accent' ? 'accent' : a.sev})` : 'none',
      opacity: a.unread ? 1 : 0.4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, a.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      marginTop: 2
    }
  }, a.m), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--text-faint)',
      marginTop: 5
    }
  }, a.time)))))));
}
function NewsScreen() {
  const d = useLoad(API.loadNews, 60000);
  useIcons();
  if (!d) return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    n: 3,
    h: 88
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    eyebrow: "News",
    title: "Market Feed",
    action: d.actionable ? /*#__PURE__*/React.createElement(Badge, {
      tone: "accent",
      variant: "outline"
    }, d.actionable, " high impact") : /*#__PURE__*/React.createElement(SourceTag, {
      live: d.live
    })
  }, d.news.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, "No news in the feed.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, d.news.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '13px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-sunken)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.06em',
      color: 'var(--text-muted)',
      textTransform: 'uppercase'
    }
  }, a.src), /*#__PURE__*/React.createElement(Badge, {
    tone: a.tone,
    variant: "soft",
    size: "sm"
  }, a.sent), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    size: "sm"
  }, a.impact), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--text-faint)'
    }
  }, a.time)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-primary)',
      lineHeight: 1.45
    }
  }, a.h), (a.tickers || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginTop: 8
    }
  }, a.tickers.map((tk, j) => /*#__PURE__*/React.createElement(Badge, {
    key: j,
    tone: "accent",
    variant: "outline",
    size: "sm"
  }, tk))))))));
}
function Desk() {
  const validTabs = ['signals', 'performance', 'news'];
  const initial = validTabs.includes((location.hash || '').replace('#', '')) ? location.hash.replace('#', '') : 'signals';
  const [tab, setTab] = React.useState(initial);
  const select = id => {
    setTab(id);
    try {
      history.replaceState(null, '', '#' + id);
    } catch (e) {}
  };
  const status = useLoad(API.loadStatus, 15000);
  useIcons();
  const tabs = [{
    id: 'signals',
    label: 'Signals'
  }, {
    id: 'performance',
    label: 'Performance'
  }, {
    id: 'news',
    label: 'News'
  }];
  // Research + Alerts screens remain defined below as reference, but are not
  // surfaced — the live site ships Signals + Performance + News (per Will).
  return /*#__PURE__*/React.createElement("div", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(DeskHeader, {
    status: status
  }), /*#__PURE__*/React.createElement("div", {
    className: "stickytabs"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: select,
    tabs: tabs,
    style: {
      border: 'none'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, tab === 'signals' && /*#__PURE__*/React.createElement(SignalsScreen, null), tab === 'performance' && /*#__PURE__*/React.createElement(PerformanceScreen, null), tab === 'news' && /*#__PURE__*/React.createElement(NewsScreen, null)));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Desk, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/desk.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.ConfidenceMeter = __ds_scope.ConfidenceMeter;

__ds_ns.DirectionTag = __ds_scope.DirectionTag;

__ds_ns.PriceTicker = __ds_scope.PriceTicker;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.Tabs = __ds_scope.Tabs;

})();

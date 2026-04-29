import type { Config } from 'tailwindcss';

// ── Market Cyclops color system ───────────────────────────────────────────────
// Keep in sync with the CSS custom properties in globals.css.
// "blue-accent" token name preserved so existing component code compiles
// unchanged — the VALUE is now neon green.
// ─────────────────────────────────────────────────────────────────────────────

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──────────────────────────────────────────────────────────
        'bg-base':     '#080B0F',   // near-black page background
        'bg-card':     '#0D1117',   // dark card surface
        'bg-elevated': '#111820',   // raised block / inner section
        // ── Borders ───────────────────────────────────────────────────────────
        'border-dim':  '#1A2430',   // faintest divider
        'border-med':  '#253045',   // standard border
        // ── Text hierarchy ────────────────────────────────────────────────────
        'text-primary':   '#CDD9E5', // primary text — off-white
        'text-secondary': '#7A8D9E', // medium muted
        'text-muted':     '#3E5268', // faintest labels
        // ── Accent — neon green (Bloomberg terminal feel) ─────────────────────
        'blue-accent': '#00FF88',   // kept as "blue-accent" for code compat
        // ── Directional trade states ──────────────────────────────────────────
        'green-trade': '#22C55E',   // profit / bullish
        'red-trade':   '#EF4444',   // loss / bearish
        // ── Alerts & warnings ─────────────────────────────────────────────────
        'yellow-alert': '#F59E0B',  // amber warning
        'gold-trade':   '#F59E0B',  // golden-hour signal
        'gold-glow':    '#FBBF24',  // lighter amber highlight
        // ── Contract action states ────────────────────────────────────────────
        'state-hold':   '#F59E0B',  // amber  — holding position
        'state-profit': '#22C55E',  // green  — took profit
        'state-exit':   '#EF4444',  // red    — stopped out / exited
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        // Dark-optimised shadows with subtle inner border highlight
        'card':    '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-md': '0 4px 16px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
        // Neon accent glow — use sparingly on interactive highlights
        'neon':    '0 0 12px rgba(0,255,136,0.20), 0 0 28px rgba(0,255,136,0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink':      'blink 1.2s step-start infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

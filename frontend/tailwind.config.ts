import type { Config } from 'tailwindcss';

// ── Market Cyclops — Heavenly Orange color system ─────────────────────────────
// Primary:   white    (#FFFAF5 warm-white backgrounds)
// Secondary: light orange (#FF8C2A — the main accent, eye outline, interactive)
// Tertiary:  burnt orange (#CC4500 — stronger highlights, eye iris depth)
// Keep token names unchanged so all components compile without edits.
// ─────────────────────────────────────────────────────────────────────────────

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces — warm white ─────────────────────────────────────────────
        'bg-base':     '#FFFAF5',   // warm white page background
        'bg-card':     '#FFF5EC',   // cream card surface
        'bg-elevated': '#FFEDD8',   // light peach inner section
        // ── Borders — warm tan/orange ─────────────────────────────────────────
        'border-dim':  '#F0D0A8',   // softest warm border
        'border-med':  '#E0A870',   // standard warm border
        // ── Text — dark warm tones (readable on white) ────────────────────────
        'text-primary':   '#1A0A00', // very dark warm brown
        'text-secondary': '#5C3010', // medium warm brown
        'text-muted':     '#9A5828', // lighter warm brown
        // ── Accent — light orange (secondary colour) ──────────────────────────
        'blue-accent': '#FF8C2A',   // token kept as "blue-accent" for code compat
        // ── Directional trade states ──────────────────────────────────────────
        'green-trade': '#16A34A',   // darker green (readable on white)
        'red-trade':   '#DC2626',   // red — loss / bearish
        // ── Alerts & warnings ─────────────────────────────────────────────────
        'yellow-alert': '#D97706',  // amber warning
        'gold-trade':   '#D97706',  // golden-hour signal
        'gold-glow':    '#F59E0B',  // lighter amber highlight
        // ── Burnt orange (tertiary) ───────────────────────────────────────────
        'burnt-orange': '#CC4500',  // tertiary — eye iris, strong accents
        // ── Contract action states ────────────────────────────────────────────
        'state-hold':   '#D97706',
        'state-profit': '#16A34A',
        'state-exit':   '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        // Warm-light optimised shadows
        'card':    '0 1px 3px rgba(100,50,0,0.08), 0 0 0 1px rgba(200,100,30,0.10)',
        'card-md': '0 4px 16px rgba(100,50,0,0.12), 0 0 0 1px rgba(200,100,30,0.12)',
        'card-lg': '0 8px 32px rgba(100,50,0,0.16), 0 0 0 1px rgba(200,100,30,0.14)',
        // Orange accent glow
        'neon':    '0 0 12px rgba(255,140,42,0.30), 0 0 28px rgba(255,140,42,0.12)',
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

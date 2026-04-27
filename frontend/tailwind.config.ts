import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces — JP Morgan light theme ──────────────────────────────
        'bg-base':     '#F4F6F9',   // page background — cool off-white
        'bg-card':     '#FFFFFF',   // card surface — pure white
        'bg-elevated': '#EEF2F7',   // inner section / raised block
        // ── Borders ───────────────────────────────────────────────────────
        'border-dim':  '#E2E8F0',   // faintest divider
        'border-med':  '#CBD5E1',   // standard border
        // ── Text hierarchy ────────────────────────────────────────────────
        'text-primary':   '#0F172A', // near-black (slate-900)
        'text-secondary': '#475569', // medium gray (slate-600)
        'text-muted':     '#94A3B8', // light gray (slate-400)
        // ── Brand — JPMorgan Chase signature navy ─────────────────────────
        'blue-accent': '#003087',   // JPM deep navy blue
        // ── Directional ───────────────────────────────────────────────────
        'green-trade': '#15692A',   // deep forest green
        'red-trade':   '#B91C1C',   // deep red
        // ── Warning & alerts ──────────────────────────────────────────────
        'yellow-alert': '#92400E',  // dark amber
        'gold-trade':   '#92400E',  // golden amber (Golden Hour)
        'gold-glow':    '#B45309',  // lighter amber highlight
        // ── Contract action states ────────────────────────────────────────
        'state-hold':   '#B45309',  // amber  — holding position
        'state-profit': '#15692A',  // green  — took profit
        'state-exit':   '#B91C1C',  // red    — terminated / stopped out
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'card':    '0 1px 3px 0 rgba(15,23,42,0.07), 0 1px 2px -1px rgba(15,23,42,0.07)',
        'card-md': '0 4px 6px -1px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.08)',
        'card-lg': '0 8px 16px -2px rgba(15,23,42,0.10), 0 4px 6px -4px rgba(15,23,42,0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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

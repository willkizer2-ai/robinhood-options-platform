import type { Config } from 'tailwindcss';

// ── Web Trace Portfolio Management — dark charcoal + periwinkle theme ─────────
// Token names are kept compatible with existing component code where possible.
// ─────────────────────────────────────────────────────────────────────────────

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Surfaces — cool charcoal ─────────────────────────────────────────
        'bg-base':        '#161619',
        'bg-card':        '#232329',
        'bg-elevated':    '#2e2e36',
        // ── Borders ──────────────────────────────────────────────────────────
        'border-dim':     'rgba(180,180,204,0.08)',
        'border-med':     'rgba(180,180,204,0.14)',
        // ── Text ─────────────────────────────────────────────────────────────
        'text-primary':   '#f4f4f9',
        'text-secondary': '#a9aab8',
        'text-muted':     '#8a8b9c',
        // ── Accent — periwinkle (kept as blue-accent for code compat) ─────────
        'blue-accent':    '#b4b4cc',
        // ── Directional ──────────────────────────────────────────────────────
        'green-trade':    '#2dd4bf',   // teal = up / call / profit
        'red-trade':      '#f0508f',   // magenta = down / put / loss
        // ── States ───────────────────────────────────────────────────────────
        'yellow-alert':   '#e6b450',
        'gold-trade':     '#e6b450',
        'gold-glow':      '#f3cf7e',
        'state-hold':     '#e6b450',
        'state-profit':   '#2dd4bf',
        'state-exit':     '#f0508f',
        // ── Ink ramp ─────────────────────────────────────────────────────────
        'ink-900':  '#161619',
        'ink-800':  '#232329',
        'ink-700':  '#2e2e36',
        'ink-650':  '#363640',
        'ink-600':  '#41414d',
        // ── Periwinkle ───────────────────────────────────────────────────────
        'periwinkle-300': '#c7c9e0',
        'periwinkle-400': '#b4b4cc',
        'periwinkle-500': '#9c9cba',
        'periwinkle-700': '#646580',
        // ── Directional full set ─────────────────────────────────────────────
        'teal-300':     '#6ee7d3',
        'teal-400':     '#2dd4bf',
        'magenta-300':  '#f78ab6',
        'magenta-400':  '#f0508f',
      },
      fontFamily: {
        sans:    ['Space Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':    '0 1px 2px rgba(0,0,0,0.45), 0 0 0 1px rgba(180,180,204,0.06)',
        'card-md': '0 6px 18px rgba(0,0,0,0.50), 0 0 0 1px rgba(180,180,204,0.07)',
        'card-lg': '0 14px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(180,180,204,0.08)',
        'neon':    '0 0 18px rgba(180,180,204,0.28)',
        'up':      '0 0 18px rgba(45,212,191,0.30)',
        'down':    '0 0 18px rgba(240,80,143,0.30)',
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

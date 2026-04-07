import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens (stone palette) ─────────────────────────────────
        canvas:        '#fafaf9',     // page background (stone-50)
        surface:       '#ffffff',     // card / modal backgrounds
        border:        '#e7e5e4',     // standard border (stone-200)
        'border-subtle': '#f5f5f4',   // dividers, sidebar border (stone-100)
        ink:           '#1c1917',     // primary text (stone-900)
        secondary:     '#292524',     // nav text, button text (stone-800)
        muted:         '#44403c',     // body text, descriptions (stone-700)
        faint:         '#78716c',     // secondary muted, icons (stone-500)
        placeholder:   '#a8a29e',     // placeholder, overlines (stone-400)
        // ── Surface states ───────────────────────────────────────────────────
        hover:         '#f5f5f4',     // ghost button hover (stone-100)
        active:        '#e7e5e4',     // ghost button active (stone-200)
        // ── Sidebar ──────────────────────────────────────────────────────────
        sidebar: {
          bg:     '#fafaf9',          // stone-50
          border: '#e7e5e4',          // stone-200
          hover:  '#f5f5f4',          // stone-100
          active: '#e7e5e4',          // stone-200
          text:   '#44403c',          // stone-700
        },
        // ── Accent (monochrome) ──────────────────────────────────────────────
        accent: {
          DEFAULT: '#1c1917',   // stone-900 — primary
          hover:   '#0c0a09',   // stone-950 — hover
          dark:    '#0c0a09',   // stone-950 — active press
          light:   '#a8a29e',   // stone-400 — light
          wash:    '#e7e5e4',   // stone-200 — wash bg
        },
        // ── Surface containers (multi-level bg system) ──────────────────────
        'surface-low':  '#fafaf9',    // stone-50
        'surface-mid':  '#f5f5f4',    // stone-100
        'surface-high': '#e7e5e4',    // stone-200
        blue:          '#1c1917',     // was interactive blue, now stone-900
        // ── Semantic status (kept as pops of color) ───────────────────────────
        teal: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':  'spin 2s linear infinite',
        'fade-in':    'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // ── Attio multi-layer shadow system ──────────────────────────────────────
      // Base color: rgba(28,29,31,…) — their near-black, not pure black
      boxShadow: {
        card: [
          '0px 0px 0px 1px rgba(28,29,31,0.08)',
          '0px 1px 2px 0px rgba(28,29,31,0.05)',
          '0px 2px 4px -1px rgba(28,29,31,0.04)',
        ].join(', '),
        'card-hover': [
          '0px 0px 0px 1px rgba(28,29,31,0.08)',
          '0px 4px 8px -2px rgba(28,29,31,0.06)',
          '0px 8px 16px -4px rgba(28,29,31,0.08)',
          '0px 16px 32px -8px rgba(28,29,31,0.06)',
        ].join(', '),
        'card-lg': [
          '0px 0px 0px 1px rgba(28,29,31,0.08)',
          '0px 2px 6px 0px rgba(28,29,31,0.06)',
          '0px 6px 20px -2px rgba(28,29,31,0.08)',
        ].join(', '),
        float: '0px 2px 6px 0px rgba(28,40,64,0.06), 0px 6px 20px -2px rgba(28,40,64,0.08)',
      },
    },
  },
  plugins: [],
}

export default config

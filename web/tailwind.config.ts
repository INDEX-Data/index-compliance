import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces (cool slate, var-driven, dark-ready) ───────────────────
        canvas:          'var(--surface-canvas)',
        surface:         'var(--surface-card)',
        'surface-raised':'var(--surface-raised)',
        'surface-sunken':'var(--surface-sunken)',
        // ── Text ─────────────────────────────────────────────────────────────
        ink:           'var(--text-ink)',
        muted:         'var(--text-muted)',
        faint:         'var(--text-faint)',
        'on-accent':   'var(--text-on-accent)',
        // ── Borders ──────────────────────────────────────────────────────────
        border:          'var(--border-default)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        // ── Brand — INDEX orange (mark + primary action only) ────────────────
        brand: {
          DEFAULT: 'var(--brand)',
          hover:   'var(--brand-hover)',
          active:  'var(--brand-active)',
          wash:    'var(--brand-wash)',
          ink:     'var(--brand-ink)',
        },
        'on-brand': 'var(--text-on-brand)',
        // ── Accent (INDEX orange, rationed to interactive/focal moments) ─────
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
          wash:    'var(--accent-wash)',
        },
        'on-accent-brand': 'var(--text-on-accent-brand)',
        // ── Dark navigation rail ─────────────────────────────────────────────
        rail: {
          DEFAULT: 'var(--rail-bg)',
          raised:  'var(--rail-raised)',
          border:  'var(--rail-border)',
          text:    'var(--rail-text)',
          faint:   'var(--rail-faint)',
        },
        // ── Status — semantic, distinct from brand ───────────────────────────
        pass:    { DEFAULT: 'var(--status-pass)',    bg: 'var(--status-pass-bg)',    border: 'var(--status-pass-border)' },
        warn:    { DEFAULT: 'var(--status-warn)',    bg: 'var(--status-warn-bg)',    border: 'var(--status-warn-border)' },
        fail:    { DEFAULT: 'var(--status-fail)',    bg: 'var(--status-fail-bg)',    border: 'var(--status-fail-border)' },
        info:    { DEFAULT: 'var(--status-info)',    bg: 'var(--status-info-bg)',    border: 'var(--status-info-border)' },
        neutral: { DEFAULT: 'var(--status-neutral)', bg: 'var(--status-neutral-bg)', border: 'var(--status-neutral-border)' },
        // ── Legacy aliases (existing pages still reference these) ─────────────
        secondary:     '#292524',
        placeholder:   'var(--text-faint)',
        hover:         'var(--surface-sunken)',
        active:        'var(--border-default)',
        sidebar: {
          bg: 'var(--rail-bg)', border: 'var(--rail-border)',
          hover: 'var(--rail-raised)', active: 'var(--rail-active-bg)', text: 'var(--rail-text)',
        },
        'surface-low':  'var(--surface-canvas)',
        'surface-mid':  'var(--surface-sunken)',
        'surface-high': 'var(--border-default)',
        blue:          'var(--text-ink)',
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
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out)',
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
      // ── Flat elevation — monochrome dark relies on hairline borders, not
      // soft shadows. Cards get a near-invisible depth; popovers get a quiet
      // drop so they separate from the surface beneath.
      boxShadow: {
        card: 'none',
        'card-hover': 'none',
        'card-lg': '0 1px 2px rgba(0,0,0,0.3)',
        float: '0 8px 24px -8px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}

export default config

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
        // ── Attio-exact semantic tokens ──────────────────────────────────────
        canvas:        '#fafafa',     // page background
        surface:       '#ffffff',     // card / modal backgrounds
        border:        '#e4e7ec',     // standard border
        'border-subtle': '#eeeff1',   // dividers, sidebar border
        ink:           '#1c1d1f',     // primary text (near-black, slight blue cast)
        secondary:     '#2e3238',     // nav text, button text
        muted:         '#505967',     // body text, descriptions
        faint:         '#6f7988',     // secondary muted, icons
        placeholder:   '#a4adba',     // placeholder, overlines, very faint labels
        // ── Surface states ───────────────────────────────────────────────────
        hover:         '#f3f4f6',     // ghost button hover
        active:        '#edeff3',     // ghost button active / nav active bg
        // ── Sidebar ──────────────────────────────────────────────────────────
        sidebar: {
          bg:     '#fbfbfb',          // barely-off-white (Attio exact)
          border: '#eeeff1',
          hover:  '#f3f4f6',
          active: '#edeff3',
          text:   '#505967',
        },
        // ── Accent ───────────────────────────────────────────────────────────
        gold:          '#C4A96D',     // INDEX brand accent
        blue:          '#266df0',     // interactive / AI features (Attio blue)
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

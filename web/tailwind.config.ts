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
        canvas:  '#F8FAFC',
        surface: '#FFFFFF',
        border:  '#E2E8F0',
        'border-light': '#F1F5F9',
        ink:     '#0F172A',
        muted:   '#64748B',
        faint:   '#94A3B8',
        sidebar: {
          bg:     '#0B1829',
          hover:  '#102238',
          active: '#162B40',
          border: '#1A2D3F',
          text:   '#7B96B2',
          bright: '#F5F4EF',
        },
        teal: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
        'card-hover': '0 8px 24px 0 rgb(15 23 42 / 0.10), 0 2px 6px -1px rgb(15 23 42 / 0.06)',
        'card-lg': '0 4px 16px 0 rgb(15 23 42 / 0.08), 0 2px 4px -1px rgb(15 23 42 / 0.05)',
      },
    },
  },
  plugins: [],
}

export default config

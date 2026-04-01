import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
        },
        surface: '#FFFFFF',
        background: '#F4F4F6',
        border: '#E4E4E7',
        text: {
          primary:   '#18181B',
          secondary: '#52525B',
          muted:     '#A1A1AA',
          inverse:   '#FFFFFF',
        },
        status: {
          checkin:    '#10B981',
          late:       '#F59E0B',
          absent:     '#EF4444',
          checkout:   '#94A3B8',
          checkinBg:  '#D1FAE5',
          lateBg:     '#FEF3C7',
          absentBg:   '#FEE2E2',
          checkoutBg: '#F1F5F9',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-noto-sans-kr)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        card:         '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 16px 0 rgb(0 0 0 / 0.08), 0 0 0 1px rgb(0 0 0 / 0.04)',
        'sidebar':    '1px 0 0 0 #E4E4E7',
        'header':     '0 1px 0 0 #E4E4E7',
        'popover':    '0 8px 30px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.05)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease',
        'slide-in': 'slideIn 200ms ease',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

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
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
        },
        sidebar: {
          bg:     '#FFFFFF',
          hover:  '#F5F3FF',
          active: '#EDE9FE',
          border: '#F0EEFF',
          text:   '#6B7280',
          muted:  '#9CA3AF',
        },
        surface: '#FFFFFF',
        background: '#F8F7FF',
        border: '#E5E7EB',
        text: {
          primary:   '#111827',
          secondary: '#4B5563',
          muted:     '#9CA3AF',
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
        card:         '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;

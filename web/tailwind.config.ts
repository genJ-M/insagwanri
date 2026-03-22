import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        sidebar: {
          bg:     '#0F172A',
          hover:  '#1E293B',
          active: '#334155',
          border: '#1E293B',
          text:   '#94A3B8',
          muted:  '#475569',
        },
        surface: '#FFFFFF',
        background: '#F1F5F9',
        border: '#E2E8F0',
        text: {
          primary:   '#0F172A',
          secondary: '#64748B',
          muted:     '#94A3B8',
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

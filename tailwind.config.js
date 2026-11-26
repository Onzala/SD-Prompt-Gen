/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.tsx', './hooks/**/*.ts'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // 以較深、偏冷的中性色取代 Tailwind 預設 slate，讓整體層次更乾淨
        slate: {
          50: '#f6f7fb',
          100: '#eceef5',
          200: '#d6d9e6',
          300: '#b3b8cc',
          400: '#8a90a8',
          500: '#686e87',
          600: '#4d5269',
          700: '#33374a',
          800: '#22253a',
          900: '#16182a',
          950: '#0b0c18',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139,92,246,.25), 0 8px 30px -8px rgba(139,92,246,.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(6px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .15s ease-out',
        'pop-in': 'pop-in .18s cubic-bezier(.2,.8,.2,1)',
        'slide-in-right': 'slide-in-right .22s cubic-bezier(.2,.8,.2,1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

import defaultColors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// ==========================================
// 深色／淺色主題
// 所有色票都改成 CSS 變數，<html data-theme="light"> 時自動換成淺色版本，
// 元件不需要另外寫 dark: / light: 變體。
// ==========================================

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// 強調色：淺色模式把淺色調（文字用）換成深色調、深色調（底色用）換成淺色調，
// 500–700 保持不變，讓實心按鈕上的白字維持足夠對比。
const ACCENT_LIGHT_MAP = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500, 600: 600, 700: 700, 800: 200, 900: 100, 950: 50 };
const ACCENTS = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

// 中性色依「用途」分別指定兩種主題的值（950 = 頁面底色、900 = 卡片、100 = 主要文字）
const SLATE = {
  dark: { 50: '#f6f7fb', 100: '#eceef5', 200: '#d6d9e6', 300: '#b3b8cc', 400: '#8a90a8', 500: '#686e87', 600: '#4d5269', 700: '#33374a', 800: '#22253a', 900: '#16182a', 950: '#0b0c18' },
  light: { 50: '#0e1019', 100: '#1b1e2c', 200: '#2b2f40', 300: '#41465a', 400: '#5b6176', 500: '#737990', 600: '#a9aebf', 700: '#d9dce6', 800: '#eceef4', 900: '#ffffff', 950: '#f3f4f8' },
};

// 疊加色：深色模式是白色半透明，淺色模式是深色半透明
const FG = { dark: '#ffffff', light: '#11131f' };

const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const ref = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const colors = { slate: {}, fg: ref('fg') };
const darkVars = { '--c-fg': rgb(FG.dark) };
const lightVars = { '--c-fg': rgb(FG.light) };

for (const shade of SHADES) {
  colors.slate[shade] = ref(`slate-${shade}`);
  darkVars[`--c-slate-${shade}`] = rgb(SLATE.dark[shade]);
  lightVars[`--c-slate-${shade}`] = rgb(SLATE.light[shade]);
}

for (const name of ACCENTS) {
  colors[name] = {};
  for (const shade of SHADES) {
    colors[name][shade] = ref(`${name}-${shade}`);
    darkVars[`--c-${name}-${shade}`] = rgb(defaultColors[name][shade]);
    lightVars[`--c-${name}-${shade}`] = rgb(defaultColors[name][ACCENT_LIGHT_MAP[shade]]);
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.tsx', './hooks/**/*.ts'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors,
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...darkVars, colorScheme: 'dark' },
        ':root[data-theme="light"]': { ...lightVars, colorScheme: 'light' },
      });
    }),
  ],
};

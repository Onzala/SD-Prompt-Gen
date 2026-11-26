import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

// 與 index.html 開頭的內嵌腳本使用同一個 key，避免載入時先閃一下深色
const STORAGE_KEY = 'sd_prompt_theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#0b0c18', light: '#f3f4f8' };

const readInitialTheme = (): Theme => {
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === 'light' || fromDom === 'dark') return fromDom;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(current => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* 無痕模式等情況可能無法寫入 */
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
};

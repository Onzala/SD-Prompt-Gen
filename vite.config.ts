import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相對路徑，讓 GitHub Pages 子路徑（/SD-Prompt-Gen/）也能正確載入資源
  base: './',
  server: {
    host: true
  }
});

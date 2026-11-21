import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/what-the-shell/' : '/',
  build: {
    chunkSizeWarningLimit: 700,
  },
}));

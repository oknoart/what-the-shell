import { defineConfig } from 'vite';

// Auto-open is handled by the `start` script (`vite --open`), not here.
export default defineConfig(({ command }) => ({
  // Project pages are served under /<repo>/; keep the dev server at root.
  base: command === 'build' ? '/raup-1966-shell-generator/' : '/',
  build: {
    // Three.js alone is ~500 kB; the warning is not actionable here.
    chunkSizeWarningLimit: 700,
  },
}));

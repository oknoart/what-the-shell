import { defineConfig } from 'vite';

// Auto-open is handled by the `start` script (`vite --open`), not here.
export default defineConfig({
  build: {
    // Three.js alone is ~500 kB; the warning is not actionable here.
    chunkSizeWarningLimit: 700,
  },
});

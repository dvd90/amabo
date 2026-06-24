import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The device shell (docs/ARCHITECTURE.md §10, §15): an installable PWA. The
// manifest + service worker land in M8/M9; M0 is the compiling Vite skeleton.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});

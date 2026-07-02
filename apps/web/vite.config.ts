import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The device shell (docs/ARCHITECTURE.md §10, §15): an installable PWA. The
// manifest + service worker land in M8/M9; M0 is the compiling Vite skeleton.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Deploy truth (LAUNCH_PLAN.md L0): stamp the bundle with the commit it was built
  // from, so a stale PWA cache is diagnosable from the Settings sheet.
  define: {
    'import.meta.env.VITE_COMMIT': JSON.stringify(
      process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.AMABO_VERSION ?? 'dev',
    ),
  },
});

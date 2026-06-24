import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Engine-scoped config so `pnpm --filter @amabo/engine test:coverage` measures the
// PURE core on its own (CLAUDE.md: keep the core ~100%). Tests run against source.
export default defineConfig({
  resolve: {
    alias: {
      '@amabo/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      // The deterministic core is the one place we hold a hard line.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});

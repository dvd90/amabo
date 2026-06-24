import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against package SOURCE, not built dist — no build step before the
    // TDD loop, and the pure engine stays the fast inner loop.
    alias: {
      '@amabo/shared': pkg('shared'),
      '@amabo/engine': pkg('engine'),
      '@amabo/ai': pkg('ai'),
    },
  },
  test: {
    include: ['{packages,apps}/*/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});

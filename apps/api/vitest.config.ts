import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

// API tests run against workspace SOURCE (no build step) and a node environment.
export default defineConfig({
  resolve: {
    alias: {
      '@amabo/shared': pkg('shared'),
      '@amabo/engine': pkg('engine'),
      '@amabo/ai': pkg('ai'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

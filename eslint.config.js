// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/*.tsbuildinfo'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Law 1: packages/engine is PURE. No I/O, no wall-clock, no global RNG.
    // Time and randomness are injected. This lint makes a purity violation
    // fail CI instead of silently corrupting determinism.
    files: ['packages/engine/**/*.ts'],
    ignores: ['packages/engine/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'engine is pure: inject time, never read the wall clock.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'engine is pure: use the injected seeded Rng, never Math.random().',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'engine is pure: inject time, never call Date.now().',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message: 'engine is pure: no database access.' },
            { name: '@anthropic-ai/sdk', message: 'engine is pure: no LLM access.' },
          ],
          patterns: [
            {
              group: ['*/ai', '*/ai/*', '@amabo/ai', '@amabo/ai/*'],
              message: 'engine must never depend on the AI layer.',
            },
            {
              group: ['*/chain', '*/chain/*', '@amabo/chain', '@amabo/chain/*'],
              message: 'the chain is a leaf: engine must never depend on it.',
            },
          ],
        },
      ],
    },
  },
);

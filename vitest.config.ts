import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        // Acceptance criteria from spec v3 must be met by tests.
        // Coverage is a leading indicator, not a goal in itself.
        // BLOCK-class code (RLS, append-only, joint custody) requires 100% coverage.
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      include: ['packages/**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/test/**', '**/migrations/**', '**/dist/**'],
    },
    include: ['**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/scratch/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

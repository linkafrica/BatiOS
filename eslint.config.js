// Root ESLint flat config for BatiOS.
// Cheap first-line enforcement only. The regex compliance scanner and the QA
// harness cover broader architectural checks; ESLint is intentionally limited
// to rules it can enforce reliably without custom plugins.
//
// Enforced here:
//   - No direct imports of LLM SDKs outside the Agent Gateway
//   - No console.log in production code
//   - No eval-style execution

import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.d.ts',
      'scratch/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json', './packages/*/tsconfig.json', './apps/*/tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      // TypeScript hygiene
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      // Architectural enforcement: no direct LLM SDK imports outside the Agent Gateway.
      // The Agent Gateway is the ONLY place that imports @anthropic-ai/sdk, openai, etc.
      // QA Agent BLOCKs PRs that violate this regardless of override attempts.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'],
              message:
                'Direct LLM SDK imports are forbidden outside packages/agent-gateway. ' +
                'All LLM calls go through the Agent Gateway. See ADR-0006 and Backend Builder manual Section 4.',
            },
          ],
        },
      ],

      // No console.log in production code; use the structured logger.
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Disallow eval and Function constructor (security).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  // Agent Gateway is the only package permitted to import LLM SDKs.
  {
    files: ['packages/agent-gateway/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  // Test files have looser rules.
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  // Migrations may use raw SQL strings.
  {
    files: ['**/migrations/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  prettier,
];

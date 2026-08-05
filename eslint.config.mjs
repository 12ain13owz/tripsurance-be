// @ts-check
import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import-x'
import n from 'eslint-plugin-n'
import security from 'eslint-plugin-security'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

// Shared import/order rule — reused by both the src and scripts rule sets.
/** @type {['error', Record<string, unknown>]} */
const importOrderRule = [
  'error',
  {
    groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'type'],
    pathGroups: [
      // Match the @/* alias defined in tsconfig.json
      { pattern: '@/**', group: 'internal', position: 'after' },
    ],
    pathGroupsExcludedImportTypes: ['builtin'],
    alphabetize: { order: 'asc', caseInsensitive: true },
    'newlines-between': 'never',
  },
]

export default defineConfig(
  // ── Ignores ───────────────────────────────────────────────────────────────
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.turbo/**', 'eslint.config.mjs'],
  },

  // ── TypeScript (Node.js / Express backend) ──────────────────────────────────
  {
    files: ['src/**/*.{js,mjs,cjs,ts}'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked, // type-aware rules for stricter linting
      prettier, // MUST be last: turns off ESLint rules that conflict with Prettier
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        // Type-aware linting via the TypeScript project service (recommended over `project`)
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
      // @types/eslint-plugin-security is stale against ESLint 10's Plugin type
      // (eslint-plugin-security itself ships no types) — cast around the mismatch.
      security: /** @type {import('eslint').ESLint.Plugin} */ (security),
      n,
    },
    rules: {
      // ═══════════════════════════════════════════════════════════════════════
      // Baseline — safety & correctness. Keep enabled in every project cloned
      // from this template; only relax with a documented reason.
      // ═══════════════════════════════════════════════════════════════════════

      // ── Safety & error handling ──────────────────────────────────────────────
      'no-async-promise-executor': 'error', // unsafe Promise executor functions
      'no-eval': 'error', // disallow eval()
      eqeqeq: 'error', // require === / !== over == / !=
      'no-var': 'error', // block-scoped declarations only
      'prefer-const': 'error', // catch accidental reassignment
      curly: ['error', 'all'], // always require braces around blocks
      '@typescript-eslint/no-floating-promises': 'error', // every Promise must be awaited/handled
      '@typescript-eslint/no-misused-promises': 'error', // catch async fns passed where sync is expected
      '@typescript-eslint/only-throw-error': 'error', // always throw Error instances (type-aware version of no-throw-literal)
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true }, // a `default` catch-all counts as exhaustive
      ],

      // ── Node.js runtime ──────────────────────────────────────────────────────
      'n/no-deprecated-api': 'error', // catch use of deprecated Node.js APIs
      'n/no-extraneous-import': 'error', // imports must be declared in package.json
      'n/no-unsupported-features/node-builtins': ['error', { version: '>=20.0.0' }], // match engines.node

      // ── Security ─────────────────────────────────────────────────────────────
      'security/detect-object-injection': 'warn',

      // ── TypeScript strictness ───────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn', // prefer explicit narrowing over `!`
      '@typescript-eslint/no-unnecessary-condition': 'warn', // catch dead branches from bad type narrowing
      '@typescript-eslint/promise-function-async': 'warn', // functions returning a Promise should be async
      // Auto-rewrite type-only imports to `import type` on --fix / save
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': 'off', // delegated to unused-imports below

      // ── Imports ──────────────────────────────────────────────────────────────
      'unused-imports/no-unused-imports': 'error', // auto-remove unused imports on --fix
      'import/no-duplicates': 'error',
      'import/no-cycle': 'warn', // circular deps between feature/core modules
      // Same-folder imports use `./foo`; anything crossing a folder boundary must use the `@/` alias
      'import/no-relative-parent-imports': 'error',
      // Cross-feature imports go through a feature's public `index.ts`, never its internals
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Import from another feature only via its public API (@/features/<name>), not internal paths.',
            },
          ],
        },
      ],

      // ═══════════════════════════════════════════════════════════════════════
      // Opinionated — sensible defaults for this template, safe to tune per project.
      // ═══════════════════════════════════════════════════════════════════════

      // ── Logging & environment ────────────────────────────────────────────────
      'no-console': ['error', { allow: ['warn', 'error'] }], // prefer the winston logger
      'no-process-env': 'warn', // read env through the central config module

      // ── Complexity (relaxed for Express handlers) ────────────────────────────
      complexity: ['warn', { max: 15 }],

      '@typescript-eslint/explicit-module-boundary-types': 'off', // implicit return types are fine for handlers
      '@typescript-eslint/require-await': 'off', // async middleware without await is common
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
      'import/order': importOrderRule,
    },
  },

  // ── Node.js scripts (setup, tooling) ────────────────────────────────────────
  {
    files: ['scripts/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      prettier,
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: './scripts/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
      n,
    },
    rules: {
      'no-console': 'off', // CLI scripts report progress via console
      'no-process-env': 'off',
      'n/no-process-exit': 'off', // CLI scripts legitimately exit with a status code
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'unused-imports/no-unused-imports': 'error',
      'import/order': importOrderRule,
    },
  },

  // ── Tests (relaxed for mocks/fixtures) ──────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  }
)

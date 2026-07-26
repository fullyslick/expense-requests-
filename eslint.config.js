import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
    },
    rules: {
      // Express error middleware must declare all 4 params (err, req, res, next)
      // for Express to recognize it by arity, even when some go unused.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    extends: [reactHooks.configs['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Generated shadcn primitives: each file pairs a component with a
    // `cva` variants export by convention, which react-refresh's
    // components-only-export rule otherwise flags.
    files: ['client/src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Context files pair a Provider component with its consumer hook (and
    // sometimes a shared constant) by convention — same rationale as the
    // shadcn override above.
    files: ['client/src/context/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['server/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
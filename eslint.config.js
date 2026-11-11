// ESLint (kjøres med «npm run lint», og av «npm run sjekk» før commit og på GitHub).
// Anbefalte regler pluss noen få strengere. Appen har ingen byggesteg; dette er bare en sjekk.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'vendor/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'sw.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...globals.serviceworker } },
  },
  {
    files: ['tests/**/*.js', 'tools/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['tools/**/*.cjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none', destructuredArrayIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-irregular-whitespace': ['error', { skipStrings: false, skipTemplates: false }],
      'no-implicit-globals': 'error',
    },
  },
];

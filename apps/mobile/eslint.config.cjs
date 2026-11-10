const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const hooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  { ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'readonly' },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { globals: { process: 'readonly' } },
    plugins: { 'react-hooks': hooks },
    rules: hooks.configs.recommended.rules,
  },
);

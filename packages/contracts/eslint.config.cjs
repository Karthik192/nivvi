const js = require('@eslint/js');
const ts = require('typescript-eslint');
module.exports = ts.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
);

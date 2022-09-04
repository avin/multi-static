module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended',
  ],
  rules: {
    'no-empty': 0,
    'consistent-return': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info', 'dir'] }],
    'spaced-comment': ['warn', 'always', { markers: ['/'] }],

    '@typescript-eslint/no-unused-vars': [1, { args: 'none', ignoreRestSiblings: true }],
  },
};

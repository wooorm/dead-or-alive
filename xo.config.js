/**
 * @import {FlatXoConfig} from 'xo'
 */

/** @type {FlatXoConfig} */
const xoConfig = [
  {
    name: 'default',
    prettier: true,
    rules: {
      'import-x/order': 'off',
      'max-depth': 'off',
      'require-unicode-regexp': 'off',
      'unicorn/no-array-sort': 'off',
      'unicorn/prefer-code-point': 'off'
    },
    space: true
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'generic'
        }
      ],
      '@typescript-eslint/no-restricted-types': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface']
    }
  }
]

export default xoConfig

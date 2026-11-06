import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';

export default ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: ['.vue'] } },
  },
  {
    languageOptions: {
      globals: Object.fromEntries(
        [
          'console',
          'process',
          'Buffer',
          'URL',
          'URLSearchParams',
          'AbortSignal',
          'AbortController',
          'fetch',
          'Response',
          'Request',
          'Headers',
          'TextDecoder',
          'TextEncoder',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'IntersectionObserver',
          'Image',
          'Blob',
          'HTMLElement',
          'KeyboardEvent',
          'HTMLInputElement',
          'HTMLSelectElement',
          'HTMLTextAreaElement',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'performance',
          'globalThis',
        ].map((name) => [name, 'readonly']),
      ),
    },
    rules: {
      // TypeScript checks undeclared identifiers, including DOM types.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'vue/multi-word-component-names': 'off',
    },
  },
);

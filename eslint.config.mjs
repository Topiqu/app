// @ts-check
import perfectionist from 'eslint-plugin-perfectionist'

import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  plugins: { perfectionist },
  rules: {
    'vue/no-v-html': 'off',
    'vue/html-self-closing': 'off',
    'vue/attribute-hyphenation': ['error', 'never'],
    'vue/v-on-event-hyphenation': ['error', 'never'],
    'object-shorthand': ['error', 'always'],
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'perfectionist/sort-imports': 'error',
    'vue/require-default-prop': 'off',
  },
  settings: {
    perfectionist: {
      type: 'line-length',
      partitionByComment: true,
    },
  },
})

import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'jsdom',
      },
    },
    globals: true,
    hookTimeout: 30_000,
    exclude: ['tests/e2e/**', '**/.nuxt/**', '**/.output/**', '**/node_modules/**', '**/.git/**'],
  },
})

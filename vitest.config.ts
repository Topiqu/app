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
    maxWorkers: 4,
    hookTimeout: 60_000,
    exclude: ['tests/e2e/**', '**/.nuxt/**', '**/.output/**', '**/node_modules/**', '**/.git/**'],
  },
})

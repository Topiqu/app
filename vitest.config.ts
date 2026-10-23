import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    // Intlify's per-process virtual IDs cannot be restored from persisted importer transforms.
    fsModuleCache: false,
    environment: 'jsdom',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'jsdom',
      },
    },
    globals: true,
    // Each worker isolates a full Nuxt/jsdom graph; leave headroom for the database and native modules.
    maxWorkers: 2,
    hookTimeout: 60_000,
    exclude: ['tests/e2e/**', '**/.nuxt/**', '**/.output/**', '**/node_modules/**', '**/.git/**'],
  },
})

const zod = { from: 'zod', imports: [{ name: 'z', as: 'z' }] }

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@sidebase/nuxt-auth',
    'nuxt-toast',
  ],
  imports: {
    presets: [zod],
    dirs: ['shared/zod/models', 'utils'],
  },
  auth: {
    provider: { type: 'authjs' },
    baseURL: process.env.AUTH_ORIGIN
      ? `${process.env.AUTH_ORIGIN}`
      : 'http://localhost:3000/api/auth',
    originEnvKey: 'AUTH_ORIGIN',
  },
  nitro: {
    preset: 'bun',
    imports: {
      presets: [zod],
      dirs: ['shared/zod/models', 'server/utils'],
    },
  },
  runtimeConfig: {
    authSecret: process.env.AUTH_SECRET || 'placeholder',
  },
})

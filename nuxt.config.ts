const zod = { from: 'zod', imports: [{ name: 'z' }] }
export default defineNuxtConfig({
  compatibilityDate: '2025-07-20',
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
    dirs: ['shared/zod/models', 'utils', '#auth'],
  },
  auth: {
    provider: { type: 'authjs' },
    baseURL: process.env.AUTH_ORIGIN,
    originEnvKey: 'AUTH_ORIGIN',
  },
  nitro: {
    preset: 'bun',
    imports: {
      presets: [
        zod,
        {
          from: '#auth',
          imports: ['getServerSession'],
        },
      ],
      dirs: ['shared/zod/models', 'server/utils', '#auth'],
    },
  },
  runtimeConfig: {
    public: {
      appVersion: '1.0.0 beta',
    },
    authSecret: process.env.AUTH_SECRET,
  },
})

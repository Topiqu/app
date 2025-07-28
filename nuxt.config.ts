const zod = { from: 'zod', imports: [{ name: 'z' }] }

export default defineNuxtConfig({
  compatibilityDate: '2025-07-20',

  devtools: { enabled: true },

  future: { compatibilityVersion: 4 },

  runtimeConfig: {
    public: { appVersion: '1.0.0 beta' },
    openModeratorApiKey: process.env.OPENMODERATOR_API_KEY,
    openAI: process.env.OPENAI_API_KEY,
    authSecret: process.env.AUTH_SECRET,
  },

  nitro: {
    preset: 'bun',
    imports: {
      presets: [zod, { from: '#auth', imports: ['getServerSession'] }],
      dirs: ['shared/zod/models', 'server/utils', '#auth'],
    },
  },

  imports: {
    presets: [zod],
    dirs: ['shared/zod/models', 'utils', '#auth'],
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@sidebase/nuxt-auth',
    'nuxt-nodemailer',
    'nuxt-toast',
  ],

  eslint: { config: { typescript: true } },

  css: ['~/assets/styles/base.scss'],

  auth: {
    provider: { type: 'authjs' },
    baseURL: process.env.AUTH_ORIGIN,
    originEnvKey: 'AUTH_ORIGIN',
  },

  nodemailer: {
    from: `"RASG BLOG" ${process.env.NUXT_MAIL_USER}`,
    service: 'gmail',
    auth: {
      user: process.env.NUXT_MAIL_USER,
      pass: process.env.NUXT_MAIL_PASS,
    },
  },
})

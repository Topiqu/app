export default defineNuxtConfig({
  compatibilityDate: '2025-08-18',

  devtools: { enabled: true },

  future: { compatibilityVersion: 4 },

  runtimeConfig: {
    public: { appVersion: '1.0.0 beta' },
    openModeratorApiKey: process.env.OPENMODERATOR_API_KEY,
    openAI: { apiKey: process.env.OPENAI_API_KEY },
    authSecret: process.env.AUTH_SECRET,
  },

  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      '*/1 * * * *': ['publish:check'],
    },
    preset: 'bun',
    imports: {
      presets: [
        { from: 'zod', imports: [{ name: 'z' }] },
        { from: '#auth', imports: ['getServerSession'] },
      ],
      dirs: ['shared/zod/models', 'server/utils', '#auth'],
    },
  },

  imports: {
    presets: [{ from: 'zod', imports: [{ name: 'z' }] }],
    dirs: ['shared/zod/models', 'utils', '#auth'],
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@pinia/nuxt',
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    '@sidebase/nuxt-auth',
    'pinia-plugin-persistedstate/nuxt',
    'nuxt-nodemailer',
    'nuxt-security',
    'nuxt-toast',
  ],

  security: {
    rateLimiter: {
      interval: 10 * 1000,
      tokensPerInterval: 70,
    },
    headers: {
      referrerPolicy: 'origin',
      contentSecurityPolicy: {
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https://developers.google.com',
          'https://lh3.googleusercontent.com',
          'https://avatars.githubusercontent.com',
          'https://simpleicons.org',
        ],
        'frame-src': ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        'connect-src': ["'self'", 'https:'],
        'script-src': ["'self'", "'unsafe-inline'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      },
    },
    xssValidator: false,
  },

  eslint: { config: { typescript: true } },

  css: ['~/assets/styles/base.scss'],

  auth: {
    provider: { type: 'authjs' },
    baseURL: process.env.AUTH_ORIGIN,
    originEnvKey: 'AUTH_ORIGIN',
  },

  nodemailer: {
    from: `"TOPIQO BLOG" ${process.env.NUXT_MAIL_USER}`,
    service: 'gmail',
    auth: {
      user: process.env.NUXT_MAIL_USER,
      pass: process.env.NUXT_MAIL_PASS,
    },
  },

  image: {
    quality: 90,
    formats: ['avif', 'webp', 'png'],
  },
})

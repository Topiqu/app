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
      '*/1 * * * *': ['publish-check'],
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
    '@nuxtjs/i18n',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxtjs/seo',
    '@pinia/nuxt',
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    '@sidebase/nuxt-auth',
    '@vite-pwa/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    'nuxt-nodemailer',
    'nuxt-security',
    'nuxt-toast',
  ],
  site: {
    url: 'https://topiqu.com',
    name: 'Topiqu AI Blog',
    description: 'Moderní blogovací platforma poháněná AI',
    defaultLocale: 'cs',
    indexable: true,
    // multiTenancy: {},
  },
  seo: {},
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Topiqu AI Blog',
      short_name: 'Topiqu',
      description: 'Moderní blogovací platforma poháněná AI',
      theme_color: '#2d5ebc',
      // icons: [
      //   {
      //     src: '/icons/icon-192x192.png',
      //     sizes: '192x192',
      //     type: 'image/png',
      //   },
      //   {
      //     src: '/icons/icon-512x512.png',
      //     sizes: '512x512',
      //     type: 'image/png',
      //   },
      // ],
    },
    workbox: {
      runtimeCaching: [
        {
          urlPattern: 'https://topiqu.com/.*',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 86400,
            },
          },
        },
      ],
    },
  },
  i18n: {
    locales: [
      {
        code: 'en',
        iso: 'en-US',
        name: 'EN',
        file: 'en.json',
      },
      {
        code: 'cs',
        iso: 'cs-CZ',
        name: 'CZ',
        file: 'cs.json',
      },
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      redirectOn: 'root',
      fallbackLocale: 'en',
    },
    compilation: {
      strictMessage: false,
      escapeHtml: false,
    },
  },
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
    from: `"TOPIQU BLOG" ${process.env.NUXT_MAIL_USER}`,
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

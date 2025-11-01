export default defineNuxtConfig({
  compatibilityDate: '2025-10-19',

  devtools: { enabled: true },

  runtimeConfig: {
    public: { appVersion: '1.0.0 beta' },
    openModerator: { apiKey: process.env.OPENMODERATOR_API_KEY },
    xai: { apiKey: process.env.XAI_API_KEY },
    auth: { secret: process.env.AUTH_SECRET },
  },

  $production: {
    nitro: {
      preset: 'vercel',
    },
  },

  nitro: {
    experimental: {
      tasks: true,
      asyncContext: true,
    },
    scheduledTasks: {
      '*/1 * * * *': ['publish-check'],
      '0 15 * * *': ['generate-article'],
    },
    preset: 'bun',
    imports: {
      presets: [
        { from: 'zod', imports: [{ name: 'z' }] },
        { from: '#auth', imports: ['getServerSession'] },
      ],
      dirs: ['shared/zod/models', 'server/utils', '#auth'],
    },
    serverAssets: [{ baseName: 'templates', dir: '../emails/templates' }],
  },

  imports: {
    presets: [{ from: 'zod', imports: [{ name: 'z' }] }],
    dirs: ['shared/zod/models', 'utils', '#auth', 'server/shared/consts'],
  },
  vite: {
    resolve: {
      alias: {
        '.prisma/client/index-browser': './node_modules/@prisma/client/index-browser.js',
      },
    },
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
    'nuxt-qrcode',
    'nuxt-gtag',
  ],

  typescript: { tsConfig: { include: ['../types/**/*.d.ts', '../server/tasks/**/*.ts'] } },

  eslint: { config: { typescript: true } },

  css: ['~/assets/styles/base.scss'],

  auth: {
    provider: { type: 'authjs' },
    baseURL: process.env.AUTH_ORIGIN,
    originEnvKey: 'AUTH_ORIGIN',
  },

  image: {
    quality: 90,
    formats: ['avif', 'webp', 'png'],
  },

  nodemailer: {
    from: `"TOPIQU BLOG" ${process.env.NUXT_MAIL_USER}`,
    service: 'gmail',
    auth: {
      user: process.env.NUXT_MAIL_USER,
      pass: process.env.NUXT_MAIL_PASS,
    },
  },

  qrcode: {
    options: {
      variant: 'pixelated',
      radius: 1,
      blackColor: 'currentColor',
      whiteColor: 'transparent',
    },
  },

  security: {
    rateLimiter: {
      interval: 10 * 1000,
      tokensPerInterval: 70,
    },
    headers: {
      referrerPolicy: 'origin',
      xFrameOptions: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: 'unsafe-none',
      contentSecurityPolicy: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'frame-src': ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        'connect-src': [
          "'self'",
          'https:',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://api.giphy.com',
        ],
        'frame-ancestors': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          'blob:',
          'data:',
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
        ],
      },
    },
    xssValidator: false,
  },

  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', name: 'EN', file: 'en.json' },
      { code: 'cs', iso: 'cs-CZ', name: 'CZ', file: 'cs.json' },
    ],
    vueI18n: './i18n/i18n.config.ts',
    defaultLocale: 'en',
    strategy: 'prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_lang',
      cookieSecure: true,
      cookieCrossOrigin: true,
      redirectOn: 'root',
      alwaysRedirect: true,
      fallbackLocale: 'en',
    },
    compilation: {
      strictMessage: false,
      escapeHtml: false,
    },
    customRoutes: 'config',
    pages: {
      'clanky-slug': {
        cs: '/clanky/[slug]',
        en: '/articles/[slug]',
      },
      'autor-name': {
        cs: '/autor/[name]',
        en: '/author/[name]',
      },
      uzivatel: {
        cs: '/uzivatel',
        en: '/user',
      },
      'stitky-slug': {
        cs: '/stitky/[slug]',
        en: '/tags/[slug]',
      },
      autorizace: {
        cs: '/autorizace',
        en: '/auth',
      },
    },
  },

  site: {
    url: 'https://topiqu.com',
    name: 'Topiqu AI Blog',
    description: 'Moderní blogovací platforma poháněná AI',
    defaultLocale: 'cs',
    indexable: true,
  },

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
          urlPattern: /^https:\/\/topiqu\.com\/.*$/,
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
})

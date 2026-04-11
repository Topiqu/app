export default defineNuxtConfig({
  compatibilityDate: '2025-11-02',

  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      appVersion: '1.0.0 beta',
      cdnUrl: process.env.CDN_URL || 'https://cdn.topiqu.com',
    },
    openModerator: { apiKey: process.env.OPENMODERATOR_API_KEY },
    xai: { apiKey: process.env.XAI_API_KEY },
    auth: { secret: process.env.AUTH_SECRET },
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsRegion: '',
    awsS3BucketName: '',
    cdnUrl: '',
  },

  $production: {
    nitro: {
      preset: 'vercel',
    },
  },
  app: {
    head: {
      meta: [{ name: 'google-adsense-account', content: 'ca-pub-9286243311790870' }],
      script: [
        {
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9286243311790870',
          async: true,
          crossorigin: 'anonymous',
        },
      ],
    },
  },
  nitro: {
    experimental: {
      tasks: true,
      asyncContext: true,
    },
    scheduledTasks: {
      '*/10 * * * *': ['publish-check'],
      '0 15 * * *': ['generate-article'],
      '*/30 * * * *': ['sentiment-analysis'],
      '0 3 * * * *': ['community-insights'],
    },
    preset: 'bun',
    imports: {
      presets: [
        { from: 'zod', imports: [{ name: 'z' }] },
        { from: '#auth', imports: ['getServerSession'] },
      ],
      dirs: ['shared/zod/models', 'server/utils', '#auth'],
    },
    // externals: {
    //   trace: false,
    //   external: ['sharp'],
    // },
    serverAssets: [
      { baseName: 'emails:locales', dir: '../emails/locales' },
      { baseName: 'emails:templates', dir: '../emails/templates' },
      { baseName: 'i18n:locales', dir: '../i18n/locales' },
    ],
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
    '@unlok-co/nuxt-stripe',
    'pinia-plugin-persistedstate/nuxt',
    'nuxt-nodemailer',
    'nuxt-security',
    'nuxt-og-image',
    'nuxt-toast',
    'nuxt-qrcode',
    'nuxt-gtag',
  ],
  ogImage: {
    debug: process.env.NODE_ENV === 'development',
    runtimeCacheStorage: true,
  },
  image: {
    quality: 90,
    format: ['avif', 'webp', 'png'],
    domains: ['cdn.topiqu.com', 'topiqu-storage-eu-frankfurt.s3.eu-central-1.amazonaws.com', 'wsrv.nl'],
  },

  typescript: {
    tsConfig: {
      include: ['../types/**/*.d.ts', '../server/tasks/**/*.ts'],
      compilerOptions: {
        types: ['@types/google-publisher-tag'],
      },
    },
  },

  eslint: { config: { typescript: true } },

  css: ['~/assets/styles/base.scss'],

  stripe: {
    client: { key: process.env.STRIPE_PK, options: { locale: 'cs' } },
    server: { key: process.env.STRIPE_SK },
  },

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
        'img-src': ["'self'", 'data:', 'blob:', 'https:', 'https://wsrv.nl'],
        'frame-src': [
          "'self'",
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://googleads.g.doubleclick.net',
          'https://tpc.googlesyndication.com',
          'https://www.google.com',
          'https://fundingchoicesmessages.google.com',
          'https://pagead2.googlesyndication.com',
          'https://ep2.adtrafficquality.google',
        ],
        'connect-src': [
          "'self'",
          'https:',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://api.giphy.com',
          'https://wsrv.nl',
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
          'https://pagead2.googlesyndication.com',
          'https://tpc.googlesyndication.com',
          'https://adservice.google.com',
          'https://fundingchoicesmessages.google.com',
          'https://ep2.adtrafficquality.google',
        ],
      },
    },
    xssValidator: false,
  },
  routeRules: {
    '/__og-image__/**': { security: { xssValidator: false, headers: false } },
    '/**/__og-image__/**': { security: { xssValidator: false, headers: false } },
    '/cs/clanky/**': { security: { xssValidator: false } },
    '/en/articles/**': { security: { xssValidator: false } },
  },
  i18n: {
    langDir: 'locales/',
    locales: [
      { code: 'en', iso: 'en-US', name: 'EN', files: ['en.json', 'master_en.json'] },
      { code: 'cs', iso: 'cs-CZ', name: 'CZ', files: ['cs.json', 'master_cs.json'] },
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
      'oauth-start': {
        cs: '/oauth-start',
        en: '/oauth-start',
      },
    },
  },

  site: {
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

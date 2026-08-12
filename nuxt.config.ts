import { IMAGE_HOSTS } from './shared/utils/imageHosts'
import { AI_GROUNDING_TOKENS, ANSWER_ENGINE_BOTS } from './shared/utils/crawlers'

const APP_ENV = process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
const IS_PROD = APP_ENV === 'production'

const CONSENT_REGIONS = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
]

const CONSENT_DEFAULT = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500,
  region: CONSENT_REGIONS,
} as const

// Signed-in surfaces. `@nuxtjs/robots` emits each one again under every locale prefix, so they
// are listed bare. Crawl budget, not access — auth middleware already turns these away.
const PRIVATE_PATHS = [
  '/api/',
  '/admin',
  '/settings',
  '/master',
  '/drafts',
  '/uzivatel',
  '/user',
  '/autorizace',
  '/auth',
  '/oauth-start',
]

/** Headroom for crawler bursts on the public read surfaces, over the global 70 / 10 s. */
const CRAWL_LIMIT = { tokensPerInterval: 300, interval: 10 * 1000 }

export default defineNuxtConfig({
  compatibilityDate: '2026-05-21',

  devtools: { enabled: true },
  experimental: {
    typedPages: true,
  },
  build: {
    transpile: ['html-encoding-sniffer', '@exodus/bytes'],
  },
  runtimeConfig: {
    public: {
      appVersion: '1.0.0',
      appEnv: APP_ENV,
      cdnUrl: process.env.CDN_URL || 'https://cdn.topiqu.com',
      baseDomain: process.env.BASE_DOMAIN || 'topiqu.com',
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
        environment: APP_ENV,
        tracesSampleRate: IS_PROD ? 0.2 : 1.0,
        replaysSessionSampleRate: IS_PROD ? 0.1 : 0,
      },
    },
    turnstile: { secretKey: process.env.TURNSTILE_SECRET_KEY || '' },
    openAi: { apiKey: process.env.OPENAI_API_KEY },
    auth: { secret: process.env.AUTH_SECRET },
    email: {
      from: process.env.EMAIL_FROM || `"TOPIQU BLOG" <${process.env.NUXT_MAIL_USER}>`,
    },
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    awsRegion: process.env.AWS_REGION || 'eu-central-1',
    awsS3BucketName: process.env.AWS_S3_BUCKET_NAME || '',
  },

  app: {
    head: {
      meta: [{ name: 'google-adsense-account', content: 'ca-pub-9731440718321055' }],
      script: [
        {
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9731440718321055',
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
      '0 3 * * *': ['community-insights'],
      '*/5 * * * *': ['translate-pending'],
      '0 4 * * *': ['gam-sync'],
      '15 4 * * *': ['search-console-sync'],
      '30 4 * * *': ['domain-reverification'],
      '0 5 * * *': ['trial-expiry'],
    },
    preset: 'bun',
    imports: {
      presets: [
        { from: 'zod', imports: [{ name: 'z' }] },
        { from: '#auth', imports: ['getServerSession'] },
      ],
      dirs: ['shared/zod/models', 'server/utils', '#auth'],
    },
    externals: {
      // ultrahtml: the tracer copies only dist/index.js, so nuxt-og-image's
      // `ultrahtml/selector` import 500s every /_og/ route at runtime.
      inline: ['html-encoding-sniffer', '@exodus/bytes', 'ultrahtml'],
    },
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
    '@pinia/colada-nuxt',
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    '@sidebase/nuxt-auth',
    '@vite-pwa/nuxt',
    '@unlok-co/nuxt-stripe',
    'pinia-plugin-persistedstate/nuxt',
    'nuxt-security',
    'nuxt-og-image',
    'nuxt-toast',
    'nuxt-qrcode',
    'nuxt-gtag',
    '@sentry/nuxt/module',
  ],

  gtag: {
    initCommands: [['consent', 'default', { ...CONSENT_DEFAULT }]],
  },

  sentry: {
    // Without this the server SDK never initializes and only browser errors reach Better Stack.
    // The documented alternative is `--import ./server/sentry.server.config.mjs` at startup, which
    // is a Node flag — the container entrypoint is `bun --bun server/index.mjs`. Costs us
    // db/native-module tracing spans (http traces and errors still arrive); do not add `--import`
    // alongside it or the SDK initializes twice.
    autoInjectServerSentry: 'top-level-import',
    sourceMapsUploadOptions: {
      url: process.env.SENTRY_URL,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },

  sitemap: {
    // Route discovery only finds the app-shell pages, which is exactly what no blog should list.
    excludeAppSources: true,
    // The source emits locale prefixes and alternates itself, from the PUBLISHED translations.
    autoI18n: false,
    sources: ['/api/__sitemap__/urls'],
    cacheMaxAgeSeconds: 600,
  },

  // Naming the answer engines makes the stance reviewable and applies the private-path list; the
  // wildcard group already allows them. Training crawlers inherit `*` — that is a product call.
  robots: {
    disallow: PRIVATE_PATHS,
    groups: [
      { userAgent: [...ANSWER_ENGINE_BOTS], allow: ['/'], disallow: PRIVATE_PATHS },
      { userAgent: [...AI_GROUNDING_TOKENS], allow: ['/'] },
    ],
  },

  sourcemap: { client: 'hidden' },
  ogImage: {
    debug: process.env.NODE_ENV === 'development',
    runtimeCacheStorage: true,
  },
  image: {
    quality: 90,
    format: ['avif', 'webp', 'png'],
    domains: [...IMAGE_HOSTS],
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
    provider: { type: 'authjs', trustHost: true },
    originEnvKey: 'AUTH_ORIGIN',
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
          'https://challenges.cloudflare.com',
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
          'https://challenges.cloudflare.com',
        ],
      },
    },
    xssValidator: false,
  },
  routeRules: {
    '/manifest.webmanifest': { headers: { 'content-type': 'application/manifest+json' } },
    '/sitemap.xml': { headers: { 'content-type': 'application/xml' }, security: { rateLimiter: CRAWL_LIMIT } },
    '/robots.txt': { security: { rateLimiter: CRAWL_LIMIT } },
    '/llms.txt': { security: { rateLimiter: CRAWL_LIMIT } },
    '/rss.xml': { security: { rateLimiter: CRAWL_LIMIT } },
    '/__og-image__/**': { security: { xssValidator: false, headers: false } },
    '/**/__og-image__/**': { security: { xssValidator: false, headers: false } },
    // A crawler works through a sitemap in bursts. At the global 70 requests / 10 s it starts
    // collecting 429s partway down the list, and the pages behind them silently never get indexed.
    '/cs/clanky/**': { security: { xssValidator: false, rateLimiter: CRAWL_LIMIT } },
    '/en/articles/**': { security: { xssValidator: false, rateLimiter: CRAWL_LIMIT } },
    '/api/onboarding/send-code': {
      security: { rateLimiter: { tokensPerInterval: 5, interval: 60 * 60 * 1000 } },
    },
    '/api/onboarding/verify-code': {
      security: { rateLimiter: { tokensPerInterval: 10, interval: 60 * 60 * 1000 } },
    },
    '/api/auth/callback/credentials': {
      security: { rateLimiter: { tokensPerInterval: 10, interval: 60 * 1000 } },
    },
    '/api/users/totp': {
      security: { rateLimiter: { tokensPerInterval: 10, interval: 60 * 1000 } },
    },
  },
  i18n: {
    langDir: 'locales/',
    locales: [
      {
        code: 'en',
        iso: 'en-US',
        name: 'EN',
        files: [
          'en/common.json',
          'en/series.json',
          'en/feedback.json',
          'en/seo.json',
          'en/articles.json',
          'en/emoji.json',
          'en/stats.json',
          'en/profile.json',
          'en/languages.json',
          'en/themes.json',
          'en/legal.json',
          'en/admin.json',
          'en/domainVerification.json',
          'master_en.json',
        ],
      },
      {
        code: 'cs',
        iso: 'cs-CZ',
        name: 'CZ',
        files: [
          'cs/common.json',
          'cs/series.json',
          'cs/feedback.json',
          'cs/seo.json',
          'cs/articles.json',
          'cs/emoji.json',
          'cs/stats.json',
          'cs/profile.json',
          'cs/languages.json',
          'cs/themes.json',
          'cs/legal.json',
          'cs/admin.json',
          'cs/domainVerification.json',
          'master_cs.json',
        ],
      },
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
      tos: {
        cs: '/obchodni-podminky',
        en: '/terms-of-service',
      },
      privacy: {
        cs: '/ochrana-soukromi',
        en: '/privacy-policy',
      },
    },
  },

  // Platform fallback; `server/plugins/siteConfig.ts` swaps in the tenant's own per request.
  // `defaultLocale` must agree with `i18n.defaultLocale` or the two disagree on `x-default`.
  site: {
    name: 'Topiqu AI Blog',
    description: 'Moderní blogovací platforma poháněná AI',
    defaultLocale: 'en',
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

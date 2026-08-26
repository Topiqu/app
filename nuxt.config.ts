import { createRequire } from 'node:module'
import { defineNuxtModule } from 'nuxt/kit'

import { IMAGE_HOSTS } from './shared/utils/imageHosts'
import { AI_GROUNDING_TOKENS, ANSWER_ENGINE_BOTS } from './shared/utils/crawlers'

const APP_ENV = process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
const IS_PROD = APP_ENV === 'production'
const IS_BROWSER_TEST = Boolean(process.env.TEST_DATABASE_URL)
const IS_UNIT_TEST = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)
const USE_PRODUCTION_SECURITY = IS_PROD && !IS_BROWSER_TEST
const SITE_URL = (() => {
  try {
    return new URL(process.env.NUXT_PUBLIC_SITE_URL || 'https://topiqu.com').origin
  } catch {
    return 'https://topiqu.com'
  }
})()

// Nuxt 4.4 ships its Volar plugins with its private Vue Router 5 dependency,
// while the application intentionally keeps Vue Router 4 as its public runtime API.
const requireFromNuxt = createRequire(createRequire(import.meta.url).resolve('nuxt/package.json'))
const routerVolarPlugins = {
  'vue-router/volar/sfc-route-blocks': requireFromNuxt.resolve('vue-router/volar/sfc-route-blocks'),
  'vue-router/volar/sfc-typed-router': requireFromNuxt.resolve('vue-router/volar/sfc-typed-router'),
}
const routerVolarBridge = defineNuxtModule({
  meta: { name: 'topiqu-router-volar-bridge' },
  setup(_options, nuxt) {
    nuxt.hook('modules:done', () => {
      nuxt.hook('prepare:types', ({ tsConfig }) => {
        const plugins = tsConfig.vueCompilerOptions?.plugins
        if (!plugins) return

        tsConfig.vueCompilerOptions!.plugins = plugins.map((plugin) => {
          if (typeof plugin === 'string') return routerVolarPlugins[plugin as keyof typeof routerVolarPlugins] ?? plugin
          if (plugin && typeof plugin === 'object' && 'name' in plugin) {
            const name = String(plugin.name)
            const resolved = routerVolarPlugins[name as keyof typeof routerVolarPlugins]
            return resolved ? { ...plugin, name: resolved } : plugin
          }
          return plugin
        })
      })
    })
  },
})

const CONSENT_DEFAULT = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500,
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

  devtools: { enabled: !IS_BROWSER_TEST },
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
      browserTest: IS_BROWSER_TEST,
      cdnUrl: process.env.CDN_URL || 'https://cdn.topiqu.com',
      baseDomain: process.env.BASE_DOMAIN || 'topiqu.com',
      baseUrl: SITE_URL,
      adsensePublisherId: process.env.NUXT_PUBLIC_ADSENSE_PUBLISHER_ID || 'ca-pub-9731440718321055',
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
        environment: APP_ENV,
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

  nitro: {
    experimental: {
      tasks: true,
      asyncContext: true,
    },
    scheduledTasks: IS_PROD
      ? {
          '*/10 * * * *': ['publish-check'],
          '0 15 * * *': ['generate-article'],
          '*/30 * * * *': ['sentiment-analysis'],
          '0 3 * * *': ['community-insights'],
          '*/5 * * * *': ['translate-pending'],
          '0 4 * * *': ['gam-sync'],
        }
      : undefined,
    preset: 'bun',
    imports: {
      presets: [{ from: '#auth', imports: ['getServerSession'] }],
      dirs: ['shared/zod/models', 'server/utils', '#auth'],
    },
    externals: {
      inline: [
        'html-encoding-sniffer',
        '@exodus/bytes',
        'uncrypto',
        '@upstash/redis',
        'vue',
        '@vue/server-renderer',
        'unhead',
      ],
    },
    serverAssets: [
      { baseName: 'emails:locales', dir: '../emails/locales' },
      { baseName: 'emails:templates', dir: '../emails/templates' },
      { baseName: 'i18n:locales', dir: '../i18n/locales' },
    ],
  },

  imports: {
    dirs: ['shared/zod/models', 'utils', '#auth', 'server/shared/consts'],
  },
  vite: {
    optimizeDeps: {
      include: ['@fingerprintjs/fingerprintjs', 'chart.js', 'fast-deep-equal', 'vue-chartjs', 'vue-qrcode-reader'],
    },
    resolve: {
      alias: {
        '.prisma/client/index-browser': './node_modules/@prisma/client/index-browser.js',
      },
    },
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxtjs/seo',
    '@pinia/nuxt',
    '@pinia/colada-nuxt',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    '@sidebase/nuxt-auth',
    '@vite-pwa/nuxt',
    '@unlok-co/nuxt-stripe',
    'pinia-plugin-persistedstate/nuxt',
    'nuxt-security',
    'nuxt-qrcode',
    'nuxt-gtag',
    '@sentry/nuxt/module',
    routerVolarBridge,
  ],

  gtag: {
    initMode: 'manual',
    config: { cookie_domain: 'none' },
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
    enabled: IS_PROD,
    debug: process.env.NODE_ENV === 'development',
    runtimeCacheStorage: true,
  },
  image: {
    quality: 82,
    format: ['avif', 'webp', 'png'],
    domains: [...IMAGE_HOSTS],
    ipx: {
      // CDN article keys are timestamped/unique, so transformed variants are immutable too.
      http: { maxAge: 31_536_000, ignoreCacheControl: true },
      // Local public assets keep a shorter TTL because their URL is not content-hashed.
      fs: { maxAge: 86_400 },
    },
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

  css: ['~/assets/styles/main.css'],

  icon: {
    provider: 'none',
    clientBundle: {
      icons: [
        'mdi:arrow-down',
        'mdi:check-all',
        'mdi:chevron-down',
        'mdi:chevron-double-left',
        'mdi:chevron-double-right',
        'mdi:chevron-left',
        'mdi:chevron-right',
        'mdi:chevron-up',
        'mdi:dots-horizontal',
        'mdi:file-outline',
        'mdi:folder-open-outline',
        'mdi:folder-outline',
        'mdi:format-align-center',
        'mdi:format-align-justify',
        'mdi:format-align-left',
        'mdi:format-align-right',
        'mdi:lightbulb-outline',
        'mdi:monitor',
        'mdi:open-in-new',
        'mdi:page-layout-sidebar-left',
        'mdi:pound',
        'mdi:upload',
        'mdi:weather-night',
        'mdi:weather-sunny',
      ],
      scan: true,
    },
  },

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'topiqu-color-mode',
  },

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
    // Sentry injects per-build debug IDs after Vite has named hashed chunks. SRI can therefore
    // bind SSR HTML to a different body served under the same chunk URL across deployments.
    sri: false,
    rateLimiter: {
      interval: 10 * 1000,
      tokensPerInterval: IS_BROWSER_TEST ? 10_000 : 300,
    },
    headers: {
      referrerPolicy: 'origin',
      xFrameOptions: false,
      strictTransportSecurity: USE_PRODUCTION_SECURITY ? { maxAge: 15_552_000, includeSubdomains: true } : false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: 'unsafe-none',
      contentSecurityPolicy: {
        'upgrade-insecure-requests': USE_PRODUCTION_SECURITY,
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
        // Nuxt Image uses this fixed handler to replay image failures that happen
        // before hydration. Permit only that exact inline attribute, not arbitrary
        // inline event handlers.
        'script-src-attr': ["'unsafe-hashes'", "'sha256-bwK6T5wZVTANitXbrTsel7kl/PyCjCd/Dq5Qoz3imjM='"],
      },
    },
    xssValidator: false,
  },
  routeRules: {
    // A service worker must revalidate on every navigation/deploy; caching this file can leave
    // clients controlled by an obsolete Workbox routing table for hours.
    '/sw.js': { headers: { 'cache-control': 'no-cache, no-store, must-revalidate' } },
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
      security: { rateLimiter: { tokensPerInterval: IS_BROWSER_TEST ? 10_000 : 10, interval: 60 * 1000 } },
    },
    '/api/users/totp': {
      security: { rateLimiter: { tokensPerInterval: 10, interval: 60 * 1000 } },
    },
  },
  i18n: {
    baseUrl: SITE_URL,
    langDir: 'locales/',
    locales: [
      {
        code: 'en',
        language: 'en-US',
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
        language: 'cs-CZ',
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
    vueI18n: './i18n.config.ts',
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
    url: SITE_URL,
    name: 'Topiqu AI Blog',
    description: 'Moderní blogovací platforma poháněná AI',
    defaultLocale: 'en',
    indexable: true,
  },

  pwa: {
    disable: IS_UNIT_TEST,
    client: { registerPlugin: !IS_UNIT_TEST },
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
      // This is an SSR application, not an app-shell build. `/` is intentionally absent from
      // precache, so Workbox must let navigations reach Nitro instead of binding them to `/`.
      navigateFallback: null,
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

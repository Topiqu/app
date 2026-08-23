import * as Sentry from '@sentry/nuxt'

// This file is prepended as the very first import of the Nitro server entry (`autoInjectServerSentry`
// in nuxt.config), so it runs before Nitro exists: `useRuntimeConfig()` here throws and kills the
// process on boot. Read the environment directly — these mirror `runtimeConfig.public.sentry`,
// which is built from the same variables. Empty DSN disables the SDK.
const APP_ENV = process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'

Sentry.init({
  dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || undefined,
  environment: APP_ENV,
  tracesSampleRate: APP_ENV === 'production' ? 0.2 : 1.0,
})

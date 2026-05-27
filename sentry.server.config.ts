import * as Sentry from '@sentry/nuxt'

// Sentry SDK. Empty DSN disables the SDK.
const config = useRuntimeConfig()

Sentry.init({
  dsn: config.public.sentry.dsn || undefined,
  environment: config.public.sentry.environment,
  tracesSampleRate: config.public.sentry.tracesSampleRate,
})

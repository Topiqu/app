import * as Sentry from '@sentry/nuxt'

// Sentry SDK. Empty DSN disables the SDK.
const config = useRuntimeConfig()
const replayIntegration =
  'replayIntegration' in Sentry && typeof Sentry.replayIntegration === 'function'
    ? Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })
    : null

Sentry.init({
  dsn: config.public.sentry.dsn || undefined,
  environment: config.public.sentry.environment,
  tracesSampleRate: config.public.sentry.tracesSampleRate,
  replaysSessionSampleRate: config.public.sentry.replaysSessionSampleRate,
  replaysOnErrorSampleRate: 1.0,
  // Do not leak user content into replays. Server-side test environments do not expose the browser-only integration.
  integrations: replayIntegration ? [replayIntegration] : [],
})

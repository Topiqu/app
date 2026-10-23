import * as Sentry from '@sentry/nuxt'

import { scrubAuthEvent } from './shared/utils/authTelemetry'
import { telemetryPrivacy } from './shared/utils/telemetryPrivacy'
import { scrubDomainTelemetry } from './server/utils/domainTelemetry'

// The SDK bundles this initializer into Nitro startup. It must also work before a Nitro context
// exists: useRuntimeConfig() can kill startup there. These environment values mirror public.sentry.
// Empty DSN disables the SDK.
const APP_ENV = process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'

Sentry.init({
  ...telemetryPrivacy,
  dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || undefined,
  environment: APP_ENV,
  tracesSampleRate: APP_ENV === 'production' ? 0.2 : 1.0,
  integrations: [Sentry.requestDataIntegration({ include: { data: false } })],
  beforeSend: (event) => {
    scrubAuthEvent(event)
    scrubDomainTelemetry(event)
    return event
  },
  beforeSendTransaction: (event) => {
    scrubAuthEvent(event)
    if (scrubDomainTelemetry(event)) for (const span of event.spans ?? []) span.data = {}
    return event
  },
})

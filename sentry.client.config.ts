import * as Sentry from '@sentry/nuxt'

import { scrubWebVitalMetric } from './shared/utils/webVitals'
import { telemetryPrivacy } from './shared/utils/telemetryPrivacy'
import { scrubAuthEvent, scrubAuthTransferBreadcrumb } from './shared/utils/authTelemetry'

// Sentry SDK. Empty DSN disables the SDK.
const config = useRuntimeConfig()

Sentry.init({
  ...telemetryPrivacy,
  dsn: config.public.sentry.dsn || undefined,
  environment: config.public.sentry.environment,
  beforeSend: (event) => scrubAuthEvent(event),
  beforeSendTransaction: (event) => scrubAuthEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubAuthTransferBreadcrumb(breadcrumb),
  beforeSendMetric: (metric) => scrubWebVitalMetric(metric),
})

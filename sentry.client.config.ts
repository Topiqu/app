import * as Sentry from '@sentry/nuxt'

import { scrubAuthTransferBreadcrumb } from './shared/utils/authTelemetry'

// Sentry SDK. Empty DSN disables the SDK.
const config = useRuntimeConfig()

Sentry.init({
  dsn: config.public.sentry.dsn || undefined,
  environment: config.public.sentry.environment,
  beforeBreadcrumb: (breadcrumb) => scrubAuthTransferBreadcrumb(breadcrumb),
})

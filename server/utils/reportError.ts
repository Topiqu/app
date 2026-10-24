import * as Sentry from '@sentry/nuxt'

import { logErrorDetails, sanitizeLogContext, sanitizeLogText } from './logging'

/**
 * A failure that was caught and handled on purpose. Neither Better Stack channel finds these by
 * itself: Sentry only auto-captures what escapes a handler, and `plugins/errorLogging.ts` only sees
 * what Nitro turns into a 5xx. So anything deliberately swallowed — a best-effort fallback, or a
 * streamed response that has already committed to its 200 and cannot become a 5xx afterwards — is
 * invisible in production unless it is reported here.
 */
export const reportCaughtError = async (message: string, error: unknown, context?: Record<string, unknown>) => {
  const details = logErrorDetails(error)
  const safeError = new Error(String(details.message))
  safeError.name = String(details.name ?? 'Error')
  if (typeof details.stack === 'string') safeError.stack = details.stack
  const safeContext = sanitizeLogContext(context ?? {})
  const safeMessage = sanitizeLogText(message)
  try {
    Sentry.captureException(safeError, { extra: { ...safeContext, message: safeMessage } })
  } catch {
    // The independent logger still records the original failure below.
  }

  try {
    await logger.error(safeMessage, { ...safeContext, error: details })
  } catch {
    // Reporting must not fail an operation whose original error was already handled.
    console.error(
      JSON.stringify({
        level: 'error',
        source: 'logging',
        message: 'Error reporting unavailable',
        operation: safeMessage,
      }),
    )
  }
}

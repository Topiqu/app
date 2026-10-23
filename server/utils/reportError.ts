import * as Sentry from '@sentry/nuxt'

/**
 * A failure that was caught and handled on purpose. Neither Better Stack channel finds these by
 * itself: Sentry only auto-captures what escapes a handler, and `plugins/errorLogging.ts` only sees
 * what Nitro turns into a 5xx. So anything deliberately swallowed — a best-effort fallback, or a
 * streamed response that has already committed to its 200 and cannot become a 5xx afterwards — is
 * invisible in production unless it is reported here.
 */
export const reportCaughtError = async (message: string, error: unknown, context?: Record<string, unknown>) => {
  try {
    Sentry.captureException(error, { extra: { message, ...context } })
  } catch {
    // The independent logger still records the original failure below.
  }

  try {
    await logger.error(message, {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  } catch {
    // Reporting must not fail an operation whose original error was already handled.
    console.error('[error reporting] Logger unavailable', { message })
  }
}

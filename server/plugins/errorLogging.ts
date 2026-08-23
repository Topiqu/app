// Nitro answers a thrown error with its own 500 and stops — nothing reported unhandled throws,
// so a broken handler was only visible as a generic "Server Error" in the browser. Sentry covers
// error *tracking*; this puts the same failure in Better Stack Logs next to the cron and audit
// lines, with the request context that makes it findable.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', async (error, { event }) => {
    // 4xx are `createError` doing its job (401s, validation) — logging them buries the real ones.
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    if (statusCode < 500) return

    await logger.error(`${event?.method ?? '?'} ${event?.path ?? '?'} → ${statusCode}`, {
      source: 'nitro',
      method: event?.method,
      path: event?.path,
      statusCode,
      error: error.message,
      stack: error.stack,
    })
  })
})

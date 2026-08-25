// Nitro answers a thrown error with its own 500 and stops — nothing reported unhandled throws,
// so a broken handler was only visible as a generic "Server Error" in the browser. Sentry covers
// error *tracking*; this puts the same failure in Better Stack Logs next to the cron and audit
// lines, with the request context that makes it findable.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', async (error, { event }) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    const method = event?.method ?? '?'
    // Never log the query string: auth callbacks and invitation routes can carry secrets there.
    const path = event ? getRequestURL(event).pathname : '?'

    // Most 4xx responses are expected client input. A 403 is different: it marks an authorization
    // boundary and is valuable when a valid public page is accidentally treated as tenant-private.
    if (statusCode === 403) {
      await logger.warn(`${method} ${path} → ${statusCode}`, {
        source: 'nitro',
        method,
        path,
        statusCode,
        error: error.message,
      })
      return
    }
    if (statusCode < 500) return

    await logger.error(`${method} ${path} → ${statusCode}`, {
      source: 'nitro',
      method,
      path,
      statusCode,
      error: error.message,
      stack: error.stack,
    })
  })
})

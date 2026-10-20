/** Liveness does not turn a temporary dependency outage into a restart loop. */
export default defineEventHandler(() => ({ status: 'ok' }))

export default defineEventHandler(async (event) => {
  let db: boolean
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Readiness timeout')), 4000)
      }),
    ])
    db = true
  } catch {
    db = false
  } finally {
    clearTimeout(timeout)
  }

  if (!db) setResponseStatus(event, 503)

  return {
    status: db ? 'ok' : 'degraded',
    db,
    version: useRuntimeConfig().public.appVersion,
    timestamp: new Date().toISOString(),
  }
})

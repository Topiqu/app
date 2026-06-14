export default defineEventHandler(async (event) => {
  let db = false
  try {
    await prisma.$queryRaw`SELECT 1`
    db = true
  } catch {
    db = false
  }

  if (!db) setResponseStatus(event, 503)

  return {
    status: db ? 'ok' : 'degraded',
    db,
    version: useRuntimeConfig().public.appVersion,
    timestamp: new Date().toISOString(),
  }
})

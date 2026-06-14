export default defineEventHandler(async () => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const started = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { db: true, latency: Date.now() - started }
  } catch {
    return { db: false, latency: Date.now() - started }
  }
})

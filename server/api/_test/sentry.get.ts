export default defineEventHandler(() => {
  if (useRuntimeConfig().public.appEnv === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  throw new Error('Sentry server-side verification error')
})

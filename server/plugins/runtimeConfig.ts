export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production' || process.env.TEST_DATABASE_URL) return
  for (const key of ['DATABASE_URL', 'AUTH_SECRET'] as const) {
    if (!process.env[key]?.trim()) throw new Error(`Required runtime configuration is missing: ${key}`)
  }
  if (process.env.AUTH_SECRET!.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters')
})

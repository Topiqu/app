export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantScope(event, 'TENANT_SETTINGS')
  const { q, locale } = getQuery(event)
  const query = typeof q === 'string' ? q.trim().slice(0, 100) : ''
  if (query.length < 2) return { places: [] }
  // Nominatim allows about one request a second for the whole app.
  if (!(await consumeRateLimit(`widget:places:${membership.clientSiteId}`, 20, 60)))
    throw createError({ statusCode: 429, message: 'Too many place searches' })
  const language = typeof locale === 'string' && /^[a-z]{2}$/.test(locale) ? locale : 'en'
  return { places: await searchPlaces(query, language) }
})

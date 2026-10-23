import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  const clientSiteId = user.clientSiteId!
  if (user.role !== 'superadmin') await requireTenantScope(event, 'TENANT_SETTINGS', clientSiteId)

  const { market } = await readValidatedBody(event, z.object({ market: z.string().max(8) }).parse)
  const site = await db.clientSite.findUnique({ where: { id: clientSiteId }, select: { language: true } })
  if (!site) throw createError({ statusCode: 404, message: 'Site not found' })
  // Only markets with data in the article language; the plan rebuilds within a day (`planProfile`).
  if (!keywordMarketsFor(site.language).includes(market as never))
    throw createError({ statusCode: 400, message: 'Market not available for this language' })

  await db.clientSite.update({ where: { id: clientSiteId }, data: { keywordMarket: market } })
  return { market }
})

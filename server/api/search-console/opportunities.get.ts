import { getSearchOpportunities } from '../../utils/searchConsole/opportunities'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const site = await prisma.clientSite.findUnique({
    where: { id: user.clientSiteId! },
    select: {
      plan: true,
      features: { where: { isActive: true, feature: { code: 'SEARCH_CONSOLE' } }, select: { id: true }, take: 1 },
    },
  })
  if (!site || !['PREMIUM', 'CUSTOM'].includes(site.plan) || !site.features.length)
    throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })
  return getSearchOpportunities(user.clientSiteId!)
})

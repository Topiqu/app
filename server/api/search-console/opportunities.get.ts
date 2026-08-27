import { getSearchOpportunities } from '../../utils/searchConsole/opportunities'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const site = await prisma.clientSite.findUnique({ where: { id: user.clientSiteId! }, select: { plan: true } })
  if (!site || !['PREMIUM', 'CUSTOM'].includes(site.plan))
    throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })
  return getSearchOpportunities(user.clientSiteId!)
})

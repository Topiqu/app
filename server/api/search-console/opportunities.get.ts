import { subDays } from 'date-fns'

import { detectSearchOpportunities } from '../../utils/searchConsole/opportunities'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  const site = await prisma.clientSite.findUnique({ where: { id: user.clientSiteId! }, select: { plan: true } })
  if (!site || !['PREMIUM', 'CUSTOM'].includes(site.plan)) throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })
  const rows = await prisma.searchConsoleMetric.groupBy({
    by: ['page', 'query'], where: { clientSiteId: user.clientSiteId!, date: { gte: subDays(new Date(), 28) } },
    _sum: { clicks: true, impressions: true }, _avg: { ctr: true, position: true }, orderBy: { _sum: { impressions: 'desc' } }, take: 500,
  })
  return detectSearchOpportunities(rows.map((row) => ({ page: row.page, query: row.query, clicks: row._sum.clicks ?? 0, impressions: row._sum.impressions ?? 0, ctr: row._avg.ctr ?? 0, position: row._avg.position ?? 0 }))).slice(0, 50)
})

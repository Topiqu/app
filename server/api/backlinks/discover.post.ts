import { hasDataForSeo } from '~~/server/utils/keywords/dataforseo'
import { claimBacklinkDiscovery, runBacklinkDiscovery } from '~~/server/utils/backlinks/discover'
import { BACKLINK_DAY_MS, BACKLINK_MANUAL_DAYS, backlinkAllowance } from '~~/shared/utils/backlinks'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const clientSiteId = user.clientSiteId!

  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { plan: true, backlinksAttemptedAt: true },
  })
  if (!backlinkAllowance(site?.plan).kinds.length)
    throw createError({ statusCode: 403, message: 'Backlinks are not part of this plan' })
  if (!(await hasActiveFeature(db, clientSiteId, 'AI')))
    throw createError({ statusCode: 403, message: 'AI is not enabled for this tenant' })
  if (!hasDataForSeo()) throw createError({ statusCode: 503, message: 'Backlink data is not configured' })
  const now = new Date()
  // Claimed before answering, so the page already sees the run and polls; a double click is a 429.
  if (!(await claimBacklinkDiscovery(clientSiteId, now, BACKLINK_MANUAL_DAYS))) {
    const retryAt = new Date((site?.backlinksAttemptedAt ?? now).getTime() + BACKLINK_MANUAL_DAYS * BACKLINK_DAY_MS)
    throw createError({ statusCode: 429, message: 'Backlinks were searched recently', data: { retryAt } })
  }
  runBacklinkDiscovery(clientSiteId, now).catch((error) =>
    reportCaughtError('Backlink discovery failed', error, { clientSiteId }),
  )
  await logAction({ action: 'BACKLINKS_DISCOVERY_REQUESTED', userId: user.id, clientSiteId })
  return { started: true }
})

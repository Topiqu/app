import { z } from 'zod'
import { hasDataForSeo } from '~~/server/utils/keywords/dataforseo'
import { BACKLINK_DAY_MS, BACKLINK_MANUAL_DAYS, backlinkAllowance } from '~~/shared/utils/backlinks'

const RUNNING_MS = 15 * 60_000

const draftView = z.object({ subject: z.string(), body: z.string() }).nullable().catch(null)

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const clientSiteId = user.clientSiteId!

  const [site, opportunities, won, links] = await Promise.all([
    db.clientSite.findUnique({
      where: { id: clientSiteId },
      select: { plan: true, backlinksRefreshedAt: true, backlinksAttemptedAt: true },
    }),
    db.backlinkOpportunity.findMany({
      where: { clientSiteId, status: { in: ['OPEN', 'SENT'] } },
      select: {
        id: true,
        kind: true,
        status: true,
        sourceUrl: true,
        sourceDomain: true,
        title: true,
        evidence: true,
        targetUrl: true,
        contactUrl: true,
        draft: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.backlinkOpportunity.count({ where: { clientSiteId, status: 'WON' } }),
    db.backlink.findMany({
      where: { clientSiteId },
      select: {
        id: true,
        sourceUrl: true,
        sourceDomain: true,
        targetUrl: true,
        rel: true,
        anchor: true,
        firstSeenAt: true,
        lastSeenAt: true,
        lostAt: true,
        opportunityId: true,
      },
      orderBy: [{ lostAt: { sort: 'desc', nulls: 'first' } }, { firstSeenAt: 'desc' }],
      take: 100,
    }),
  ])
  const now = Date.now()
  const attemptedAt = site?.backlinksAttemptedAt ?? null
  const refreshedAt = site?.backlinksRefreshedAt ?? null
  return {
    allowance: backlinkAllowance(site?.plan),
    available: hasDataForSeo(),
    refreshedAt,
    // A run claims `attemptedAt` first and stamps `refreshedAt` when done; a crashed run stops counting after a while.
    running: !!attemptedAt && (!refreshedAt || refreshedAt < attemptedAt) && now - attemptedAt.getTime() < RUNNING_MS,
    nextManualAt: attemptedAt ? new Date(attemptedAt.getTime() + BACKLINK_MANUAL_DAYS * BACKLINK_DAY_MS) : null,
    won,
    opportunities: opportunities.map(({ draft, evidence, ...opportunity }) => ({
      ...opportunity,
      evidence: (evidence ?? {}) as Record<string, unknown>,
      draft: draftView.parse(draft),
    })),
    links,
  }
})

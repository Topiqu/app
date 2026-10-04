import { z } from 'zod'
import { refreshAllowance, refreshesThisMonth } from '~~/server/utils/keywords/refresh'

const proposalView = z
  .object({
    title: z.string(),
    excerpt: z.string().nullable(),
    content: z.string(),
    summary: z.array(z.string()),
    changed: z.number(),
  })
  .nullable()
  .catch(null)

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  const clientSiteId = user.clientSiteId!
  if (user.role !== 'superadmin') await requireTenantScope(event, 'AI_USE', clientSiteId)

  const select = {
    id: true,
    type: true,
    status: true,
    keyword: true,
    reason: true,
    angle: true,
    positionBefore: true,
    positionAfter: true,
    measuredAt: true,
    proposal: true,
    error: true,
    appliedAt: true,
    article: { select: { id: true, title: true, slug: true } },
  } as const
  const [site, open, applied, used] = await Promise.all([
    db.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } }),
    db.contentAction.findMany({
      where: { clientSiteId, status: { in: ['SUGGESTED', 'QUEUED', 'READY', 'FAILED'] } },
      select,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.contentAction.findMany({
      where: { clientSiteId, status: 'APPLIED' },
      select,
      orderBy: { appliedAt: 'desc' },
      take: 5,
    }),
    refreshesThisMonth(clientSiteId, new Date(), db),
  ])
  const allowance = refreshAllowance(site?.plan)
  return {
    allowed: allowance.allowed,
    monthly: allowance.monthly,
    used,
    actions: [...open, ...applied].map(({ proposal, ...action }) => ({
      ...action,
      // The proposal body is shown only while it waits for a decision.
      proposal: action.status === 'READY' ? proposalView.parse(proposal) : null,
    })),
  }
})

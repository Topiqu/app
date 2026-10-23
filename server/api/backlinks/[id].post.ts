import { z } from 'zod'

const Body = z.object({ action: z.enum(['draft', 'sent', 'dismiss', 'reopen', 'check']) })

type Status = 'OPEN' | 'SENT' | 'WON' | 'DISMISSED' | 'EXPIRED'

const TRANSITIONS: Record<'sent' | 'dismiss' | 'reopen', { from: Status[]; to: Status }> = {
  sent: { from: ['OPEN'], to: 'SENT' },
  dismiss: { from: ['OPEN', 'SENT'], to: 'DISMISSED' },
  reopen: { from: ['DISMISSED', 'EXPIRED'], to: 'OPEN' },
}

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const clientSiteId = user.clientSiteId!
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing opportunity ID' })
  const { action } = await readValidatedBody(event, Body.parse)

  // The tenant filter makes a foreign id a 404.
  const target = await db.backlinkOpportunity.findFirst({
    where: { id, clientSiteId },
    select: {
      id: true,
      clientSiteId: true,
      kind: true,
      status: true,
      sourceUrl: true,
      sourceDomain: true,
      title: true,
      evidence: true,
      targetUrl: true,
      sentAt: true,
    },
  })
  if (!target) throw createError({ statusCode: 404, message: 'Opportunity not found' })
  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { id: true, name: true, domain: true, websiteUrl: true, language: true, focus: true, plan: true },
  })
  if (!site) throw createError({ statusCode: 404, message: 'Site not found' })

  if (action === 'draft') {
    await requireTenantScope(event, 'AI_USE', clientSiteId)
    if (!backlinkAllowance(site.plan).drafts)
      throw createError({ statusCode: 403, message: 'Outreach drafts are not part of this plan' })
    if (!(await hasActiveFeature(db, clientSiteId, 'AI')))
      throw createError({ statusCode: 403, message: 'AI is not enabled for this tenant' })
    if (target.status !== 'OPEN' && target.status !== 'SENT')
      throw createError({ statusCode: 409, message: 'Opportunity is closed' })
    if (!(await consumeRateLimit(`backlink-draft:${clientSiteId}`, 30, 3600)))
      throw createError({ statusCode: 429, message: 'Too many drafts, try again later' })
    const draft = await draftOutreach(
      site,
      { ...target, evidence: (target.evidence ?? {}) as Record<string, unknown> },
      user.id,
    )
    await db.backlinkOpportunity.update({ where: { id }, data: { draft } })
    return { draft }
  }

  if (action === 'check') {
    if (target.status !== 'OPEN' && target.status !== 'SENT')
      throw createError({ statusCode: 409, message: 'Opportunity is closed' })
    if (!(await consumeRateLimit(`backlink-check:${clientSiteId}`, 20, 3600)))
      throw createError({ statusCode: 429, message: 'Too many checks, try again later' })
    return { outcome: await checkOpportunity({ ...target, clientSite: site }) }
  }

  const transition = TRANSITIONS[action]
  const now = new Date()
  const updated = await db.backlinkOpportunity.updateMany({
    where: { id, clientSiteId, status: { in: transition.from } },
    data:
      transition.to === 'SENT'
        ? { status: 'SENT', sentAt: now, nextCheckAt: new Date(now.getTime() + BACKLINK_CHECK_DAYS * BACKLINK_DAY_MS) }
        : transition.to === 'OPEN'
          ? { status: 'OPEN', sentAt: null, decidedAt: null, nextCheckAt: null }
          : { status: transition.to, decidedAt: now, nextCheckAt: null },
  })
  if (!updated.count) throw createError({ statusCode: 409, message: 'Opportunity changed meanwhile' })
  await logAction({
    action: 'BACKLINK_OPPORTUNITY_UPDATED',
    userId: user.id,
    clientSiteId,
    metadata: { id, action, status: transition.to },
  })
  return { status: transition.to }
})

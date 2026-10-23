const BATCH = 100
const CONCURRENCY = 5
// An unreadable page keeps its link until this long without a successful read.
const UNREADABLE_DAYS = 30

const days = (now: Date, count: number) => new Date(now.getTime() + count * BACKLINK_DAY_MS)

type SiteHosts = { domain: string; websiteUrl: string | null }

/** Whether a page links now; settles a SENT or OPEN request as WON or, after the wait, EXPIRED. */
export const checkOpportunity = async (
  opportunity: {
    id: string
    clientSiteId: string
    sourceUrl: string
    sourceDomain: string
    status: string
    sentAt: Date | null
    clientSite: SiteHosts
  },
  now = new Date(),
) => {
  const page = await fetchPage(opportunity.sourceUrl, ownedHosts(opportunity.clientSite))
  if (page.status === 'ok' && page.links.length) {
    await prisma.backlinkOpportunity.update({
      where: { id: opportunity.id },
      data: { status: 'WON', decidedAt: now, nextCheckAt: null },
    })
    await recordBacklink(
      opportunity.clientSiteId,
      { sourceUrl: opportunity.sourceUrl, sourceDomain: opportunity.sourceDomain, link: page.links[0]! },
      now,
      opportunity.id,
    )
    return 'won' as const
  }
  if (opportunity.status !== 'SENT') return page.status === 'ok' ? ('missing' as const) : ('unreadable' as const)
  const expired =
    opportunity.sentAt && opportunity.sentAt.getTime() < now.getTime() - BACKLINK_SENT_DAYS * BACKLINK_DAY_MS
  await prisma.backlinkOpportunity.update({
    where: { id: opportunity.id },
    data: expired
      ? { status: 'EXPIRED', decidedAt: now, nextCheckAt: null }
      : { nextCheckAt: days(now, BACKLINK_CHECK_DAYS) },
  })
  return expired ? ('expired' as const) : page.status === 'ok' ? ('missing' as const) : ('unreadable' as const)
}

const siteSelect = { select: { domain: true, websiteUrl: true } } as const
const eligibleSite = { plan: { in: [...BACKLINK_PLANS] }, deletedAt: null }

/**
 * Daily: sent requests are read weekly until the link appears or they expire; verified links are read
 * weekly and a miss is re-read the next day, so one failed render cannot mark a link lost.
 */
export const checkDueBacklinks = async (now = new Date()) => {
  const requests = await prisma.backlinkOpportunity.findMany({
    where: { status: 'SENT', nextCheckAt: { lte: now }, clientSite: eligibleSite },
    select: {
      id: true,
      clientSiteId: true,
      sourceUrl: true,
      sourceDomain: true,
      status: true,
      sentAt: true,
      nextCheckAt: true,
      clientSite: siteSelect,
    },
    orderBy: { nextCheckAt: 'asc' },
    take: BATCH,
  })
  const outcomes: Record<string, number> = {}
  await mapLimit(requests, CONCURRENCY, async (request) => {
    const claimed = await prisma.backlinkOpportunity.updateMany({
      where: { id: request.id, status: 'SENT', nextCheckAt: request.nextCheckAt },
      data: { nextCheckAt: days(now, 1) },
    })
    if (!claimed.count) return
    const outcome = await checkOpportunity(request, now)
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1
  })

  const links = await prisma.backlink.findMany({
    where: { lostAt: null, nextCheckAt: { lte: now }, clientSite: eligibleSite },
    select: {
      id: true,
      clientSiteId: true,
      sourceUrl: true,
      sourceDomain: true,
      lastSeenAt: true,
      missedChecks: true,
      nextCheckAt: true,
      clientSite: siteSelect,
    },
    orderBy: { nextCheckAt: 'asc' },
    take: BATCH,
  })
  let live = 0
  let lost = 0
  await mapLimit(links, CONCURRENCY, async (link) => {
    const claimed = await prisma.backlink.updateMany({
      where: { id: link.id, nextCheckAt: link.nextCheckAt },
      data: { nextCheckAt: days(now, 1) },
    })
    if (!claimed.count) return
    const page = await fetchPage(link.sourceUrl, ownedHosts(link.clientSite))
    if (page.status === 'ok' && page.links.length) {
      live += 1
      await recordBacklink(link.clientSiteId, { ...link, link: page.links[0]! }, now)
      return
    }
    const stale = link.lastSeenAt.getTime() < now.getTime() - UNREADABLE_DAYS * BACKLINK_DAY_MS
    if (page.status === 'failed' && !stale) {
      await prisma.backlink.update({ where: { id: link.id }, data: { nextCheckAt: days(now, BACKLINK_CHECK_DAYS) } })
      return
    }
    const missedChecks = link.missedChecks + 1
    const isLost = missedChecks >= BACKLINK_LOST_AFTER
    if (isLost) lost += 1
    await prisma.backlink.update({
      where: { id: link.id },
      data: { missedChecks, ...(isLost ? { lostAt: now, nextCheckAt: null } : {}) },
    })
  })
  return { requests: requests.length, ...outcomes, links: links.length, live, lost }
}

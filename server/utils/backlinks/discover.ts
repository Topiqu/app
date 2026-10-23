export const BACKLINK_PLANS = ['PRO', 'PREMIUM', 'CUSTOM'] as const

/** Insert or refresh a verified link; re-finding a lost one revives it. */
export const recordBacklink = async (
  clientSiteId: string,
  found: { sourceUrl: string; sourceDomain: string; link: PageLink },
  now: Date,
  opportunityId?: string | null,
) => {
  const seen = {
    targetUrl: found.link.href.slice(0, 2048),
    rel: found.link.rel,
    anchor: found.link.anchor,
    lastSeenAt: now,
    lostAt: null,
    missedChecks: 0,
    nextCheckAt: new Date(now.getTime() + BACKLINK_CHECK_DAYS * BACKLINK_DAY_MS),
  }
  await prisma.backlink.upsert({
    where: { clientSiteId_sourceUrl: { clientSiteId, sourceUrl: found.sourceUrl } },
    create: {
      clientSiteId,
      sourceUrl: found.sourceUrl,
      sourceDomain: found.sourceDomain,
      firstSeenAt: now,
      ...seen,
      opportunityId,
    },
    update: { ...seen, ...(opportunityId ? { opportunityId } : {}) },
  })
}

/** A page that links now closes the request that asked for it. */
const closeWon = async (clientSiteId: string, found: FoundBacklink[], now: Date) => {
  for (const link of found) {
    const open = await prisma.backlinkOpportunity.findFirst({
      where: { clientSiteId, sourceUrl: link.sourceUrl, status: { in: ['OPEN', 'SENT'] } },
      select: { id: true },
    })
    if (open)
      await prisma.backlinkOpportunity.update({
        where: { id: open.id },
        data: { status: 'WON', decidedAt: now, nextCheckAt: null },
      })
    await recordBacklink(clientSiteId, link, now, open?.id)
  }
}

/** New pages open; an OPEN one gets fresh evidence; a decision (sent, dismissed, won) is never undone. */
const saveOpportunities = async (
  clientSiteId: string,
  kind: 'UNLINKED_MENTION' | 'SUPPLIER',
  items: FoundOpportunity[],
  targetUrl: string,
) => {
  let opened = 0
  for (const item of items) {
    const where = { clientSiteId_kind_sourceUrl: { clientSiteId, kind, sourceUrl: item.sourceUrl } }
    const existing = await prisma.backlinkOpportunity.findUnique({ where, select: { status: true } })
    const facts = {
      title: item.title?.slice(0, 500) ?? null,
      contactUrl: item.contactUrl?.slice(0, 2048) ?? null,
      evidence: item.evidence as never,
      targetUrl,
    }
    if (!existing) {
      await prisma.backlinkOpportunity.create({
        data: { clientSiteId, kind, sourceUrl: item.sourceUrl, sourceDomain: item.sourceDomain, ...facts },
      })
      opened += 1
    } else if (existing.status === 'OPEN') await prisma.backlinkOpportunity.update({ where, data: facts })
  }
  return opened
}

/** `backlinksAttemptedAt` claims paid work, so overlapping runs and repeated clicks cannot pay twice. */
export const claimBacklinkDiscovery = async (clientSiteId: string, now: Date, cooldownDays: number) => {
  const cutoff = new Date(now.getTime() - cooldownDays * BACKLINK_DAY_MS)
  const claimed = await prisma.clientSite.updateMany({
    where: { id: clientSiteId, OR: [{ backlinksAttemptedAt: null }, { backlinksAttemptedAt: { lt: cutoff } }] },
    data: { backlinksAttemptedAt: now },
  })
  return claimed.count > 0
}

/** A claimed discovery; a source that fails leaves the other's results standing. */
export const runBacklinkDiscovery = async (clientSiteId: string, now = new Date()) => {
  const site = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: {
      id: true,
      name: true,
      domain: true,
      websiteUrl: true,
      language: true,
      keywordMarket: true,
      focus: true,
      plan: true,
    },
  })
  const allowance = backlinkAllowance(site?.plan)
  if (!site || !allowance.kinds.length) return { skipped: 'plan' as const }
  const owned = ownedHosts(site)
  const targetUrl = backlinkTarget(site)

  const [mentions, suppliers] = await Promise.allSettled([
    allowance.kinds.includes('UNLINKED_MENTION') ? findMentions(site, owned) : Promise.resolve(null),
    allowance.kinds.includes('SUPPLIER') ? findSuppliers(site, owned) : Promise.resolve(null),
  ])
  const failures = [mentions, suppliers].flatMap((outcome) =>
    outcome.status === 'rejected' ? [(outcome.reason as Error)?.message ?? 'failed'] : [],
  )
  for (const message of failures) console.error('[backlinks] Discovery source failed:', clientSiteId, message)
  const mentionResult = mentions.status === 'fulfilled' ? mentions.value : null
  const supplierResult = suppliers.status === 'fulfilled' ? suppliers.value : null

  const found = [...(mentionResult?.found ?? []), ...(supplierResult?.found ?? [])]
  await closeWon(clientSiteId, found, now)
  const opened =
    (mentionResult
      ? await saveOpportunities(clientSiteId, 'UNLINKED_MENTION', mentionResult.opportunities, targetUrl)
      : 0) +
    (supplierResult ? await saveOpportunities(clientSiteId, 'SUPPLIER', supplierResult.opportunities, targetUrl) : 0)
  if (mentionResult || supplierResult)
    await prisma.clientSite.update({ where: { id: clientSiteId }, data: { backlinksRefreshedAt: now } })

  const costUsd = Math.round(((mentionResult?.costUsd ?? 0) + (supplierResult?.costUsd ?? 0)) * 10_000) / 10_000
  const summary = {
    mentions: mentionResult?.searched ?? null,
    suppliers: supplierResult?.searched ?? null,
    found: found.length,
    opened,
    failures: failures.length,
    costUsd,
  }
  await logAction({ action: 'BACKLINKS_DISCOVERED', clientSiteId, metadata: summary })
  return summary
}

export const discoverBacklinks = async (
  clientSiteId: string,
  { now = new Date(), cooldownDays = BACKLINK_DISCOVERY_DAYS } = {},
) => {
  if (!hasDataForSeo()) return { skipped: 'provider' as const }
  if (!(await claimBacklinkDiscovery(clientSiteId, now, cooldownDays))) return { skipped: 'cooldown' as const }
  return runBacklinkDiscovery(clientSiteId, now)
}

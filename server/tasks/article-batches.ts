import { loadGenerationClient, processClient } from './generate-article'

// Provider capacity across tenants. Each tenant runs one article at a time: the next run then sees the
// previous draft among its recent articles, and one tenant's batch cannot crowd out the others.
const MAX_RUNNING = 3
const CANDIDATE_WINDOW = 100
// Renewed every tick by the process running the article, so one killed by a deploy frees its slot in minutes.
const LEASE_MS = 5 * 60_000
const ITEM_TIMEOUT_MS = 45 * 60_000
const MAX_ATTEMPTS = 3
const OVERDUE_MS = 6 * 60 * 60_000
const FAILURES_BEFORE_PAUSE = 3

const RETRY_AFTER_MS: Record<ArticleBatchPauseReason, number> = {
  credits: 15 * 60_000,
  allowance: 60 * 60_000,
  access: 60 * 60_000,
  // Failed runs are not charged, so repeating them is our AI bill: one attempt a day until someone looks.
  failures: 24 * 60 * 60_000,
}

const ITEM_SELECT = {
  id: true,
  batchId: true,
  clientSiteId: true,
  topic: true,
  instructions: true,
  keywordClusterId: true,
  clusterPinned: true,
  scheduledFor: true,
  attempts: true,
  batch: { select: { mode: true, requestedById: true, pauseReason: true } },
} as const

type ClaimedItem = {
  id: string
  batchId: string
  clientSiteId: string
  topic: string
  instructions: string | null
  keywordClusterId: string | null
  clusterPinned: boolean
  scheduledFor: Date
  attempts: number
  batch: {
    mode: 'SPREAD' | 'DRAFTS' | null
    requestedById: string | null
    pauseReason: string | null
  }
}

const activeRuns = new Set<string>()

const pauseBatch = async (item: ClaimedItem, reason: ArticleBatchPauseReason, now = new Date()) => {
  const { count } = await prisma.articleBatch.updateMany({
    where: { id: item.batchId, status: 'ACTIVE' },
    data: { pausedUntil: new Date(now.getTime() + RETRY_AFTER_MS[reason]), pauseReason: reason },
  })
  // Retries of the same pause stay quiet.
  if (count && item.batch.pauseReason !== reason)
    await notifyArticleBatchPaused(item.batchId, reason).catch((error: unknown) =>
      reportCaughtError('Article batch pause notification failed', error, { batchId: item.batchId }),
    )
  return count > 0
}

/**
 * Puts the article back without an outcome: the condition passes and the batch carries on. Requeueing comes
 * before the pause, so a concurrent cancel either sees this row as queued or leaves the pause nothing to update.
 */
const waitFor = async (item: ClaimedItem, reason: ArticleBatchPauseReason) => {
  await prisma.articleBatchItem.updateMany({
    where: { id: item.id, status: 'RUNNING', attempts: item.attempts },
    data: { status: 'QUEUED', startedAt: null, leaseUntil: null },
  })
  if (await pauseBatch(item, reason)) return { id: item.id, status: 'paused' as const, reason }
  // Cancelled meanwhile: nothing will claim this article again.
  const { count } = await prisma.articleBatchItem.updateMany({
    where: { id: item.id, status: 'QUEUED' },
    data: { status: 'CANCELLED', finishedAt: new Date() },
  })
  if (count) await releaseBatchCluster(prisma, item)
  return { id: item.id, status: 'cancelled' as const }
}

const failedInARow = async (batchId: string) => {
  const latest = await prisma.articleBatchItem.findMany({
    where: { batchId, status: { in: ['SUCCEEDED', 'FAILED'] } },
    orderBy: { finishedAt: 'desc' },
    take: FAILURES_BEFORE_PAUSE,
    select: { status: true },
  })
  return latest.length === FAILURES_BEFORE_PAUSE && latest.every((row) => row.status === 'FAILED')
}

type ItemOutcome =
  | { status: 'SUCCEEDED'; articleId: string }
  | { status: 'FAILED'; error: string }
  | { status: 'CANCELLED'; error: string }

/** Guarded on the attempt: a run declared lost must not overwrite the attempt that replaced it, and vice versa. */
const finishItem = async (item: ClaimedItem, outcome: ItemOutcome) => {
  const { count } = await prisma.articleBatchItem.updateMany({
    where: { id: item.id, status: 'RUNNING', attempts: item.attempts },
    data:
      outcome.status === 'SUCCEEDED'
        ? { status: 'SUCCEEDED', articleId: outcome.articleId, error: null, finishedAt: new Date(), leaseUntil: null }
        : { status: outcome.status, error: outcome.error.slice(0, 500), finishedAt: new Date(), leaseUntil: null },
  })
  if (!count) return
  if (outcome.status === 'SUCCEEDED') {
    // Normally linked with the article. Here too because a topic its run could not load must not stay reserved.
    if (item.keywordClusterId)
      await prisma.keywordCluster.updateMany({
        where: { id: item.keywordClusterId, status: 'RESERVED' },
        data: { status: 'USED', articleId: outcome.articleId, usedAt: new Date(), nextRankCheckAt: firstRankCheck() },
      })
    if (item.batch.pauseReason)
      await prisma.articleBatch.updateMany({
        where: { id: item.batchId, status: 'ACTIVE' },
        data: { pausedUntil: null, pauseReason: null },
      })
  } else await releaseBatchCluster(prisma, item)
  if (await finishArticleBatchIfDone(item.batchId)) return
  if (outcome.status === 'FAILED' && (await failedInARow(item.batchId))) await pauseBatch(item, 'failures')
}

/**
 * The article and `articleId` commit together, so a dead run's outcome is known: with an ID the article exists
 * and its reservation lapses uncharged, without one nothing was saved and it is safe to write it again.
 */
export const recoverLostBatchItems = async (now = new Date()) => {
  const lost = await prisma.articleBatchItem.findMany({
    where: {
      status: 'RUNNING',
      OR: [{ leaseUntil: { lt: now } }, { startedAt: { lt: new Date(now.getTime() - ITEM_TIMEOUT_MS) } }],
    },
    select: { ...ITEM_SELECT, articleId: true, batch: { select: { ...ITEM_SELECT.batch.select, status: true } } },
  })
  for (const item of lost) {
    activeRuns.delete(item.id)
    if (item.articleId) await finishItem(item, { status: 'SUCCEEDED', articleId: item.articleId })
    else if (item.attempts < MAX_ATTEMPTS && item.batch.status === 'ACTIVE')
      await prisma.articleBatchItem.updateMany({
        where: { id: item.id, status: 'RUNNING', attempts: item.attempts },
        data: { status: 'QUEUED', startedAt: null, leaseUntil: null },
      })
    else await finishItem(item, { status: 'FAILED', error: 'The generation was interrupted' })
  }
  return lost.length
}

const renewLeases = async (now: Date) => {
  if (!activeRuns.size) return
  await prisma.articleBatchItem.updateMany({
    where: { id: { in: [...activeRuns] }, status: 'RUNNING' },
    data: { leaseUntil: new Date(now.getTime() + LEASE_MS) },
  })
}

export const claimBatchItems = async (now = new Date()) =>
  prisma.$transaction(async (tx) => {
    // Cross-replica: the capacity and the one-per-tenant rule are read and then acted on.
    const [lock] = await tx.$queryRaw<
      { locked: boolean }[]
    >`SELECT pg_try_advisory_xact_lock(7420190002::bigint) AS locked`
    if (!lock?.locked) return []
    const running = await tx.articleBatchItem.findMany({
      where: { status: 'RUNNING' },
      select: { clientSiteId: true },
    })
    const free = MAX_RUNNING - running.length
    if (free <= 0) return []
    const busy = new Set(running.map((item) => item.clientSiteId))
    const candidates = await tx.articleBatchItem.findMany({
      where: {
        status: 'QUEUED',
        scheduledFor: { lte: new Date(now.getTime() + GENERATION_LEAD_MS) },
        batch: {
          status: 'ACTIVE',
          deletedAt: null,
          OR: [{ pausedUntil: null }, { pausedUntil: { lte: now } }],
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: CANDIDATE_WINDOW,
      select: ITEM_SELECT,
    })
    const claimed: ClaimedItem[] = []
    for (const candidate of candidates) {
      if (claimed.length >= free) break
      if (busy.has(candidate.clientSiteId)) continue
      busy.add(candidate.clientSiteId)
      let scheduledFor = candidate.scheduledFor
      if (candidate.batch.mode === 'SPREAD' && now.getTime() - scheduledFor.getTime() > OVERDUE_MS) {
        const [next] = await replanArticleBatch(candidate.batchId, now, tx)
        if (next) scheduledFor = next
        // Replanned past the lead: its turn comes on a later tick.
        if (scheduledFor.getTime() > now.getTime() + GENERATION_LEAD_MS) continue
      }
      const { count } = await tx.articleBatchItem.updateMany({
        where: { id: candidate.id, status: 'QUEUED' },
        data: {
          status: 'RUNNING',
          startedAt: now,
          leaseUntil: new Date(now.getTime() + LEASE_MS),
          attempts: { increment: 1 },
        },
      })
      if (count) claimed.push({ ...candidate, scheduledFor, attempts: candidate.attempts + 1 })
    }
    return claimed
  })

/** The plan lapsed or the site is gone. Re-upgrading months later must not resume publishing on an old approval. */
const endBatch = async (item: ClaimedItem) => {
  await cancelArticleBatch(item.batchId, item.clientSiteId).catch((error: { statusCode?: number }) => {
    if (error.statusCode !== 404) throw error
  })
  await finishItem(item, { status: 'CANCELLED', error: 'The plan no longer includes AI articles' })
  await notifyArticleBatchEnded(item.batchId).catch((error: unknown) =>
    reportCaughtError('Article batch end notification failed', error, { batchId: item.batchId }),
  )
  return { id: item.id, status: 'cancelled' as const }
}

export const runArticleBatchItem = async (item: ClaimedItem) => {
  const fail = async (error: string) => {
    await finishItem(item, { status: 'FAILED', error })
    return { id: item.id, status: 'failed' as const }
  }
  activeRuns.add(item.id)
  try {
    const access = await articleBatchAccess(item.batch, item.clientSiteId)
    if (access === 'plan') return await endBatch(item)
    if (access === 'member') return await waitFor(item, 'access')
    const client = await loadGenerationClient(item.clientSiteId)
    if (!client) return await endBatch(item)
    const { available } = await getArticleCreditWallet(item.clientSiteId)
    if (available < articleCreditCost(client.articleQuality)) return await waitFor(item, 'credits')
    // An autopilot run already writing this topic when it was reserved takes it: a second article would compete.
    if (
      item.keywordClusterId &&
      !(await prisma.keywordCluster.count({ where: { id: item.keywordClusterId, status: 'RESERVED' } }))
    ) {
      await finishItem(item, { status: 'CANCELLED', error: 'The topic was written meanwhile' })
      return { id: item.id, status: 'cancelled' as const }
    }

    const planned = await prisma.articleBatchItem.findMany({
      where: { batchId: item.batchId, status: 'QUEUED', id: { not: item.id } },
      orderBy: { scheduledFor: 'asc' },
      select: { topic: true },
    })
    const spread = item.batch.mode === 'SPREAD'
    const outcome = await processClient(
      client,
      spread ? clearOfAutopilot(item.scheduledFor, client.nextReleaseAt) : new Date(),
      {
        topic: item.topic,
        instructions: item.instructions,
        batchItem: {
          id: item.id,
          // Attempt-scoped: only a run that left no article is ever attempted again.
          creditKey: `article-batch:${item.id}:${item.attempts}`,
          keywordClusterId: item.keywordClusterId,
          autoRelease: spread,
          plannedTopics: planned.map(({ topic }) => topic),
          stillActive: async () =>
            (await prisma.articleBatch.count({ where: { id: item.batchId, status: 'ACTIVE' } })) > 0,
        },
      },
    )
    if (outcome.status === 'failed') {
      if (outcome.pauseReason) return await waitFor(item, outcome.pauseReason)
      return await fail(outcome.error || 'The article could not be written')
    }
    if (!outcome.articleId) return await fail('The article could not be written')
    await finishItem(item, { status: 'SUCCEEDED', articleId: outcome.articleId })
    return { id: item.id, status: 'succeeded' as const, articleId: outcome.articleId }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  } finally {
    activeRuns.delete(item.id)
  }
}

export default defineMonitoredTask({
  meta: {
    name: 'article-batches',
    description: 'Writes the articles of approved article batches',
  },
  async run() {
    const now = new Date()
    await renewLeases(now)
    const lost = await recoverLostBatchItems(now)
    const claimed = await claimBatchItems(now)
    // Not awaited: Nitro skips a tick while the task runs, and one slow article must not stall the free slots.
    for (const item of claimed)
      void runArticleBatchItem(item).catch((error: unknown) =>
        reportCaughtError('Article batch item crashed', error, { itemId: item.id }),
      )
    return { result: { lost, started: claimed.length } }
  },
})

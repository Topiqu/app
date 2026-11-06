import type { H3Event } from 'h3'
import type { ArticleBatchMode, TenantScope } from '~~/generated/zenstack/models'

import { randomUUID } from 'node:crypto'

const DAY_MS = 86_400_000
const PROPOSAL_TTL_MS = DAY_MS
const FINISHED_VISIBLE_MS = 14 * DAY_MS
// Long enough for a keyword plan rebuild followed by the model's topics.
const TOP_UP_MS = 5 * 60_000
const MAX_AI_TOPICS = 10
const MAX_AUTOPILOT_RESERVE = 7
// A proposal is free for the client but not for us; beyond this it offers the keyword plan alone.
const AI_PROPOSALS_PER_DAY = 2

const batchError = (statusCode: number, code: string, data: Record<string, unknown> = {}) =>
  createError({ statusCode, data: { code, ...data } })

/** Starting a batch creates AI-authored articles, so it takes the scope that lets the requester open them. */
const articleBatchScopes = (mode?: ArticleBatchMode | null): TenantScope[] => [
  'AI_USE',
  'ARTICLE_WRITE',
  'ARTICLE_WRITE_OTHERS',
  ...(mode === 'SPREAD' ? (['ARTICLE_PUBLISH'] as const) : []),
]

export const requireArticleBatchAccess = async (event: H3Event, mode?: ArticleBatchMode | null) => {
  const { user, membership } = await requireTenantMember(event)
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'No active tenant' })
  for (const scope of articleBatchScopes(mode))
    if (!hasTenantScope(membership, scope))
      throw createError({ statusCode: 403, message: `Missing tenant scope: ${scope}` })
  await requireAiPlan(user.clientSiteId, 'Article batches require an AI plan')
  return { user, clientSiteId: user.clientSiteId }
}

/**
 * A queued article still needs a paid plan and its requester's seat and permissions when work starts.
 * `plan` ends the batch; `member` waits, because another member can take it over.
 */
export const articleBatchAccess = async (
  batch: { requestedById: string | null; mode: ArticleBatchMode | null },
  clientSiteId: string,
): Promise<'ok' | 'member' | 'plan'> => {
  const site = await prisma.clientSite.findFirst({
    where: { id: clientSiteId, deletedAt: null },
    select: { plan: true },
  })
  if (!site || !hasAiPlan(site.plan)) return 'plan'
  const user = batch.requestedById
    ? await prisma.user.findFirst({
        where: { id: batch.requestedById, deletedAt: null },
        select: { id: true, role: true },
      })
    : null
  if (!user) return 'member'
  if (user.role === 'superadmin') return 'ok'
  const membership = await prisma.tenantMembership.findUnique({
    where: { clientSiteId_userId: { clientSiteId, userId: user.id } },
    select: { id: true, userId: true, clientSiteId: true, role: true, scopes: true, deletedAt: true },
  })
  if (!membership || membership.deletedAt) return 'member'
  if (!(await hasTeamSeat(prisma, membership, site.plan))) return 'member'
  return articleBatchScopes(batch.mode).every((scope) => hasTenantScope(membership, scope)) ? 'ok' : 'member'
}

const BATCH_SITE_SELECT = {
  id: true,
  plan: true,
  language: true,
  focus: true,
  audience: true,
  keywords: true,
  keywordPlanProfile: true,
  keywordPlanRefreshedAt: true,
  keywordPlanAttemptedAt: true,
  keywordMarket: true,
  domain: true,
  articleQuality: true,
  autoRelease: true,
  publishToWeb: true,
  generationFrequency: true,
  timeZone: true,
  releaseHour: true,
  releaseWindowStart: true,
  releaseWindowEnd: true,
  releaseDays: true,
  intervalMinHours: true,
  intervalMaxHours: true,
} as const

const creditsOf = async (site: {
  id: string
  plan: string
  articleQuality: unknown
  generationFrequency: Parameters<typeof releaseScheduleOf>[0]['generationFrequency']
  timeZone: string
  releaseHour: number
  releaseWindowStart: number
  releaseWindowEnd: number
  releaseDays: number[] | null
  intervalMinHours: number
  intervalMaxHours: number
}) => {
  const quality = articleQualityOf(site.articleQuality)
  const [wallet, autopilot, queued] = await Promise.all([
    getArticleCreditWallet(site.id),
    hasActiveFeature(prisma, site.id, 'ARTICLE_CRONS'),
    // Reserved only when written, so the wallet still counts them as available.
    prisma.articleBatchItem.count({ where: { clientSiteId: site.id, status: 'QUEUED' } }),
  ])
  const carried = wallet.grants
    .filter((grant) => grant.source === 'ROLLOVER')
    .reduce((total, grant) => total + grant.remaining, 0)
  return {
    quality,
    autopilot,
    credits: articleCreditOverview({
      plan: site.plan,
      quality,
      schedule: autopilot ? releaseScheduleOf(site) : null,
      available: wallet.available,
      carried,
      committed: queued * articleCreditCost(quality),
    }),
  }
}

const proposalOf = (value: unknown) => (Array.isArray(value) ? (value as ArticleBatchProposalItem[]) : [])

type PlanTopic = Awaited<ReturnType<typeof planTopicsFor>>[number]

const planProposalItem = (cluster: PlanTopic): ArticleBatchProposalItem => ({
  id: randomUUID(),
  topic: cluster.opportunity.angle,
  reason: cluster.opportunity.reason,
  keyword: cluster.keyword,
  volume: cluster.volume,
  instructions: null,
  keywordClusterId: cluster.id,
  recommended:
    cluster.status === 'PINNED' ||
    (cluster.opportunity.articleFit === 'strong' && cluster.opportunity.specificity === 'focused'),
})

const autopilotReserve = (perMonth: number) => Math.min(MAX_AUTOPILOT_RESERVE, Math.ceil((perMonth * 7) / 30))

/** A week of topics stays with the autopilot, which would otherwise write its next articles without one. */
const beyondAutopilot = (topics: PlanTopic[], autopilotPerMonth: number) =>
  topics.slice(0, Math.max(0, topics.length - autopilotReserve(autopilotPerMonth)))

export const ARTICLE_BATCH_SELECT = {
  id: true,
  status: true,
  mode: true,
  paceHours: true,
  proposal: true,
  proposingUntil: true,
  pauseReason: true,
  pausedUntil: true,
  createdAt: true,
  confirmedAt: true,
  finishedAt: true,
  items: {
    orderBy: { scheduledFor: 'asc' },
    select: {
      id: true,
      topic: true,
      status: true,
      scheduledFor: true,
      article: { select: { slug: true, title: true, status: true, releaseAt: true, releaseHold: true } },
    },
  },
} as const

type BatchRow = {
  id: string
  status: ArticleBatchView['status']
  mode: ArticleBatchView['mode']
  paceHours: number | null
  proposal: unknown
  proposingUntil: Date | null
  pauseReason: string | null
  pausedUntil: Date | null
  items: {
    id: string
    topic: string
    status: ArticleBatchItemView['status']
    scheduledFor: Date
    article: { slug: string; title: string; status: string; releaseAt: Date | null; releaseHold: unknown } | null
  }[]
}

/** Cluster IDs and internal notes stay on the server; confirmation only names proposal rows. */
export const serializeArticleBatch = (batch: BatchRow, now = new Date()): ArticleBatchView => ({
  id: batch.id,
  status: batch.status,
  mode: batch.mode,
  paceHours: batch.paceHours,
  proposal:
    batch.status === 'PROPOSED'
      ? proposalOf(batch.proposal).map(({ id, topic, reason, keyword, volume, recommended }) => ({
          id,
          topic,
          reason,
          keyword,
          volume,
          recommended,
        }))
      : [],
  proposing: Boolean(batch.proposingUntil && batch.proposingUntil > now),
  pauseReason: batch.pausedUntil ? (batch.pauseReason as ArticleBatchPauseReason | null) : null,
  pausedUntil: batch.pausedUntil?.toISOString() ?? null,
  items: batch.items.map((item) => ({
    id: item.id,
    topic: item.topic,
    status: item.status,
    scheduledFor: item.scheduledFor.toISOString(),
    article: item.article
      ? {
          slug: item.article.slug,
          title: item.article.title,
          status: item.article.status,
          releaseAt: item.article.releaseAt?.toISOString() ?? null,
          held: Boolean(item.article.releaseHold),
        }
      : null,
  })),
})

export const articleBatchOverview = async (
  clientSiteId: string,
  db: Pick<Awaited<ReturnType<typeof getEnhancedPrisma>>, 'articleBatch'>,
): Promise<ArticleBatchOverview> => {
  const site = await prisma.clientSite.findFirst({
    where: { id: clientSiteId, deletedAt: null },
    select: BATCH_SITE_SELECT,
  })
  if (!site) throw createError({ statusCode: 404 })
  const { quality, autopilot, credits } = await creditsOf(site)
  const latest = await db.articleBatch.findFirst({
    where: { clientSiteId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: ARTICLE_BATCH_SELECT,
  })
  const now = Date.now()
  const current =
    latest &&
    (latest.status === 'ACTIVE' ||
      (latest.status === 'PROPOSED' && now - latest.createdAt.getTime() < PROPOSAL_TTL_MS) ||
      // A discarded proposal never became a plan, so it leaves no result to show.
      (latest.confirmedAt && latest.finishedAt && now - latest.finishedAt.getTime() < FINISHED_VISIBLE_MS))
      ? latest
      : null
  return {
    clientSiteId,
    enabled: hasAiPlan(site.plan),
    hasProfile: hasPlanProfile(site),
    autopilot,
    autoRelease: site.autoRelease,
    publishToWeb: site.publishToWeb,
    quality,
    credits,
    recommended: {
      quality: recommendedArticleQuality(credits, quality),
      interval: autopilot ? recommendedAutopilotInterval(credits) : null,
    },
    batch: current ? serializeArticleBatch(current as unknown as BatchRow) : null,
  }
}

/**
 * Proposes as many articles as the free credits pay for and good topics exist. Keyword plan topics come first:
 * they carry measured demand and a coverage check. Returns how many topics the top-up should still look for.
 */
export const proposeArticleBatch = async (clientSiteId: string, userId: string) => {
  const live = await prisma.articleBatch.findFirst({
    where: { clientSiteId, deletedAt: null, status: { in: ['PROPOSED', 'ACTIVE'] } },
    select: { id: true, status: true, createdAt: true },
  })
  if (live?.status === 'ACTIVE') throw batchError(409, 'ACTIVE')
  if (live && Date.now() - live.createdAt.getTime() < PROPOSAL_TTL_MS) return { id: live.id, missing: 0 }

  const site = await prisma.clientSite.findFirstOrThrow({
    where: { id: clientSiteId, deletedAt: null },
    select: BATCH_SITE_SELECT,
  })
  if (!hasPlanProfile(site)) throw batchError(409, 'NO_PROFILE')
  const { quality, credits } = await creditsOf(site)
  const target = Math.min(
    MAX_BATCH_ITEMS,
    affordableArticleCount(credits.free, quality) || affordableArticleCount(credits.available, quality),
  )
  if (!target) throw batchError(402, 'NO_CREDITS')

  const topics = beyondAutopilot(await planTopicsFor(site), credits.autopilotPerMonth)
  const proposal = topics.slice(0, target).map(planProposalItem)
  const missing = target - proposal.length

  const created = await prisma
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${clientSiteId} FOR UPDATE`
      if (live)
        await tx.articleBatch.updateMany({
          where: { id: live.id, status: 'PROPOSED' },
          data: { status: 'CANCELLED', finishedAt: new Date() },
        })
      return tx.articleBatch.create({
        data: {
          clientSiteId,
          requestedById: userId,
          proposal: toDatabaseJson(proposal),
          proposingUntil: missing ? new Date(Date.now() + TOP_UP_MS) : null,
        },
        select: { id: true },
      })
    })
    .catch((error: unknown) => {
      // Two tabs asking at once: the partial unique index let one of them through.
      if (isUniqueViolation(error)) throw batchError(409, 'ACTIVE')
      throw error
    })
  return { id: created.id, missing }
}

/**
 * Runs after the response: a rebuild and a model call must not hold the request past the proxy's idle timeout.
 * The plan comes first, because its topics carry measured demand. A site without the autopilot refills only
 * here, when someone asks, so an idle blog pays for nothing.
 */
export const topUpArticleBatchProposal = async (batchId: string, clientSiteId: string, count: number) => {
  try {
    const [site, batch] = await Promise.all([
      prisma.clientSite.findFirstOrThrow({ where: { id: clientSiteId, deletedAt: null }, select: BATCH_SITE_SELECT }),
      prisma.articleBatch.findFirstOrThrow({ where: { id: batchId, clientSiteId }, select: { proposal: true } }),
    ])
    let proposal = proposalOf(batch.proposal)
    const target = proposal.length + count
    const { autopilot, credits } = await creditsOf(site)
    if (autopilot) {
      await refillKeywordPlan(site, target + autopilotReserve(credits.autopilotPerMonth))
      const topics = await planTopicsFor(site)
      // The rebuild may have dropped a proposed topic it could no longer confirm; confirming it would find nothing.
      const current = new Set(topics.map((cluster) => cluster.id))
      const kept = proposal.filter((item) => !item.keywordClusterId || current.has(item.keywordClusterId))
      const proposed = new Set(kept.map((item) => item.keywordClusterId))
      const fromPlan = beyondAutopilot(topics, credits.autopilotPerMonth)
        .filter((cluster) => !proposed.has(cluster.id))
        .slice(0, target - kept.length)
        .map(planProposalItem)
      if (fromPlan.length || kept.length !== proposal.length) {
        proposal = [...kept, ...fromPlan]
        // Saved now: the model call below may fail, and the client can already work with these.
        await prisma.articleBatch.updateMany({
          where: { id: batchId, status: 'PROPOSED' },
          data: { proposal: toDatabaseJson(proposal) },
        })
      }
    }

    const wanted = Math.min(target - proposal.length, MAX_AI_TOPICS)
    if (
      wanted <= 0 ||
      !(await consumeRateLimit(`article-batch-ai:${clientSiteId}`, AI_PROPOSALS_PER_DAY, DAY_MS / 1000))
    ) {
      await prisma.articleBatch.updateMany({
        where: { id: batchId, status: 'PROPOSED' },
        data: { proposingUntil: null },
      })
      return
    }
    const articles = await prisma.article.findMany({
      where: { clientSiteId, status: { in: ['published', 'draft'] }, excerpt: { not: null } },
      select: { excerpt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    const topics = await withAiSpend(clientSiteId, () =>
      proposeArticleTopics(
        {
          language: site.language,
          focus: site.focus,
          audience: site.audience,
          keywords: siteKeywords(site),
          recentExcerpts: articles.flatMap((article) => (article.excerpt ? [article.excerpt] : [])),
          plannedTopics: proposal.map((item) => item.topic),
        },
        wanted,
      ),
    )
    const added = topics.map(({ topic, reason }): ArticleBatchProposalItem => ({
      id: randomUUID(),
      topic,
      reason,
      keyword: null,
      volume: null,
      instructions: null,
      keywordClusterId: null,
      // No measured demand behind it, so the client opts in.
      recommended: false,
    }))
    await prisma.articleBatch.updateMany({
      where: { id: batchId, status: 'PROPOSED' },
      data: { proposal: toDatabaseJson([...proposal, ...added]), proposingUntil: null },
    })
  } catch (error) {
    // The plan's topics are still a valid proposal.
    await reportCaughtError('Article batch topic proposal failed', error, { clientSiteId, batchId })
    await prisma.articleBatch
      .updateMany({ where: { id: batchId, status: 'PROPOSED' }, data: { proposingUntil: null } })
      .catch(() => undefined)
  }
}

type ReservedCluster = { keywordClusterId: string | null; clusterPinned: boolean }

export const releaseBatchCluster = async (db: Pick<DatabaseTransaction, 'keywordCluster'>, item: ReservedCluster) => {
  if (!item.keywordClusterId) return
  await db.keywordCluster.updateMany({
    where: { id: item.keywordClusterId, status: 'RESERVED' },
    data: { status: item.clusterPinned ? 'PINNED' : 'OPEN' },
  })
}

export const confirmArticleBatch = async (input: {
  id: string
  clientSiteId: string
  userId: string
  mode: ArticleBatchMode
  paceHours: BatchPaceHours
  items: { id: string; topic: string }[]
  customTopics: string[]
}) =>
  prisma.$transaction(async (tx) => {
    // Locks the site row, so a concurrent confirmation sees this one's reservations.
    const wallet = await getArticleCreditWallet(input.clientSiteId, tx)
    const batch = await tx.articleBatch.findFirst({
      where: { id: input.id, clientSiteId: input.clientSiteId, status: 'PROPOSED', deletedAt: null },
      select: { proposal: true },
    })
    if (!batch) throw createError({ statusCode: 404 })
    const site = await tx.clientSite.findFirstOrThrow({
      where: { id: input.clientSiteId, deletedAt: null },
      select: BATCH_SITE_SELECT,
    })
    if (input.mode === 'SPREAD' && !site.publishToWeb) throw batchError(400, 'NO_WEB_PUBLISHING')

    const proposal = proposalOf(batch.proposal)
    const items: (ReservedCluster & { topic: string; instructions: string | null })[] = []
    for (const row of input.items) {
      const proposed = proposal.find((candidate) => candidate.id === row.id)
      if (!proposed) continue
      if (!proposed.keywordClusterId) {
        items.push({
          topic: row.topic,
          instructions: proposed.instructions,
          keywordClusterId: null,
          clusterPinned: false,
        })
        continue
      }
      const cluster = await tx.keywordCluster.findFirst({
        where: { id: proposed.keywordClusterId, clientSiteId: input.clientSiteId, status: { in: ['OPEN', 'PINNED'] } },
        select: { status: true },
      })
      // The autopilot wrote this one meanwhile, or the editor skipped it: a second article would compete with it.
      if (!cluster) continue
      await tx.keywordCluster.updateMany({
        where: { id: proposed.keywordClusterId, status: cluster.status },
        data: { status: 'RESERVED' },
      })
      items.push({
        topic: row.topic,
        instructions: proposed.instructions,
        keywordClusterId: proposed.keywordClusterId,
        clusterPinned: cluster.status === 'PINNED',
      })
    }
    for (const topic of input.customTopics)
      items.push({ topic, instructions: null, keywordClusterId: null, clusterPinned: false })
    if (!items.length) throw batchError(409, 'EMPTY')

    const required = articleCreditCost(site.articleQuality) * items.length
    if (wallet.available < required)
      throw batchError(402, 'INSUFFICIENT_CREDITS', { required, available: wallet.available })

    const now = new Date()
    const slots =
      input.mode === 'SPREAD'
        ? batchSlots(releaseScheduleSettings(site), input.paceHours, items.length, now)
        : // Written right away, one at a time, in the order shown.
          items.map((_, index) => new Date(now.getTime() + index))
    await tx.articleBatchItem.createMany({
      data: items.map((item, index) => ({
        ...item,
        batchId: input.id,
        clientSiteId: input.clientSiteId,
        scheduledFor: slots[index]!,
      })),
    })
    await tx.articleBatch.update({
      where: { id: input.id },
      data: {
        status: 'ACTIVE',
        mode: input.mode,
        paceHours: input.mode === 'SPREAD' ? input.paceHours : null,
        requestedById: input.userId,
        confirmedAt: now,
        proposal: [],
        proposingUntil: null,
      },
    })
    await logAction({
      action: 'ARTICLE_BATCH_CONFIRMED',
      clientSiteId: input.clientSiteId,
      userId: input.userId,
      tx,
      metadata: { batchId: input.id, mode: input.mode, paceHours: input.paceHours, items: items.length, required },
    })
    return { items: items.length }
  })

/** Running articles finish and are charged; what has not started costs nothing and frees its topic. */
export const cancelArticleBatch = async (id: string, clientSiteId: string, userId?: string) =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${clientSiteId} FOR UPDATE`
    const { count } = await tx.articleBatch.updateMany({
      where: { id, clientSiteId, status: { in: ['PROPOSED', 'ACTIVE'] }, deletedAt: null },
      data: { status: 'CANCELLED', finishedAt: new Date(), pausedUntil: null, pauseReason: null, proposingUntil: null },
    })
    if (!count) throw createError({ statusCode: 404 })
    const queued = await tx.articleBatchItem.findMany({
      where: { batchId: id, status: 'QUEUED' },
      select: { keywordClusterId: true, clusterPinned: true },
    })
    await tx.articleBatchItem.updateMany({
      where: { batchId: id, status: 'QUEUED' },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
    for (const item of queued) await releaseBatchCluster(tx, item)
    await logAction({
      action: 'ARTICLE_BATCH_CANCELLED',
      clientSiteId,
      userId,
      tx,
      metadata: { batchId: id, released: queued.length },
    })
  })

/** Slots that passed during a pause or an outage move forward, or the backlog would publish back to back. */
export const replanArticleBatch = async (
  id: string,
  now = new Date(),
  db: Pick<DatabaseTransaction, 'articleBatch' | 'articleBatchItem'> = prisma,
) => {
  const batch = await db.articleBatch.findFirst({
    where: { id, mode: 'SPREAD', status: 'ACTIVE' },
    select: {
      paceHours: true,
      clientSite: {
        select: {
          timeZone: true,
          releaseHour: true,
          releaseWindowStart: true,
          releaseWindowEnd: true,
          releaseDays: true,
          intervalMinHours: true,
          intervalMaxHours: true,
        },
      },
      items: { where: { status: 'QUEUED' }, orderBy: { scheduledFor: 'asc' }, select: { id: true } },
    },
  })
  if (!batch?.paceHours) return []
  const slots = batchSlots(releaseScheduleSettings(batch.clientSite), batch.paceHours, batch.items.length, now)
  for (const [index, item] of batch.items.entries())
    await db.articleBatchItem.updateMany({
      where: { id: item.id, status: 'QUEUED' },
      data: { scheduledFor: slots[index]! },
    })
  return slots
}

/** Another member takes the batch over, which is also the way out of a pause for lost access. */
export const resumeArticleBatch = async (id: string, clientSiteId: string, userId: string) => {
  const { count } = await prisma.articleBatch.updateMany({
    where: { id, clientSiteId, status: 'ACTIVE', pausedUntil: { not: null } },
    data: { pausedUntil: null, pauseReason: null, requestedById: userId },
  })
  if (!count) throw createError({ statusCode: 409 })
  await replanArticleBatch(id)
}

const batchRecipient = async (batchId: string) => {
  const batch = await prisma.articleBatch.findUnique({
    where: { id: batchId },
    select: {
      clientSiteId: true,
      clientSite: { select: { name: true, domain: true, logoUrl: true } },
      requestedBy: { select: { id: true, email: true, language: true, emailVerified: true, deletedAt: true } },
    },
  })
  const user = batch?.requestedBy
  return batch && user && !user.deletedAt ? { batch, user, lang: uiLanguageOf(user.language) } : null
}

/** The owners can take the plan over; a requester who lost access can do nothing about it. */
const notifyOwnersOrRequester = async (batchId: string, messageKey: string, owners: boolean) => {
  const recipient = owners ? null : await batchRecipient(batchId)
  const users = recipient
    ? [recipient.user]
    : (
        await prisma.tenantMembership.findMany({
          where: {
            role: 'OWNER',
            deletedAt: null,
            clientSite: { articleBatches: { some: { id: batchId } } },
            user: { role: { not: 'ai' }, deletedAt: null },
          },
          select: { user: { select: { id: true, language: true } } },
        })
      ).map(({ user }) => user)
  for (const user of users) {
    const lang = uiLanguageOf(user.language)
    const translate = await getServerTranslator(lang)
    await prisma.notification.create({
      data: {
        message: translate(messageKey)!.slice(0, 255),
        userId: user.id,
        link: `/${lang}/admin/credits`,
        type: 'SYSTEM',
      },
    })
  }
}

export const notifyArticleBatchPaused = (batchId: string, reason: ArticleBatchPauseReason) =>
  notifyOwnersOrRequester(batchId, `articleBatch.notifications.paused.${reason}`, reason === 'access')

export const notifyArticleBatchEnded = (batchId: string) =>
  notifyOwnersOrRequester(batchId, 'articleBatch.notifications.cancelled', false)

const notifyArticleBatchFinished = async (batchId: string) => {
  const recipient = await batchRecipient(batchId)
  if (!recipient) return
  const { batch, user, lang } = recipient
  const items = await prisma.articleBatchItem.findMany({
    where: { batchId },
    select: { status: true, article: { select: { releaseHold: true } } },
  })
  const written = items.filter((item) => item.status === 'SUCCEEDED').length
  const held = items.filter((item) => item.article?.releaseHold).length
  const failed = items.filter((item) => item.status === 'FAILED').length
  const path = `/${lang}/admin/credits`
  const translate = await getServerTranslator(lang)
  await prisma.notification.create({
    data: {
      message: translate('articleBatch.notifications.finished', { written, held, failed })!.slice(0, 255),
      userId: user.id,
      link: path,
      type: 'SYSTEM',
    },
  })
  if (!user.emailVerified) return
  const origin = import.meta.dev ? 'http://localhost:3000' : `https://${batch.clientSite.domain}`
  await sendEmail({
    to: user.email,
    lang,
    template: 'articleBatchFinished',
    data: {
      tenantName: batch.clientSite.name,
      tenantLogoUrl: batch.clientSite.logoUrl ?? '',
      written: String(written),
      held: String(held),
      failed: String(failed),
      reviewUrl: `${origin}${path}`,
    },
  })
}

/** The guarded update is the once-only claim of the summary. */
export const finishArticleBatchIfDone = async (batchId: string) => {
  const pending = await prisma.articleBatchItem.count({
    where: { batchId, status: { in: ['QUEUED', 'RUNNING'] } },
  })
  if (pending) return false
  const { count } = await prisma.articleBatch.updateMany({
    where: { id: batchId, status: 'ACTIVE' },
    data: { status: 'FINISHED', finishedAt: new Date(), pausedUntil: null, pauseReason: null },
  })
  if (!count) return false
  await notifyArticleBatchFinished(batchId).catch((error: unknown) =>
    reportCaughtError('Article batch summary failed', error, { batchId }),
  )
  return true
}

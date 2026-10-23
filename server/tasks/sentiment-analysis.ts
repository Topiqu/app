import { randomUUID } from 'node:crypto'

const BATCH_SIZE = 175
const CONCURRENCY = 4
const MAX_ATTEMPTS = 3
const LEASE_MS = 5 * 60_000

const eligibleComment = () => ({
  deletedAt: null,
  article: { deletedAt: null, clientSite: communitySiteWhere() },
})

export default defineMonitoredTask({
  meta: { name: 'sentiment-analysis', description: 'Claimed and bounded comment sentiment processing' },
  async run() {
    const now = new Date()
    const staleBefore = new Date(now.getTime() - LEASE_MS)
    const abandoned = await prisma.comment.updateMany({
      where: {
        sentimentStatus: 'PENDING',
        sentimentAttempts: { gte: MAX_ATTEMPTS },
        sentimentClaimedAt: { lt: staleBefore },
      },
      data: { sentimentStatus: 'ERROR', sentimentClaimToken: null, sentimentClaimedAt: null },
    })
    const claimable = () => ({
      ...eligibleComment(),
      sentimentStatus: 'PENDING' as const,
      sentimentAttempts: { lt: MAX_ATTEMPTS },
      OR: [{ sentimentClaimedAt: null }, { sentimentClaimedAt: { lt: staleBefore } }],
    })
    const candidates = await prisma.comment.findMany({
      where: claimable(),
      take: BATCH_SIZE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })
    const outcomes = await mapLimit(candidates, CONCURRENCY, async ({ id }) => {
      const token = randomUUID()
      const claimed = await prisma.comment.updateMany({
        where: { id, ...claimable() },
        data: { sentimentClaimToken: token, sentimentClaimedAt: new Date(), sentimentAttempts: { increment: 1 } },
      })
      if (claimed.count !== 1) return 'skipped'
      const comment = await prisma.comment.findFirst({
        where: { id, sentimentClaimToken: token, ...eligibleComment() },
        select: {
          content: true,
          sentimentAttempts: true,
          article: { select: { clientSite: { select: { id: true, plan: true } } } },
        },
      })
      if (!comment) {
        await prisma.comment.updateMany({
          where: { id, sentimentClaimToken: token },
          data: { sentimentClaimToken: null, sentimentClaimedAt: null, sentimentAttempts: 0 },
        })
        return 'skipped'
      }
      const clientSiteId = comment.article.clientSite.id
      try {
        const { object, usage } = await detectSentiment(comment.content, comment.article.clientSite.plan)
        // Usage belongs to the completed provider call even when an edit/deletion makes its result stale.
        await recordAiUsage(clientSiteId, usage.totalTokens ?? 0, 'SENTIMENT_ANALYSIS', { usage, commentId: id })
        const saved = await prisma.$transaction(async (tx) => {
          // Feature/plan mutations lock this parent first; serialize the final eligibility check with them.
          await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${clientSiteId} FOR SHARE`
          return tx.comment.updateMany({
            where: {
              id,
              sentimentClaimToken: token,
              sentimentStatus: 'PENDING',
              content: comment.content,
              ...eligibleComment(),
            },
            data: {
              sentiment: toDatabaseJson(object),
              sentimentStatus: 'PROCESSED',
              sentimentClaimToken: null,
              sentimentClaimedAt: null,
            },
          })
        })
        if (saved.count !== 1) {
          await prisma.comment.updateMany({
            where: { id, sentimentClaimToken: token },
            data: { sentimentClaimToken: null, sentimentClaimedAt: null, sentimentAttempts: 0 },
          })
          return 'skipped'
        }
        try {
          await logAction({
            action: 'SENTIMENT_PROCESSED',
            clientSiteId,
            metadata: {
              commentId: id,
              plan: comment.article.clientSite.plan,
              usage,
              score: object.score,
              label: object.label,
            },
          })
        } catch (error) {
          await reportCaughtError('Sentiment audit failed', error, { commentId: id, clientSiteId })
        }
        return 'processed'
      } catch (error) {
        await prisma.comment.updateMany({
          where: { id, sentimentClaimToken: token, sentimentStatus: 'PENDING' },
          data: {
            sentimentStatus: comment.sentimentAttempts >= MAX_ATTEMPTS ? 'ERROR' : 'PENDING',
            sentimentClaimToken: null,
          },
        })
        await reportCaughtError('Comment sentiment processing failed', error, { commentId: id, clientSiteId })
        return 'failed'
      }
    })
    return {
      result: {
        processed: outcomes.filter((outcome) => outcome === 'processed').length,
        failed: abandoned.count + outcomes.filter((outcome) => outcome === 'failed').length,
        skipped: outcomes.filter((outcome) => outcome === 'skipped').length,
        total: candidates.length,
        timestamp: now.toISOString(),
      },
    }
  },
})

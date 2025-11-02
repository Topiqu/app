export default defineTask({
  meta: {
    name: 'sentiment-analysis',
    description: 'Batch sentiment analysis with plan-based schema (PRO: basic, PREMIUM+: advanced)',
  },
  async run() {
    const batchSize = 175
    const now = new Date()

    return prisma.$transaction(async (ctx) => {
      const comments = await ctx.comment.findMany({
        where: {
          sentimentStatus: 'PENDING',
          deletedAt: null,
          article: {
            clientSite: { plan: { in: ['PRO', 'PREMIUM'] } },
          },
        },
        take: batchSize,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          article: { select: { clientSite: { select: { plan: true, id: true } } } },
        },
      })

      if (!comments.length) {
        return { result: { processed: 0, failed: 0, total: 0, timestamp: now.toISOString() } }
      }

      const results = await Promise.allSettled(
        comments.map(async (c) => {
          const { object, usage } = await detectSentiment(c.content, c.article.clientSite.plan)
          return { object, usage, clientSiteId: c.article.clientSite.id }
        }),
      )

      const updates = results.map((r, i) => {
        const comment = comments[i]
        const clientSiteId = comment!.article.clientSite.id

        if (r.status === 'fulfilled') {
          logAction({
            action: 'SENTIMENT_PROCESSED',
            clientSiteId,
            metadata: {
              commentId: comment!.id,
              plan: comment!.article.clientSite.plan,
              usage: r.value.usage,
              score: r.value.object.score,
              label: r.value.object.label,
            },
          })

          return ctx.comment.update({
            where: { id: comment!.id },
            data: { sentiment: r.value.object, sentimentStatus: 'PROCESSED' },
          })
        }

        logAction({
          action: 'SENTIMENT_FAILED',
          clientSiteId,
          metadata: { commentId: comment!.id, error: r.reason?.message || 'unknown' },
        })

        return ctx.comment.update({
          where: { id: comment!.id },
          data: { sentimentStatus: 'ERROR' },
        })
      })

      await Promise.all(updates)

      const processed = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - processed

      return {
        result: { processed, failed, total: comments.length, timestamp: now.toISOString() },
      }
    })
  },
})

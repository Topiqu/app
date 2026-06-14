export default defineMonitoredTask({
  meta: {
    name: 'publish-check',
    description: 'Publishes scheduled articles and notifies users',
  },
  async run() {
    const now = new Date()
    return prisma.$transaction(async (ctx) => {
      // console.log('now', now.toISOString())
      const articles = await ctx.article.findMany({
        where: { status: 'draft', releaseAt: { not: null, lte: now } },
        select: { id: true, title: true, userId: true, clientSiteId: true, user: { select: { username: true } } },
      })
      if (!articles.length) return { result: { count: 0, timestamp: now.toISOString() } }
      // console.log(articles)

      const articleIds = articles.map((a) => a.id)
      const update = await ctx.article.updateMany({
        where: { id: { in: articleIds }, status: 'draft' },
        data: { status: 'published', releaseAt: null },
      })

      for (const a of articles) {
        await syncArticleTranslationQueue(ctx, a.id, a.clientSiteId)
      }

      await Promise.all(
        articles.map((a) =>
          logAction({
            action: 'ARTICLE_PUBLISHED',
            userId: a.userId,
            clientSiteId: a.clientSiteId,
            metadata: { articleId: a.id, title: a.title },
          }),
        ),
      )

      await Promise.all(
        articles.map((a) =>
          ctx.notification.create({
            data: {
              message: `Tvůj naplánovaný článek "${a.title}" byl publikován`,
              userId: a.userId,
              articleId: a.id,
              type: 'ARTICLE_PUBLISHED',
            },
          }),
        ),
      )

      const notifications = []
      for (const a of articles) {
        const followers = await ctx.follow.findMany({
          where: { followedId: a.userId, follower: { allowNotifs: true } },
          select: { followerId: true },
        })
        notifications.push(
          ...followers.map((f) => ({
            message: `${a.user?.username ?? 'Autor'} vydal nový článek: ${a.title}`,
            userId: f.followerId,
            articleId: a.id,
            type: 'ARTICLE_PUBLISHED' as const,
          })),
        )
      }

      const BATCH_SIZE = 100
      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE)
        await ctx.notification.createMany({ data: batch, skipDuplicates: true })
      }

      return { result: { count: update.count, timestamp: now.toISOString() } }
    })
  },
})

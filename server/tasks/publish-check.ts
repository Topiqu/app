export default defineMonitoredTask({
  meta: {
    name: 'publish-check',
    description: 'Publishes scheduled articles and notifies users',
  },
  async run() {
    const now = new Date()
    const touched = new Set<string>()
    const result = await prisma.$transaction(async (ctx) => {
      // console.log('now', now.toISOString())
      const articles = await ctx.article.findMany({
        where: { status: 'draft', releaseAt: { not: null, lte: now } },
        select: {
          id: true,
          title: true,
          userId: true,
          clientSiteId: true,
          imageUrl: true,
          coverMediaId: true,
          content: true,
          clientSite: { select: { language: true } },
          mediaRightsSnapshots: { orderBy: { createdAt: 'desc' }, take: 1, select: { fingerprint: true } },
          user: { select: { username: true, language: true } },
        },
      })
      if (!articles.length) return { result: { count: 0, timestamp: now.toISOString() }, published: [] }
      // console.log(articles)

      const publishable = []
      const held = []
      for (const article of articles) {
        const report = await evaluateMediaRights(ctx as typeof prisma, article.clientSiteId, article)
        const approval = article.mediaRightsSnapshots[0]
        if (approval && approval.fingerprint !== report.fingerprint) {
          await ctx.article.update({ where: { id: article.id }, data: { releaseAt: null } })
          const translate = await getServerTranslator(article.user?.language || 'en')
          await ctx.notification.create({
            data: {
              message:
                translate('articles.editor.mediaRights.scheduleChanged') ||
                'Scheduled publication was paused because its media rights information changed.',
              userId: article.userId,
              articleId: article.id,
              type: 'ARTICLE_PUBLISHED',
            },
          })
          held.push(article)
        } else publishable.push({ ...article, mediaReport: report, legacySchedule: !approval })
      }

      const articleIds = publishable.map((a) => a.id)
      const update = await ctx.article.updateMany({
        where: { id: { in: articleIds }, status: 'draft' },
        data: { status: 'published', releaseAt: null },
      })

      for (const a of publishable) touched.add(a.clientSiteId)

      for (const a of publishable) {
        await syncArticleTranslationQueue(ctx, a.id, a.clientSiteId)
        if (a.legacySchedule) {
          await ctx.mediaRightsPublicationSnapshot.create({
            data: {
              articleId: a.id,
              clientSiteId: a.clientSiteId,
              language: a.clientSite.language,
              fingerprint: a.mediaReport.fingerprint,
              items: JSON.parse(JSON.stringify(mediaRightsSnapshotItems(a.mediaReport))),
              issueCount: a.mediaReport.counts.needsAttention,
              overrideConfirmed: false,
              legacySchedule: true,
            },
          })
        }
      }

      await Promise.all(
        publishable.map(async (a) => {
          const translate = await getServerTranslator(a.user?.language || 'en')
          return ctx.notification.create({
            data: {
              message: translate('common.notifications.articlePublished', [a.title])!,
              userId: a.userId,
              articleId: a.id,
              type: 'ARTICLE_PUBLISHED',
            },
          })
        }),
      )

      const notifications = []
      for (const a of publishable) {
        const followers = await ctx.follow.findMany({
          where: { followedId: a.userId, follower: { allowNotifs: true } },
          select: { followerId: true, follower: { select: { language: true } } },
        })
        const username = a.user?.username ?? 'Anonymous'

        for (const f of followers) {
          const translate = await getServerTranslator(f.follower.language || 'en')
          notifications.push({
            message: translate('common.notifications.newArticleFromFollowed', [username, a.title])!,
            userId: f.followerId,
            articleId: a.id,
            type: 'ARTICLE_PUBLISHED' as const,
          })
        }
      }

      const BATCH_SIZE = 100
      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE)
        await ctx.notification.createMany({ data: batch, skipDuplicates: true })
      }

      return {
        result: { count: update.count, held: held.length, timestamp: now.toISOString() },
        published: publishable,
      }
    })

    // The global audit-chain lock must not hold this transaction's Article locks while it waits.
    await Promise.all(
      (result.published ?? []).map((article) =>
        logAction({
          action: 'ARTICLE_PUBLISHED',
          userId: article.userId,
          clientSiteId: article.clientSiteId,
          metadata: { articleId: article.id, title: article.title },
        }),
      ),
    )

    // After commit — a rolled-back publish must not flush anyone's listings.
    await Promise.all([...touched].map(invalidateFeed))
    return { result: result.result }
  },
})

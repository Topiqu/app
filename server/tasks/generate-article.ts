import type { EventStream } from 'h3'

import slugify from 'slugify'

interface GlobalThis {
  eventStreams?: Map<string, Set<EventStream>>
}

declare const globalThis: GlobalThis

export default defineTask({
  meta: {
    name: 'generate-article',
    description: 'Generates articles using AI',
  },
  async run() {
    const now = Date.now()

    const clients = await prisma.clientSite.findMany({
      select: {
        id: true,
        users: { select: { id: true }, orderBy: { role: 'asc' }, take: 1 },
      },
      where: {
        tokenRemaining: { gt: 1000 }, // avg clanek bere okolo 5000 + imgs, takze pak asi zvysit
        OR: [
          {
            generationFrequency: 'DAILY',
            lastGeneratedAt: { gt: new Date(now - 24 * 60 * 60 * 1000) },
          },
          {
            generationFrequency: 'WEEKLY',
            lastGeneratedAt: { gt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    })

    await Promise.all(
      clients.map(async (client) => {
        const { usage, ...generated } = await generateArticle(
          client.id,
          'Create a detailed blog article on a trending topic relevant to my audience.',
        )

        await prisma.clientSite.update({
          data: { tokenRemaining: { decrement: usage.totalTokens } },
          where: { id: client.id },
        })

        await logAction({
          action: 'GENERATE_ARTICLE',
          clientSiteId: client.id,
          metadata: { ...generated, usage },
        })

        await prisma.clientSite.update({
          data: { lastGeneratedAt: new Date() },
          where: { id: client.id },
        })

        const article = await prisma.$transaction(async (ctx) => {
          const article = await ctx.article.create({
            select: { id: true, title: true, userId: true, user: { select: { username: true } } },
            data: {
              title: generated.title,
              excerpt: generated.perex,
              slug: slugify(generated.title ?? '', { lower: true, strict: true, trim: true }),
              userId: client.users[0]?.id || 'system',
              content: generated.content,
              clientSiteId: client.id,
              status: 'draft',
            },
          })

          await ctx.articleTag.createMany({
            data: generated.tags.map((tagId) => ({ articleId: article.id, tagId })),
            skipDuplicates: true,
          })

          return article
        })

        logAction({
          action: 'ARTICLE_PUBLISHED',
          userId: article.userId,
          clientSiteId: client.id,
          metadata: { articleId: article.id, title: article.title },
        })

        await prisma.$transaction(async (ctx) => {
          const notification = await ctx.notification.create({
            data: {
              message: `Tvůj naplánovaný článek "${article.title}" byl publikován`,
              userId: article.userId,
              articleId: article.id,
              type: 'ARTICLE_PUBLISHED',
            },
          })

          const streamKey = `notifications:${notification.userId}`
          const streams = globalThis.eventStreams?.get(streamKey)
          if (streams) {
            const serialized = JSON.stringify({ ...notification, count: 1 })
            streams.forEach((stream) => stream.push(serialized))
          }

          const followers = await ctx.follow.findMany({
            where: { followedId: article.userId, follower: { allowNotifs: true } },
            select: { followerId: true },
          })
          const notifications = []
          notifications.push(
            ...followers.map((f) => ({
              message: `${article.user?.username ?? 'Autor'} vydal nový článek: ${article.title}`,
              userId: f.followerId,
              articleId: article.id,
              type: 'ARTICLE_PUBLISHED' as const,
            })),
          )

          const BATCH_SIZE = 100
          for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
            const batch = notifications.slice(i, i + BATCH_SIZE)
            await ctx.notification.createMany({ data: batch, skipDuplicates: true })
            batch.forEach((notification) => {
              const streamKey = `notifications:${notification.userId}`
              const streams = globalThis.eventStreams?.get(streamKey)
              if (streams) {
                const serialized = JSON.stringify({ ...notification, count: 1 })
                streams.forEach((stream) => stream.push(serialized))
              }
            })
          }

          return article
        })
      }),
    )

    return { result: { count: clients.length, timestamp: now } }
  },
})

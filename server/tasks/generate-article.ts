import slugify from 'slugify'

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
        const { usage, ...article } = await generateArticle(
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
          metadata: { ...article, usage },
          userId: 'system',
        })

        await prisma.clientSite.update({
          data: { lastGeneratedAt: new Date() },
          where: { id: client.id },
        })

        await prisma.$transaction(async (ctx) => {
          const { id: articleId } = await ctx.article.create({
            data: {
              title: article.title,
              excerpt: article.perex,
              slug: slugify(article.title ?? '', { lower: true, strict: true, trim: true }),
              userId: client.users[0]?.id || 'system',
              content: article.content,
              clientSiteId: client.id,
              status: 'draft',
            },
          })

          await ctx.articleTag.createMany({
            data: article.tags.map((tagId) => ({ articleId, tagId })),
            skipDuplicates: true,
          })
        })

        return article
      }),
    )

    return { result: { count: clients.length, timestamp: now } }
  },
})

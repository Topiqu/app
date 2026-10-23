export default defineEventHandler(async (event) => {
  const clientSite = await requireExternalClient(event)
  const where = { clientSiteId: clientSite.id, ...publicArticleWhere() }

  const tags = await prisma.tag.findMany({
    where: {
      articles: { some: { article: where } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      articles: {
        where: { article: where },
        select: { articleId: true },
      },
    },
    orderBy: [{ name: 'asc' }, { slug: 'asc' }],
  })

  return {
    data: tags.map(({ articles, ...tag }) => ({ ...tag, articleCount: articles.length })),
    meta: { total: tags.length },
  }
})

export default defineEventHandler(async (event) => {
  const clientSite = await requireExternalClient(event)

  const tags = await prisma.tag.findMany({
    where: {
      articles: { some: { article: { clientSiteId: clientSite.id, status: 'published' } } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      articles: {
        where: { article: { clientSiteId: clientSite.id, status: 'published' } },
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

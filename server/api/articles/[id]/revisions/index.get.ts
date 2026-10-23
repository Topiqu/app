export default defineEventHandler(async (event): Promise<ArticleRevisionSummary[]> => {
  const { id } = getRouterParams(event) as { id: string }
  const { user } = await requireArticleAccess(event, id)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const db = await getEnhancedPrisma(user)
  return db.articleRevision.findMany({
    where: { articleId: id },
    orderBy: { version: 'desc' },
    take: 50,
    select: { id: true, version: true, title: true, actorName: true, createdAt: true },
  })
})

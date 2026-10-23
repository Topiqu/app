export default defineEventHandler(async (event): Promise<ArticleRevisionSnapshot> => {
  const { id, revisionId } = getRouterParams(event) as { id: string; revisionId: string }
  const { user } = await requireArticleAccess(event, id)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (!(await consumeRateLimit(`article-revision:${user.id}`, 60, 600))) throw createError({ statusCode: 429 })
  const db = await getEnhancedPrisma(user)
  const revision = await db.articleRevision.findFirst({
    where: { id: revisionId, articleId: id },
    select: { snapshot: true },
  })
  if (!revision) throw createError({ statusCode: 404 })
  const snapshot = articleRevisionSnapshot.parse(revision.snapshot)
  // Removed tags cannot be attached again when restoring an older draft.
  const tags = snapshot.tagIds.length
    ? await db.tag.findMany({
        where: { id: { in: snapshot.tagIds }, clientSiteId: user.clientSiteId! },
        select: { id: true },
      })
    : []
  return { ...snapshot, tagIds: tags.map((tag) => tag.id), content: sanitizeHtml(snapshot.content) }
})

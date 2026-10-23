export const tagFeedTenants = async (
  db: Awaited<ReturnType<typeof getEnhancedPrisma>>,
  tag: { id: string; clientSiteId: string | null },
) => {
  if (tag.clientSiteId) return [tag.clientSiteId]
  const articles = await db.article.findMany({
    where: { tags: { some: { tagId: tag.id } }, clientSite: { deletedAt: null } },
    distinct: ['clientSiteId'],
    select: { clientSiteId: true },
  })
  return articles.map((article) => article.clientSiteId)
}

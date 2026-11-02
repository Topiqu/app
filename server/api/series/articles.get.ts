import { z } from 'zod'

const querySchema = z.object({ query: z.string().trim().max(255).default('') })

export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const db = await getEnhancedPrisma(user)
  const { skip, take } = await getPagination(event)
  const { query } = await getValidatedQuery(event, querySchema.parse)
  const where = {
    clientSiteId: membership.clientSiteId,
    deletedAt: null,
    articleSeriesId: null,
    ...(!hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS') ? { userId: user.id } : {}),
    ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}),
  }
  const [articles, total] = await Promise.all([
    db.article.findMany({
      where,
      select: { id: true, title: true, imageUrl: true, language: true, status: true, releaseAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take,
    }),
    db.article.count({ where }),
  ])
  const now = new Date()
  return {
    data: articles.map((article) => ({
      ...article,
      // A scheduled article is a draft with a future release, the same rule as `Article/StatusCell.vue`.
      scheduled: !!article.releaseAt && article.releaseAt > now,
    })),
    total,
  }
})

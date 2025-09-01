import type { SharePlatform } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

  const db = await getEnhancedPrisma()
  const articles = await db.article.findMany({
    where: { status: 'published', clientSiteId: user.clientSiteId },
    select: { shared: true },
  })

  const totalShares = articles.reduce((sum, article) => sum + article.shared, 0)
  const shares = await db.articleShare.groupBy({
    by: ['platform'],
    where: { article: { status: 'published', clientSiteId: user.clientSiteId } },
    _count: { platform: true },
  })

  const distribution: Record<SharePlatform, number> = {
    TWITTER: 0,
    LINKEDIN: 0,
    FACEBOOK: 0,
    EMAIL: 0,
    OTHER: 0,
  }

  shares.forEach((s) => {
    distribution[s.platform] = s._count.platform
  })

  return {
    totalShares,
    distribution,
  }
})

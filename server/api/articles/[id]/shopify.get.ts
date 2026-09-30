import { requireShopifyAccess } from '../../../utils/shopify/access'
import { shopifyPublicationSelect } from '../../../utils/shopify/publication'

export default defineEventHandler(async (event) => {
  const { db, site } = await requireShopifyAccess(event, 'ARTICLE_WRITE')
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: 'Missing article' })
  const article = await db.article.findFirst({ where: { id: articleId, clientSiteId: site.id }, select: { id: true } })
  if (!article) throw createError({ statusCode: 404, message: 'Article not found' })
  return db.shopifyPublication.findFirst({
    where: { articleId, clientSiteId: site.id },
    select: shopifyPublicationSelect,
  })
})

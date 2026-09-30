import { z } from 'zod'

import { escapeHtml } from '../../../utils/sanitize'
import { requireShopifyAccess } from '../../../utils/shopify/access'
import { publishShopifyArticle, shopifyPublicationSelect } from '../../../utils/shopify/publication'
import { exportShopifyContent, shopifyHandle, type ShopifyArticlePayload } from '../../../utils/shopify/content'

const Request = z.object({
  mode: z.enum(['draft', 'published']),
  mediaRightsReview: z.object({ fingerprint: z.string(), acknowledged: z.literal(true) }).optional(),
})

export default defineEventHandler(async (event) => {
  const { db, site, user } = await requireShopifyAccess(event, 'ARTICLE_PUBLISH')
  await requireTenantScope(event, 'ARTICLE_WRITE', site.id)
  const { membership } = await requireTenantScope(event, 'ARTICLE_PUBLISH', site.id)
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: 'Missing article' })
  const parsed = Request.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid Shopify publication request' })
  const article = await db.article.findFirst({
    where: { id: articleId, clientSiteId: site.id },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      imageUrl: true,
      imageCredit: true,
      answer: true,
      keyTakeaways: true,
      faq: true,
      sources: true,
      userId: true,
      language: true,
      coverMediaId: true,
      tags: { select: { tag: { select: { name: true } } } },
      clientSite: { select: { domain: true } },
    },
  })
  if (!article) throw createError({ statusCode: 404, message: 'Article not found' })
  if (article.userId !== user.id && !hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS'))
    throw createError({ statusCode: 403, message: 'Missing tenant scope: ARTICLE_WRITE_OTHERS' })
  const connection = await db.shopifyConnection.findUnique({
    where: { clientSiteId: site.id },
    select: { id: true, status: true, blogId: true, author: true },
  })
  if (!connection || connection.status !== 'CONNECTED' || !connection.blogId || !connection.author)
    throw createError({ statusCode: 409, message: 'Connect Shopify and choose a blog and author first' })
  const report = await requireMediaRightsReview(prisma, site.id, article, parsed.data.mediaRightsReview)
  const content = await applyMediaAttributions(site.id, article.content)
  const payload: ShopifyArticlePayload = {
    blogId: connection.blogId,
    author: { name: connection.author },
    title: article.title,
    handle: shopifyHandle(article.slug, article.id),
    body: exportShopifyContent({ ...article, content }, `https://${article.clientSite.domain}`, article.language),
    summary: article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : '',
    tags: article.tags.map(({ tag }) => tag.name),
    isPublished: parsed.data.mode === 'published',
    image: article.imageUrl ? { url: article.imageUrl, altText: article.title } : null,
  }
  await createMediaRightsSnapshot(prisma, {
    articleId,
    clientSiteId: site.id,
    language: article.language,
    report,
    confirmedById: user.id,
  })
  const publication = await db.$transaction(async (tx) => {
    const existing = await tx.shopifyPublication.findUnique({
      where: { connectionId_articleId: { connectionId: connection.id, articleId } },
      select: { id: true, status: true, blogId: true, handle: true, shopifyArticleId: true },
    })
    if (existing && ['QUEUED', 'PUBLISHING'].includes(existing.status))
      throw createError({ statusCode: 409, message: 'This article is already being sent to Shopify' })
    if (existing) {
      // Keep the original target and handle, including on a retry after an uncertain create.
      payload.blogId = existing.blogId
      payload.handle = existing.handle
      const updated = await tx.shopifyPublication.updateMany({
        where: { id: existing.id, status: existing.status },
        data: {
          payload: JSON.parse(JSON.stringify(payload)),
          status: 'QUEUED',
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
        },
      })
      if (!updated.count)
        throw createError({ statusCode: 409, message: 'Shopify publication changed; refresh and retry' })
      return { id: existing.id }
    }
    return tx.shopifyPublication.create({
      data: {
        clientSiteId: site.id,
        articleId,
        connectionId: connection.id,
        blogId: payload.blogId,
        handle: payload.handle,
        payload: JSON.parse(JSON.stringify(payload)),
      },
      select: { id: true },
    })
  })
  await publishShopifyArticle(publication.id)
  return db.shopifyPublication.findUnique({ where: { id: publication.id }, select: shopifyPublicationSelect })
})

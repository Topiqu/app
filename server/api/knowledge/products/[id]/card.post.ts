/** Prepares a card the editor inserts: copies the product image to our CDN once, then returns the ref. */
export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const clientSiteId = user.clientSiteId!
  const db = await getEnhancedPrisma(user)
  const product = await db.knowledgeProduct.findFirst({
    where: { id: getRouterParam(event, 'id'), clientSiteId, source: { deletedAt: null } },
    select: {
      id: true,
      clientSiteId: true,
      name: true,
      url: true,
      imageUrl: true,
      cdnImageUrl: true,
      cdnImageSource: true,
    },
  })
  if (!product) throw createError({ statusCode: 404, message: 'Product not found' })
  // Each new image is one fetch from the shop's host.
  if (await consumeRateLimit(`product-card:${clientSiteId}`, 120, 60 * 60)) await copyProductImage(product)
  return { productId: product.id, url: product.url, name: product.name }
})

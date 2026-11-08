import { z } from 'zod'

/** The editor's product picker: in-stock products of the author's own site. */
export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const { q } = await getValidatedQuery(event, z.object({ q: z.string().trim().max(100).default('') }).parse)
  const db = await getEnhancedPrisma(user)
  const products = await db.knowledgeProduct.findMany({
    where: {
      clientSiteId: user.clientSiteId!,
      availability: { not: 'OUT_OF_STOCK' },
      source: { deletedAt: null },
      ...(q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { name: 'asc' },
    take: 20,
    select: { id: true, name: true, brand: true, price: true, currency: true, availability: true, cdnImageUrl: true },
  })
  return products.map(({ price, ...product }) => ({ ...product, price: price?.toString() ?? null }))
})

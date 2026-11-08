import * as cheerio from 'cheerio'

type ProductDb = { knowledgeProduct: { findMany: (args: any) => Promise<any[]> } }

type LiveProduct = {
  id: string
  name: string
  url: string
  price: { toString: () => string } | null
  currency: string | null
  availability: string
  cdnImageUrl: string | null
}

const LIVE = ['data-name', 'data-url', 'data-price', 'data-currency', 'data-availability', 'data-image'] as const

/**
 * Stamps each card with today's catalog facts and unwraps a sold-out or removed product to its
 * plain link. Every live attribute is rewritten, so a URL an author typed into the body never renders.
 * `clientSiteId` must come from the resolved article: product ids in a body are author input.
 */
export const resolveProductCards = async (
  db: ProductDb,
  content: string | null | undefined,
  { clientSiteId }: { clientSiteId: string },
) => {
  if (!content?.includes('data-type="product"')) return content ?? ''

  const $ = cheerio.load(content, null, false)
  const cards = $('div[data-type="product"]').toArray()
  const ids = [...new Set(cards.flatMap((el) => $(el).attr('data-product-id') || []))]
  const products: LiveProduct[] = ids.length
    ? await db.knowledgeProduct.findMany({
        where: {
          clientSiteId,
          id: { in: ids },
          availability: { not: 'OUT_OF_STOCK' },
          source: { deletedAt: null },
        },
        select: { id: true, name: true, url: true, price: true, currency: true, availability: true, cdnImageUrl: true },
      })
    : []
  const byId = new Map(products.map((product) => [product.id, product]))

  for (const el of cards) {
    const card = $(el)
    const product = byId.get(card.attr('data-product-id') ?? '')
    if (!product) {
      card.replaceWith(card.contents())
      continue
    }
    for (const name of LIVE) card.removeAttr(name)
    card.attr({
      'data-name': product.name,
      'data-url': product.url,
      'data-availability': product.availability,
      ...(product.price && product.currency
        ? { 'data-price': product.price.toString(), 'data-currency': product.currency }
        : {}),
      ...(product.cdnImageUrl ? { 'data-image': product.cdnImageUrl } : {}),
    })
    card.find('a').attr('href', product.url).text(product.name)
  }

  return $.html()
}

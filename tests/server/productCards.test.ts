import { describe, expect, it, vi } from 'vitest'

import { productCardHtml } from '../../shared/utils/articleEmbeds'
import { resolveProductCards } from '../../server/utils/productCards'

const live = {
  id: 'p1',
  name: 'Rýč Pro',
  url: 'https://shop.test/ryc-pro',
  price: { toString: () => '1290.00' },
  currency: 'CZK',
  availability: 'IN_STOCK',
  cdnImageUrl: 'https://cdn.test/knowledge/products/site/p1.webp',
}

const db = (rows: unknown[]) => {
  const findMany = vi.fn(async () => rows)
  return { db: { knowledgeProduct: { findMany } }, findMany }
}

describe('resolveProductCards', () => {
  it("stamps today's facts and rewrites what an author could have typed", async () => {
    const stale = productCardHtml({ productId: 'p1', url: 'https://shop.test/old', name: 'Rýč' }).replace(
      '<div data-type="product"',
      '<div data-type="product" data-image="https://evil.test/x.png"',
    )
    const { db: products, findMany } = db([live])
    const html = await resolveProductCards(products, `<p>Úvod</p>${stale}`, { clientSiteId: 'site' })

    expect(html).toContain('data-url="https://shop.test/ryc-pro"')
    expect(html).toContain('data-name="Rýč Pro"')
    expect(html).toContain('data-price="1290.00" data-currency="CZK"')
    expect(html).toContain('data-image="https://cdn.test/knowledge/products/site/p1.webp"')
    expect(html).not.toContain('evil.test')
    expect(html).toContain('<a href="https://shop.test/ryc-pro">Rýč Pro</a>')
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientSiteId: 'site',
          id: { in: ['p1'] },
          availability: { not: 'OUT_OF_STOCK' },
          source: { deletedAt: null },
        },
      }),
    )
  })

  it('leaves a sold-out, removed or foreign product as its plain link', async () => {
    const body = productCardHtml({ productId: 'gone', url: 'https://shop.test/ryc', name: 'Rýč' })
    const html = await resolveProductCards(db([]).db, body, { clientSiteId: 'site' })
    expect(html).toBe('<p><a href="https://shop.test/ryc">Rýč</a></p>')
  })

  it('never queries for a body without cards', async () => {
    const { db: products, findMany } = db([])
    expect(await resolveProductCards(products, '<p>Text</p>', { clientSiteId: 'site' })).toBe('<p>Text</p>')
    expect(findMany).not.toHaveBeenCalled()
  })

  it('omits the price without a currency', async () => {
    const html = await resolveProductCards(
      db([{ ...live, currency: null, cdnImageUrl: null }]).db,
      productCardHtml({ productId: 'p1', url: live.url, name: live.name }),
      { clientSiteId: 'site' },
    )
    expect(html).not.toContain('data-price')
    expect(html).not.toContain('data-image')
  })
})

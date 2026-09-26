import { describe, expect, it } from 'vitest'

import { ARTICLE_PACK_LIST } from '../../shared/utils/articlePacks'
import { buildArticlePackViews, PACK_PRESENTATION } from '../../app/utils/articlePackPresentation'

const translate = (key: string) => `t:${key}`

describe('buildArticlePackViews', () => {
  it('derives every view from the shared catalog, never from local prices', () => {
    const views = buildArticlePackViews(translate, 'en-US')

    expect(views.map((v) => v.id)).toEqual(ARTICLE_PACK_LIST.map((p) => p.id))
    expect(views.map((v) => v.price)).toEqual(['$8.99', '$14.99', '$22.49'])
  })

  it('labels packs through i18n keys and marks exactly one pack as featured', () => {
    const views = buildArticlePackViews(translate, 'en-US')

    expect(views.map((v) => v.name)).toEqual([
      't:common.articlePacks.pack5',
      't:common.articlePacks.pack12',
      't:common.articlePacks.pack25',
    ])
    expect(views.filter((v) => v.featured).map((v) => v.id)).toEqual(['25'])
  })

  it('shows exact article quantities', () => {
    expect(buildArticlePackViews(translate, 'en-US').map((v) => v.articles)).toEqual([5, 12, 25])
  })

  it('calculates honest volume discounts against the entry pack unit price', () => {
    const views = buildArticlePackViews(translate, 'en-US')

    expect(views.map((view) => view.volumeDiscount)).toEqual([0, 30, 50])
  })

  it('formats price for the active locale', () => {
    const [pack] = buildArticlePackViews(translate, 'cs-CZ')

    expect(pack?.price).toMatch(/8,99/)
  })

  it('degrades gracefully for a pack with no presentation entry', () => {
    const views = buildArticlePackViews(translate, 'en-US', [
      { id: '99', articles: 99, priceUsd: 99.99, name: '99 extra articles' },
    ])

    expect(views[0]).toMatchObject({
      name: '99 extra articles',
      featured: false,
      articles: 99,
    })
  })

  it('keeps a presentation entry for every catalog pack so none falls back to its raw English name', () => {
    for (const pack of ARTICLE_PACK_LIST) {
      expect(PACK_PRESENTATION[pack.id]?.label, `missing presentation for pack ${pack.id}`).toBeTruthy()
    }
  })
})

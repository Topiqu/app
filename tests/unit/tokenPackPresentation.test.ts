import { describe, expect, it } from 'vitest'

import { TOKEN_PACK_LIST } from '../../shared/utils/tokenPacks'
import {
  buildTokenPackViews,
  FALLBACK_PACK_ICON,
  PACK_PRESENTATION,
  TOKENS_PER_ARTICLE,
} from '../../app/utils/tokenPackPresentation'

const translate = (key: string) => `t:${key}`

describe('buildTokenPackViews', () => {
  it('derives every view from the shared catalog, never from local prices', () => {
    const views = buildTokenPackViews(translate, 'en-US')

    expect(views.map((v) => v.id)).toEqual(TOKEN_PACK_LIST.map((p) => p.id))
    expect(views.map((v) => v.price)).toEqual(['$2.99', '$4.99', '$9.99', '$11.19'])
  })

  it('labels packs through i18n keys and marks exactly one pack as featured', () => {
    const views = buildTokenPackViews(translate, 'en-US')

    expect(views.map((v) => v.name)).toEqual([
      't:common.tokens.pack10k',
      't:common.tokens.pack25k',
      't:common.tokens.pack50k',
      't:common.tokens.pack75k',
    ])
    expect(views.filter((v) => v.featured).map((v) => v.id)).toEqual(['75000'])
  })

  it('estimates articles by flooring tokens against the per-article cost', () => {
    const views = buildTokenPackViews(translate, 'en-US')

    expect(views.map((v) => v.articles)).toEqual(TOKEN_PACK_LIST.map((p) => Math.floor(p.tokens / TOKENS_PER_ARTICLE)))
    expect(views.map((v) => v.articles)).toEqual([2, 5, 10, 15])
  })

  it('calculates honest value gains against the entry pack', () => {
    const views = buildTokenPackViews(translate, 'en-US')

    expect(views.map((view) => view.valueBonus)).toEqual([0, 50, 50, 100])
  })

  it('formats price for the active locale', () => {
    const [pack] = buildTokenPackViews(translate, 'cs-CZ')

    expect(pack?.price).toMatch(/2,99/)
  })

  it('degrades gracefully for a pack with no presentation entry', () => {
    const views = buildTokenPackViews(translate, 'en-US', [
      { id: '99999', tokens: 99000, priceUsd: 19.99, name: 'Token Pack 99k' },
    ])

    expect(views[0]).toMatchObject({
      name: 'Token Pack 99k',
      icon: FALLBACK_PACK_ICON,
      featured: false,
      articles: 19,
    })
  })

  it('keeps a presentation entry for every catalog pack so none falls back to its raw English name', () => {
    for (const pack of TOKEN_PACK_LIST) {
      expect(PACK_PRESENTATION[pack.id]?.label, `missing presentation for pack ${pack.id}`).toBeTruthy()
    }
  })
})

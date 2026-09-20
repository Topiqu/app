import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { planFromPriceId } from '../../server/utils/stripeWebhook'
import { ARTICLE_PACKS, getArticlePack } from '../../shared/utils/articlePacks'

describe('getArticlePack', () => {
  it('returns the pack for a known id with server-side price and article count', () => {
    const pack = getArticlePack('25')
    expect(pack).toEqual(ARTICLE_PACKS['25'])
    expect(pack?.priceUsd).toBe(29.99)
    expect(pack?.articles).toBe(25)
  })

  it('rejects unknown or malformed ids (price tampering guard)', () => {
    expect(getArticlePack('99999')).toBeNull()
    expect(getArticlePack('')).toBeNull()
    expect(getArticlePack(undefined)).toBeNull()
    expect(getArticlePack(25)).toBeNull()
  })
})

describe('planFromPriceId', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO = 'price_pro_123'
    process.env.STRIPE_PRICE_PREMIUM = 'price_premium_456'
  })
  afterEach(() => {
    delete process.env.STRIPE_PRICE_PRO
    delete process.env.STRIPE_PRICE_PREMIUM
  })

  it('reverse-maps configured price IDs to plans', () => {
    expect(planFromPriceId('price_pro_123')).toBe('PRO')
    expect(planFromPriceId('price_premium_456')).toBe('PREMIUM')
  })

  it('returns null for unknown / empty price IDs', () => {
    expect(planFromPriceId('price_unknown')).toBeNull()
    expect(planFromPriceId(null)).toBeNull()
    expect(planFromPriceId(undefined)).toBeNull()
  })
})

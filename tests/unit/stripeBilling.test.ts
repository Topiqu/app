import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getTokenPack, TOKEN_PACKS } from '../../shared/utils/tokenPacks'
import { planFromPriceId } from '../../server/utils/stripeWebhook'

describe('getTokenPack', () => {
  it('returns the pack for a known id with server-side price + tokens', () => {
    const pack = getTokenPack('25000')
    expect(pack).toEqual(TOKEN_PACKS['25000'])
    expect(pack?.priceUsd).toBe(4.99)
    expect(pack?.tokens).toBe(25000)
  })

  it('rejects unknown or malformed ids (price tampering guard)', () => {
    expect(getTokenPack('99999')).toBeNull()
    expect(getTokenPack('')).toBeNull()
    expect(getTokenPack(undefined)).toBeNull()
    expect(getTokenPack(25000)).toBeNull()
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

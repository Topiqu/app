import { describe, expect, it } from 'vitest'

import { usdCrossRate, type FxRate } from '../../../server/utils/currency'

const rates: FxRate[] = [
  { currencyCode: 'USD', amount: 1, rate: 23 },
  { currencyCode: 'EUR', amount: 1, rate: 25 },
  { currencyCode: 'HUF', amount: 100, rate: 6.2 },
]

describe('usdCrossRate (USD base)', () => {
  it('USD → USD is identity', () => {
    expect(usdCrossRate(rates, 'USD')).toBe(1)
  })

  it('USD → CZK equals CZK-per-USD', () => {
    expect(usdCrossRate(rates, 'CZK')).toBe(23)
    expect(usdCrossRate(rates, 'czk')).toBe(23)
  })

  it('USD → EUR cross-converts via CZK (23/25)', () => {
    expect(usdCrossRate(rates, 'EUR')).toBeCloseTo(0.92, 5)
  })

  it('normalizes CNB amount (HUF quoted per 100)', () => {
    expect(usdCrossRate(rates, 'HUF')).toBeCloseTo(23 / (6.2 / 100), 5)
  })

  it('falls back to 1 for unknown or invalid currencies', () => {
    expect(usdCrossRate(rates, 'XYZ')).toBe(1)
    expect(usdCrossRate([{ currencyCode: 'USD', amount: 1, rate: 0 }], 'CZK')).toBe(1)
  })
})

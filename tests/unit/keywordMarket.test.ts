import { describe, expect, it } from 'vitest'

import { keywordLocation, keywordMarketFor } from '../../shared/utils/keywordPlan'

describe('keyword markets', () => {
  it('defaults to the home market of the article language', () => {
    expect(keywordLocation('cs')).toEqual({
      market: 'CZ',
      languageCode: 'cs',
      labsLocationCode: 2203,
      serpLocationCode: 2203,
    })
    expect(keywordMarketFor('de', null)).toBe('DE')
  })

  it('uses another country with data in that language', () => {
    expect(keywordLocation('de', 'AT')).toMatchObject({ market: 'AT', labsLocationCode: 2040, serpLocationCode: 2040 })
  })

  it('asks Labs worldwide for GLOBAL but keeps the home country for SERP and news', () => {
    expect(keywordLocation('en', 'GLOBAL')).toMatchObject({ labsLocationCode: null, serpLocationCode: 2840 })
  })

  it('falls back when the market has no data in the language', () => {
    expect(keywordMarketFor('cs', 'GLOBAL')).toBe('CZ')
    expect(keywordMarketFor('fr', 'GB')).toBe('FR')
  })
})

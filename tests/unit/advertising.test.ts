import { describe, expect, it } from 'vitest'
import { FEED_AD_AFTER, tenantGamEnabled } from '~~/shared/utils/advertising'

describe('tenantGamEnabled', () => {
  it('serves the tenant network on paid plans', () => {
    expect(tenantGamEnabled({ plan: 'PRO', gamNetworkCode: '123' })).toBe(true)
    expect(tenantGamEnabled({ plan: 'PREMIUM', gamNetworkCode: ' 123 ' })).toBe(true)
    expect(tenantGamEnabled({ plan: 'CUSTOM', gamNetworkCode: '123' })).toBe(true)
  })

  it('does not activate a leftover GAM code on BASIC', () => {
    expect(tenantGamEnabled({ plan: 'BASIC', gamNetworkCode: '123' })).toBe(false)
  })

  it('ignores a missing site or blank network code', () => {
    expect(tenantGamEnabled(null)).toBe(false)
    expect(tenantGamEnabled({ plan: 'PRO', gamNetworkCode: '  ' })).toBe(false)
    expect(tenantGamEnabled({ plan: 'PRO' })).toBe(false)
  })
})

describe('FEED_AD_AFTER', () => {
  it('places the slot after a full row at every grid width', () => {
    for (const columns of [1, 2, 3]) expect(FEED_AD_AFTER % columns).toBe(0)
  })
})

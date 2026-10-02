import { describe, expect, it } from 'vitest'
import { FEED_AD_AFTER, adProviderFor } from '~~/shared/utils/advertising'

const granted = { marketing: true, adsenseSlot: '1234567890' }

describe('adProviderFor', () => {
  it('serves platform AdSense on BASIC', () => {
    expect(adProviderFor({ plan: 'BASIC' }, granted)).toBe('adsense')
  })

  it('keeps BASIC inventory on AdSense even with a leftover GAM code', () => {
    expect(adProviderFor({ plan: 'BASIC', gamNetworkCode: '123' }, granted)).toBe('adsense')
  })

  it('renders nothing on BASIC until the AdSense unit is configured', () => {
    expect(adProviderFor({ plan: 'BASIC' }, { marketing: true, adsenseSlot: ' ' })).toBeNull()
  })

  it('serves the tenant GAM unit on paid plans that set a network code', () => {
    expect(adProviderFor({ plan: 'PRO', gamNetworkCode: '123' }, granted)).toBe('gam')
    expect(adProviderFor({ plan: 'PREMIUM', gamNetworkCode: '  ' }, granted)).toBeNull()
    expect(adProviderFor({ plan: 'PRO' }, granted)).toBeNull()
  })

  it('never renders without marketing consent', () => {
    expect(adProviderFor({ plan: 'BASIC' }, { ...granted, marketing: false })).toBeNull()
    expect(adProviderFor({ plan: 'PRO', gamNetworkCode: '123' }, { ...granted, marketing: false })).toBeNull()
  })

  it('places the slot after a full row at every grid width', () => {
    for (const columns of [1, 2, 3]) expect(FEED_AD_AFTER % columns).toBe(0)
  })
})

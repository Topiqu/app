import { describe, expect, it } from 'vitest'
import { FEED_AD_AFTER, adProviderFor } from '~~/shared/utils/advertising'

const granted = { marketing: true, adsenseSlot: '1234567890' }

describe('adProviderFor', () => {
  it('does not serve platform AdSense on BASIC while advertising is halted', () => {
    expect(adProviderFor({ plan: 'BASIC' }, granted)).toBeNull()
  })

  it('does not activate a leftover GAM code on BASIC', () => {
    expect(adProviderFor({ plan: 'BASIC', gamNetworkCode: '123' }, granted)).toBeNull()
  })

  it('renders nothing on BASIC until the AdSense unit is configured', () => {
    expect(adProviderFor({ plan: 'BASIC' }, { marketing: true, adsenseSlot: ' ' })).toBeNull()
  })

  it('does not activate retained GAM configuration on paid plans', () => {
    expect(adProviderFor({ plan: 'PRO', gamNetworkCode: '123' }, granted)).toBeNull()
    expect(adProviderFor({ plan: 'PREMIUM', gamNetworkCode: '  ' }, granted)).toBeNull()
    expect(adProviderFor({ plan: 'PRO' }, granted)).toBeNull()
  })

  it('does not request advertising regardless of the stored Marketing choice', () => {
    expect(adProviderFor({ plan: 'BASIC' }, { ...granted, marketing: false })).toBeNull()
    expect(adProviderFor({ plan: 'PRO', gamNetworkCode: '123' }, { ...granted, marketing: false })).toBeNull()
  })

  it('places the slot after a full row at every grid width', () => {
    for (const columns of [1, 2, 3]) expect(FEED_AD_AFTER % columns).toBe(0)
  })
})

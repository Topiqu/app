import { describe, expect, it } from 'vitest'
import { getUpgradeTarget } from '~~/shared/utils/plans'

describe('plan upgrade ladder', () => {
  it('walks BASIC → PRO → PREMIUM and stops at the top', () => {
    expect(getUpgradeTarget('BASIC')).toBe('PRO')
    expect(getUpgradeTarget('PRO')).toBe('PREMIUM')
    expect(getUpgradeTarget('PREMIUM')).toBeNull()
  })

  it('never offers an upgrade to CUSTOM or to a site without a plan', () => {
    expect(getUpgradeTarget('CUSTOM')).toBeNull()
    expect(getUpgradeTarget(null)).toBeNull()
    expect(getUpgradeTarget(undefined)).toBeNull()
  })

  it('hides the checkout upgrade for active subscribers — those go through the Stripe portal for correct proration', () => {
    expect(getUpgradeTarget('BASIC', true)).toBeNull()
    expect(getUpgradeTarget('PRO', true)).toBeNull()
  })
})

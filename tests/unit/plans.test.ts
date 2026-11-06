import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getUpgradeTarget, getUpgradeTargets, manualBillingPlan, planName } from '~~/shared/utils/plans'

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

  it('gives hand-provisioned PRO/PREMIUM a permanent contract so their AI budget is funded', () => {
    expect(manualBillingPlan('PRO')).toBe('PERMANENT')
    expect(manualBillingPlan('PREMIUM')).toBe('PERMANENT')
    expect(manualBillingPlan('BASIC')).toBeUndefined()
    expect(manualBillingPlan('CUSTOM')).toBeUndefined()

    const create = readFileSync('server/api/clients/index.post.ts', 'utf8')
    expect(create).toContain('billingPlan: manualBillingPlan(body.plan)')
    expect(create).toContain('await syncPlanFeatures(tx, clientSite.id)')
  })

  it('names plans as the pricing page does', () => {
    expect(planName('BASIC')).toBe('Free')
    expect(planName('PREMIUM')).toBe('Premium')
    expect(planName('UNKNOWN')).toBe('UNKNOWN')
  })

  it('lets BASIC choose between PRO and PREMIUM, cheapest first', () => {
    expect(getUpgradeTargets('BASIC')).toEqual(['PRO', 'PREMIUM'])
    expect(getUpgradeTargets('PRO')).toEqual(['PREMIUM'])
    expect(getUpgradeTargets('PREMIUM')).toEqual([])
    expect(getUpgradeTargets('CUSTOM')).toEqual([])
    expect(getUpgradeTargets('BASIC', true)).toEqual([])
  })
})

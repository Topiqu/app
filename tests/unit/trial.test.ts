import { describe, expect, it } from 'vitest'
import {
  TRIAL_DAYS,
  TRIAL_PLAN,
  isInTrial,
  needsTrialDowngrade,
  trialDaysLeft,
  trialEndsAt,
  trialExpired,
} from '~~/shared/utils/trial'

const NOW = new Date('2026-08-09T12:00:00Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

const trialing = { plan: TRIAL_PLAN, createdAt: daysBefore(3), firstPaidAt: null, stripeSubscriptionId: null }
const expired = { ...trialing, createdAt: daysBefore(TRIAL_DAYS + 1) }

describe('trial predicates', () => {
  it('counts a fresh card-less signup as trialing', () => {
    expect(isInTrial(trialing, NOW)).toBe(true)
    expect(trialExpired(trialing, NOW)).toBe(false)
    expect(trialDaysLeft(trialing, NOW)).toBe(TRIAL_DAYS - 3)
  })

  it('reads firstPaidAt, not the plan — a paying PREMIUM tenant is never trialing', () => {
    const paying = { ...trialing, firstPaidAt: daysBefore(2) }

    expect(isInTrial(paying, NOW)).toBe(false)
    expect(trialExpired(paying, NOW)).toBe(false)
  })

  it('flips to expired the moment the window closes', () => {
    const site = { ...trialing, createdAt: daysBefore(TRIAL_DAYS) }

    expect(NOW.getTime()).toBe(trialEndsAt(site)!.getTime())
    expect(isInTrial(site, NOW)).toBe(false)
    expect(trialExpired(site, NOW)).toBe(true)
    expect(trialDaysLeft(site, NOW)).toBe(0)
  })

  it('leaves a card-backed trial to Stripe', () => {
    const withCard = { ...expired, stripeSubscriptionId: 'sub_123' }

    expect(trialExpired(withCard, NOW)).toBe(true)
    expect(needsTrialDowngrade(withCard, NOW)).toBe(false)
    expect(needsTrialDowngrade(expired, NOW)).toBe(true)
  })

  it('is idempotent once downgraded, so the cron cannot pick the same tenant twice', () => {
    expect(needsTrialDowngrade({ ...expired, plan: 'BASIC' }, NOW)).toBe(false)
  })

  it('never treats a tenant already on BASIC as trialing', () => {
    expect(isInTrial({ ...trialing, plan: 'BASIC' }, NOW)).toBe(false)
  })

  it('survives a missing site or unparseable timestamp', () => {
    expect(isInTrial(null, NOW)).toBe(false)
    expect(trialExpired(undefined, NOW)).toBe(false)
    expect(needsTrialDowngrade({ plan: TRIAL_PLAN, createdAt: 'not-a-date' }, NOW)).toBe(false)
    expect(trialEndsAt({ createdAt: null })).toBeNull()
  })

  it('accepts ISO strings, which is what the client status endpoint serialises', () => {
    expect(isInTrial({ ...trialing, createdAt: daysBefore(1).toISOString() }, NOW)).toBe(true)
  })
})

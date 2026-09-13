import { describe, expect, it } from 'vitest'
import {
  TRIAL_DAYS,
  TRIAL_PLAN,
  isInTrial,
  needsTrialDowngrade,
  trialDaysLeft,
  trialEndsAt,
  trialExpired,
  trialState,
} from '~~/shared/utils/trial'

const NOW = new Date('2026-08-09T12:00:00Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

const trialing = {
  plan: TRIAL_PLAN,
  trialStartedAt: daysBefore(3),
  trialEndsAt: daysBefore(3 - TRIAL_DAYS),
  trialAcknowledgedAt: null,
  firstPaidAt: null,
  stripeSubscriptionId: null,
}
const expired = { ...trialing, trialStartedAt: daysBefore(TRIAL_DAYS + 1), trialEndsAt: daysBefore(1) }

describe('trial predicates', () => {
  it('counts a fresh card-less signup as trialing', () => {
    expect(isInTrial(trialing, NOW)).toBe(true)
    expect(trialState(trialing, NOW)).toBe('ACTIVE')
    expect(trialExpired(trialing, NOW)).toBe(false)
    expect(trialDaysLeft(trialing, NOW)).toBe(TRIAL_DAYS - 3)
  })

  it('reads firstPaidAt, not the plan — a paying PREMIUM tenant is never trialing', () => {
    const paying = { ...trialing, firstPaidAt: daysBefore(2) }

    expect(isInTrial(paying, NOW)).toBe(false)
    expect(trialExpired(paying, NOW)).toBe(false)
  })

  it('flips to expired the moment the window closes', () => {
    const site = { ...trialing, trialEndsAt: NOW }

    expect(NOW.getTime()).toBe(trialEndsAt(site)!.getTime())
    expect(isInTrial(site, NOW)).toBe(false)
    expect(trialExpired(site, NOW)).toBe(true)
    expect(trialDaysLeft(site, NOW)).toBe(0)
  })

  it('leaves a card-backed trial to Stripe', () => {
    const withCard = { ...expired, stripeSubscriptionId: 'sub_123' }

    expect(trialExpired(withCard, NOW)).toBe(false)
    expect(trialState(withCard, NOW)).toBe('NONE')
    expect(needsTrialDowngrade(withCard, NOW)).toBe(false)
    expect(needsTrialDowngrade(expired, NOW)).toBe(true)
  })

  it('is idempotent once downgraded, so the cron cannot pick the same tenant twice', () => {
    expect(needsTrialDowngrade({ ...expired, plan: 'BASIC' }, NOW)).toBe(false)
  })

  it('never treats a tenant already on BASIC as trialing', () => {
    expect(isInTrial({ ...trialing, plan: 'BASIC' }, NOW)).toBe(false)
  })

  it('does not infer a trial from a manually provisioned PREMIUM plan', () => {
    const provisioned = { ...trialing, trialStartedAt: null }
    expect(isInTrial(provisioned, NOW)).toBe(false)
    expect(trialExpired(provisioned, NOW)).toBe(false)
    expect(needsTrialDowngrade(provisioned, NOW)).toBe(false)
  })

  it('stops showing trial state after the user acknowledges its end', () => {
    const acknowledged = { ...expired, trialAcknowledgedAt: NOW }
    expect(trialState(acknowledged, NOW)).toBe('ACKNOWLEDGED')
    expect(trialExpired(acknowledged, NOW)).toBe(false)
    expect(needsTrialDowngrade(acknowledged, NOW)).toBe(false)
  })

  it('survives a missing site or unparseable timestamp', () => {
    expect(isInTrial(null, NOW)).toBe(false)
    expect(trialExpired(undefined, NOW)).toBe(false)
    expect(needsTrialDowngrade({ plan: TRIAL_PLAN, trialStartedAt: 'not-a-date' }, NOW)).toBe(false)
    expect(trialEndsAt({ trialStartedAt: NOW, trialEndsAt: 'not-a-date' })).toBeNull()
  })

  it('accepts ISO strings, which is what the client status endpoint serialises', () => {
    expect(
      isInTrial(
        {
          ...trialing,
          trialStartedAt: daysBefore(1).toISOString(),
          trialEndsAt: daysBefore(1 - TRIAL_DAYS).toISOString(),
        },
        NOW,
      ),
    ).toBe(true)
  })

  it('does not retroactively move an existing deadline when TRIAL_DAYS changes', () => {
    const explicitEnd = daysBefore(-2)
    expect(trialEndsAt({ trialStartedAt: daysBefore(12), trialEndsAt: explicitEnd })).toEqual(explicitEnd)
    expect(trialDaysLeft({ trialStartedAt: daysBefore(12), trialEndsAt: explicitEnd }, NOW)).toBe(2)
  })
})

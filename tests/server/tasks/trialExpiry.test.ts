import { describe, expect, it } from 'vitest'

import { expiredTrialWhere } from '../../../server/utils/trialDowngrade'
import { TRIAL_DAYS, TRIAL_PLAN, needsTrialDowngrade } from '../../../shared/utils/trial'

const NOW = new Date('2026-08-09T05:00:00Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

type Row = {
  plan: string
  createdAt: Date
  firstPaidAt: Date | null
  stripeSubscriptionId: string | null
  deletedAt: Date | null
}

const row = (overrides: Partial<Row> = {}): Row => ({
  plan: TRIAL_PLAN,
  createdAt: daysBefore(TRIAL_DAYS + 1),
  firstPaidAt: null,
  stripeSubscriptionId: null,
  deletedAt: null,
  ...overrides,
})

/** Applies the Prisma filter in memory so the SQL and the predicate can be compared directly. */
const matchesWhere = (candidate: Row, now: Date) => {
  const where = expiredTrialWhere(now)
  return (
    candidate.plan !== where.plan.not &&
    candidate.firstPaidAt === where.firstPaidAt &&
    candidate.stripeSubscriptionId === where.stripeSubscriptionId &&
    candidate.deletedAt === where.deletedAt &&
    candidate.createdAt <= where.createdAt.lte
  )
}

describe('expiredTrialWhere', () => {
  it('cuts off exactly TRIAL_DAYS back', () => {
    expect(expiredTrialWhere(NOW).createdAt.lte).toEqual(daysBefore(TRIAL_DAYS))
  })

  const cases: Array<[string, Row, boolean]> = [
    ['an expired card-less trial', row(), true],
    ['a trial still inside its window', row({ createdAt: daysBefore(TRIAL_DAYS - 1) }), false],
    ['a tenant that already paid', row({ firstPaidAt: daysBefore(2) }), false],
    ['a card-backed trial Stripe still owns', row({ stripeSubscriptionId: 'sub_1' }), false],
    ['a tenant already downgraded', row({ plan: 'BASIC' }), false],
    ['a soft-deleted tenant', row({ deletedAt: daysBefore(1) }), false],
  ]

  it.each(cases)('selects %s: %o → %s', (_label, candidate, expected) => {
    expect(matchesWhere(candidate, NOW)).toBe(expected)
  })

  // The cron re-checks every selected row; if these two ever disagree the predicate wins, but a
  // filter that is merely wider costs a wasted query and one that is narrower silently strands
  // tenants on a trial plan forever.
  it.each(cases)('agrees with needsTrialDowngrade on %s', (_label, candidate) => {
    if (candidate.deletedAt) return // soft-delete is a DB concern the predicate does not model
    expect(needsTrialDowngrade(candidate, NOW)).toBe(matchesWhere(candidate, NOW))
  })
})

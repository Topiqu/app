import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { expiredTrialWhere } from '../../../server/utils/trialDowngrade'
import { TRIAL_ARTICLE_CREDITS } from '../../../shared/utils/articleCredits'
import { TRIAL_PLAN, needsTrialDowngrade } from '../../../shared/utils/trial'

const NOW = new Date('2026-08-09T05:00:00Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

type Row = {
  plan: string
  trialStartedAt: Date | null
  trialEndsAt: Date | null
  trialAcknowledgedAt: Date | null
  firstPaidAt: Date | null
  stripeSubscriptionId: string | null
  deletedAt: Date | null
}

const row = (overrides: Partial<Row> = {}): Row => ({
  plan: TRIAL_PLAN,
  trialStartedAt: daysBefore(15),
  trialEndsAt: daysBefore(1),
  trialAcknowledgedAt: null,
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
    candidate.trialStartedAt !== null &&
    where.trialStartedAt.not === null &&
    candidate.trialEndsAt !== null &&
    where.trialEndsAt.not === null &&
    candidate.trialEndsAt <= where.trialEndsAt.lte &&
    candidate.trialAcknowledgedAt === where.trialAcknowledgedAt &&
    candidate.firstPaidAt === where.firstPaidAt &&
    candidate.stripeSubscriptionId === where.stripeSubscriptionId &&
    candidate.deletedAt === where.deletedAt
  )
}

describe('expiredTrialWhere', () => {
  it('starts a trial with five complete AI articles', () => {
    expect(TRIAL_ARTICLE_CREDITS).toBe(5)
  })

  it('backfills trial provenance only from an issued trial credit grant', () => {
    const migration = readFileSync('prisma/migrations/20260913150000_explicit_trial_lifecycle/migration.sql', 'utf8')

    expect(migration).toContain('WHERE "source" = \'TRIAL\'')
    expect(migration).toContain('"trialEndsAt" = trial."endsAt"')
    expect(migration).not.toMatch(/WHERE[\s\S]*"plan"\s*=\s*'PREMIUM'/)
  })

  it('derives the modal state on the server and keeps raw lifecycle fields off the client', () => {
    const status = readFileSync('server/api/clients/status.get.ts', 'utf8')
    const dashboard = readFileSync('app/pages/admin/index.vue', 'utf8')

    expect(status).toContain('const state = trialState(clientSite)')
    expect(status).toContain("const daysLeft = state === 'ACTIVE' ? trialDaysLeft(clientSite) : 0")
    expect(dashboard).toContain("status.value?.trial.state === 'EXPIRED'")
    expect(dashboard).not.toContain('trialExpired(')
  })

  it('changes entitlement without resetting wallet credit', () => {
    const source = readFileSync('server/utils/trialDowngrade.ts', 'utf8')

    expect(source).not.toContain('tokenLimit')
    expect(source).not.toContain('tokenRemaining')
    expect(source).toContain("data: { plan: 'BASIC' }")
  })

  it('uses the stored immutable deadline', () => {
    expect(expiredTrialWhere(NOW).trialEndsAt.lte).toEqual(NOW)
  })

  const cases: Array<[string, Row, boolean]> = [
    ['an expired card-less trial', row(), true],
    ['a trial still inside its window', row({ trialEndsAt: daysBefore(-1) }), false],
    ['a manually provisioned plan without a trial marker', row({ trialStartedAt: null }), false],
    ['a trial without an explicit deadline', row({ trialEndsAt: null }), false],
    ['an acknowledged trial', row({ trialAcknowledgedAt: daysBefore(1) }), false],
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

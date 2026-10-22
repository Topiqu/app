import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  domainFailureReason,
  monitoredTaskIntervals,
  taskIsOverdue,
  taskResultCounts,
  webhookFailureReason,
} from '../../shared/utils/operations'

describe('operations summaries', () => {
  it('retains numeric counters and strips customer content and raw errors', () => {
    expect(
      taskResultCounts({
        result: {
          generated: 3,
          failed: [{ clientSiteId: 'private', error: 'secret' }],
          skipped: { not_due: 3, feature_inactive: 2 },
          outcomes: ['private'],
        },
      }),
    ).toEqual({ processed: 3, failed: 1, skipped: 5 })
    expect(taskResultCounts({ result: { processed: -1, failed: Infinity, skipped: 'provider' } })).toEqual({
      processed: null,
      failed: null,
      skipped: null,
    })
    expect(taskResultCounts(null)).toEqual({ processed: null, failed: null, skipped: null })
  })
  it('distinguishes an unknown history from overdue clean completion', () => {
    const now = Date.parse('2026-10-22T12:00:00Z')
    expect(taskIsOverdue(null, 5, now)).toBe(false)
    expect(taskIsOverdue('2026-10-22T11:46:00Z', 5, now)).toBe(false)
    expect(taskIsOverdue('2026-10-22T11:44:00Z', 5, now)).toBe(true)
  })
  it('keeps configured schedule names and monitoring intervals synchronized', () => {
    const config = readFileSync(join(process.cwd(), 'nuxt.config.ts'), 'utf8')
    const block = config.slice(config.indexOf('scheduledTasks:'), config.indexOf("preset: 'bun'"))
    const scheduled = [...block.matchAll(/'([a-z]+(?:-[a-z]+)+)'/g)].map((match) => match[1]).sort()
    expect(Object.keys(monitoredTaskIntervals).sort()).toEqual(scheduled)
  })
  it('classifies integration failures without returning arbitrary provider errors', () => {
    expect(webhookFailureReason(401, true)).toBe('endpointAuthorization')
    expect(webhookFailureReason(429, true)).toBe('endpointRateLimited')
    expect(webhookFailureReason(503, true)).toBe('endpointUnavailable')
    expect(webhookFailureReason(null, false)).toBe('endpointDisabled')
    expect(webhookFailureReason(null, true)).toBe('endpointUnreachable')
    expect(domainFailureReason('PLAN_REQUIRED', 'ROUTING')).toBe('planRequired')
    expect(domainFailureReason('private error containing credentials', 'ROUTING')).toBe('domainRouting')
  })
})

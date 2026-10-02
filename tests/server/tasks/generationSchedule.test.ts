import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RELEASE_SCHEDULE } from '~~/shared/utils/releaseSchedule'

import { GENERATION_LEAD_MS, planRun, type ScheduledSite } from '../../../server/utils/generationSchedule'

const site = (overrides: Partial<ScheduledSite> = {}): ScheduledSite => ({
  ...DEFAULT_RELEASE_SCHEDULE,
  generationFrequency: 'DAILY',
  nextReleaseAt: null,
  lastGeneratedAt: null,
  ...overrides,
})

const now = new Date('2026-10-05T06:00:00Z') // Monday 08:00 in Prague
const middle = () => 0.5

describe('planRun', () => {
  it('ignores a site with scheduling off', () => {
    expect(planRun(site({ generationFrequency: 'NONE' }), now).action).toBe('off')
  })

  it('waits for a slot beyond the generation lead', () => {
    const slot = new Date(now.getTime() + GENERATION_LEAD_MS + 60_000)
    expect(planRun(site({ nextReleaseAt: slot }), now)).toEqual({ action: 'wait', slot })
  })

  it('generates inside the lead and claims the following slot', () => {
    const slot = new Date(now.getTime() + GENERATION_LEAD_MS - 60_000)
    const plan = planRun(site({ nextReleaseAt: slot }), now, middle)

    expect(plan).toMatchObject({ action: 'generate', slot })
    if (plan.action !== 'generate') return
    expect(plan.following!.getTime() - slot.getTime()).toBeGreaterThan(20 * 3600_000)
  })

  it('still generates for a slot missed during an outage, and claims a future one', () => {
    const slot = new Date('2026-10-02T14:00:00Z')
    const plan = planRun(site({ nextReleaseAt: slot }), now, middle)

    expect(plan).toMatchObject({ action: 'generate', slot })
    if (plan.action === 'generate') expect(plan.following! > now).toBe(true)
  })

  // Migrated DAILY tenants have no slot yet. Measuring from the last run keeps deploy day from
  // producing a second article.
  it('derives a first slot from the last generation', () => {
    const plan = planRun(site({ lastGeneratedAt: new Date('2026-10-05T05:30:00Z') }), now, middle)
    expect(plan.action).toBe('wait')
    if (plan.action === 'wait') expect(plan.slot.getTime() - now.getTime()).toBeGreaterThan(24 * 3600_000)
  })

  it('schedules a fresh site for today’s release hour', () => {
    const plan = planRun(site({ releaseHour: 10 }), now, middle)
    expect(plan).toMatchObject({ action: 'generate', slot: new Date('2026-10-05T08:00:00Z') })
  })
})

describe('generation cron contract', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
  const cron = source('server/tasks/generate-article.ts')

  it('runs often enough to honour any slot within its lead', () => {
    expect(source('nuxt.config.ts')).toContain(`'*/15 * * * *': ['generate-article']`)
    expect(GENERATION_LEAD_MS).toBeGreaterThan(15 * 60_000)
  })

  // Without the guard two overlapping runs (or replicas) would both generate for one slot.
  it('claims a slot with a guarded write before generating', () => {
    expect(cron).toContain('where: { id: client.id, nextReleaseAt: client.nextReleaseAt }')
    expect(cron).toContain('if (claimed.count) due.push({ client, slot: plan.slot })')
  })

  it('hands a future slot to publish-check instead of publishing on generation', () => {
    expect(cron).toContain('const releaseAt = releasable && slot > new Date() ? slot : null')
    expect(cron).toMatch(/status,\s*releaseAt,/)
  })

  it('recomputes the slot whenever the settings change the rhythm', () => {
    const patch = source('server/api/clients/[id]/index.patch.ts')
    expect(patch).toContain('RELEASE_SCHEDULE_FIELDS.some((field) => field in data)')
    expect(patch).toContain('data.nextReleaseAt = schedule ? nextRelease(schedule, {}) : null')
  })
})

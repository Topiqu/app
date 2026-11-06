import { describe, expect, it } from 'vitest'

import { groupByDay } from '../../app/utils/dayGroups'

const item = (createdAt: string) => ({ createdAt })
const now = new Date('2026-11-06T10:00:00Z')

describe('groupByDay', () => {
  it('puts newest-first items under their day and names today and yesterday', () => {
    const groups = groupByDay(
      [
        item('2026-11-06T09:00:00Z'),
        item('2026-11-05T22:00:00Z'),
        item('2026-11-05T01:00:00Z'),
        item('2026-11-03T12:00:00Z'),
      ],
      { locale: 'cs', timeZone: 'UTC', relativeTo: now },
    )
    expect(groups.map(({ label, items }) => [label, items.length])).toEqual([
      ['Dnes', 1],
      ['Včera', 2],
      ['3. listopadu', 1],
    ])
  })

  it('splits days in the viewer’s time zone, not in UTC', () => {
    const late = [item('2026-11-03T23:30:00Z'), item('2026-11-03T22:30:00Z')]
    expect(groupByDay(late, { locale: 'cs', timeZone: 'UTC' })).toHaveLength(1)
    expect(groupByDay(late, { locale: 'cs', timeZone: 'Europe/Prague' }).map(({ label }) => label)).toEqual([
      '4. listopadu',
      '3. listopadu',
    ])
  })

  it('adds the year only to other years and follows the interface language', () => {
    const groups = groupByDay([item('2026-03-01T12:00:00Z'), item('2025-12-31T12:00:00Z')], {
      locale: 'en',
      timeZone: 'UTC',
      relativeTo: now,
    })
    expect(groups.map(({ label }) => label)).toEqual(['March 1', 'December 31, 2025'])
  })

  it('stays absolute without a reference time, which keeps hydration stable', () => {
    const groups = groupByDay([item('2026-11-06T09:00:00Z')], { locale: 'cs', timeZone: 'UTC' })
    expect(groups[0]!.label).toBe('6. listopadu')
  })
})

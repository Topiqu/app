import { describe, expect, it } from 'vitest'

import {
  buildReportDefinition,
  gamDateRange,
  microsToCents,
  parseReportRows,
  readValue,
  toGamDate,
  type GamConfig,
  type GamReportRow,
} from '../../server/utils/ads/gamReport'

const config: GamConfig = {
  networkCode: '123456',
  clientDimension: 'CUSTOM_DIMENSION_9_VALUE',
  revenueMetric: 'AD_EXCHANGE_REVENUE',
  timeZone: 'UTC',
  currency: 'USD',
  apiBase: 'https://admanager.googleapis.com/v1',
  pollTimeoutMs: 1000,
}

const previousUtcDay = { start: new Date('2026-07-24T00:00:00Z'), end: new Date('2026-07-25T00:00:00Z') }

describe('gamReport dates', () => {
  it('converts a Date to GAM y/m/d in UTC with 1-based months', () => {
    expect(toGamDate(new Date('2026-01-05T23:30:00Z'))).toEqual({ year: 2026, month: 1, day: 5 })
  })

  it('makes the exclusive period end inclusive for GAM', () => {
    expect(gamDateRange(previousUtcDay)).toEqual({
      startDate: { year: 2026, month: 7, day: 24 },
      endDate: { year: 2026, month: 7, day: 24 },
    })
  })

  it('keeps multi-day ranges inclusive on both sides', () => {
    expect(
      gamDateRange({ start: new Date('2026-07-01T00:00:00Z'), end: new Date('2026-08-01T00:00:00Z') }),
    ).toEqual({
      startDate: { year: 2026, month: 7, day: 1 },
      endDate: { year: 2026, month: 7, day: 31 },
    })
  })
})

describe('buildReportDefinition', () => {
  it('reports the configured client dimension against the revenue metric', () => {
    const body = buildReportDefinition(previousUtcDay, config)

    expect(body.reportDefinition.dimensions).toEqual(['CUSTOM_DIMENSION_9_VALUE'])
    expect(body.reportDefinition.metrics).toEqual(['AD_EXCHANGE_REVENUE'])
    expect(body.reportDefinition.dateRange.fixed.startDate).toEqual({ year: 2026, month: 7, day: 24 })
    expect(body.reportDefinition.currencyCode).toBe('USD')
    expect(body.displayName).toBe('topiqu-revenue-2026-07-24')
  })
})

describe('microsToCents', () => {
  it('converts micro-units of currency to integer cents', () => {
    expect(microsToCents(1_000_000)).toBe(100)
    expect(microsToCents(0)).toBe(0)
    expect(microsToCents(4_999)).toBe(0)
    expect(microsToCents(5_000)).toBe(1)
    expect(microsToCents(-1_000_000)).toBe(-100)
  })
})

describe('readValue', () => {
  it('unwraps whichever branch of the GAM value union is present', () => {
    expect(readValue({ stringValue: 'cs_1' })).toBe('cs_1')
    expect(readValue({ intValue: '1234' })).toBe('1234')
    expect(readValue({ doubleValue: 1.5 })).toBe(1.5)
    expect(readValue({ boolValue: true })).toBeNull()
    expect(readValue(undefined)).toBeNull()
  })
})

describe('parseReportRows', () => {
  it('maps dimension value to clientSiteId and metric micros to cents', () => {
    const rows: GamReportRow[] = [
      { dimensionValues: [{ stringValue: 'cs_1' }], metricValueGroups: [{ primary: [{ intValue: '1000000' }] }] },
      { dimensionValues: [{ stringValue: 'cs_2' }], metricValueGroups: [{ primary: [{ intValue: '250000' }] }] },
    ]

    expect(parseReportRows(rows, 'USD')).toEqual([
      { clientSiteId: 'cs_1', grossCents: 100, currency: 'USD' },
      { clientSiteId: 'cs_2', grossCents: 25, currency: 'USD' },
    ])
  })

  it('sums micros before rounding so split rows never drift a cent', () => {
    const rows: GamReportRow[] = [
      { dimensionValues: [{ stringValue: 'cs_1' }], metricValueGroups: [{ primary: [{ intValue: '5000' }] }] },
      { dimensionValues: [{ stringValue: 'cs_1' }], metricValueGroups: [{ primary: [{ intValue: '5000' }] }] },
    ]

    expect(parseReportRows(rows, 'USD')).toEqual([{ clientSiteId: 'cs_1', grossCents: 1, currency: 'USD' }])
  })

  it('drops rows with an empty or whitespace-only client dimension', () => {
    const rows: GamReportRow[] = [
      { dimensionValues: [{ stringValue: '' }], metricValueGroups: [{ primary: [{ intValue: '9000000' }] }] },
      { dimensionValues: [{ stringValue: '   ' }], metricValueGroups: [{ primary: [{ intValue: '9000000' }] }] },
      { metricValueGroups: [{ primary: [{ intValue: '9000000' }] }] },
      { dimensionValues: [{ stringValue: 'cs_1' }], metricValueGroups: [{ primary: [{ intValue: '1000000' }] }] },
    ]

    expect(parseReportRows(rows, 'USD')).toEqual([{ clientSiteId: 'cs_1', grossCents: 100, currency: 'USD' }])
  })

  it('treats a missing metric as zero revenue rather than NaN', () => {
    const rows: GamReportRow[] = [{ dimensionValues: [{ stringValue: 'cs_1' }] }]

    expect(parseReportRows(rows, 'EUR')).toEqual([{ clientSiteId: 'cs_1', grossCents: 0, currency: 'EUR' }])
  })

  it('preserves negative revenue (GAM clawbacks) instead of clamping it', () => {
    const rows: GamReportRow[] = [
      { dimensionValues: [{ stringValue: 'cs_1' }], metricValueGroups: [{ primary: [{ intValue: '-500000' }] }] },
    ]

    expect(parseReportRows(rows, 'USD')).toEqual([{ clientSiteId: 'cs_1', grossCents: -50, currency: 'USD' }])
  })

  it('returns nothing for an empty report', () => {
    expect(parseReportRows([], 'USD')).toEqual([])
  })
})

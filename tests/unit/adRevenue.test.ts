import { describe, expect, it } from 'vitest'

import {
  buildEarningRow,
  CLIENT_SHARE,
  getClientShareRatio,
  monthKey,
  splitAdRevenue,
  summarizeEarnings,
  type LedgerRow,
} from '../../server/utils/adRevenue'

const ledgerRow = (overrides: Partial<LedgerRow> = {}): LedgerRow => ({
  periodStart: new Date('2026-07-24T00:00:00Z'),
  currency: 'USD',
  grossCents: 1000,
  clientCents: 700,
  platformCents: 300,
  payoutStatus: 'PENDING',
  ...overrides,
})

describe('adRevenue', () => {
  it('maps each plan to its contractual client share', () => {
    expect(getClientShareRatio('BASIC')).toBe(0)
    expect(getClientShareRatio('PRO')).toBe(0.7)
    expect(getClientShareRatio('PREMIUM')).toBe(0.9)
    expect(getClientShareRatio('CUSTOM')).toBe(1)
  })

  it('gives the whole amount to the platform on BASIC', () => {
    expect(splitAdRevenue(10000, 'BASIC')).toEqual({ clientCut: 0, platformCut: 10000 })
  })

  it('gives the whole amount to the client on CUSTOM', () => {
    expect(splitAdRevenue(10000, 'CUSTOM')).toEqual({ clientCut: 10000, platformCut: 0 })
  })

  it('splits 70/30 on PRO and 90/10 on PREMIUM', () => {
    expect(splitAdRevenue(10000, 'PRO')).toEqual({ clientCut: 7000, platformCut: 3000 })
    expect(splitAdRevenue(10000, 'PREMIUM')).toEqual({ clientCut: 9000, platformCut: 1000 })
  })

  it('never loses or invents units when rounding', () => {
    for (const plan of Object.keys(CLIENT_SHARE) as (keyof typeof CLIENT_SHARE)[]) {
      for (const gross of [1, 7, 33, 12345, 999999]) {
        const { clientCut, platformCut } = splitAdRevenue(gross, plan)
        expect(clientCut + platformCut).toBe(gross)
        expect(clientCut).toBeGreaterThanOrEqual(0)
        expect(platformCut).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('preserves the sum invariant on negative adjustments (GAM clawbacks)', () => {
    const { clientCut, platformCut } = splitAdRevenue(-500, 'PRO')
    expect(clientCut + platformCut).toBe(-500)
  })

  it('builds a ledger row snapshotting the applied ratio and split', () => {
    const row = buildEarningRow({ clientSiteId: 'cs_1', grossCents: 10000, currency: 'USD', plan: 'PREMIUM' })
    expect(row).toEqual({
      clientSiteId: 'cs_1',
      currency: 'USD',
      plan: 'PREMIUM',
      shareRatio: 0.9,
      grossCents: 10000,
      clientCents: 9000,
      platformCents: 1000,
    })
  })
})

describe('summarizeEarnings', () => {
  it('buckets a period into its UTC month regardless of local time', () => {
    expect(monthKey(new Date('2026-01-31T23:30:00Z'))).toBe('2026-01')
    expect(monthKey('2026-12-01T00:00:00Z')).toBe('2026-12')
  })

  it('returns an empty list for an empty ledger', () => {
    expect(summarizeEarnings([])).toEqual([])
  })

  it('totals a single currency and groups by month in chronological order', () => {
    const summaries = summarizeEarnings([
      ledgerRow({
        periodStart: new Date('2026-06-02T00:00:00Z'),
        grossCents: 500,
        clientCents: 350,
        platformCents: 150,
      }),
      ledgerRow({ periodStart: new Date('2026-07-01T00:00:00Z') }),
      ledgerRow({ periodStart: new Date('2026-07-24T00:00:00Z') }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]!.totals).toEqual({ grossCents: 2500, clientCents: 1750, platformCents: 750 })
    expect(summaries[0]!.rowCount).toBe(3)
    expect(summaries[0]!.byMonth).toEqual([
      { month: '2026-06', grossCents: 500, clientCents: 350, platformCents: 150 },
      { month: '2026-07', grossCents: 2000, clientCents: 1400, platformCents: 600 },
    ])
  })

  it('never sums across currencies — one summary per currency, biggest first', () => {
    const summaries = summarizeEarnings([
      ledgerRow({ currency: 'EUR', grossCents: 100, clientCents: 70, platformCents: 30 }),
      ledgerRow({ currency: 'USD' }),
    ])

    expect(summaries.map((s) => s.currency)).toEqual(['USD', 'EUR'])
    expect(summaries[0]!.totals.grossCents).toBe(1000)
    expect(summaries[1]!.totals.grossCents).toBe(100)
  })

  it('splits the client cut across payout statuses so payable money is visible', () => {
    const summaries = summarizeEarnings([
      ledgerRow({ payoutStatus: 'PAID' }),
      ledgerRow({ payoutStatus: 'PAYABLE' }),
      ledgerRow({ payoutStatus: 'PAYABLE' }),
      ledgerRow({ payoutStatus: 'VOID' }),
    ])

    expect(summaries[0]!.clientCentsByPayoutStatus).toEqual({
      PENDING: 0,
      PAYABLE: 1400,
      PAID: 700,
      VOID: 700,
    })
  })

  it('keeps totals equal to the sum of the monthly buckets', () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      ledgerRow({
        periodStart: new Date(Date.UTC(2026, i % 12, 1 + (i % 27))),
        grossCents: i * 13,
        clientCents: Math.round(i * 13 * 0.7),
        platformCents: i * 13 - Math.round(i * 13 * 0.7),
      }),
    )

    const [summary] = summarizeEarnings(rows)

    expect(summary!.byMonth.reduce((acc, m) => acc + m.grossCents, 0)).toBe(summary!.totals.grossCents)
    expect(summary!.byMonth.reduce((acc, m) => acc + m.clientCents, 0)).toBe(summary!.totals.clientCents)
    expect(summary!.totals.clientCents + summary!.totals.platformCents).toBe(summary!.totals.grossCents)
  })
})

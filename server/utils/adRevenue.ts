import type { AdPayoutStatus, ClientPlan } from '@prisma/client'

export const CLIENT_SHARE: Record<ClientPlan, number> = {
  BASIC: 0,
  PRO: 0.7,
  PREMIUM: 0.9,
  CUSTOM: 1,
}

export const getClientShareRatio = (plan: ClientPlan): number => CLIENT_SHARE[plan]

export interface RevenueSplit {
  clientCut: number
  platformCut: number
}

export const splitAdRevenue = (grossAmount: number, plan: ClientPlan): RevenueSplit => {
  const clientCut = Math.round(grossAmount * CLIENT_SHARE[plan])
  return { clientCut, platformCut: grossAmount - clientCut }
}

export interface EarningInput {
  clientSiteId: string
  grossCents: number
  currency: string
  plan: ClientPlan
}

export interface EarningRow {
  clientSiteId: string
  currency: string
  plan: ClientPlan
  shareRatio: number
  grossCents: number
  clientCents: number
  platformCents: number
}

export const buildEarningRow = (input: EarningInput): EarningRow => {
  const { clientCut, platformCut } = splitAdRevenue(input.grossCents, input.plan)
  return {
    clientSiteId: input.clientSiteId,
    currency: input.currency,
    plan: input.plan,
    shareRatio: getClientShareRatio(input.plan),
    grossCents: input.grossCents,
    clientCents: clientCut,
    platformCents: platformCut,
  }
}

export interface EarningTotals {
  grossCents: number
  clientCents: number
  platformCents: number
}

export interface LedgerRow extends EarningTotals {
  periodStart: Date | string
  currency: string
  payoutStatus: AdPayoutStatus
}

export interface EarningsSummary {
  currency: string
  totals: EarningTotals
  byMonth: (EarningTotals & { month: string })[]
  clientCentsByPayoutStatus: Record<AdPayoutStatus, number>
  rowCount: number
}

const emptyTotals = (): EarningTotals => ({ grossCents: 0, clientCents: 0, platformCents: 0 })

const emptyPayoutBuckets = (): Record<AdPayoutStatus, number> => ({
  PENDING: 0,
  PAYABLE: 0,
  PAID: 0,
  VOID: 0,
})

const addTotals = (target: EarningTotals, row: EarningTotals): void => {
  target.grossCents += row.grossCents
  target.clientCents += row.clientCents
  target.platformCents += row.platformCents
}

export const monthKey = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export const summarizeEarnings = (rows: LedgerRow[]): EarningsSummary[] => {
  const byCurrency = new Map<string, EarningsSummary & { months: Map<string, EarningTotals> }>()

  for (const row of rows) {
    let bucket = byCurrency.get(row.currency)
    if (!bucket) {
      bucket = {
        currency: row.currency,
        totals: emptyTotals(),
        byMonth: [],
        clientCentsByPayoutStatus: emptyPayoutBuckets(),
        rowCount: 0,
        months: new Map(),
      }
      byCurrency.set(row.currency, bucket)
    }

    addTotals(bucket.totals, row)
    bucket.clientCentsByPayoutStatus[row.payoutStatus] += row.clientCents
    bucket.rowCount++

    const key = monthKey(row.periodStart)
    let month = bucket.months.get(key)
    if (!month) {
      month = emptyTotals()
      bucket.months.set(key, month)
    }
    addTotals(month, row)
  }

  return [...byCurrency.values()]
    .map(({ months, ...summary }) => ({
      ...summary,
      byMonth: [...months.entries()]
        .map(([month, totals]) => ({ month, ...totals }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    }))
    .sort((a, b) => b.totals.grossCents - a.totals.grossCents)
}

import { getGamAccessToken } from './gamAuth'

export interface GamReportPeriod {
  start: Date
  end: Date
}

export interface GamClientRevenue {
  clientSiteId: string
  grossCents: number
  currency: string
}

export interface GamDate {
  year: number
  month: number
  day: number
}

export interface GamConfig {
  networkCode: string
  clientDimension: string
  revenueMetric: string
  timeZone: string
  currency: string
  apiBase: string
  pollTimeoutMs: number
}

interface GamValue {
  stringValue?: string
  intValue?: string | number
  doubleValue?: number
  boolValue?: boolean
}

export interface GamReportRow {
  dimensionValues?: GamValue[]
  metricValueGroups?: { primary?: GamValue[] }[]
}

interface GamOperation {
  name?: string
  done?: boolean
  error?: { code?: number; message?: string }
  response?: { report?: string }
}

const DEFAULT_API_BASE = 'https://admanager.googleapis.com/v1'
const DEFAULT_REVENUE_METRIC = 'AD_EXCHANGE_REVENUE'
const DEFAULT_TIMEZONE = 'UTC'
const DEFAULT_CURRENCY = 'USD'
const DEFAULT_POLL_TIMEOUT_MS = 300_000
const POLL_INTERVAL_MS = 5_000
const ROWS_PAGE_SIZE = 1000

export const microsToCents = (micros: number): number => Math.round(micros / 10000)

export const isGamConfigured = (): boolean => !!process.env.GAM_NETWORK_CODE && !!process.env.GAM_SERVICE_ACCOUNT_KEY

export const resolveGamConfig = (): GamConfig => {
  const networkCode = process.env.GAM_NETWORK_CODE
  const clientDimension = process.env.GAM_CLIENT_DIMENSION

  if (!networkCode) throw createError({ statusCode: 500, message: 'GAM_NETWORK_CODE is not set' })

  if (!clientDimension)
    throw createError({
      statusCode: 500,
      message:
        'GAM_CLIENT_DIMENSION is not set — without the custom-targeting dimension for `client_id` revenue cannot be attributed per site',
    })

  return {
    networkCode,
    clientDimension,
    revenueMetric: process.env.GAM_REVENUE_METRIC || DEFAULT_REVENUE_METRIC,
    timeZone: process.env.GAM_REPORT_TIMEZONE || DEFAULT_TIMEZONE,
    currency: process.env.GAM_CURRENCY || DEFAULT_CURRENCY,
    apiBase: process.env.GAM_API_BASE || DEFAULT_API_BASE,
    pollTimeoutMs: Number(process.env.GAM_REPORT_POLL_TIMEOUT_MS) || DEFAULT_POLL_TIMEOUT_MS,
  }
}

export const toGamDate = (date: Date): GamDate => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
})

export const gamDateRange = (period: GamReportPeriod): { startDate: GamDate; endDate: GamDate } => ({
  startDate: toGamDate(period.start),
  endDate: toGamDate(new Date(period.end.getTime() - 1)),
})

export const buildReportDefinition = (period: GamReportPeriod, config: GamConfig) => ({
  displayName: `topiqu-revenue-${toGamDate(period.start).year}-${String(toGamDate(period.start).month).padStart(2, '0')}-${String(toGamDate(period.start).day).padStart(2, '0')}`,
  reportDefinition: {
    reportType: 'HISTORICAL',
    dimensions: [config.clientDimension],
    metrics: [config.revenueMetric],
    dateRange: { fixed: gamDateRange(period) },
    timeZoneSource: 'PUBLISHER',
    timeZone: config.timeZone,
    currencyCode: config.currency,
  },
})

export const readValue = (value: GamValue | undefined): string | number | null => {
  if (!value) return null
  if (value.stringValue !== undefined) return value.stringValue
  if (value.intValue !== undefined) return value.intValue
  if (value.doubleValue !== undefined) return value.doubleValue
  return null
}

export const parseReportRows = (rows: GamReportRow[], currency: string): GamClientRevenue[] => {
  const microsByClient = new Map<string, number>()

  for (const row of rows) {
    const clientSiteId = String(readValue(row.dimensionValues?.[0]) ?? '').trim()
    if (!clientSiteId) continue

    const micros = Number(readValue(row.metricValueGroups?.[0]?.primary?.[0]) ?? 0)
    if (!Number.isFinite(micros)) continue

    microsByClient.set(clientSiteId, (microsByClient.get(clientSiteId) ?? 0) + micros)
  }

  return [...microsByClient.entries()].map(([clientSiteId, micros]) => ({
    clientSiteId,
    grossCents: microsToCents(micros),
    currency,
  }))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const gamFetch = async <T>(
  url: string,
  token: string,
  init?: { method?: 'GET' | 'POST'; body?: Record<string, unknown> },
): Promise<T> => {
  const response = await $fetch(url, {
    method: init?.method ?? 'GET',
    body: init?.body,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    timeout: 60_000,
    retry: 2,
  })

  return response as T
}

const awaitReportResult = async (operation: GamOperation, token: string, config: GamConfig): Promise<string> => {
  const deadline = Date.now() + config.pollTimeoutMs
  let current = operation

  while (!current.done) {
    if (Date.now() > deadline)
      throw createError({ statusCode: 504, message: `GAM report did not finish within ${config.pollTimeoutMs}ms` })

    await sleep(POLL_INTERVAL_MS)

    if (!current.name) break
    current = await gamFetch<GamOperation>(`${config.apiBase}/${current.name}`, token)
  }

  if (current.error)
    throw createError({ statusCode: 502, message: `GAM report failed: ${current.error.message ?? 'unknown error'}` })

  const result = current.response?.report
  if (!result) throw createError({ statusCode: 502, message: 'GAM report finished without a result resource' })

  return result
}

const fetchAllRows = async (resultName: string, token: string, config: GamConfig): Promise<GamReportRow[]> => {
  const rows: GamReportRow[] = []
  let pageToken: string | undefined

  do {
    const query = new URLSearchParams({ pageSize: String(ROWS_PAGE_SIZE) })
    if (pageToken) query.set('pageToken', pageToken)

    const page = await gamFetch<{ rows?: GamReportRow[]; nextPageToken?: string }>(
      `${config.apiBase}/${resultName}:fetchRows?${query.toString()}`,
      token,
    )

    if (page.rows?.length) rows.push(...page.rows)
    pageToken = page.nextPageToken || undefined
  } while (pageToken)

  return rows
}

export const fetchGamRevenueByClient = async (period: GamReportPeriod): Promise<GamClientRevenue[]> => {
  if (!isGamConfigured()) return []

  const config = resolveGamConfig()
  const token = await getGamAccessToken()

  const report = await gamFetch<{ name?: string }>(`${config.apiBase}/networks/${config.networkCode}/reports`, token, {
    method: 'POST',
    body: buildReportDefinition(period, config),
  })

  if (!report.name) throw createError({ statusCode: 502, message: 'GAM did not return a report resource name' })

  const operation = await gamFetch<GamOperation>(`${config.apiBase}/${report.name}:run`, token, { method: 'POST' })
  const resultName = await awaitReportResult(operation, token, config)
  const rows = await fetchAllRows(resultName, token, config)

  return parseReportRows(rows, config.currency)
}

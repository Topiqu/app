export const monitoredTaskIntervals = {
  'webhook-deliver': 1,
  'generate-article': 15,
  'sentiment-analysis': 30,
  'community-insights': 1440,
  'search-console-sync': 1440,
  'search-console-autopilot': 1440,
  'translate-pending': 5,
  'knowledge-index': 5,
  'shopify-publish': 5,
  'shopify-catalog': 5,
  'content-actions': 5,
  'gam-sync': 1440,
  'grant-annual-article-credits': 1440,
  'media-gc': 1440,
  'knowledge-refresh': 60,
  'shopify-billing': 60,
  'ai-visibility-monitor': 1440,
  'keyword-rank': 1440,
  'backlink-discovery': 1440,
  'backlink-check': 1440,
  'publish-check': 10,
  'trial-expiry': 10,
  'domain-reverification': 60,
} as const

export type TaskStatus = 'unknown' | 'running' | 'succeeded' | 'degraded' | 'failed'

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const count = (value: unknown): number | null => {
  if (Array.isArray(value)) return value.length
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 2_147_483_647) : null
}

/** Task results can include customer content; only bounded numeric counters cross this boundary. */
export const taskResultCounts = (result: unknown) => {
  const value = record(record(result)?.result)
  const skipped = record(value?.skipped)
  return {
    processed: count(value?.processed ?? value?.generated ?? value?.synced ?? value?.delivered ?? value?.count),
    failed: count(value?.failed),
    skipped: skipped
      ? count(Object.values(skipped).reduce<number>((sum, value) => sum + (count(value) ?? 0), 0))
      : count(value?.skipped),
  }
}

export const taskIsOverdue = (lastSucceededAt: string | null, intervalMinutes: number, now: number) =>
  lastSucceededAt !== null && now - Date.parse(lastSucceededAt) > (intervalMinutes * 2 + 5) * 60_000

export const webhookFailureReason = (statusCode: number | null, endpointActive: boolean) => {
  if (!endpointActive) return 'endpointDisabled'
  if (statusCode === 401 || statusCode === 403) return 'endpointAuthorization'
  if (statusCode === 404 || statusCode === 410) return 'endpointMissing'
  if (statusCode === 429) return 'endpointRateLimited'
  if (statusCode !== null && statusCode >= 500) return 'endpointUnavailable'
  if (statusCode !== null) return 'endpointRejected'
  return 'endpointUnreachable'
}

export const domainFailureReason = (errorCode: string | null, state: string) => {
  if (errorCode === 'PLAN_REQUIRED') return 'planRequired'
  if (errorCode === 'TXT_MISMATCH' || state === 'OWNERSHIP') return 'domainOwnership'
  if (errorCode === 'DNS_UNAVAILABLE' || state === 'DNS_UNAVAILABLE') return 'domainDns'
  if (errorCode === 'CERTIFICATE_EXPIRED' || state === 'CERTIFICATE') return 'domainCertificate'
  if (state === 'DISCONNECTING') return 'domainCleanup'
  return 'domainRouting'
}

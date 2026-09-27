import type { H3Event } from 'h3'

import { toDatabaseJson } from './databaseJson'

/** Internal cost telemetry. Never throws: a logging outage must not fail the work it measures. */
export async function recordAiUsage(
  clientSiteId: string,
  tokens: number,
  action: string,
  metadata: Record<string, any> = {},
  event?: H3Event,
  userId?: string,
) {
  try {
    const apiTokens = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0
    const data = toDatabaseJson(metadata) as Record<string, any>
    await prisma.aiUsage.create({ data: { clientSiteId, action, tokens: apiTokens, metadata: data } })
    await logAction({
      action,
      userId,
      clientSiteId,
      metadata: { ...data, apiTokens },
      ip: event ? getIp(event) : undefined,
    })
  } catch (error) {
    await reportCaughtError('AI usage logging failed', error, { clientSiteId, action, tokens })
  }
}

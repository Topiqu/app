import type { H3Event } from 'h3'

import { currentTokenOperation, recordTokenUsage } from './tokenWallet'

export const tokenDebit = (remaining: number | null | undefined, requested: number) => {
  const available = Math.max(0, remaining ?? 0)
  const debited = Math.min(available, requested)

  return { remaining: available - debited, debited, fullyCovered: debited === requested }
}

export async function consumeClientTokens(
  clientSiteId: string,
  apiTokens: number,
  action: string,
  metadata: Record<string, any> = {},
  event?: H3Event,
  userId?: string,
) {
  if (!Number.isFinite(apiTokens) || apiTokens < 0)
    throw createError({ statusCode: 400, message: 'Token usage must be a finite non-negative number' })

  const operation = currentTokenOperation()
  if (!operation || operation.clientSiteId !== clientSiteId)
    throw new Error('Token usage requires a reservation before provider execution')
  const clientTokens = Math.ceil(apiTokens * operation.ratio)
  const settled = await recordTokenUsage(
    clientSiteId,
    clientTokens,
    JSON.parse(JSON.stringify({ ...metadata, apiTokens, ratio: operation.ratio, action })),
  )
  const debit = {
    remaining: settled.available,
    debited: settled.charged,
    fullyCovered: settled.charged === clientTokens,
  }

  await logAction({
    action,
    userId,
    clientSiteId,
    metadata: {
      ...metadata,
      apiTokens,
      clientTokensCharged: debit.debited,
      clientTokensUsed: clientTokens,
      fullyCovered: debit.fullyCovered,
      ratio: operation.ratio,
    },
    ip: event ? getIp(event) : undefined,
  })

  return {
    clientTokensCharged: debit.debited,
    clientTokensUsed: clientTokens,
    fullyCovered: debit.fullyCovered,
    apiTokens,
    tokenRemaining: debit.remaining,
  }
}

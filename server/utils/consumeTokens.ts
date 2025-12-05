import type { H3Event } from 'h3'

export async function consumeClientTokens(
  clientSiteId: string,
  apiTokens: number,
  action: string,
  metadata: Record<string, any> = {},
  event?: H3Event,
) {
  const clientTokens = Math.ceil(apiTokens * TOKEN_RATIO)

  const clientSite = await prisma.clientSite.update({
    where: { id: clientSiteId },
    data: {
      tokenRemaining: { decrement: clientTokens },
      totalUsage: { increment: clientTokens },
    },
  })

  if (clientSite.tokenRemaining && clientSite.tokenRemaining < 0) {
    throw createError({ statusCode: 402, message: 'Insufficient tokens' })
  }

  await logAction({
    action,
    clientSiteId,
    metadata: {
      ...metadata,
      apiTokens,
      clientTokensCharged: clientTokens,
      ratio: TOKEN_RATIO,
    },
    ip: event ? getIp(event) : undefined,
  })

  return { clientTokensCharged: clientTokens, apiTokens }
}

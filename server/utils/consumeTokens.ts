import type { H3Event } from 'h3'

const TOKEN_DEBIT_RETRIES = 5

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

  const clientTokens = Math.ceil(apiTokens * TOKEN_RATIO)
  let debit: ReturnType<typeof tokenDebit> | null = null

  // Usage is known only after the provider finishes. An optimistic compare-and-swap records the
  // real usage while clamping spendable balance at zero, even when concurrent AI jobs finish at
  // the same time. The old decrement-then-check flow persisted a negative balance before throwing.
  for (let attempt = 0; attempt < TOKEN_DEBIT_RETRIES; attempt++) {
    const clientSite = await prisma.clientSite.findUnique({
      where: { id: clientSiteId },
      select: { tokenRemaining: true },
    })
    if (!clientSite) throw createError({ statusCode: 404, message: 'Client site not found' })

    const candidate = tokenDebit(clientSite.tokenRemaining, clientTokens)
    const updated = await prisma.clientSite.updateMany({
      where: { id: clientSiteId, tokenRemaining: clientSite.tokenRemaining },
      data: {
        tokenRemaining: candidate.remaining,
        totalUsage: { increment: clientTokens },
      },
    })
    if (updated.count) {
      debit = candidate
      break
    }
  }
  if (!debit) throw createError({ statusCode: 409, message: 'Token balance changed concurrently; retry the action' })

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
      ratio: TOKEN_RATIO,
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

import { loadGenerationClient, processClient } from './generate-article'

/** Each run writes a few articles; the rest wait for the next minute. */
const PER_RUN = 3

const finish = async (
  id: string,
  clientSiteId: string,
  outcome: { status: 'SUCCEEDED'; articleId: string } | { status: 'FAILED'; error: string },
) => {
  // Guarded by status: a run declared lost must not be overwritten by its late worker, and vice versa.
  const { count } = await prisma.apiGeneration.updateMany({
    where: { id, status: 'RUNNING' },
    data:
      outcome.status === 'SUCCEEDED'
        ? { status: 'SUCCEEDED', articleId: outcome.articleId, error: null, finishedAt: new Date() }
        : { status: 'FAILED', error: outcome.error.slice(0, 500), finishedAt: new Date() },
  })
  if (count)
    await enqueueGenerationWebhook(outcome.status === 'SUCCEEDED' ? 'GENERATION_SUCCEEDED' : 'GENERATION_FAILED', {
      id,
      clientSiteId,
    })
  return count > 0
}

export const failLostApiGenerations = async (now = new Date()) => {
  const lost = await prisma.apiGeneration.findMany({
    where: { status: 'RUNNING', startedAt: { lt: new Date(now.getTime() - API_GENERATION_TIMEOUT_MS) } },
    select: { id: true, clientSiteId: true },
  })
  for (const generation of lost)
    await finish(generation.id, generation.clientSiteId, { status: 'FAILED', error: 'The generation was interrupted' })
  return lost.length
}

/** The guarded update is the claim: an overlapping run that read the same row updates nothing. */
export const claimApiGeneration = async () => {
  const next = await prisma.apiGeneration.findFirst({
    where: { status: 'QUEUED', deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!next) return null
  const { count } = await prisma.apiGeneration.updateMany({
    where: { id: next.id, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  if (!count) return null
  return prisma.apiGeneration.findUniqueOrThrow({
    where: { id: next.id },
    select: { id: true, clientSiteId: true, topic: true, instructions: true },
  })
}

export const runApiGeneration = async (generation: NonNullable<Awaited<ReturnType<typeof claimApiGeneration>>>) => {
  const fail = (error: string) => finish(generation.id, generation.clientSiteId, { status: 'FAILED', error })
  try {
    const client = await loadGenerationClient(generation.clientSiteId)
    if (!client) return (await fail('The site no longer exists'), { id: generation.id, status: 'failed' as const })
    const outcome = await processClient(client, new Date(), {
      generationId: generation.id,
      topic: generation.topic,
      instructions: generation.instructions,
    })
    if (outcome.status === 'failed' || !('articleId' in outcome) || !outcome.articleId) {
      await fail('error' in outcome && outcome.error ? outcome.error : 'The article could not be written')
      return { id: generation.id, status: 'failed' as const }
    }
    await finish(generation.id, generation.clientSiteId, { status: 'SUCCEEDED', articleId: outcome.articleId })
    return { id: generation.id, status: 'succeeded' as const, articleId: outcome.articleId }
  } catch (error) {
    await fail(error instanceof Error ? error.message : String(error))
    return { id: generation.id, status: 'failed' as const }
  }
}

export default defineMonitoredTask({
  meta: {
    name: 'api-generations',
    description: 'Writes articles requested through the external API',
  },
  async run() {
    const lost = await failLostApiGenerations()
    const pruned = await pruneIdempotencyKeys()

    const claimed = []
    for (let i = 0; i < PER_RUN; i++) {
      const generation = await claimApiGeneration()
      if (!generation) break
      claimed.push(generation)
    }
    const results = await Promise.all(claimed.map(runApiGeneration))
    return { result: { lost, prunedIdempotencyKeys: pruned.count, results } }
  },
})

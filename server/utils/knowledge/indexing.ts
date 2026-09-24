import { embedMany } from 'ai'

import { chunkKnowledge } from './chunk'
import { aiEmbeddingModelId } from '../ai/modelRegistry'

const MAX_ATTEMPTS = 3
const STALE_CLAIM_MS = 10 * 60_000

export const toPgVector = (values: readonly number[]) => `[${values.join(',')}]`

const claimable = () => ({
  deletedAt: null,
  attempts: { lt: MAX_ATTEMPTS },
  OR: [
    { status: 'PENDING' as const },
    // A process that died mid-run leaves PROCESSING behind; reclaim it once the run is clearly gone.
    { status: 'PROCESSING' as const, updatedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
  ],
})

export const indexKnowledgeSource = async (id: string) => {
  const claim = await prisma.knowledgeSource.updateMany({
    where: { id, ...claimable() },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  })
  if (claim.count !== 1) return false

  const source = await prisma.knowledgeSource.findUniqueOrThrow({
    where: { id },
    select: { clientSiteId: true, title: true, content: true, version: true, attempts: true },
  })
  try {
    const chunks = chunkKnowledge(source.title, source.content)
    const { embeddings, usage } = await embedMany({
      model: aiEmbeddingModel('knowledge'),
      values: chunks,
      maxParallelCalls: 2,
      abortSignal: AbortSignal.timeout(120_000),
    })
    const written = await prisma.$transaction(async (tx) => {
      // An edit during embedding bumped `version`; its own run will index the newer text.
      const done = await tx.knowledgeSource.updateMany({
        where: { id, version: source.version, status: 'PROCESSING' },
        data: {
          status: 'INDEXED',
          chunkCount: chunks.length,
          embeddingModel: aiEmbeddingModelId('knowledge'),
          indexedAt: new Date(),
          attempts: 0,
          error: null,
        },
      })
      if (done.count !== 1) return false
      await tx.$executeRaw`DELETE FROM "KnowledgeChunk" WHERE "sourceId" = ${id}`
      await tx.$executeRaw`
        INSERT INTO "KnowledgeChunk" ("id", "sourceId", "clientSiteId", "version", "ordinal", "content", "embedding")
        SELECT gen_random_uuid()::text, ${id}, ${source.clientSiteId}, ${source.version}, t.ordinal, t.content, t.embedding::vector
        FROM unnest(${chunks.map((_, index) => index)}::int[], ${chunks}::text[], ${embeddings.map(toPgVector)}::text[])
          AS t(ordinal, content, embedding)`
      return true
    })
    if (written)
      await logAction({
        action: 'KNOWLEDGE_SOURCE_INDEXED',
        clientSiteId: source.clientSiteId,
        metadata: { sourceId: id, version: source.version, chunks: chunks.length, embeddingTokens: usage.tokens },
      })
    return written
  } catch (error) {
    await prisma.knowledgeSource.updateMany({
      where: { id, version: source.version, status: 'PROCESSING' },
      data: {
        status: source.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        error: (error instanceof Error ? error.message : 'Indexing failed').slice(0, 500),
      },
    })
    await reportCaughtError('Knowledge indexing failed', error, { sourceId: id, attempt: source.attempts })
    return false
  }
}

export const drainKnowledgeQueue = async (limit = 10) => {
  const abandoned = await prisma.knowledgeSource.updateMany({
    where: {
      status: 'PROCESSING',
      attempts: { gte: MAX_ATTEMPTS },
      updatedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) },
    },
    data: { status: 'FAILED', error: 'Indexing did not finish' },
  })
  const queued = await prisma.knowledgeSource.findMany({
    where: claimable(),
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  let indexed = 0
  for (const { id } of queued) if (await indexKnowledgeSource(id)) indexed += 1
  return { queued: queued.length, indexed, abandoned: abandoned.count }
}

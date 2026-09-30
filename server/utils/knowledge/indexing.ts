import { embedMany } from 'ai'
import { knowledgeQuota } from '~~/shared/utils/knowledge'

import { chunkKnowledge } from './chunk'
import { KnowledgeExtractError } from './extract'
import { aiEmbeddingModelId } from '../ai/modelRegistry'
import { fetchKnowledgeFeed, type FeedProduct } from './feed'

const MAX_ATTEMPTS = 3
const STALE_CLAIM_MS = 10 * 60_000
// One commit per batch, so a timeout mid-catalog resumes where it stopped.
const FEED_EMBED_BATCH = 256

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
    select: {
      clientSiteId: true,
      title: true,
      content: true,
      version: true,
      attempts: true,
      kind: true,
      sourceUrl: true,
      currency: true,
      contentHash: true,
      embeddingModel: true,
      chunkCount: true,
    },
  })
  if (source.kind === 'FEED') return syncFeed({ id, ...source })
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

type FeedSource = {
  id: string
  clientSiteId: string
  version: number
  attempts: number
  sourceUrl: string | null
  currency: string | null
  contentHash: string
  embeddingModel: string | null
  chunkCount: number
}

/** The plan's product quota, less what the tenant's other feeds already hold. */
const feedProductLimit = async ({ id, clientSiteId }: FeedSource) => {
  const [site, others] = await Promise.all([
    prisma.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } }),
    prisma.knowledgeProduct.count({ where: { clientSiteId, sourceId: { not: id } } }),
  ])
  return Math.max(0, knowledgeQuota(site?.plan).maxProducts - others)
}

/** Facts only; a row whose facts did not change is not rewritten. */
const upsertProducts = (source: FeedSource, products: readonly FeedProduct[]) => prisma.$executeRaw`
  INSERT INTO "KnowledgeProduct" ("id", "updatedAt", "sourceId", "clientSiteId", "externalId", "name", "url", "price", "currency", "availability")
  SELECT gen_random_uuid()::text, now(), ${source.id}, ${source.clientSiteId}, t.external_id, t.name, t.url, t.price::numeric,
         t.currency, t.availability::"KnowledgeProductAvailability"
  FROM unnest(
    ${products.map((product) => product.externalId)}::text[],
    ${products.map((product) => product.name)}::text[],
    ${products.map((product) => product.url)}::text[],
    ${products.map((product) => product.price)}::text[],
    ${products.map((product) => product.currency)}::text[],
    ${products.map((product) => product.availability)}::text[]
  ) AS t(external_id, name, url, price, currency, availability)
  ON CONFLICT ("sourceId", "externalId") DO UPDATE SET
    "name" = EXCLUDED."name", "url" = EXCLUDED."url", "price" = EXCLUDED."price",
    "currency" = EXCLUDED."currency", "availability" = EXCLUDED."availability", "updatedAt" = now()
  WHERE ("KnowledgeProduct"."name", "KnowledgeProduct"."url", "KnowledgeProduct"."price", "KnowledgeProduct"."currency", "KnowledgeProduct"."availability")
    IS DISTINCT FROM (EXCLUDED."name", EXCLUDED."url", EXCLUDED."price", EXCLUDED."currency", EXCLUDED."availability")`

/** Embeds one batch and swaps its chunks; `textHash` moves in the same transaction as the chunk. */
const embedProducts = async (source: FeedSource, batch: readonly FeedProduct[], ids: readonly string[]) => {
  const { embeddings, usage } = await embedMany({
    model: aiEmbeddingModel('knowledge'),
    values: batch.map((product) => product.text),
    maxParallelCalls: 2,
    abortSignal: AbortSignal.timeout(120_000),
  })
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "KnowledgeChunk" WHERE "productId" = ANY(${ids}::text[])`
    await tx.$executeRaw`
      INSERT INTO "KnowledgeChunk" ("id", "sourceId", "clientSiteId", "version", "ordinal", "content", "embedding", "productId")
      SELECT gen_random_uuid()::text, ${source.id}, ${source.clientSiteId}, ${source.version}, 0, t.content, t.embedding::vector, t.product_id
      FROM unnest(${batch.map((product) => product.text)}::text[], ${embeddings.map(toPgVector)}::text[], ${ids}::text[])
        AS t(content, embedding, product_id)`
    await tx.$executeRaw`
      UPDATE "KnowledgeProduct" p SET "textHash" = t.hash
      FROM unnest(${ids}::text[], ${batch.map((product) => product.textHash)}::text[]) AS t(id, hash)
      WHERE p."id" = t.id`
    // A heartbeat: the stale-claim reclaim must leave a long but live sync alone.
    await tx.$executeRaw`UPDATE "KnowledgeSource" SET "updatedAt" = now() WHERE "id" = ${source.id}`
  })
  return usage.tokens
}

/**
 * Upserts every product's facts, embeds only products whose text changed (all of them after an
 * embedding-model switch), then drops products gone from the feed. A failed sync keeps the last
 * good catalog serving; only a feed that never synced counts attempts toward FAILED.
 */
const syncFeed = async (source: FeedSource) => {
  const model = aiEmbeddingModelId('knowledge')
  try {
    const { products, report, hash } = await fetchKnowledgeFeed(source.sourceUrl!, {
      currency: source.currency,
      limit: await feedProductLimit(source),
    })
    const changed = hash !== source.contentHash || source.embeddingModel !== model
    let embedded = 0
    let tokens = 0
    if (changed) {
      await upsertProducts(source, products)
      const stored = await prisma.knowledgeProduct.findMany({
        where: { sourceId: source.id },
        select: { id: true, externalId: true, textHash: true },
      })
      const byExternalId = new Map(stored.map((product) => [product.externalId, product]))
      const stale = products.filter(
        (product) =>
          source.embeddingModel !== model || byExternalId.get(product.externalId)!.textHash !== product.textHash,
      )
      for (let start = 0; start < stale.length; start += FEED_EMBED_BATCH) {
        const batch = stale.slice(start, start + FEED_EMBED_BATCH)
        const ids = batch.map((product) => byExternalId.get(product.externalId)!.id)
        tokens += await embedProducts(source, batch, ids)
        embedded += batch.length
      }
      await prisma.$executeRaw`
        DELETE FROM "KnowledgeProduct"
        WHERE "sourceId" = ${source.id} AND NOT ("externalId" = ANY(${products.map((product) => product.externalId)}::text[]))`
    }
    const now = new Date()
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: {
        status: 'INDEXED',
        chunkCount: products.length,
        embeddingModel: model,
        contentHash: hash,
        syncReport: report,
        fetchedAt: now,
        ...(changed ? { indexedAt: now } : {}),
        attempts: 0,
        error: null,
      },
    })
    if (changed)
      await logAction({
        action: 'KNOWLEDGE_SOURCE_INDEXED',
        clientSiteId: source.clientSiteId,
        metadata: { sourceId: source.id, products: products.length, embedded, embeddingTokens: tokens },
      })
    return true
  } catch (error) {
    // A code is the shop's problem and the list explains it; anything else is ours.
    const code = error instanceof KnowledgeExtractError ? error.code : null
    // Only the network can heal itself: a page that is not a feed will not become one on retry.
    const retry = (!code || code === 'unreachable') && source.attempts < MAX_ATTEMPTS
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: {
        status: source.chunkCount ? 'INDEXED' : retry ? 'PENDING' : 'FAILED',
        fetchedAt: new Date(),
        error: (code ?? (error instanceof Error ? error.message : 'Feed sync failed')).slice(0, 500),
      },
    })
    if (!code)
      await reportCaughtError('Knowledge feed sync failed', error, { sourceId: source.id, attempt: source.attempts })
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

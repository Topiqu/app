import { embedMany } from 'ai'
import { randomUUID } from 'node:crypto'
import { knowledgeQuota } from '~~/shared/utils/knowledge'

import type { DatabaseTransaction } from '../database'

import { chunkKnowledge } from './chunk'
import { KnowledgeExtractError } from './extract'
import { knowledgeSiteWhere } from './eligibility'
import { aiEmbeddingModelId } from '../ai/modelRegistry'
import { fetchShopifyCatalog } from '../shopify/catalog'
import { fetchKnowledgeFeed, type FeedProduct } from './feed'

const MAX_ATTEMPTS = 3
const STALE_CLAIM_MS = 10 * 60_000
// One commit per batch, so a timeout mid-catalog resumes where it stopped.
const FEED_EMBED_BATCH = 256

export const toPgVector = (values: readonly number[]) => `[${values.join(',')}]`

const claimable = () => ({
  deletedAt: null,
  clientSite: knowledgeSiteWhere(),
  attempts: { lt: MAX_ATTEMPTS },
  OR: [
    { status: 'PENDING' as const },
    // A process that died mid-run leaves PROCESSING behind; reclaim it once the run is clearly gone.
    { status: 'PROCESSING' as const, updatedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
  ],
})

export const indexKnowledgeSource = async (id: string) => {
  const indexingToken = randomUUID()
  const target = await prisma.knowledgeSource.findUnique({ where: { id }, select: { clientSiteId: true } })
  if (!target) return false
  const claim = await prisma.$transaction(async (tx) => {
    // Match the parent-first lock order of feature/plan transitions before paying for a claim.
    await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${target.clientSiteId} FOR SHARE`
    return tx.knowledgeSource.updateMany({
      where: { id, clientSiteId: target.clientSiteId, ...claimable() },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, indexingToken },
    })
  })
  if (claim.count !== 1) return false

  const source = await prisma.knowledgeSource.findFirst({
    where: { id, indexingToken, status: 'PROCESSING', deletedAt: null },
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
      shopifyConnectionId: true,
    },
  })
  if (!source) return false
  const ownership = { id, version: source.version, indexingToken }
  if (source.kind === 'FEED' || source.kind === 'SHOPIFY') return syncFeed({ ...source, ...ownership })
  try {
    await heartbeat({ ...source, ...ownership })
    const chunks = chunkKnowledge(source.title, source.content)
    const { embeddings, usage } = await embedMany({
      model: aiEmbeddingModel('knowledge'),
      values: chunks,
      maxParallelCalls: 2,
      abortSignal: AbortSignal.timeout(120_000),
    })
    await recordAiUsage(source.clientSiteId, usage.tokens ?? 0, 'KNOWLEDGE_EMBEDDING_TOKENS', {
      sourceId: id,
      version: source.version,
      attempt: source.attempts,
      embeddingModel: aiEmbeddingModelId('knowledge'),
      chunks: chunks.length,
    })
    if (embeddings.length !== chunks.length) throw new Error('Incomplete knowledge embedding batch')
    const written = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${source.clientSiteId} FOR SHARE`
      // An edit during embedding bumped `version`; its own run will index the newer text.
      const done = await tx.knowledgeSource.updateMany({
        where: claimOwner(ownership),
        data: {
          status: 'INDEXED',
          chunkCount: chunks.length,
          embeddingModel: aiEmbeddingModelId('knowledge'),
          indexedAt: new Date(),
          attempts: 0,
          error: null,
          indexingToken: null,
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
    if (written) {
      try {
        await logAction({
          action: 'KNOWLEDGE_SOURCE_INDEXED',
          clientSiteId: source.clientSiteId,
          metadata: { sourceId: id, version: source.version, chunks: chunks.length, embeddingTokens: usage.tokens },
        })
      } catch (error) {
        await reportCaughtError('Knowledge indexing audit failed', error, { sourceId: id })
      }
    }
    if (!written) await releaseIneligibleClaim({ ...source, ...ownership })
    return written
  } catch (error) {
    if (error instanceof LostKnowledgeClaim) {
      await releaseIneligibleClaim({ ...source, ...ownership })
      return false
    }
    await prisma.knowledgeSource.updateMany({
      where: claimOwner(ownership),
      data: {
        status: source.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        error: (error instanceof Error ? error.message : 'Indexing failed').slice(0, 500),
        indexingToken: null,
      },
    })
    await releaseIneligibleClaim({ ...source, ...ownership })
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
  shopifyConnectionId?: string | null
  indexingToken: string
}

const claimIdentity = ({ id, version, indexingToken }: { id: string; version: number; indexingToken: string }) => ({
  id,
  version,
  indexingToken,
  status: 'PROCESSING' as const,
})

const claimOwner = (source: Parameters<typeof claimIdentity>[0]) => ({
  ...claimIdentity(source),
  deletedAt: null,
  clientSite: knowledgeSiteWhere(),
})

class LostKnowledgeClaim extends Error {}
class KnowledgeQuotaChanged extends Error {}

const heartbeat = async (source: FeedSource, db: Pick<DatabaseTransaction, 'knowledgeSource'> = prisma) => {
  const result = await db.knowledgeSource.updateMany({
    where: claimOwner(source),
    data: { updatedAt: new Date() },
  })
  if (result.count !== 1) throw new LostKnowledgeClaim()
}

/** A revoked tenant can resume explicitly later without losing a successful catalog or retry budget. */
const releaseIneligibleClaim = (
  source: Pick<FeedSource, 'id' | 'version' | 'indexingToken' | 'clientSiteId' | 'attempts'>,
) =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${source.clientSiteId} FOR SHARE`
    const released = await tx.knowledgeSource.updateMany({
      where: {
        ...claimIdentity(source),
        OR: [{ deletedAt: { not: null } }, { clientSite: { NOT: knowledgeSiteWhere() } }],
      },
      data: { status: 'PENDING', attempts: Math.max(0, source.attempts - 1), indexingToken: null },
    })
    if (released.count === 1) await tx.$executeRaw`DELETE FROM "KnowledgeProductStage" WHERE "sourceId" = ${source.id}`
  })

/** Reserve the larger live/staged catalog per source, without counting replacement IDs twice. */
const feedProductLimit = async (
  { id, clientSiteId }: FeedSource,
  db: Pick<DatabaseTransaction, 'clientSite' | '$queryRaw'> = prisma,
) => {
  const [site, others] = await Promise.all([
    db.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } }),
    db.$queryRaw<{ reserved: number }[]>`
      SELECT COALESCE(sum(GREATEST(
        (SELECT count(*) FROM "KnowledgeProduct" p WHERE p."sourceId" = s."id"),
        (SELECT count(*) FROM "KnowledgeProductStage" p WHERE p."sourceId" = s."id")
      )), 0)::int AS reserved
      FROM "KnowledgeSource" s WHERE s."clientSiteId" = ${clientSiteId} AND s."id" <> ${id}`,
  ])
  return Math.max(0, knowledgeQuota(site?.plan).maxProducts - (others[0]?.reserved ?? 0))
}

/** Facts only; a row whose facts did not change is not rewritten. */
const upsertProducts = (
  tx: DatabaseTransaction,
  source: FeedSource,
  products: readonly FeedProduct[],
) => tx.$executeRaw`
  INSERT INTO "KnowledgeProduct" ("id", "updatedAt", "sourceId", "clientSiteId", "externalId", "name", "brand", "url", "price", "currency", "availability")
  SELECT gen_random_uuid()::text, now(), ${source.id}, ${source.clientSiteId}, t.external_id, t.name, t.brand, t.url, t.price::numeric,
         t.currency, t.availability::"KnowledgeProductAvailability"
  FROM unnest(
    ${products.map((product) => product.externalId)}::text[],
    ${products.map((product) => product.name)}::text[],
    ${products.map((product) => product.brand)}::text[],
    ${products.map((product) => product.url)}::text[],
    ${products.map((product) => product.price)}::text[],
    ${products.map((product) => product.currency)}::text[],
    ${products.map((product) => product.availability)}::text[]
  ) AS t(external_id, name, brand, url, price, currency, availability)
  ON CONFLICT ("sourceId", "externalId") DO UPDATE SET
    "name" = EXCLUDED."name", "brand" = EXCLUDED."brand", "url" = EXCLUDED."url", "price" = EXCLUDED."price",
    "currency" = EXCLUDED."currency", "availability" = EXCLUDED."availability", "updatedAt" = now()
  WHERE ("KnowledgeProduct"."name", "KnowledgeProduct"."brand", "KnowledgeProduct"."url", "KnowledgeProduct"."price", "KnowledgeProduct"."currency", "KnowledgeProduct"."availability")
    IS DISTINCT FROM (EXCLUDED."name", EXCLUDED."brand", EXCLUDED."url", EXCLUDED."price", EXCLUDED."currency", EXCLUDED."availability")`

/** Retain completed batches privately; live products and chunks remain a consistent snapshot. */
const embedProducts = async (source: FeedSource, batch: readonly FeedProduct[], model: string) => {
  await heartbeat(source)
  const { embeddings, usage } = await embedMany({
    model: aiEmbeddingModel('knowledge'),
    values: batch.map((product) => product.text),
    maxParallelCalls: 2,
    abortSignal: AbortSignal.timeout(120_000),
  })
  await recordAiUsage(source.clientSiteId, usage.tokens ?? 0, 'KNOWLEDGE_EMBEDDING_TOKENS', {
    sourceId: source.id,
    version: source.version,
    attempt: source.attempts,
    embeddingModel: model,
    products: batch.length,
  })
  if (embeddings.length !== batch.length) throw new Error('Incomplete knowledge embedding batch')
  await prisma.$transaction(async (tx) => {
    await heartbeat(source, tx)
    const written = await tx.$executeRaw`
      UPDATE "KnowledgeProductStage" p SET "embedding" = t.embedding::vector, "updatedAt" = now()
      FROM unnest(${batch.map((product) => product.externalId)}::text[], ${batch.map((product) => product.textHash)}::text[],
        ${embeddings.map(toPgVector)}::text[]) AS t(external_id, hash, embedding)
      WHERE p."sourceId" = ${source.id} AND p."externalId" = t.external_id
        AND p."textHash" = t.hash AND p."embeddingModel" = ${model}`
    if (written !== batch.length) throw new Error('Incomplete knowledge embedding stage')
  })
  return usage.tokens
}

/**
 * Reserve a bounded snapshot, resume changed embeddings in private batches, then atomically swap
 * facts/chunks/retired products. Failure keeps serving the last good catalog and its original facts.
 */
const syncFeed = async (source: FeedSource) => {
  const model = aiEmbeddingModelId('knowledge')
  try {
    await heartbeat(source)
    const limit = await feedProductLimit(source)
    const snapshot = source.shopifyConnectionId
      ? await fetchShopifyCatalog(source.shopifyConnectionId, source.clientSiteId, limit, () => heartbeat(source))
      : await fetchKnowledgeFeed(source.sourceUrl!, { currency: source.currency, limit })
    const { products, report, hash } = snapshot
    await heartbeat(source)
    const changed = hash !== source.contentHash || source.embeddingModel !== model
    let embedded = 0
    let tokens = 0
    let rewritten: FeedProduct[] = []
    if (changed) {
      await prisma.$transaction(async (tx) => {
        // Serialize only the short reservation/write, using the same parent-first lock order as plan changes.
        await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${source.clientSiteId} FOR UPDATE`
        await heartbeat(source, tx)
        if (products.length > (await feedProductLimit(source, tx))) throw new KnowledgeQuotaChanged()
        await tx.$executeRaw`
          DELETE FROM "KnowledgeProductStage" WHERE "sourceId" = ${source.id}
            AND NOT ("externalId" = ANY(${products.map((product) => product.externalId)}::text[]))`
        await tx.$executeRaw`
          INSERT INTO "KnowledgeProductStage" ("sourceId", "externalId", "textHash", "embeddingModel")
          SELECT ${source.id}, t.external_id, t.hash, ${model}
          FROM unnest(${products.map((product) => product.externalId)}::text[], ${products.map((product) => product.textHash)}::text[])
            AS t(external_id, hash)
          ON CONFLICT ("sourceId", "externalId") DO UPDATE SET
            "embedding" = CASE WHEN "KnowledgeProductStage"."textHash" = EXCLUDED."textHash"
                AND "KnowledgeProductStage"."embeddingModel" = EXCLUDED."embeddingModel"
              THEN "KnowledgeProductStage"."embedding" ELSE NULL END,
            "textHash" = EXCLUDED."textHash", "embeddingModel" = EXCLUDED."embeddingModel", "updatedAt" = now()`
      })
      const stored = await prisma.knowledgeProduct.findMany({
        where: { sourceId: source.id },
        select: { externalId: true, textHash: true },
      })
      const byExternalId = new Map(stored.map((product) => [product.externalId, product]))
      rewritten = products.filter(
        (product) =>
          source.embeddingModel !== model || byExternalId.get(product.externalId)?.textHash !== product.textHash,
      )
      // Only readiness leaves PostgreSQL; loading every staged vector would inflate process memory.
      const ready = await prisma.$queryRaw<{ externalId: string }[]>`
        SELECT "externalId" FROM "KnowledgeProductStage"
        WHERE "sourceId" = ${source.id} AND "embeddingModel" = ${model} AND "embedding" IS NOT NULL`
      const completed = new Set(ready.map((product) => product.externalId))
      const stale = rewritten.filter((product) => !completed.has(product.externalId))
      for (let start = 0; start < stale.length; start += FEED_EMBED_BATCH) {
        const batch = stale.slice(start, start + FEED_EMBED_BATCH)
        tokens += await embedProducts(source, batch, model)
        embedded += batch.length
      }
    }
    const now = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${source.clientSiteId} FOR UPDATE`
      await heartbeat(source, tx)
      if (products.length > (await feedProductLimit(source, tx))) throw new KnowledgeQuotaChanged()
      if (changed) {
        if (rewritten.length) {
          const [ready] = await tx.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM "KnowledgeProductStage"
            WHERE "sourceId" = ${source.id} AND "embeddingModel" = ${model} AND "embedding" IS NOT NULL
              AND "externalId" = ANY(${rewritten.map((product) => product.externalId)}::text[])`
          if (ready?.count !== rewritten.length) throw new Error('Incomplete knowledge catalog snapshot')
        }
        await upsertProducts(tx, source, products)
        if (rewritten.length) {
          await tx.$executeRaw`
            DELETE FROM "KnowledgeChunk" c USING "KnowledgeProduct" p
            WHERE c."productId" = p."id" AND p."sourceId" = ${source.id}
              AND p."externalId" = ANY(${rewritten.map((product) => product.externalId)}::text[])`
          await tx.$executeRaw`
            INSERT INTO "KnowledgeChunk" ("id", "sourceId", "clientSiteId", "version", "ordinal", "content", "embedding", "productId")
            SELECT gen_random_uuid()::text, ${source.id}, ${source.clientSiteId}, ${source.version}, 0, t.content, s."embedding", p."id"
            FROM unnest(${rewritten.map((product) => product.externalId)}::text[], ${rewritten.map((product) => product.text)}::text[],
              ${rewritten.map((product) => product.textHash)}::text[]) AS t(external_id, content, hash)
            JOIN "KnowledgeProductStage" s ON s."sourceId" = ${source.id} AND s."externalId" = t.external_id
              AND s."textHash" = t.hash AND s."embeddingModel" = ${model}
            JOIN "KnowledgeProduct" p ON p."sourceId" = ${source.id} AND p."externalId" = t.external_id`
          await tx.$executeRaw`
            UPDATE "KnowledgeProduct" p SET "textHash" = t.hash
            FROM unnest(${rewritten.map((product) => product.externalId)}::text[], ${rewritten.map((product) => product.textHash)}::text[])
              AS t(external_id, hash)
            WHERE p."sourceId" = ${source.id} AND p."externalId" = t.external_id`
        }
        await tx.$executeRaw`
          DELETE FROM "KnowledgeProduct"
          WHERE "sourceId" = ${source.id} AND NOT ("externalId" = ANY(${products.map((product) => product.externalId)}::text[]))`
      }
      const done = await tx.knowledgeSource.updateMany({
        where: claimOwner(source),
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
          indexingToken: null,
        },
      })
      if (done.count !== 1) throw new LostKnowledgeClaim()
      await tx.$executeRaw`DELETE FROM "KnowledgeProductStage" WHERE "sourceId" = ${source.id}`
      if (source.shopifyConnectionId && 'revision' in snapshot && typeof snapshot.revision === 'number')
        await tx.shopifyConnection.update({
          where: { id: source.shopifyConnectionId },
          data: { catalogSyncedRevision: snapshot.revision },
        })
    })
    if (changed) {
      try {
        await logAction({
          action: 'KNOWLEDGE_SOURCE_INDEXED',
          clientSiteId: source.clientSiteId,
          metadata: { sourceId: source.id, products: products.length, embedded, embeddingTokens: tokens },
        })
      } catch (error) {
        await reportCaughtError('Knowledge feed audit failed', error, { sourceId: source.id })
      }
    }
    return true
  } catch (error) {
    if (error instanceof LostKnowledgeClaim) {
      await releaseIneligibleClaim(source)
      return false
    }
    if (error instanceof KnowledgeQuotaChanged) {
      // Another feed used the old budget while this snapshot was fetched. Re-fetch with the new cap.
      await prisma.knowledgeSource.updateMany({
        where: claimOwner(source),
        data: { status: 'PENDING', attempts: 0, indexingToken: null },
      })
      await releaseIneligibleClaim(source)
      return false
    }
    // A code is the shop's problem and the list explains it; anything else is ours.
    const code = error instanceof KnowledgeExtractError ? error.code : null
    // Only the network can heal itself: a page that is not a feed will not become one on retry.
    const retry = (!code || code === 'unreachable') && source.attempts < MAX_ATTEMPTS
    await prisma.$transaction(async (tx) => {
      const saved = await tx.knowledgeSource.updateMany({
        where: claimOwner(source),
        data: {
          status: retry ? 'PENDING' : source.chunkCount ? 'INDEXED' : 'FAILED',
          fetchedAt: new Date(),
          error: (code ?? (error instanceof Error ? error.message : 'Feed sync failed')).slice(0, 500),
          indexingToken: null,
        },
      })
      // Terminal failures relinquish only the temporary reservation, never the last good catalog.
      if (saved.count === 1 && !retry)
        await tx.$executeRaw`DELETE FROM "KnowledgeProductStage" WHERE "sourceId" = ${source.id}`
    })
    await releaseIneligibleClaim(source)
    if (!code)
      await reportCaughtError('Knowledge feed sync failed', error, { sourceId: source.id, attempt: source.attempts })
    return false
  }
}

export const drainKnowledgeQueue = async (limit = 10) => {
  const abandoned = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      WITH abandoned AS (
        SELECT "id" FROM "KnowledgeSource"
        WHERE "status" = 'PROCESSING' AND "attempts" >= ${MAX_ATTEMPTS}
          AND "updatedAt" < ${new Date(Date.now() - STALE_CLAIM_MS)}
        ORDER BY "updatedAt", "id" LIMIT ${Math.max(1, Math.min(10, limit))} FOR UPDATE SKIP LOCKED
      )
      UPDATE "KnowledgeSource" SET
        "status" = CASE WHEN "kind" IN ('FEED', 'SHOPIFY') AND "chunkCount" > 0 THEN 'INDEXED' ELSE 'FAILED' END::"KnowledgeSourceStatus",
        "error" = 'Indexing did not finish', "indexingToken" = NULL, "updatedAt" = now()
      WHERE "id" IN (SELECT "id" FROM abandoned)
      RETURNING "id"`
    if (rows.length)
      await tx.$executeRaw`DELETE FROM "KnowledgeProductStage" WHERE "sourceId" = ANY(${rows.map((source) => source.id)}::text[])`
    return rows.length
  })
  const queued = await prisma.knowledgeSource.findMany({
    where: claimable(),
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  let indexed = 0
  for (const { id } of queued) if (await indexKnowledgeSource(id)) indexed += 1
  return { queued: queued.length, indexed, abandoned }
}

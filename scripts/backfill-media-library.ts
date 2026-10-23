import { parseArgs } from 'node:util'
import { createHash, randomUUID } from 'node:crypto'

import type { Language, MediaAsset } from '../generated/zenstack/models'
import type { DatabaseClient, DatabaseTransaction } from '../server/utils/database'

import { createDatabaseClient } from '../server/utils/database'
import { extractArticleMedia } from '../shared/utils/mediaRights'

const phases = ['assets', 'articles', 'translations', 'drafts'] as const
type Phase = (typeof phases)[number]
type DocumentPhase = Exclude<Phase, 'assets'>
type MediaDb = Pick<DatabaseTransaction, 'mediaAsset' | 'articleMediaUsage' | '$queryRaw' | '$queryRawUnsafe'>
type Identity = { id: string; clientSiteId: string; articleId?: string }
type Document = Identity & {
  articleId: string
  language: Language | null
  content: string | null
  imageUrl: string | null
  coverMediaId: string | null
  oversized: boolean
}
const MAX_BODY_BYTES = 1024 * 1024
const MAX_OCCURRENCES = 500
const MAX_NEW_ASSETS = 20_000
const MAX_MATCHES = 1000
const limited = (value: string | null | undefined, maximum: number) => value?.trim().slice(0, maximum) || null

const assetSelect = {
  id: true,
  clientSiteId: true,
  url: true,
  deliveryUrl: true,
  storageKey: true,
  name: true,
  originalFilename: true,
  defaultAltText: true,
  machineTags: true,
  searchText: true,
  author: true,
  license: true,
  updatedAt: true,
} as const
type ExistingAsset = Pick<MediaAsset, keyof typeof assetSelect>

const filename = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || '') || null
  } catch {
    return null
  }
}

const storageKey = (url: string, cdnUrl: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.host !== new URL(cdnUrl).host) return null
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    return /^(?:uploads|article-images|optimized)\/[A-Za-z0-9._/-]+$/.test(key) ? key : null
  } catch {
    return null
  }
}

const enrichment = (asset: ExistingAsset, cdnUrl: string) => {
  const originalFilename = limited(asset.originalFilename || filename(asset.url), 255)
  const name = limited(asset.name || originalFilename?.replace(/\.[^/.]+$/, ''), 255)
  return {
    deliveryUrl: asset.deliveryUrl || asset.url,
    storageKey: asset.storageKey || storageKey(asset.url, cdnUrl),
    originalFilename,
    name,
    searchText: [name, originalFilename, asset.defaultAltText, asset.author, asset.license, ...asset.machineTags]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .slice(0, 5000),
  }
}

async function readDocument(db: MediaDb, phase: DocumentPhase, identity: Identity, lock: boolean) {
  if (lock && phase === 'translations') {
    const parent = await db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Article" WHERE "id" = ${identity.articleId} AND "clientSiteId" = ${identity.clientSiteId}
        AND "deletedAt" IS NULL FOR UPDATE
    `
    if (!parent.length) return null
  }
  // Identifiers and SQL fragments come exclusively from this fixed phase map.
  // IDs, tenant scope and byte limits remain bound parameters. SQL projects a
  // bounded body before transfer, including legacy drafts without a size limit.
  const table = { articles: 'Article', translations: 'ArticleTranslation', drafts: 'ArticleDraft' }[phase]
  const translated = phase === 'translations'
  const rows = await db.$queryRawUnsafe<Document[]>(
    `
    SELECT source."id", source."clientSiteId", source."language",
      ${translated ? 'source."articleId"' : 'source."id"'} AS "articleId",
      ${translated ? 'NULL::text' : 'source."imageUrl"'} AS "imageUrl",
      ${translated ? 'NULL::text' : 'source."coverMediaId"'} AS "coverMediaId",
      CASE WHEN octet_length(source."content") <= $3 THEN source."content" ELSE NULL END AS "content",
      COALESCE(octet_length(source."content"), 0) > $3 AS "oversized"
    FROM "${table}" source
    INNER JOIN "ClientSite" site ON site."id" = source."clientSiteId" AND site."deletedAt" IS NULL
    ${translated ? 'INNER JOIN "Article" parent ON parent."id" = source."articleId" AND parent."clientSiteId" = source."clientSiteId" AND parent."deletedAt" IS NULL' : ''}
    WHERE source."id" = $1 AND source."clientSiteId" = $2 AND source."deletedAt" IS NULL
    ${translated ? 'AND source."articleId" = $4' : ''}
    ${lock ? 'FOR UPDATE OF source' : ''}
  `,
    identity.id,
    identity.clientSiteId,
    MAX_BODY_BYTES,
    ...(translated ? [identity.articleId] : []),
  )
  return rows[0] ?? null
}

async function resolveMedia(db: MediaDb, source: Document, apply: boolean, cdnUrl: string, proposed: Set<string>) {
  if (source.oversized) return { kind: 'oversized' } as const
  const occurrences = extractArticleMedia(source)
  if (occurrences.length > MAX_OCCURRENCES) return { kind: 'oversized' } as const
  const ids = [...new Set(occurrences.flatMap((row) => (row.mediaId ? [row.mediaId] : [])))]
  const urls = [...new Set(occurrences.map((row) => row.url).filter((url) => url.length <= 2048))]
  const matches =
    ids.length || urls.length
      ? await db.mediaAsset.findMany({
          where: {
            clientSiteId: source.clientSiteId,
            deletedAt: null,
            purgedAt: null,
            OR: [
              ...(ids.length ? [{ id: { in: ids } }] : []),
              ...(urls.length ? [{ url: { in: urls } }, { deliveryUrl: { in: urls } }] : []),
            ],
          },
          select: { id: true, url: true, deliveryUrl: true },
          take: MAX_MATCHES + 1,
        })
      : []
  if (matches.length > MAX_MATCHES) return { kind: 'ambiguous' } as const
  type Resolved = { id: string; url: string; deliveryUrl: string | null }
  const byId = new Map<string, Resolved>(matches.map((asset) => [asset.id, asset]))
  const byUrl = new Map<string, Resolved | null>()
  for (const asset of matches)
    for (const url of [asset.url, asset.deliveryUrl]) {
      if (!url) continue
      const previous = byUrl.get(url)
      byUrl.set(url, byUrl.has(url) && previous?.id !== asset.id ? null : asset)
    }
  const additions = []
  const hashes = new Set<string>()
  const grouped = new Map<string, { mediaAssetId: string; placement: 'COVER' | 'BODY'; occurrenceCount: number }>()
  let skipped = 0
  for (const occurrence of occurrences) {
    let asset = (occurrence.mediaId && byId.get(occurrence.mediaId)) || byUrl.get(occurrence.url)
    if (!asset && byUrl.has(occurrence.url)) return { kind: 'ambiguous' } as const
    if (!asset) {
      if (occurrence.url.length > 2048) {
        skipped++
        continue
      }
      const hash = createHash('sha256').update(source.clientSiteId).update('\n').update(occurrence.url).digest('hex')
      const originalFilename = limited(filename(occurrence.url), 255)
      const alt = limited(occurrence.alt, 500)
      const key = storageKey(occurrence.url, cdnUrl)
      const values = {
        id: apply ? randomUUID() : `dry:${hash}`,
        clientSiteId: source.clientSiteId,
        url: occurrence.url,
        deliveryUrl: occurrence.url,
        storageKey: key,
        name: limited(alt || originalFilename?.replace(/\.[^/.]+$/, ''), 255),
        defaultAltText: alt,
        originalFilename,
        origin: key?.startsWith('article-images/')
          ? ('TOPIQU_AI' as const)
          : key
            ? ('UNKNOWN' as const)
            : ('EXTERNAL' as const),
        sourceUrl: key ? null : occurrence.url,
        searchText: [alt, originalFilename].filter(Boolean).join(' ').toLocaleLowerCase().slice(0, 5000),
      }
      additions.push(values)
      if (!proposed.has(hash)) hashes.add(hash)
      asset = values
      byId.set(asset.id, asset)
      byUrl.set(asset.url, asset)
    }
    const placement = occurrence.placement === 'cover' ? 'COVER' : 'BODY'
    const key = `${asset.id}:${placement}`
    const current = grouped.get(key)
    grouped.set(key, { mediaAssetId: asset.id, placement, occurrenceCount: (current?.occurrenceCount ?? 0) + 1 })
  }
  if (proposed.size + hashes.size > MAX_NEW_ASSETS) return { kind: 'budget' } as const
  return { kind: 'ready', additions, hashes, grouped, skipped } as const
}

type Progress = {
  scanned: number
  enriched: number
  created: number
  usages: number
  skipped: number
  oversized: number
  conflicted: number
  ambiguous: number
  nextCursor: string | null
  stopReason: 'complete' | 'limit' | 'asset-budget' | null
}

export const backfillMediaLibrary = async (
  prisma: DatabaseClient,
  options: {
    apply?: boolean
    limit?: number
    batchSize?: number
    after?: string
    clientSiteId?: string
    cdnUrl?: string
    onProgress?: (progress: Progress) => void
  } = {},
): Promise<Progress> => {
  const limit = options.limit ?? 1000
  const batchSize = options.batchSize ?? 100
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100_000) throw new Error('limit must be from 1 to 100000')
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 200)
    throw new Error('batch-size must be from 1 to 200')
  if (options.clientSiteId !== undefined && (!options.clientSiteId.trim() || options.clientSiteId.length > 128))
    throw new Error('Invalid tenant scope')
  const [resumePhase, ...resumeParts] = options.after?.split(':') ?? ['assets']
  let phaseIndex = phases.indexOf(resumePhase as Phase)
  let cursor = resumeParts.join(':') || undefined
  if (
    phaseIndex < 0 ||
    (options.after !== undefined &&
      (!options.after || options.after.length > 256 || (resumeParts.length > 0 && !cursor))) ||
    (cursor && cursor.length > 128)
  )
    throw new Error('Invalid resume cursor')
  const apply = options.apply ?? false
  const cdnUrl = options.cdnUrl ?? (process.env.CDN_URL || 'https://cdn.topiqu.com')
  const proposed = new Set<string>()
  const progress: Progress = {
    scanned: 0,
    enriched: 0,
    created: 0,
    usages: 0,
    skipped: 0,
    oversized: 0,
    conflicted: 0,
    ambiguous: 0,
    nextCursor: null,
    stopReason: 'complete',
  }
  const identitySelect = { id: true, clientSiteId: true } as const
  const checkpoint = () => options.onProgress?.({ ...progress })

  while (phaseIndex < phases.length && progress.scanned < limit) {
    const phase = phases[phaseIndex]!
    const take = Math.min(batchSize, limit - progress.scanned)
    const where = {
      deletedAt: null,
      clientSite: { deletedAt: null },
      ...(options.clientSiteId ? { clientSiteId: options.clientSiteId } : {}),
      ...(cursor ? { id: { gt: cursor } } : {}),
    }
    if (phase === 'assets') {
      const assets = await prisma.mediaAsset.findMany({
        where: { ...where, purgedAt: null },
        select: assetSelect,
        orderBy: { id: 'asc' },
        take,
      })
      for (const asset of assets) {
        const values = enrichment(asset, cdnUrl)
        const changed = (Object.keys(values) as (keyof typeof values)[]).some((key) => asset[key] !== values[key])
        if (changed) {
          const updated = apply
            ? await prisma.mediaAsset.updateMany({
                where: {
                  id: asset.id,
                  clientSiteId: asset.clientSiteId,
                  purgedAt: null,
                  updatedAt: asset.updatedAt,
                  name: asset.name,
                  originalFilename: asset.originalFilename,
                  deliveryUrl: asset.deliveryUrl,
                  storageKey: asset.storageKey,
                  searchText: asset.searchText,
                },
                data: values,
              })
            : { count: 1 }
          if (updated.count) progress.enriched++
          else progress.conflicted++
        }
        progress.scanned++
        cursor = asset.id
      }
      if (assets.length < take) {
        phaseIndex++
        cursor = undefined
      }
    } else {
      const identities: Identity[] =
        phase === 'articles'
          ? await prisma.article.findMany({ where, select: identitySelect, orderBy: { id: 'asc' }, take })
          : phase === 'drafts'
            ? await prisma.articleDraft.findMany({ where, select: identitySelect, orderBy: { id: 'asc' }, take })
            : await prisma.articleTranslation.findMany({
                where: { ...where, article: { deletedAt: null } },
                select: { ...identitySelect, articleId: true },
                orderBy: { id: 'asc' },
                take,
              })
      for (const identity of identities) {
        const indexDocument = async (db: MediaDb) => {
          const source = await readDocument(db, phase, identity, apply)
          if (!source) return { kind: 'conflicted' } as const
          const resolved = await resolveMedia(db, source, apply, cdnUrl, proposed)
          if (resolved.kind !== 'ready') return resolved
          if (apply) {
            for (const asset of resolved.additions) await db.mediaAsset.create({ data: asset })
            if (phase !== 'drafts') {
              await db.articleMediaUsage.deleteMany({
                where: { clientSiteId: source.clientSiteId, articleId: source.articleId, language: source.language! },
              })
              if (resolved.grouped.size)
                await db.articleMediaUsage.createMany({
                  data: [...resolved.grouped.values()].map((usage) => ({
                    id: randomUUID(),
                    clientSiteId: source.clientSiteId,
                    articleId: source.articleId,
                    articleTranslationId: phase === 'translations' ? source.id : null,
                    language: source.language!,
                    ...usage,
                  })),
                })
            }
          }
          return {
            kind: 'done',
            hashes: resolved.hashes,
            usages: phase === 'drafts' ? 0 : resolved.grouped.size,
            skipped: resolved.skipped,
          } as const
        }
        const outcome = apply ? await prisma.$transaction(indexDocument) : await indexDocument(prisma)
        if (outcome.kind === 'budget') {
          progress.nextCursor = cursor ? `${phase}:${cursor}` : phase
          progress.stopReason = 'asset-budget'
          checkpoint()
          return progress
        }
        if (outcome.kind === 'done') {
          for (const hash of outcome.hashes) proposed.add(hash)
          progress.created += outcome.hashes.size
          progress.usages += outcome.usages
          progress.skipped += outcome.skipped
        } else progress[outcome.kind]++
        progress.scanned++
        cursor = identity.id
      }
      if (identities.length < take) {
        phaseIndex++
        cursor = undefined
      }
    }
    const nextPhase = phases[phaseIndex]
    progress.nextCursor = nextPhase ? (cursor ? `${nextPhase}:${cursor}` : nextPhase) : null
    progress.stopReason = nextPhase ? (progress.scanned === limit ? 'limit' : null) : 'complete'
    checkpoint()
  }
  return progress
}

if (import.meta.main) {
  let prisma: DatabaseClient | undefined
  try {
    const { values } = parseArgs({
      options: {
        limit: { type: 'string' },
        'batch-size': { type: 'string' },
        after: { type: 'string' },
        site: { type: 'string' },
      },
    })
    const apply = process.env.APPLY === '1'
    prisma = createDatabaseClient()
    const onProgress = (progress: Progress) =>
      console.info(
        JSON.stringify({ mode: apply ? 'apply' : 'dry-run', clientSiteId: values.site ?? null, ...progress }),
      )
    await backfillMediaLibrary(prisma, {
      apply,
      limit: Number(values.limit ?? 1000),
      batchSize: Number(values['batch-size'] ?? 100),
      after: values.after,
      clientSiteId: values.site,
      onProgress,
    })
  } catch {
    console.error('[media-backfill] failed; resume from the last reported cursor after reviewing the isolated target')
    process.exitCode = 1
  } finally {
    try {
      await prisma?.$disconnect()
    } catch {
      console.error('[media-backfill] database shutdown failed; completed transactions remain committed')
      process.exitCode = 1
    }
  }
}

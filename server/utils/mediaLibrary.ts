import type { Language, MediaOrigin, MediaUsagePlacement } from '~~/generated/zenstack/models'

import { createHash, randomUUID } from 'node:crypto'
import { extractArticleMedia } from '~~/shared/utils/mediaRights'

type RegisterMediaInput = {
  clientSiteId: string
  createdById?: string | null
  url: string
  deliveryUrl?: string | null
  storageKey?: string | null
  name?: string | null
  defaultAltText?: string | null
  originalFilename?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  contentHash?: string | null
  width?: number | null
  height?: number | null
  origin?: MediaOrigin
  sourceUrl?: string | null
  author?: string | null
  license?: string | null
  licenseUrl?: string | null
  attribution?: string | null
  attributionRequired?: boolean
  machineTags?: string[]
  metadataSignals?: unknown
}

const compact = (values: Array<string | null | undefined>) => values.map((value) => value?.trim()).filter(Boolean)
const limited = (value: string | null | undefined, maximum: number) => value?.trim().slice(0, maximum) || null

export const mediaSearchText = (input: {
  name?: string | null
  defaultAltText?: string | null
  originalFilename?: string | null
  author?: string | null
  license?: string | null
  machineTags?: string[]
}) =>
  compact([
    input.name,
    input.defaultAltText,
    input.originalFilename,
    input.author,
    input.license,
    ...(input.machineTags ?? []),
  ])
    .join(' ')
    .toLocaleLowerCase()
    .slice(0, 5000)

export const hashMedia = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

export const assertTenantMedia = async (clientSiteId: string, mediaId?: string | null) => {
  if (!mediaId) return null
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaId, clientSiteId, archivedAt: null, purgeAfter: null, purgedAt: null },
  })
  if (!asset) throw createError({ statusCode: 400, statusMessage: 'Selected media is unavailable' })
  return asset
}

export const storageKeyFromMediaUrl = (url: string, cdnUrl = useRuntimeConfig().public.cdnUrl) => {
  try {
    const asset = new URL(url)
    const cdn = new URL(cdnUrl)
    if (asset.protocol !== 'https:' || asset.host !== cdn.host) return null
    const key = decodeURIComponent(asset.pathname.replace(/^\/+/, ''))
    return /^(?:uploads|article-images|optimized)\/[A-Za-z0-9._/-]+$/.test(key) ? key : null
  } catch {
    return null
  }
}

export const registerMediaAsset = async (input: RegisterMediaInput) => {
  const reusable = await prisma.mediaAsset.findFirst({
    where: {
      clientSiteId: input.clientSiteId,
      purgedAt: null,
      OR: [
        ...(input.contentHash ? [{ contentHash: input.contentHash }] : []),
        { url: input.url },
        ...(input.deliveryUrl ? [{ deliveryUrl: input.deliveryUrl }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
  })
  const values = {
    deliveryUrl: input.deliveryUrl ?? input.url,
    storageKey: input.storageKey ?? storageKeyFromMediaUrl(input.url),
    name: limited(input.name, 255),
    defaultAltText: limited(input.defaultAltText, 500),
    originalFilename: limited(input.originalFilename, 255),
    mimeType: limited(input.mimeType, 100),
    sizeBytes: input.sizeBytes ?? null,
    contentHash: input.contentHash ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    origin: input.origin ?? ('UNKNOWN' as const),
    sourceUrl: limited(input.sourceUrl, 2048),
    author: limited(input.author, 255),
    license: limited(input.license, 255),
    licenseUrl: limited(input.licenseUrl, 2048),
    attribution: limited(input.attribution, 1000),
    attributionRequired: input.attributionRequired ?? false,
    machineTags: input.machineTags ?? [],
    metadataSignals: input.metadataSignals ? JSON.parse(JSON.stringify(input.metadataSignals)) : undefined,
  }
  const searchText = mediaSearchText(values)

  if (reusable) {
    const merged = {
      name: reusable.name || values.name,
      defaultAltText: reusable.defaultAltText || values.defaultAltText,
      originalFilename: reusable.originalFilename || values.originalFilename,
      author: reusable.author || values.author,
      license: reusable.license || values.license,
      machineTags: [...new Set([...reusable.machineTags, ...values.machineTags])],
    }
    return prisma.mediaAsset.update({
      where: { id: reusable.id },
      data: {
        archivedAt: null,
        purgeAfter: null,
        deliveryUrl: reusable.deliveryUrl || values.deliveryUrl,
        storageKey: reusable.storageKey || values.storageKey,
        name: merged.name,
        defaultAltText: merged.defaultAltText,
        originalFilename: merged.originalFilename,
        mimeType: reusable.mimeType || values.mimeType,
        sizeBytes: reusable.sizeBytes || values.sizeBytes,
        contentHash: reusable.contentHash || values.contentHash,
        width: reusable.width || values.width,
        height: reusable.height || values.height,
        origin: reusable.origin === 'UNKNOWN' && input.origin ? input.origin : reusable.origin,
        sourceUrl: reusable.sourceUrl || values.sourceUrl,
        author: merged.author,
        license: merged.license,
        licenseUrl: reusable.licenseUrl || values.licenseUrl,
        attribution: reusable.attribution || values.attribution,
        attributionRequired: reusable.attributionRequired || values.attributionRequired,
        machineTags: merged.machineTags,
        metadataSignals: reusable.metadataSignals || values.metadataSignals,
        searchText: mediaSearchText(merged),
      },
    })
  }

  return prisma.mediaAsset.create({
    data: {
      clientSiteId: input.clientSiteId,
      createdById: input.createdById ?? null,
      url: input.url,
      ...values,
      searchText,
    },
  })
}

export const mediaLibraryAsset = (asset: any, usageCount = 0) => ({
  id: asset.id,
  url: asset.url,
  deliveryUrl: asset.deliveryUrl,
  name: asset.name,
  defaultAltText: asset.defaultAltText,
  originalFilename: asset.originalFilename,
  mimeType: asset.mimeType,
  sizeBytes: asset.sizeBytes,
  width: asset.width,
  height: asset.height,
  origin: asset.origin,
  sourceUrl: asset.sourceUrl,
  author: asset.author,
  license: asset.license,
  licenseUrl: asset.licenseUrl,
  attribution: asset.attribution,
  attributionRequired: asset.attributionRequired,
  rightsConfirmedAt: asset.rightsConfirmedAt,
  machineTags: asset.machineTags,
  createdAt: asset.createdAt,
  archivedAt: asset.archivedAt,
  purgeAfter: asset.purgeAfter,
  usageCount,
})

export const findMediaReferences = async (
  clientSiteId: string,
  asset: { id: string; url: string; deliveryUrl?: string | null },
) => {
  const needles = [asset.id, asset.url, asset.deliveryUrl].filter(Boolean) as string[]
  const bodyOr = needles.flatMap((needle) => [
    { content: { contains: `data-media-id="${needle}"` } },
    { content: { contains: `data-media-id='${needle}'` } },
    ...(needle === asset.id ? [] : [{ content: { contains: needle } }]),
  ])
  const [usage, covers, draftCovers, articleBodies, translationBodies, draftBodies] = await Promise.all([
    prisma.articleMediaUsage.count({ where: { clientSiteId, mediaAssetId: asset.id, deletedAt: null } }),
    prisma.article.count({ where: { clientSiteId, coverMediaId: asset.id, deletedAt: null } }),
    prisma.articleDraft.count({ where: { clientSiteId, coverMediaId: asset.id, deletedAt: null } }),
    bodyOr.length ? prisma.article.count({ where: { clientSiteId, deletedAt: null, OR: bodyOr } }) : 0,
    bodyOr.length ? prisma.articleTranslation.count({ where: { clientSiteId, deletedAt: null, OR: bodyOr } }) : 0,
    bodyOr.length ? prisma.articleDraft.count({ where: { clientSiteId, deletedAt: null, OR: bodyOr } }) : 0,
  ])
  return usage + covers + draftCovers + articleBodies + translationBodies + draftBodies
}

type UsageDb = Pick<typeof prisma, 'mediaAsset' | 'articleMediaUsage'>

const rebuildArticleMediaUsages = async (
  db: UsageDb,
  input: {
    clientSiteId: string
    articleId: string
    articleTranslationId?: string | null
    language: Language
    imageUrl?: string | null
    coverMediaId?: string | null
    content?: string | null
  },
) => {
  const occurrences = extractArticleMedia(input)
  if (!occurrences.length) {
    await db.articleMediaUsage.deleteMany({ where: { articleId: input.articleId, language: input.language } })
    return
  }
  const ids = [...new Set(occurrences.flatMap((item) => (item.mediaId ? [item.mediaId] : [])))]
  const urls = [...new Set(occurrences.map((item) => item.url).filter(Boolean))]
  const assets = await db.mediaAsset.findMany({
    where: {
      clientSiteId: input.clientSiteId,
      purgedAt: null,
      OR: [
        ...(ids.length ? [{ id: { in: ids } }] : []),
        ...(urls.length ? [{ url: { in: urls } }, { deliveryUrl: { in: urls } }] : []),
      ],
    },
    select: { id: true, url: true, deliveryUrl: true },
  })
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  const byUrl = new Map(
    assets.flatMap((asset) => [asset.url, asset.deliveryUrl].filter(Boolean).map((url) => [url!, asset])),
  )
  for (const occurrence of occurrences) {
    if ((occurrence.mediaId && byId.has(occurrence.mediaId)) || byUrl.has(occurrence.url)) continue
    if (occurrence.url.length > 2048) continue
    const ownedKey = storageKeyFromMediaUrl(occurrence.url)
    const asset = await registerMediaAsset({
      clientSiteId: input.clientSiteId,
      url: occurrence.url,
      deliveryUrl: occurrence.url,
      storageKey: ownedKey,
      name: occurrence.alt,
      defaultAltText: occurrence.alt,
      originalFilename: (() => {
        try {
          return decodeURIComponent(new URL(occurrence.url).pathname.split('/').filter(Boolean).at(-1) || '') || null
        } catch {
          return null
        }
      })(),
      origin: ownedKey?.startsWith('article-images/') ? 'TOPIQU_AI' : ownedKey ? 'UNKNOWN' : 'EXTERNAL',
      sourceUrl: ownedKey ? null : occurrence.url,
    })
    assets.push(asset)
    byId.set(asset.id, asset)
    byUrl.set(asset.url, asset)
    if (asset.deliveryUrl) byUrl.set(asset.deliveryUrl, asset)
  }
  const grouped = new Map<string, { mediaAssetId: string; placement: MediaUsagePlacement; occurrenceCount: number }>()
  for (const occurrence of occurrences) {
    const asset = (occurrence.mediaId && byId.get(occurrence.mediaId)) || byUrl.get(occurrence.url)
    if (!asset) continue
    const placement = (occurrence.placement === 'cover' ? 'COVER' : 'BODY') as MediaUsagePlacement
    const key = `${asset.id}:${placement}`
    const current = grouped.get(key)
    grouped.set(key, { mediaAssetId: asset.id, placement, occurrenceCount: (current?.occurrenceCount ?? 0) + 1 })
  }

  await db.articleMediaUsage.deleteMany({ where: { articleId: input.articleId, language: input.language } })
  if (grouped.size)
    await db.articleMediaUsage.createMany({
      data: [...grouped.values()].map((usage) => ({
        id: randomUUID(),
        clientSiteId: input.clientSiteId,
        articleId: input.articleId,
        articleTranslationId: input.articleTranslationId ?? null,
        language: input.language,
        ...usage,
      })),
    })
}

/**
 * Usage rows are a rebuildable read index, never the source of truth. A parser or
 * indexing failure must not turn an already persisted article save into a false
 * failure response; the backfill can safely reconstruct the index later.
 */
export const syncArticleMediaUsages = async (db: UsageDb, input: Parameters<typeof rebuildArticleMediaUsages>[1]) => {
  try {
    await rebuildArticleMediaUsages(db, input)
  } catch (error) {
    await reportCaughtError('Media usage indexing failed', error, {
      articleId: input.articleId,
      clientSiteId: input.clientSiteId,
      language: input.language,
    })
  }
}

import { randomUUID } from 'node:crypto'

import { createDatabaseClient } from '../server/utils/database'
import { extractArticleMedia } from '../shared/utils/mediaRights'

const APPLY = process.env.APPLY === '1'
const prisma = createDatabaseClient()
const cdnUrl = process.env.CDN_URL || 'https://cdn.topiqu.com'
const limited = (value: string | null | undefined, maximum: number) => value?.trim().slice(0, maximum) || null

const filename = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || '') || null
  } catch {
    return null
  }
}

const storageKey = (url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.host !== new URL(cdnUrl).host) return null
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    return /^(?:uploads|article-images|optimized)\/[A-Za-z0-9._/-]+$/.test(key) ? key : null
  } catch {
    return null
  }
}

const inferredOrigin = (url: string) => {
  const key = storageKey(url)
  if (key?.startsWith('article-images/')) return 'TOPIQU_AI' as const
  if (!key) return 'EXTERNAL' as const
  return 'UNKNOWN' as const
}

const main = async () => {
  const sites = await prisma.clientSite.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      language: true,
      articles: {
        where: { deletedAt: null },
        select: {
          id: true,
          imageUrl: true,
          coverMediaId: true,
          content: true,
          translations: {
            where: { deletedAt: null },
            select: { id: true, language: true, content: true },
          },
        },
      },
      articleDrafts: {
        where: { deletedAt: null },
        select: { imageUrl: true, coverMediaId: true, content: true },
      },
    },
  })

  let created = 0
  let usages = 0
  let skipped = 0
  for (const site of sites) {
    const assets = await prisma.mediaAsset.findMany({ where: { clientSiteId: site.id, purgedAt: null } })
    const byId = new Map(assets.map((asset) => [asset.id, asset]))
    const byUrl = new Map(
      assets.flatMap((asset) => [asset.url, asset.deliveryUrl].filter(Boolean).map((url) => [url!, asset])),
    )

    for (const asset of assets) {
      const assetFilename = limited(asset.originalFilename || filename(asset.url), 255)
      const assetName = limited(asset.name || assetFilename?.replace(/\.[^/.]+$/, ''), 255)
      const searchText = [assetName, assetFilename, asset.defaultAltText, ...asset.machineTags]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
      const enrichment = {
        deliveryUrl: asset.deliveryUrl || asset.url,
        storageKey: asset.storageKey || storageKey(asset.url),
        originalFilename: assetFilename,
        name: assetName,
        searchText,
      }
      Object.assign(asset, enrichment)
      if (APPLY && (!asset.searchText || !asset.deliveryUrl || !asset.originalFilename))
        await prisma.mediaAsset.update({ where: { id: asset.id }, data: enrichment })
    }

    const ensure = async (occurrence: { mediaId?: string; url: string; alt?: string }) => {
      const known = (occurrence.mediaId && byId.get(occurrence.mediaId)) || byUrl.get(occurrence.url)
      if (known) return known
      if (occurrence.url.length > 2048) {
        skipped++
        return null
      }
      const name = limited(filename(occurrence.url), 255)
      const alt = limited(occurrence.alt, 500)
      const asset = {
        id: randomUUID(),
        clientSiteId: site.id,
        url: occurrence.url,
        deliveryUrl: occurrence.url,
        storageKey: storageKey(occurrence.url),
        name: limited(alt || name?.replace(/\.[^/.]+$/, ''), 255),
        defaultAltText: alt,
        originalFilename: name,
        origin: inferredOrigin(occurrence.url),
        searchText: [alt, name].filter(Boolean).join(' ').toLocaleLowerCase().slice(0, 5000),
      }
      if (APPLY) await prisma.mediaAsset.create({ data: asset })
      byId.set(asset.id, asset as any)
      byUrl.set(asset.url, asset as any)
      created++
      return asset as any
    }

    const indexArticle = async (
      articleId: string,
      language: 'cs' | 'en',
      input: { imageUrl?: string | null; coverMediaId?: string | null; content?: string | null },
      articleTranslationId?: string,
    ) => {
      const grouped = new Map<string, { assetId: string; placement: 'COVER' | 'BODY'; count: number }>()
      for (const occurrence of extractArticleMedia(input)) {
        const asset = await ensure(occurrence)
        if (!asset) continue
        const placement = occurrence.placement === 'cover' ? 'COVER' : 'BODY'
        const key = `${asset.id}:${placement}`
        const current = grouped.get(key)
        grouped.set(key, { assetId: asset.id, placement, count: (current?.count ?? 0) + 1 })
      }
      if (!APPLY) {
        usages += grouped.size
        return
      }
      await prisma.articleMediaUsage.deleteMany({ where: { articleId, language } })
      if (grouped.size)
        await prisma.articleMediaUsage.createMany({
          data: [...grouped.values()].map((row) => ({
            id: randomUUID(),
            clientSiteId: site.id,
            mediaAssetId: row.assetId,
            articleId,
            articleTranslationId: articleTranslationId ?? null,
            language,
            placement: row.placement,
            occurrenceCount: row.count,
          })),
        })
      usages += grouped.size
    }

    for (const article of site.articles) {
      await indexArticle(article.id, site.language, article)
      for (const translation of article.translations)
        await indexArticle(article.id, translation.language, { content: translation.content }, translation.id)
    }
    for (const draft of site.articleDrafts)
      for (const occurrence of extractArticleMedia(draft)) await ensure(occurrence)
  }

  console.log(
    `${APPLY ? 'Backfilled' : 'Would backfill'} ${created} assets and ${usages} article usage rows; skipped ${skipped} oversized inline media URLs.`,
  )
  if (!APPLY) console.log('Dry run. Re-run with APPLY=1 to write.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

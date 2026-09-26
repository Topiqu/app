import type {
  ArticleMediaInput,
  MediaAssetRecord,
  MediaRightsReport,
  MediaRightsReview,
} from '~~/shared/types/mediaRights'

import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'
import { buildMediaRightsItems, extractArticleMedia, mediaRightsCounts } from '~~/shared/utils/mediaRights'

import { escapeHtml } from './sanitize'

export const mediaRightsFingerprint = (input: ArticleMediaInput) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        extractArticleMedia(input).map(({ placement, url, mediaId }) => ({ placement, url, mediaId: mediaId ?? null })),
      ),
    )
    .digest('hex')

export const evaluateMediaRights = async (
  db: typeof prisma,
  clientSiteId: string,
  input: ArticleMediaInput,
): Promise<MediaRightsReport> => {
  const ids = [...new Set(extractArticleMedia(input).flatMap((item) => (item.mediaId ? [item.mediaId] : [])))]
  const urls = [
    ...new Set(
      extractArticleMedia(input)
        .map((item) => item.url)
        .filter(Boolean),
    ),
  ]
  const assets =
    ids.length || urls.length
      ? await db.mediaAsset.findMany({
          where: {
            clientSiteId,
            deletedAt: null,
            OR: [
              ...(ids.length ? [{ id: { in: ids } }] : []),
              ...(urls.length ? [{ url: { in: urls } }, { deliveryUrl: { in: urls } }] : []),
            ],
          },
          select: {
            id: true,
            url: true,
            deliveryUrl: true,
            name: true,
            defaultAltText: true,
            origin: true,
            sourceUrl: true,
            author: true,
            license: true,
            licenseUrl: true,
            attribution: true,
            attributionRequired: true,
            rightsConfirmedAt: true,
            rightsConfirmedById: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            width: true,
            height: true,
            contentHash: true,
            metadataSignals: true,
            machineTags: true,
            createdAt: true,
            archivedAt: true,
          },
        })
      : []
  const items = buildMediaRightsItems(input, assets as MediaAssetRecord[])
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify(
        items.map((item) => ({
          placement: item.placement,
          url: item.url,
          mediaId: item.mediaId ?? null,
          origin: item.asset?.origin ?? 'UNKNOWN',
          sourceUrl: item.asset?.sourceUrl ?? null,
          author: item.asset?.author ?? null,
          license: item.asset?.license ?? null,
          attribution: item.asset?.attribution ?? null,
          confirmedAt: item.asset?.rightsConfirmedAt ?? null,
        })),
      ),
    )
    .digest('hex')
  return { fingerprint, items, counts: mediaRightsCounts(items) }
}

export const mediaRightsSnapshotItems = (report: MediaRightsReport) =>
  report.items.map((item) => ({
    placement: item.placement,
    url: item.url,
    mediaId: item.mediaId ?? null,
    origin: item.asset?.origin ?? 'UNKNOWN',
    sourceUrl: item.asset?.sourceUrl ?? null,
    author: item.asset?.author ?? null,
    license: item.asset?.license ?? null,
    attribution: item.asset?.attribution ?? null,
    rightsConfirmedAt: item.asset?.rightsConfirmedAt ?? null,
    issues: item.issues.map((issue) => issue.code),
  }))

export const requireMediaRightsReview = async (
  db: typeof prisma,
  clientSiteId: string,
  input: ArticleMediaInput,
  review?: MediaRightsReview | null,
) => {
  const report = await evaluateMediaRights(db, clientSiteId, input)
  if (report.counts.needsAttention && (!review?.acknowledged || review.fingerprint !== report.fingerprint)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Media rights review required',
      data: { code: 'MEDIA_RIGHTS_REVIEW_REQUIRED', report },
    })
  }
  return report
}

export const createMediaRightsSnapshot = async (
  db: typeof prisma,
  input: {
    articleId: string
    clientSiteId: string
    language: 'cs' | 'en'
    report: MediaRightsReport
    confirmedById?: string | null
    legacySchedule?: boolean
  },
) =>
  db.mediaRightsPublicationSnapshot.create({
    data: {
      articleId: input.articleId,
      clientSiteId: input.clientSiteId,
      language: input.language,
      fingerprint: input.report.fingerprint,
      items: JSON.parse(JSON.stringify(mediaRightsSnapshotItems(input.report))),
      issueCount: input.report.counts.needsAttention,
      overrideConfirmed: input.report.counts.needsAttention > 0,
      legacySchedule: input.legacySchedule ?? false,
      confirmedById: input.confirmedById ?? null,
    },
  })

export const coverCreditFromMedia = async (clientSiteId: string, mediaId?: string | null) => {
  if (!mediaId) return undefined
  const asset = await prisma.mediaAsset.findFirst({ where: { id: mediaId, clientSiteId, deletedAt: null } })
  if (!asset) return undefined
  const kind = asset.origin === 'TOPIQU_AI' || asset.origin === 'EXTERNAL_AI' ? 'ai' : 'photo'
  const source =
    asset.sourceUrl || asset.author || asset.license ? asset.license || asset.author || 'External source' : null
  return {
    kind,
    ...(source
      ? {
          credit: {
            source,
            sourceUrl: asset.sourceUrl ?? undefined,
            author: asset.author ?? undefined,
            license: asset.license ?? undefined,
            licenseUrl: asset.licenseUrl ?? undefined,
          },
        }
      : {}),
  }
}

export const applyMediaAttributions = async (clientSiteId: string, content: string) => {
  const occurrences = extractArticleMedia({ content }).filter((item) => item.mediaId)
  if (!occurrences.length) return content
  const ids = [...new Set(occurrences.map((item) => item.mediaId!))]
  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: ids }, clientSiteId, deletedAt: null },
    select: { id: true, attribution: true },
  })
  const attributionById = new Map(assets.flatMap((asset) => (asset.attribution ? [[asset.id, asset.attribution]] : [])))
  if (!attributionById.size) return content

  const $ = cheerio.load(content, null, false)
  $('img[data-media-id]').each((_, element) => {
    const mediaId = $(element).attr('data-media-id')
    const attribution = mediaId ? attributionById.get(mediaId) : null
    if (!attribution) return
    const parent = $(element).parent()
    if (parent.find('small[data-media-attribution]').length || parent.find('small').length) return
    $(element).after(`<br><small data-media-attribution style="color: gray;">${escapeHtml(attribution)}</small>`)
  })
  return $.html()
}

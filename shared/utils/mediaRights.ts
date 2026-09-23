import type {
  ArticleMediaInput,
  ArticleMediaOccurrence,
  MediaAssetRecord,
  MediaRightsIssue,
  MediaRightsItem,
} from '../types/mediaRights'

const attr = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))
  return match?.[1] ?? match?.[2] ?? ''
}

export const extractArticleMedia = (article: ArticleMediaInput): ArticleMediaOccurrence[] => {
  const items: ArticleMediaOccurrence[] = []
  if (article.imageUrl?.trim()) {
    items.push({
      key: 'cover',
      placement: 'cover',
      url: article.imageUrl.trim(),
      mediaId: article.coverMediaId?.trim() || undefined,
    })
  }

  let blockIndex = -1
  const blocks =
    article.content?.match(
      /<(?:p|h[1-6]|blockquote|ul|ol|table|figure)\b[\s\S]*?<\/(?:p|h[1-6]|blockquote|ul|ol|table|figure)>|<img\b[^>]*>/gi,
    ) ?? []
  for (const block of blocks) {
    blockIndex++
    const tags = block.match(/<img\b[^>]*>/gi) ?? []
    tags.forEach((tag, imageIndex) => {
      const url = attr(tag, 'src').trim()
      if (!url) return
      items.push({
        key: `body:${blockIndex}:${imageIndex}:${url}`,
        placement: 'body',
        url,
        mediaId: attr(tag, 'data-media-id').trim() || undefined,
        blockIndex,
      })
    })
  }
  return items
}

const present = (value?: string | null) => Boolean(value?.trim())
const isHotlinked = (url: string) =>
  /^https?:\/\//i.test(url) && !/\/uploads\/|\/optimized\/|\/article-images\//i.test(url)
const isSafeMediaUrl = (url: string) => {
  if (url.startsWith('/')) return true
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

export const mediaRightsIssues = (occurrence: ArticleMediaOccurrence, asset: MediaAssetRecord | null) => {
  const issues: MediaRightsIssue[] = []
  if (!asset || asset.origin === 'UNKNOWN') issues.push({ code: 'missing-origin', severity: 'warning' })

  if (asset) {
    const confirmed = Boolean(asset.rightsConfirmedAt)
    if (asset.origin === 'OWN' && !confirmed) issues.push({ code: 'permission-unconfirmed', severity: 'warning' })
    if (['EXTERNAL_AI', 'LICENSED_STOCK', 'EXTERNAL', 'OTHER'].includes(asset.origin) && !confirmed)
      issues.push({ code: 'permission-unconfirmed', severity: 'warning' })
    if (
      ['LICENSED_STOCK', 'CREATIVE_COMMONS', 'PUBLIC_DOMAIN', 'EXTERNAL'].includes(asset.origin) &&
      !present(asset.sourceUrl)
    )
      issues.push({ code: 'missing-source', severity: 'warning' })
    if (['LICENSED_STOCK', 'CREATIVE_COMMONS'].includes(asset.origin) && !present(asset.license))
      issues.push({ code: 'missing-license', severity: 'warning' })
    if (asset.origin === 'CREATIVE_COMMONS' && !present(asset.author))
      issues.push({ code: 'missing-author', severity: 'warning' })
    if (asset.attributionRequired && !present(asset.attribution))
      issues.push({ code: 'missing-attribution', severity: 'warning' })

    const metadata = asset.metadataSignals as { copyright?: string } | null
    if (metadata?.copyright && asset.origin === 'OWN') issues.push({ code: 'copyright-metadata', severity: 'info' })
  }

  if (!isSafeMediaUrl(occurrence.url)) issues.push({ code: 'unsafe-url', severity: 'warning' })
  if (isHotlinked(occurrence.url)) issues.push({ code: 'hotlinked', severity: 'info' })
  return issues
}

export const buildMediaRightsItems = (article: ArticleMediaInput, assets: MediaAssetRecord[]): MediaRightsItem[] => {
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  const items: MediaRightsItem[] = extractArticleMedia(article).map((occurrence) => {
    const asset = occurrence.mediaId ? (byId.get(occurrence.mediaId) ?? null) : null
    const issues = mediaRightsIssues(occurrence, asset)
    return {
      ...occurrence,
      asset,
      issues,
      state: issues.some((issue) => issue.severity === 'warning') ? 'needs-attention' : 'recorded',
    }
  })

  const occurrences = new Map<string, number>()
  for (const item of items) {
    const identity = item.asset?.contentHash || item.mediaId || item.url
    occurrences.set(identity, (occurrences.get(identity) ?? 0) + 1)
  }
  for (const item of items) {
    const identity = item.asset?.contentHash || item.mediaId || item.url
    if ((occurrences.get(identity) ?? 0) > 1) item.issues.push({ code: 'duplicate-media', severity: 'info' })
  }

  return items
}

export const mediaRightsCounts = (items: MediaRightsItem[]) => ({
  total: items.length,
  recorded: items.filter((item) => item.state === 'recorded').length,
  needsAttention: items.filter((item) => item.state === 'needs-attention').length,
})

export const setImageMediaId = (html: string, url: string, mediaId: string) => {
  let applied = false
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (applied || attr(tag, 'src') !== url) return tag
    applied = true
    if (/\sdata-media-id=/i.test(tag))
      return tag.replace(/\sdata-media-id=(?:"[^"]*"|'[^']*')/i, ` data-media-id="${mediaId}"`)
    return tag.replace(/\s*\/?>$/, (end) => ` data-media-id="${mediaId}"${end}`)
  })
}

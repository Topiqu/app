import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'
import { youtubeVideoId } from '~~/shared/utils/youtube'

import type { StockImage } from './types'

import { putToCdn } from '../storage'
import { fetchPublicUrl, readLimitedBody } from './publicFetch'
import { optimizeGeneratedImage, IMMUTABLE_IMAGE_CACHE_CONTROL } from './optimize'

const terms = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\biv\b/g, '4')
    .match(/[a-z0-9]+/g) ?? []

const ignored = new Set(['the', 'official', 'screenshot', 'image', 'photo', 'gameplay', 'game', 'new'])
const rasterType = /^(?:image\/jpeg|image\/png|image\/webp|image\/avif)$/i

const imageUrl = (raw: string | undefined, source: string) => {
  if (!raw) return null
  try {
    const url = new URL(raw, source)
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null
    if (/\b(?:logo|icon|avatar|favicon|sprite|tracking|pixel)\b/i.test(url.pathname)) return null
    return url.href
  } catch {
    return null
  }
}

const linkedHttpsUrl = (raw: string | undefined, source: string) => {
  if (!raw) return null
  try {
    const url = new URL(raw, source)
    return url.protocol === 'https:' && !url.port && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const relatedHost = (asset: string, page: URL) => {
  const host = new URL(asset).hostname
  if (host === page.hostname || host.endsWith(`.${page.hostname}`) || page.hostname.endsWith(`.${host}`)) return true
  const pageParts = page.hostname.split('.')
  const assetParts = host.split('.')
  return pageParts.slice(-2).join('.') === assetParts.slice(-2).join('.')
}

const jsonLdImages = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(jsonLdImages)
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const own = ['image', 'contentUrl', 'thumbnailUrl'].flatMap((key) => {
    const item = record[key]
    if (typeof item === 'string') return [item]
    const url = item && typeof item === 'object' ? (item as Record<string, unknown>).url : null
    if (typeof url === 'string') return [url]
    return []
  })
  return [...own, ...Object.values(record).flatMap(jsonLdImages)]
}

/** Parse only assets explicitly embedded by a provider-verified official page. Asset hosts may be
 * separate CDNs; trust comes from the first-party page reference, not a global publisher list. */
export const parsePressImages = (html: string, source: string): StockImage[] => {
  const page = new URL(source)
  const $ = cheerio.load(html)
  const title = $('meta[property="og:title"]').attr('content')?.trim() || $('h1').first().text().trim()
  const site = $('meta[property="og:site_name"]').attr('content')?.trim() || page.hostname.replace(/^www\./, '')
  const licenseLink = $('a[rel~="license"], link[rel~="license"]').first()
  const licenseUrl = linkedHttpsUrl(licenseLink.attr('href'), source) ?? undefined
  const license = licenseLink.text().replace(/\s+/g, ' ').trim() || undefined
  const candidates: Array<{ raw?: string; alt?: string; priority: number; publisherDeclared?: boolean }> = [
    {
      raw: $('meta[property="og:image"]').attr('content'),
      alt: $('meta[property="og:image:alt"]').attr('content'),
      priority: 3,
      publisherDeclared: true,
    },
    {
      raw: $('meta[name="twitter:image"]').attr('content'),
      alt: $('meta[name="twitter:image:alt"]').attr('content'),
      priority: 2,
      publisherDeclared: true,
    },
    { raw: $('link[rel="image_src"]').attr('href'), alt: title, priority: 2, publisherDeclared: true },
    {
      raw: $('link[rel="preload"][as="image"]').attr('href'),
      alt: title,
      priority: 2,
      publisherDeclared: true,
    },
  ]
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      jsonLdImages(JSON.parse($(element).text())).forEach((raw) =>
        candidates.push({ raw, alt: title, priority: 2, publisherDeclared: true }),
      )
    } catch {
      // Invalid analytics JSON-LD does not invalidate the page's normal image metadata.
    }
  })
  $('img').each((_, element) => {
    const node = $(element)
    const srcset = node.attr('srcset')?.split(',').at(-1)?.trim().split(/\s+/)[0]
    const publisherDeclared =
      !!node.attr('data-download') ||
      /press|media|download|gallery|screenshot|key.?art|hero/i.test(
        `${node.attr('class') ?? ''} ${node.attr('id') ?? ''}`,
      )
    candidates.push({
      raw: node.attr('data-download') || node.attr('data-src') || srcset || node.attr('src'),
      alt: node.attr('alt')?.trim() || title,
      priority: publisherDeclared ? 2 : 1,
      publisherDeclared,
    })
  })
  $('a[download], a[href]').each((_, element) => {
    const node = $(element)
    const raw = node.attr('href')
    if (
      !raw ||
      (!node.is('[download]') && !/\.(?:jpe?g|png|webp|avif)(?:\?|#|$)/i.test(raw)) ||
      !/press|media|download|gallery|screenshot|key.?art|asset/i.test(
        `${node.attr('class') ?? ''} ${node.attr('id') ?? ''} ${node.text()} ${raw}`,
      )
    )
      return
    candidates.push({
      raw,
      alt: node.attr('title')?.trim() || node.text().trim() || title,
      priority: 2,
      publisherDeclared: true,
    })
  })

  const seen = new Set<string>()
  return candidates
    .sort((a, b) => b.priority - a.priority)
    .flatMap(({ raw, alt, publisherDeclared }) => {
      const url = imageUrl(raw, source)
      if (!url || seen.has(url) || (!publisherDeclared && !relatedHost(url, page))) return []
      seen.add(url)
      return [
        {
          url,
          alt: [title, alt].filter(Boolean).join(' — ') || undefined,
          credit: {
            author: site,
            authorUrl: source,
            source: 'Official media',
            sourceUrl: url,
            license,
            licenseUrl,
          },
        },
      ]
    })
    .slice(0, 12)
}

export const youtubeThumbnailImage = (url: string, caption?: string): StockImage | null => {
  const id = youtubeVideoId(url)
  return id
    ? {
        url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        alt: caption,
        credit: { source: 'YouTube — official video thumbnail', sourceUrl: url },
      }
    : null
}

export const loadPressImages = async (sources: string[]) =>
  (
    await Promise.all(
      [...new Set(sources)].slice(0, 4).map(async (source) => {
        try {
          const response = await fetchPublicUrl(source)
          if (!response.ok || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) return []
          const body = await readLimitedBody(response, 2_000_000)
          return parsePressImages(new TextDecoder().decode(body), source)
        } catch (error) {
          console.error('[images/official] page failed:', source, error)
          return []
        }
      }),
    )
  ).flat()

const rankPressImages = (images: StockImage[], query: string) => {
  const requested = terms(query).filter((word) => !ignored.has(word))
  return images
    .map((image) => {
      const actual = new Set(
        terms(
          `${image.alt ?? ''} ${image.credit.author ?? ''} ${image.credit.authorUrl ?? ''} ${image.credit.sourceUrl ?? ''}`,
        ),
      )
      const score = requested.filter((word) => actual.has(word)).length
      const numbersMatch = requested.filter((word) => /^\d+$/.test(word)).every((word) => actual.has(word))
      return { image, score: numbersMatch ? score : 0 }
    })
    .filter(({ score }) => requested.length === 0 || score >= 1)
    .sort((a, b) => b.score - a.score)
    .map(({ image }) => image)
}

export const pickPressImage = (images: StockImage[], query: string, accept: (image: StockImage) => boolean) =>
  rankPressImages(images, query).find(accept) ?? null

const cacheOfficialImage = async (image: StockImage): Promise<StockImage | null> => {
  try {
    let response = await fetchPublicUrl(image.url, 12_000)
    if (!response.ok && new URL(image.url).hostname === 'i.ytimg.com' && /\/maxresdefault\.jpg$/.test(image.url))
      response = await fetchPublicUrl(image.url.replace('/maxresdefault.jpg', '/sddefault.jpg'), 12_000)
    if (!response.ok || !rasterType.test(response.headers.get('content-type') ?? '')) return null
    const input = await readLimitedBody(response, 15_000_000)
    const optimized = await optimizeGeneratedImage(input)
    if (optimized.width < 640 || optimized.height < 320 || optimized.width / optimized.height < 1.15) return null
    const hash = createHash('sha256').update(image.url).digest('hex').slice(0, 20)
    const url = await putToCdn(
      `article-images/official-${hash}.${optimized.extension}`,
      optimized.data,
      optimized.contentType,
      undefined,
      { cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL },
    )
    return { ...image, url, width: optimized.width, height: optimized.height }
  } catch (error) {
    console.error('[images/official] asset failed:', image.url, error)
    return null
  }
}

/** Validate and cache only ranked candidates, avoiding a download storm for every image on a page. */
export const findPressImage = async (
  images: StockImage[],
  query: string,
  accept: (image: StockImage) => boolean,
  cache = new Map<string, Promise<StockImage | null>>(),
) => {
  for (const candidate of rankPressImages(images, query).slice(0, 8)) {
    let pending = cache.get(candidate.url)
    if (!pending) {
      pending = cacheOfficialImage(candidate)
      cache.set(candidate.url, pending)
    }
    const image = await pending
    if (image && accept(image)) return image
  }
  return null
}

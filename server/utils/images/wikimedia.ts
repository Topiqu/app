import * as cheerio from 'cheerio'

import type { ImageProvider, StockImage } from './types'

import { matchesImageQuery } from './selection'
import { fetchJson, imageApiHeaders } from './http'

const SEARCH_URL = 'https://commons.wikimedia.org/w/api.php'

/** Commons also serves SVG, TIFF, PDF and video from the same namespace; none of those belong in a body. */
const RASTER = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface CommonsPage {
  index?: number
  title?: string
  imageinfo?: Array<{
    url?: string
    thumburl?: string
    descriptionurl?: string
    mime?: string
    width?: number
    height?: number
    extmetadata?: Record<string, { value?: unknown }>
  }>
}

/** Commons returns credit fields as HTML fragments (`Artist` is routinely a full `<a>`). */
const metaText = (page: CommonsPage, key: string) => {
  const raw = page.imageinfo?.[0]?.extmetadata?.[key]?.value

  if (raw === undefined || raw === null) return undefined

  return cheerio.load(String(raw))('body').text().replace(/\s+/g, ' ').trim() || undefined
}

/** Uploaders put requests and gallery notes into `Artist`; the user link is the name, and prose is no credit. */
const artistName = (page: CommonsPage) => {
  const raw = page.imageinfo?.[0]?.extmetadata?.Artist?.value
  if (raw === undefined || raw === null) return undefined
  const $ = cheerio.load(String(raw))
  const name = ($('a[href*="User:"]').first().text() || $('body').text()).replace(/\s+/g, ' ').trim()
  return name && name.length <= 80 ? name : undefined
}

export const wikimediaImage = (page: CommonsPage): StockImage | null => {
  const info = page.imageinfo?.[0]

  if (!info?.url || !RASTER.has(info.mime ?? '')) return null

  const licenseUrl = info.extmetadata?.LicenseUrl?.value

  return {
    // `thumburl` is the width-capped render; the original is regularly a 20 MB scan.
    url: info.thumburl || info.url,
    alt: metaText(page, 'ImageDescription') || page.title?.replace(/^File:/, '').replace(/\.\w+$/, ''),
    credit: {
      author: artistName(page),
      license: metaText(page, 'LicenseShortName'),
      licenseUrl: typeof licenseUrl === 'string' ? licenseUrl : undefined,
      source: 'Wikimedia Commons',
      sourceUrl: info.descriptionurl,
    },
  }
}

/**
 * Landscape first — the body renders one image per full-width paragraph. Ranks on the raw fields
 * so credit HTML is parsed only for the candidates actually tried.
 */
const rankWikimediaPages = (pages: CommonsPage[], query?: string): CommonsPage[] => {
  pages = query
    ? pages.filter((page) =>
        matchesImageQuery([page.title, metaText(page, 'ImageDescription')].filter(Boolean).join(' '), query),
      )
    : pages
  const usable = [...pages]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((page) => !!page.imageinfo?.[0]?.url && RASTER.has(page.imageinfo[0]?.mime ?? ''))
  const landscape = (page: CommonsPage) => {
    const info = page.imageinfo?.[0]
    return !!info?.width && !!info.height && info.width > info.height
  }

  return [...usable.filter(landscape), ...usable.filter((page) => !landscape(page))]
}

/** `accept` lets a caller skip candidates it cannot use, e.g. ones whose licence needs a person to confirm. */
export const pickWikimediaImage = (
  pages: CommonsPage[],
  query?: string,
  accept?: (image: StockImage) => boolean,
): StockImage | null => {
  for (const page of rankWikimediaPages(pages, query)) {
    const image = wikimediaImage(page)
    if (image && (!accept || accept(image))) return image
  }

  return null
}

export const wikimedia: ImageProvider = {
  name: 'wikimedia',
  search: async (query, accept) => {
    try {
      const url = new URL(SEARCH_URL)
      url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        generator: 'search',
        gsrsearch: `filetype:bitmap ${query}`,
        gsrnamespace: '6',
        gsrlimit: '20',
        prop: 'imageinfo',
        iiprop: 'url|mime|size|extmetadata',
        iiurlwidth: '1200',
      }).toString()

      const data = await fetchJson(url, { headers: imageApiHeaders() })

      return pickWikimediaImage(data?.query?.pages ?? [], query, accept)
    } catch (error) {
      console.error('[images/wikimedia] search failed:', error)

      return null
    }
  },
}

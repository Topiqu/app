import * as cheerio from 'cheerio'

import type { ImageProvider, StockImage } from './types'

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

export const wikimediaImage = (page: CommonsPage): StockImage | null => {
  const info = page.imageinfo?.[0]

  if (!info?.url || !RASTER.has(info.mime ?? '')) return null

  const licenseUrl = info.extmetadata?.LicenseUrl?.value

  return {
    // `thumburl` is the width-capped render; the original is regularly a 20 MB scan.
    url: info.thumburl || info.url,
    alt: metaText(page, 'ImageDescription') || page.title?.replace(/^File:/, '').replace(/\.\w+$/, ''),
    credit: {
      author: metaText(page, 'Artist'),
      license: metaText(page, 'LicenseShortName'),
      licenseUrl: typeof licenseUrl === 'string' ? licenseUrl : undefined,
      source: 'Wikimedia Commons',
      sourceUrl: info.descriptionurl,
    },
  }
}

/**
 * Landscape first — the body renders one image per full-width paragraph. Picks on the raw fields
 * so only the winner's credit HTML is ever parsed, rather than all eight candidates'.
 */
export const pickWikimediaPage = (pages: CommonsPage[]): CommonsPage | null => {
  const usable = [...pages]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((page) => !!page.imageinfo?.[0]?.url && RASTER.has(page.imageinfo[0]?.mime ?? ''))

  const landscape = usable.find((page) => {
    const info = page.imageinfo?.[0]
    return !!info?.width && !!info.height && info.width > info.height
  })

  return landscape ?? usable[0] ?? null
}

export const pickWikimediaImage = (pages: CommonsPage[]): StockImage | null => {
  const page = pickWikimediaPage(pages)

  return page ? wikimediaImage(page) : null
}

export const wikimedia: ImageProvider = {
  name: 'wikimedia',
  search: async (query) => {
    try {
      const url = new URL(SEARCH_URL)
      url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        generator: 'search',
        gsrsearch: `filetype:bitmap ${query}`,
        gsrnamespace: '6',
        gsrlimit: '8',
        prop: 'imageinfo',
        iiprop: 'url|mime|size|extmetadata',
        iiurlwidth: '1200',
      }).toString()

      const data = await fetchJson(url, { headers: imageApiHeaders() })

      return pickWikimediaImage(data?.query?.pages ?? [])
    } catch (error) {
      console.error('[images/wikimedia] search failed:', error)

      return null
    }
  },
}

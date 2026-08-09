import type { ImageProvider, StockImage } from './types'

import { fetchJson, imageApiHeaders } from './http'

const SEARCH_URL = 'https://api.openverse.org/v1/images/'

const LICENSE_NAMES: Record<string, string> = { cc0: 'CC0', pdm: 'Public Domain Mark' }

const licenseName = (license?: string, version?: string) => {
  if (!license) return undefined

  const base = LICENSE_NAMES[license.toLowerCase()] ?? `CC ${license.toUpperCase()}`

  return version && version !== 'N/A' ? `${base} ${version}` : base
}

interface OpenverseResult {
  url?: string
  title?: string
  creator?: string
  creator_url?: string
  license?: string
  license_version?: string
  license_url?: string
  foreign_landing_url?: string
  source?: string
  width?: number
  height?: number
}

export const openverseImage = (result: OpenverseResult): StockImage | null => {
  if (!result.url) return null

  return {
    url: result.url,
    alt: result.title,
    credit: {
      author: result.creator,
      authorUrl: result.creator_url,
      license: licenseName(result.license, result.license_version),
      licenseUrl: result.license_url,
      source: 'Openverse',
      sourceUrl: result.foreign_landing_url,
    },
  }
}

export const pickOpenverseImage = (results: OpenverseResult[]): StockImage | null => {
  const landscape = results.find((result) => !!result.width && !!result.height && result.width > result.height)

  return openverseImage(landscape ?? results[0] ?? {})
}

export const openverse: ImageProvider = {
  name: 'openverse',
  search: async (query) => {
    try {
      const url = new URL(SEARCH_URL)
      url.search = new URLSearchParams({
        q: query,
        // A commercial blog cannot use NC-licensed work, and the platform is multi-tenant.
        license_type: 'commercial',
        mature: 'false',
        page_size: '8',
      }).toString()

      // Anonymous access is heavily rate-limited; registering a client raises the ceiling.
      const data = await fetchJson(url, { headers: imageApiHeaders() })

      return pickOpenverseImage(data?.results ?? [])
    } catch (error) {
      console.error('[images/openverse] search failed:', error)

      return null
    }
  },
}

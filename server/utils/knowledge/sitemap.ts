import { KnowledgeExtractError } from './extract'
import { fetchPublicUrl, readLimitedBody } from '../images/publicFetch'

const MAX_SITEMAP_BYTES = 5 * 1024 * 1024
const MAX_CHILD_SITEMAPS = 5
// Bounds the `sourceUrl IN (…)` duplicate check; a larger site is imported one sitemap at a time.
const MAX_LOCATIONS = 1_000

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export const sitemapLocations = (xml: string) =>
  [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((match) =>
    match[1]!.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => XML_ENTITIES[name]!),
  )

const siteHost = (url: URL) => url.hostname.replace(/^www\./, '')

/**
 * Only https pages of the sitemap's own site: a sitemap listing other hosts would otherwise turn
 * the import into a fetcher for any domain. Every page is still SSRF-checked when it is added.
 */
export const sameSitePages = (locations: readonly string[], site: URL) => {
  const pages = new Set<string>()
  for (const location of locations) {
    const url = URL.parse(location)
    if (!url || url.protocol !== 'https:' || siteHost(url) !== siteHost(site)) continue
    url.hash = ''
    pages.add(url.toString())
    if (pages.size >= MAX_LOCATIONS) break
  }
  return [...pages]
}

const readSitemap = async (url: string) => {
  const response = await fetchPublicUrl(url, 10_000).catch(() => {
    throw new KnowledgeExtractError('unreachable')
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new KnowledgeExtractError('unreachable')
  }
  const bytes = await readLimitedBody(response, MAX_SITEMAP_BYTES).catch(() => {
    throw new KnowledgeExtractError('tooLarge')
  })
  return new TextDecoder().decode(bytes)
}

/** A site address falls back to `/sitemap.xml`; a sitemap index is followed one level deep. */
export const discoverSitemapPages = async (input: string) => {
  const site = new URL(input)
  const sitemap = /\.xml$/i.test(site.pathname) ? site : new URL('/sitemap.xml', site)
  const xml = await readSitemap(sitemap.toString())
  if (!/<sitemapindex[\s>]/i.test(xml)) return sameSitePages(sitemapLocations(xml), site)

  const children = sameSitePages(sitemapLocations(xml), site).slice(0, MAX_CHILD_SITEMAPS)
  const nested = await Promise.all(children.map((child) => readSitemap(child).then(sitemapLocations, () => [])))
  return sameSitePages(nested.flat(), site)
}

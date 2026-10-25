const MAX_SITEMAP_BYTES = 5 * 1024 * 1024
const MAX_ROBOTS_BYTES = 512 * 1024
const MAX_DECLARED_SITEMAPS = 5
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

const readSiteFile = async (url: string, maxBytes = MAX_SITEMAP_BYTES) => {
  const site = new URL(url)
  const response = await fetchPublicUrl(url, 10_000, undefined, {
    allowUrl: (target) => siteHost(target) === siteHost(site),
  }).catch(() => {
    throw new KnowledgeExtractError('unreachable')
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new KnowledgeExtractError('unreachable')
  }
  const bytes = await readLimitedBody(response, maxBytes).catch(() => {
    throw new KnowledgeExtractError('tooLarge')
  })
  return new TextDecoder().decode(bytes)
}

const readSitemapPages = async (sitemap: string, site: URL) => {
  const xml = await readSiteFile(sitemap)
  if (!/<sitemapindex[\s>]/i.test(xml)) return sameSitePages(sitemapLocations(xml), site)

  const children = sameSitePages(sitemapLocations(xml), site).slice(0, MAX_CHILD_SITEMAPS)
  const nested = await Promise.all(children.map((child) => readSiteFile(child).then(sitemapLocations, () => [])))
  return sameSitePages(nested.flat(), site)
}

/** Site addresses use robots.txt before `/sitemap.xml`; sitemap indexes are followed one level deep. */
export const discoverSitemapPages = async (input: string) => {
  const site = new URL(input)
  if (/\.xml$/i.test(site.pathname)) return readSitemapPages(site.toString(), site)

  // robots.txt is optional; an absent, unreadable or oversized file must not prevent the fallback.
  const robots = await readSiteFile(new URL('/robots.txt', site).toString(), MAX_ROBOTS_BYTES).catch(() => '')
  const fallback = new URL('/sitemap.xml', site).toString()
  const declared = sameSitePages(
    [...robots.matchAll(/^[\t ]*sitemap[\t ]*:[\t ]*(\S+)/gim)].map((match) => match[1]!),
    site,
  )
    .filter((url) => url !== fallback)
    .slice(0, MAX_DECLARED_SITEMAPS)

  for (const sitemap of declared) {
    try {
      return await readSitemapPages(sitemap, site)
    } catch (error) {
      if (!(error instanceof KnowledgeExtractError)) throw error
    }
  }
  return readSitemapPages(fallback, site)
}

/** BASIC has no description, no structured data, and `noindex` on tag/author pages. */
export const hasSeoPlan = (plan: string | null | undefined) => !!plan && plan !== 'BASIC'

// The customer's own site carries the indexable copy; this blog then stays out of search and feeds.
export const hasExternalContentHome = (site: { contentHome?: string | null } | null | undefined) =>
  site?.contentHome === 'EXTERNAL'

// Apply at every head owner: an empty page-level link list cannot remove a parent's links.
export const publicationSeoLinks = <T>(site: { contentHome?: string | null } | null | undefined, links: T[]): T[] =>
  hasExternalContentHome(site) ? [] : links

export const buildCanonicalOrigin = (protocol: string, host: string, keepProtocol = false) => {
  const scheme = keepProtocol && protocol ? protocol.replace(/:?$/, ':') : 'https:'
  return `${scheme}//${host.replace(/^www\./, '')}`
}

export const toAbsoluteUrl = (href: string, origin: string) => {
  if (!href) return href
  try {
    return new URL(href, origin).href
  } catch {
    return href
  }
}

/** og:title only — the plain name stays in <title>. Drops the dash when the tenant has no tagline. */
export const brandTitle = (name?: string | null, tagline?: string | null) => [name, tagline].filter(Boolean).join(' — ')

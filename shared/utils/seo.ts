/** BASIC has no description, no structured data, and `noindex` on tag/author pages. */
export const hasSeoPlan = (plan: string | null | undefined) => !!plan && plan !== 'BASIC'

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
export const brandTitle = (name?: string | null, tagline?: string | null) =>
  [name, tagline].filter(Boolean).join(' — ')

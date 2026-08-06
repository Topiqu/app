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

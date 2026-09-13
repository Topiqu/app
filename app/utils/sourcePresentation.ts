export interface SourcePresentation {
  hostname: string
  path: string
  valid: boolean
}

const decodePath = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const presentSourceUrl = (source: string): SourcePresentation => {
  try {
    const url = new URL(source)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol')
    const path = `${decodePath(url.pathname)}${url.search}${url.hash}`
    return { hostname: url.hostname.replace(/^www\./, ''), path: path === '/' ? '' : path, valid: true }
  } catch {
    return { hostname: source.trim() || 'Invalid URL', path: '', valid: false }
  }
}

// `www.google.com/s2/favicons?domain=` only 301s here, so request it directly — the list
// renders one icon per source and each redirect eats into the stall timeout in `AppMedia`.
export const sourceFaviconUrl = (source: string) => {
  const target = source.trim()
  if (!presentSourceUrl(target).valid) return undefined
  const params = `client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(target)}&size=32`
  return `https://t1.gstatic.com/faviconV2?${params}`
}

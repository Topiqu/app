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

export const sourceFaviconUrl = (source: string) => {
  const presented = presentSourceUrl(source)
  if (!presented.valid) return undefined
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(presented.hostname)}&sz=32`
}

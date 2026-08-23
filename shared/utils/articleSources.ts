const MAX_SOURCES = 5

/**
 * The article page renders each source as a link and requests a favicon for its host, so an entry
 * that is not an http(s) URL ships a dead link plus a junk favicon fetch. The writer prompt still
 * closes with "URLs **or references**", which contradicts the research-brief rule above it and lets
 * an ungrounded run return prose — so the filter has to sit on the write path, not at render.
 *
 * Order is preserved and duplicates dropped: the model routinely cites one page twice.
 */
export const linkableSources = (raw: unknown, max = MAX_SOURCES): string[] => {
  if (!Array.isArray(raw)) return []

  const urls = new Set<string>()

  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const url = entry.trim()

    try {
      const { protocol } = new URL(url)
      if (protocol !== 'https:' && protocol !== 'http:') continue
    } catch {
      continue
    }

    urls.add(url)
    if (urls.size === max) break
  }

  return [...urls]
}

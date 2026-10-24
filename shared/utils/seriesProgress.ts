export interface SeriesPart {
  id: string
  slug: string
  title: string
  language?: string
}

/** Series with fewer parts are not promoted on the homepage — one article is not a series yet. */
export const SERIES_MIN_PARTS = 2

export const seriesProgress = <T extends SeriesPart>(parts: T[], readIds: ReadonlySet<string>) => ({
  read: parts.filter((part) => readIds.has(part.id)).length,
  next: parts.find((part) => !readIds.has(part.id)) ?? null,
})

/** Stored orders may contain gaps from drafts, scheduled or archived articles. */
export const seriesNavigation = <T extends SeriesPart>(parts: T[], currentId: string) => {
  const currentIndex = parts.findIndex((part) => part.id === currentId)
  if (currentIndex < 0) return null
  const articles = parts.map((part, index) => ({ ...part, seriesOrder: index + 1 }))
  return {
    current: currentIndex + 1,
    total: articles.length,
    prev: articles[currentIndex - 1] ?? null,
    next: articles[currentIndex + 1] ?? null,
    articles,
  }
}

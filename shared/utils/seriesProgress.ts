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

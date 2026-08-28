import type { SearchTrend } from './opportunities'

export type SeoAutopilotAction = 'CTR_OPTIMIZATION' | 'CONTENT_REFRESH'

export type SeoAutopilotCandidate = {
  action: SeoAutopilotAction
  articleId: string
  query: string
  page: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  impressionGrowth: number | null
  score: number
}

export const articleSlugFromSearchPage = (page: string): string | null => {
  try {
    const parts = new URL(page).pathname.split('/').filter(Boolean)
    const marker = parts.findIndex((part) => part === 'clanky' || part === 'articles')
    if (marker < 0 || marker + 1 >= parts.length) return null
    return decodeURIComponent(parts[marker + 1]!).trim() || null
  } catch {
    return null
  }
}

/**
 * One deterministic action per site. CTR fixes are deliberately preferred over body writes;
 * both need substantial observed demand. Audit history enforces seven days per article and
 * 30 days for the same article/query pair.
 */
export const selectSeoAutopilotCandidate = (
  trends: SearchTrend[],
  articleIdBySlug: ReadonlyMap<string, string>,
  recentKeys: ReadonlySet<string> = new Set(),
  recentlyChangedArticleIds: ReadonlySet<string> = new Set(),
): SeoAutopilotCandidate | null => {
  const candidates = trends.flatMap((row): SeoAutopilotCandidate[] => {
    const slug = articleSlugFromSearchPage(row.page)
    const articleId = slug ? articleIdBySlug.get(slug) : undefined
    const query = row.query.replace(/\s+/g, ' ').trim()
    if (!articleId || !query || row.impressions < 200 || recentlyChangedArticleIds.has(articleId)) return []

    const key = `${articleId}\u0000${query.toLocaleLowerCase()}`
    if (recentKeys.has(key)) return []

    if (row.position <= 10 && row.ctr < 0.02)
      return [
        {
          action: 'CTR_OPTIMIZATION',
          articleId,
          ...row,
          query,
          score: Math.round(row.impressions * Math.max(0.01, 0.02 - row.ctr) * 100),
        },
      ]

    if (row.position >= 4 && row.position <= 20)
      return [
        {
          action: 'CONTENT_REFRESH',
          articleId,
          ...row,
          query,
          score: Math.round(row.impressions * (21 - row.position)),
        },
      ]

    return []
  })

  return candidates.sort((a, b) => {
    if (a.action !== b.action) return a.action === 'CTR_OPTIMIZATION' ? -1 : 1
    return b.score - a.score
  })[0] ?? null
}

/** Existing article queries belong to the refresh task, not the new-article picker. */
export const isExistingArticleOpportunity = (
  page: string,
  articleIdBySlug: ReadonlyMap<string, string>,
): boolean => {
  const slug = articleSlugFromSearchPage(page)
  return Boolean(slug && articleIdBySlug.has(slug))
}

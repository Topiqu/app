import { keywordLocation } from '~~/shared/utils/keywordPlan'

import { dataForSeo } from './dataforseo'
import { inScope, type ScopeSite } from './scope'

const NEWS_HOURS = 72
const NEWS_ITEMS = 5
const TERMS_PER_QUERY = 5

export interface NewsItem {
  title: string
  snippet: string
  url: string
  domain: string
  publishedAt: string
}

interface NewsSerpItem {
  type: string
  title?: string | null
  snippet?: string | null
  url?: string | null
  domain?: string | null
  timestamp?: string | null
}

/** Google News takes `a OR "b c"`; an apostrophe or stray quote inside a term empties the whole result. */
export const newsQuery = (terms: string[]) => {
  const seen = new Set<string>()
  const phrases = terms
    .map((term) => term.replace(/["'’()]/g, '').replace(/\bOR\b/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((term) => term && !seen.has(term.toLocaleLowerCase()) && seen.add(term.toLocaleLowerCase()))
    .slice(0, TERMS_PER_QUERY)
  return phrases.map((phrase) => (phrase.includes(' ') ? `"${phrase}"` : phrase)).join(' OR ')
}

/** DataForSEO stamps news as `2026-10-03 13:44:53 +00:00`; relative ages ("1 day ago") arrive already resolved. */
export const newsItems = (items: NewsSerpItem[], now: Date): NewsItem[] => {
  const seen = new Set<string>()
  return items.flatMap((item) => {
    const title = item.title?.replace(/\s+/g, ' ').trim()
    const published = item.timestamp ? new Date(item.timestamp.replace(' ', 'T').replace(' ', '')) : null
    const age = published ? now.getTime() - published.getTime() : Number.NaN
    if (item.type !== 'news_search' || !title || !item.url || !item.domain) return []
    if (!(age >= -3_600_000 && age <= NEWS_HOURS * 3_600_000)) return []
    const key = title.toLocaleLowerCase()
    if (seen.has(key) || seen.has(item.url)) return []
    seen.add(key).add(item.url)
    return [
      {
        title: title.slice(0, 200),
        snippet: item.snippet?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? '',
        url: item.url,
        domain: item.domain,
        publishedAt: published!.toISOString(),
      },
    ]
  })
}

/**
 * Fresh Google News stories in the tenant's market. Two queries, so a busy plan keyword cannot crowd out
 * the category: the tenant's own keywords, and the plan's top keywords. Every story then passes the scope
 * check with its snippet, which tells the genre of a game the model has never heard of. A failed query
 * costs nothing; a failed scope check throws, so off-scope news never passes.
 */
export const fetchNews = async (
  site: ScopeSite & { keywordMarket?: string | null },
  groups: string[][],
  now = new Date(),
) => {
  const market = keywordLocation(site.language, site.keywordMarket)
  const seen = new Set<string>()
  const queries = groups
    .map(newsQuery)
    .filter((query) => query && !seen.has(query.toLocaleLowerCase()) && seen.add(query.toLocaleLowerCase()))
  let cost = 0
  const settled = await Promise.allSettled(
    queries.map(async (keyword) => {
      const serp = await dataForSeo<{ items: NewsSerpItem[] | null }>('/serp/google/news/live/advanced', {
        keyword,
        location_code: market.serpLocationCode,
        language_code: market.languageCode,
        depth: 10,
      })
      cost += serp.cost
      return serp.result?.items ?? []
    }),
  )
  const found = newsItems(
    settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : [])),
    now,
  )
  const inside = await inScope(
    site,
    found.map((item) => `${item.title} (${item.domain})${item.snippet ? ` — ${item.snippet}` : ''}`),
    'NEWS_SCOPE_TOKENS',
  )
  return {
    items: inside.map((index) => found[index]!).slice(0, NEWS_ITEMS),
    queries,
    found: found.length,
    failedQueries: settled.filter((outcome) => outcome.status === 'rejected').length,
    costUsd: Math.round(cost * 10_000) / 10_000,
  }
}

/** Numbered, so the topic picker can point at the story it builds on. */
export const newsSignal = (item: NewsItem, index: number) =>
  `[${index + 1}] "${item.title}" (${item.domain}, ${item.publishedAt.slice(0, 10)})${item.snippet ? `: ${item.snippet}` : ''}`

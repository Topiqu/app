import { toHostname } from '~~/shared/utils/domain'
import { isOwnedHost, mentionsTerm } from '~~/shared/utils/backlinks'
import { isReferenceDomain, normalizeCitationUrl } from '~~/shared/utils/aiVisibility'

import { mapLimit } from '../concurrency'
import { fetchPage, type PageLink } from './page'
import { dataForSeo } from '../keywords/dataforseo'
import { mentionsBusiness, type MatchSite } from './match'

const SEARCH_LIMIT = 50
// DataForSEO spam score is 0–100; a link from a spammy page is worth less than no link.
const MAX_SPAM_SCORE = 30
const MAX_PAGES = 25
const CONCURRENCY = 4

interface Citation {
  url?: string
  domain?: string
  spam_score?: number | null
  content_info?: {
    title?: string | null
    main_title?: string | null
    snippet?: string | null
    language?: string | null
    date_published?: string | null
  } | null
}

export type FoundBacklink = { sourceUrl: string; sourceDomain: string; link: PageLink }

export type FoundOpportunity = {
  sourceUrl: string
  sourceDomain: string
  title: string | null
  contactUrl: string | null
  evidence: Record<string, unknown>
}

type Candidate = {
  url: string
  domain: string
  title: string
  snippet: string
  language: string | null
  published: string | null
  term: string
  ambiguous: boolean
}

const search = (keyword: string) =>
  dataForSeo<{ items: Citation[] | null }>('/content_analysis/search/live', {
    keyword: keyword.toLocaleLowerCase(),
    search_mode: 'one_per_domain',
    limit: SEARCH_LIMIT,
  })

const candidates = (items: Citation[] | null | undefined, term: string, ambiguous: boolean, owned: string[]) =>
  (items ?? []).flatMap((item): Candidate[] => {
    const url = item.url ? normalizeCitationUrl(item.url) : null
    if (!url) return []
    const domain = toHostname(new URL(url).hostname)
    if (isOwnedHost(domain, owned) || isReferenceDomain(domain) || (item.spam_score ?? 0) > MAX_SPAM_SCORE) return []
    const info = item.content_info ?? {}
    return [
      {
        url,
        domain,
        title: (info.title || info.main_title || '').trim(),
        snippet: (info.snippet ?? '').replace(/\s+/g, ' ').trim(),
        language: info.language ?? null,
        published: info.date_published ?? null,
        term,
        ambiguous,
      },
    ]
  })

/**
 * Pages that name the business. The domain is searched as-is; the name only after a model confirms the
 * page means this business. Every candidate is fetched: a page already linking is a backlink, a page that
 * still names the business without a link is an opportunity, and anything unreadable is left out.
 */
export const findMentions = async (site: MatchSite, owned: string[]) => {
  const name = site.name.trim()
  const terms = [...owned.map((host) => ({ term: host, ambiguous: false }))]
  if (name.length >= 3 && !owned.some((host) => mentionsTerm(host, name))) terms.push({ term: name, ambiguous: true })

  const searches = await Promise.allSettled(terms.map(({ term }) => search(term)))
  if (searches.every((outcome) => outcome.status === 'rejected')) throw (searches[0] as PromiseRejectedResult).reason
  let costUsd = 0
  const byUrl = new Map<string, Candidate>()
  searches.forEach((outcome, index) => {
    if (outcome.status !== 'fulfilled') return
    costUsd += outcome.value.cost
    for (const candidate of candidates(outcome.value.result?.items, terms[index]!.term, terms[index]!.ambiguous, owned))
      if (!byUrl.has(candidate.url) || byUrl.get(candidate.url)!.ambiguous) byUrl.set(candidate.url, candidate)
  })

  let pool = [...byUrl.values()]
  const ambiguous = pool.filter((candidate) => candidate.ambiguous)
  if (ambiguous.length) {
    const kept = new Set((await mentionsBusiness(site, ambiguous)).map((index) => ambiguous[index]!.url))
    pool = pool.filter((candidate) => !candidate.ambiguous || kept.has(candidate.url))
  }

  const found: FoundBacklink[] = []
  const opportunities: FoundOpportunity[] = []
  await mapLimit(pool.slice(0, MAX_PAGES), CONCURRENCY, async (candidate) => {
    const page = await fetchPage(candidate.url, owned)
    if (page.status !== 'ok') return
    if (page.links.length) {
      found.push({ sourceUrl: candidate.url, sourceDomain: candidate.domain, link: page.links[0]! })
      return
    }
    if (!mentionsTerm(page.text, candidate.term)) return
    opportunities.push({
      sourceUrl: candidate.url,
      sourceDomain: candidate.domain,
      title: candidate.title || page.title,
      contactUrl: page.contactUrl,
      evidence: {
        snippet: candidate.snippet.slice(0, 500),
        term: candidate.term,
        language: candidate.language,
        published: candidate.published,
      },
    })
  })
  return { found, opportunities, costUsd, searched: pool.length }
}

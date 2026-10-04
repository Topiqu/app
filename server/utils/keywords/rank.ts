import type { Language } from '~~/generated/zenstack/models'

import { articlePath } from '~~/shared/utils/routes'
import { keywordLocation } from '~~/shared/utils/keywordPlan'

import { activeFeatureFilter } from '../planFeatures'
import { dataForSeo, hasDataForSeo } from './dataforseo'

const DAY_MS = 86_400_000
// Checked depth; DataForSEO bills per 10 results, so top 30 is three units ($0.006).
const RANK_DEPTH = 30
// Days after the article: an early reading, then the months a new page needs to settle.
const CHECK_DAYS = [7, 30, 60, 90]
const TRACK_DAYS = 365
const BATCH = 100
const CONCURRENCY = 5
const HISTORY = 24

interface RankItem {
  type: string
  rank_group?: number
  domain?: string
  url?: string
}

export interface RankPoint {
  at: string
  position: number | null
  url: string | null
  location?: number
  language?: string
  domain?: string
  articlePosition?: number | null
  articleUrl?: string | null
}

/** One fresh reading, oldest position first; the task turns these into refresh suggestions and results. */
export interface RankReading {
  id: string
  clientSiteId: string
  keyword: string
  articleId: string | null
  publishedAt: Date
  positions: (number | null)[]
}

type RankSite = { domain: string; language: Language; keywordMarket?: string | null }

export const rankHistoryFor = (value: unknown, site: RankSite): RankPoint[] => {
  const market = keywordLocation(site.language, site.keywordMarket)
  return (Array.isArray(value) ? value : []).filter(
    (point): point is RankPoint =>
      point &&
      point.location === market.serpLocationCode &&
      point.language === market.languageCode &&
      point.domain === bareHost(site.domain),
  )
}

export const firstRankCheck = (now = new Date()) => new Date(now.getTime() + CHECK_DAYS[0]! * DAY_MS)

/** The fixed schedule first; then monthly for a year while the page ranks in the checked depth. */
export const nextRankCheck = (usedAt: Date, position: number | null, now: Date) => {
  const age = (now.getTime() - usedAt.getTime()) / DAY_MS
  const scheduled = CHECK_DAYS.find((day) => day > age + 1)
  if (scheduled) return new Date(usedAt.getTime() + scheduled * DAY_MS)
  return position != null && age < TRACK_DAYS ? new Date(now.getTime() + 30 * DAY_MS) : null
}

const bareHost = (host: string) => host.toLocaleLowerCase().replace(/^www\./, '')

export const isArticleUrl = (url: string | null | undefined, domain: string, language: Language, slug: string) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return (
      /^https?:$/.test(parsed.protocol) &&
      bareHost(parsed.hostname) === bareHost(domain) &&
      decodeURI(parsed.pathname).replace(/\/+$/, '') === articlePath(language, slug)
    )
  } catch {
    return false
  }
}

/** The blog's best organic position for the query: any of its pages counts, the URL says which. */
export const blogPosition = (items: RankItem[] | null | undefined, domain: string) => {
  const host = bareHost(domain)
  const hit = (items ?? [])
    .filter((item) => item.type === 'organic' && item.domain && bareHost(item.domain) === host)
    .sort((a, b) => (a.rank_group ?? Infinity) - (b.rank_group ?? Infinity))[0]
  return { position: hit?.rank_group ?? null, url: hit?.url && /^https?:\/\//.test(hit.url) ? hit.url : null }
}

/**
 * Google position of each written topic in the tenant's market, on the CHECK_DAYS schedule. A draft still
 * waiting for review is postponed a week; a deleted article ends tracking; a failed call retries tomorrow.
 */
export const checkDueRanks = async (now = new Date()) => {
  if (!hasDataForSeo()) return { checked: 0, failed: 0, costUsd: 0, readings: [] as RankReading[] }
  const due = await prisma.keywordCluster.findMany({
    where: { status: 'USED', nextRankCheckAt: { lte: now }, clientSite: activeFeatureFilter('ARTICLE_CRONS') },
    select: {
      id: true,
      clientSiteId: true,
      keyword: true,
      articleId: true,
      usedAt: true,
      rankHistory: true,
      nextRankCheckAt: true,
      article: { select: { status: true, publishedAt: true, slug: true, language: true } },
      clientSite: { select: { domain: true, language: true, keywordMarket: true } },
    },
    orderBy: { nextRankCheckAt: 'asc' },
    take: BATCH,
  })

  const spent = new Map<string, { checked: number; costUsd: number }>()
  const readings: RankReading[] = []
  let failed = 0
  for (let index = 0; index < due.length; index += CONCURRENCY) {
    await Promise.all(
      due.slice(index, index + CONCURRENCY).map(async (cluster) => {
        const claimed = await prisma.keywordCluster.updateMany({
          where: { id: cluster.id, nextRankCheckAt: cluster.nextRankCheckAt },
          data: { nextRankCheckAt: new Date(now.getTime() + DAY_MS) },
        })
        if (!claimed.count) return
        if (!cluster.article) {
          await prisma.keywordCluster.update({ where: { id: cluster.id }, data: { nextRankCheckAt: null } })
          return
        }
        if (cluster.article.status !== 'published') {
          await prisma.keywordCluster.update({
            where: { id: cluster.id },
            data: { nextRankCheckAt: new Date(now.getTime() + 7 * DAY_MS) },
          })
          return
        }
        const publishedAt = cluster.article.publishedAt ?? cluster.usedAt ?? now
        const firstCheck = firstRankCheck(publishedAt)
        if (firstCheck > now) {
          await prisma.keywordCluster.update({ where: { id: cluster.id }, data: { nextRankCheckAt: firstCheck } })
          return
        }
        const market = keywordLocation(cluster.clientSite.language, cluster.clientSite.keywordMarket)
        try {
          const serp = await dataForSeo<{ items: RankItem[] | null }>('/serp/google/organic/live/advanced', {
            keyword: cluster.keyword,
            location_code: market.serpLocationCode,
            language_code: market.languageCode,
            depth: RANK_DEPTH,
          })
          const found = blogPosition(serp.result?.items, cluster.clientSite.domain)
          const matchesArticle = (url: string | null | undefined) =>
            isArticleUrl(url, cluster.clientSite.domain, cluster.article!.language, cluster.article!.slug)
          const articleFound = blogPosition(
            serp.result?.items?.filter((item) => matchesArticle(item.url)),
            cluster.clientSite.domain,
          )
          const history = [
            ...rankHistoryFor(cluster.rankHistory, cluster.clientSite),
            {
              at: now.toISOString(),
              ...found,
              articlePosition: articleFound.position,
              articleUrl: articleFound.url,
              location: market.serpLocationCode,
              language: market.languageCode,
              domain: bareHost(cluster.clientSite.domain),
            },
          ]
          await prisma.keywordCluster.update({
            where: { id: cluster.id },
            data: {
              position: found.position,
              rankHistory: history.slice(-HISTORY) as never,
              nextRankCheckAt: nextRankCheck(publishedAt, found.position, now),
            },
          })
          readings.push({
            id: cluster.id,
            clientSiteId: cluster.clientSiteId,
            keyword: cluster.keyword,
            articleId: cluster.articleId,
            publishedAt,
            positions: history.map((point) =>
              matchesArticle(point.articleUrl ?? point.url) ? (point.articlePosition ?? point.position) : null,
            ),
          })
          const total = spent.get(cluster.clientSiteId) ?? { checked: 0, costUsd: 0 }
          spent.set(cluster.clientSiteId, { checked: total.checked + 1, costUsd: total.costUsd + serp.cost })
        } catch (error) {
          failed += 1
          console.error('[keyword-rank] Check failed:', cluster.id, (error as Error).message)
          await prisma.keywordCluster.update({
            where: { id: cluster.id },
            data: { nextRankCheckAt: new Date(now.getTime() + DAY_MS) },
          })
        }
      }),
    )
  }

  for (const [clientSiteId, { checked, costUsd }] of spent)
    await logAction({
      action: 'KEYWORD_RANKS_CHECKED',
      clientSiteId,
      metadata: { checked, costUsd: Math.round(costUsd * 10_000) / 10_000 },
    })
  const checked = [...spent.values()].reduce((total, entry) => total + entry.checked, 0)
  const costUsd = [...spent.values()].reduce((total, entry) => total + entry.costUsd, 0)
  return { checked, failed, costUsd: Math.round(costUsd * 10_000) / 10_000, readings }
}

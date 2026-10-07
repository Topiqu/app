import type { Language } from '~~/generated/zenstack/models'

import { toHostname } from '~~/shared/utils/domain'
import { keywordLocation } from '~~/shared/utils/keywordPlan'
import { foldText, isOwnedHost } from '~~/shared/utils/backlinks'
import { isReferenceDomain, normalizeCitationUrl } from '~~/shared/utils/aiVisibility'

import type { SerpItem } from '../keywords/serp'
import type { FoundBacklink, FoundOpportunity } from './mentions'

import { fetchPage, mapLimit } from './page'
import { dataForSeo } from '../keywords/dataforseo'
import { supplierPages, type MatchSite } from './match'

const MAX_BRANDS = 5
const DEALER_QUERY: Record<Language, string> = {
  cs: 'prodejci',
  en: 'where to buy',
  de: 'händler',
  fr: 'revendeurs',
}

export const topBrands = async (clientSiteId: string, site: Pick<MatchSite, 'name'>, owned: readonly string[]) => {
  const rows = await prisma.$queryRaw<{ brand: string; products: bigint }[]>`
    SELECT "brand", count(*) AS products FROM "KnowledgeProduct"
    WHERE "clientSiteId" = ${clientSiteId} AND "brand" IS NOT NULL AND "brand" <> ''
    GROUP BY "brand" ORDER BY products DESC, "brand" ASC LIMIT 20`
  // The shop's own label is not a supplier to ask for a link.
  const own = [site.name, ...owned.map((host) => host.split('.')[0]!)].map(foldText)
  return rows
    .filter((row) => !own.includes(foldText(row.brand)))
    .slice(0, MAX_BRANDS)
    .map((row) => ({ brand: row.brand, products: Number(row.products) }))
}

/**
 * Manufacturers of the brands the shop sells, from its product feed: their dealer page is the most
 * natural link a shop can ask for. One SERP per brand, one model call to pick the official page, then
 * the page itself decides whether the shop is listed already.
 */
export const findSuppliers = async (site: MatchSite & { keywordMarket?: string | null }, owned: string[]) => {
  const brands = await topBrands(site.id, site, owned)
  if (!brands.length) return { found: [], opportunities: [], costUsd: 0, searched: 0 }
  const market = keywordLocation(site.language, site.keywordMarket)
  const serps = await Promise.allSettled(
    brands.map(({ brand }) =>
      dataForSeo<{ items: SerpItem[] | null }>('/serp/google/organic/live/advanced', {
        keyword: `${brand} ${DEALER_QUERY[site.language]}`,
        location_code: market.serpLocationCode,
        language_code: market.languageCode,
        depth: 10,
      }),
    ),
  )
  if (serps.every((outcome) => outcome.status === 'rejected')) throw (serps[0] as PromiseRejectedResult).reason
  let costUsd = 0
  const searched = serps.flatMap((outcome, index) => {
    if (outcome.status !== 'fulfilled') return []
    costUsd += outcome.value.cost
    const results = (outcome.value.result?.items ?? [])
      .filter((item) => {
        const url = item.type === 'organic' && item.title && item.url ? normalizeCitationUrl(item.url) : null
        const host = url ? toHostname(new URL(url).hostname) : null
        return host && !isOwnedHost(host, owned) && !isReferenceDomain(host)
      })
      .slice(0, 8)
      .map((item) => ({ title: item.title!, url: item.url!, description: item.description ?? '' }))
    return results.length ? [{ ...brands[index]!, results }] : []
  })

  const picks = await supplierPages(site, searched)
  const found: FoundBacklink[] = []
  const opportunities: FoundOpportunity[] = []
  await mapLimit(picks, 4, async (pick) => {
    const sourceUrl = normalizeCitationUrl(pick.url)
    if (!sourceUrl) return
    const page = await fetchPage(sourceUrl, owned)
    if (page.status !== 'ok') return
    const sourceDomain = toHostname(new URL(sourceUrl).hostname)
    if (page.links.length) {
      found.push({ sourceUrl, sourceDomain, link: page.links[0]! })
      return
    }
    opportunities.push({
      sourceUrl,
      sourceDomain,
      title: pick.title || page.title,
      contactUrl: page.contactUrl,
      evidence: {
        brand: pick.brand,
        products: searched.find((entry) => entry.brand === pick.brand)?.products ?? 0,
        page: pick.page,
      },
    })
  })
  return { found, opportunities, costUsd, searched: searched.length }
}

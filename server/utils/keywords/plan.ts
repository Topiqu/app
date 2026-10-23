import { z } from 'zod'
import { createHash } from 'node:crypto'
import { generateText, Output } from 'ai'

const DAY_MS = 86_400_000
const REFRESH_DAYS = 30
const MAX_SEEDS = 5
const SUGGESTIONS_PER_SEED = 50
const PLAN_SIZE = 30
// Candidates sent through the scope check; enough that the plan still fills after it drops some.
const SCOPE_CANDIDATES = MAX_SEEDS * SUGGESTIONS_PER_SEED
const MIN_READY = 3
// A rebuild that found too few topics finds the same few tomorrow; it waits this long before trying again.
const SHORTAGE_RETRY_DAYS = 7
// Labs difficulty a blog without proven rankings can realistically reach.
export const START_DIFFICULTY = 20
// A theme may fill at most THEME_CAP of the last THEME_WINDOW articles; below the cap each repeat
// still divides a topic's score by 1 + THEME_PENALTY.
const THEME_WINDOW = 5
const THEME_CAP = 2
const THEME_PENALTY = 0.6
// Open topics re-judged against articles written since their last check, so refills stay checked too.
const RECHECK_CANDIDATES = 6

// Two top-10 results in common can be chance; three mean Google answers both queries with the same pages.
const SERP_OVERLAP = 3

export interface KeywordIdea {
  keyword: string
  volume: number | null
  difficulty: number | null
  intent: string | null
  core: string | null
  pillar?: string | null
  /** Year-on-year change of demand in percent. */
  trend?: number | null
  /** Month (1–12) of a clear seasonal peak; null for steady demand. */
  peakMonth?: number | null
}

export interface PlannedCluster {
  keyword: string
  keywords: { keyword: string; volume: number | null }[]
  volume: number
  difficulty: number | null
  intent: string
  pillar: string | null
  trend: number | null
  peakMonth: number | null
  score: number
}

interface LabsItem {
  keyword: string
  keyword_info?: {
    search_volume?: number | null
    search_volume_trend?: { yearly?: number | null } | null
    monthly_searches?: { month?: number | null; search_volume?: number | null }[] | null
  }
  keyword_properties?: { keyword_difficulty?: number | null; core_keyword?: string | null }
  search_intent_info?: { main_intent?: string | null }
}

/** The busiest month when it draws at least 1.5× the yearly average; otherwise demand counts as steady. */
export const peakMonthOf = (monthly: { month?: number | null; search_volume?: number | null }[] | null | undefined) => {
  const months = (monthly ?? []).slice(0, 12).filter((entry) => entry.month && entry.search_volume != null)
  if (months.length < 12) return null
  const average = months.reduce((total, entry) => total + entry.search_volume!, 0) / months.length
  const peak = months.reduce((best, entry) => (entry.search_volume! > best.search_volume! ? entry : best))
  return average > 0 && peak.search_volume! >= average * 1.5 ? peak.month! : null
}

interface LabsResult {
  items?: LabsItem[] | null
  seed_keyword_data?: LabsItem | null
}

export const ideasFromLabs = (results: LabsResult[], seed: string) =>
  results.flatMap((result) => [
    ...(result.seed_keyword_data?.keyword ? [ideaFromLabs(result.seed_keyword_data, seed)] : []),
    ...(result.items ?? [])
      .filter((item) => typeof item.keyword === 'string' && item.keyword.trim())
      .map((item) => ideaFromLabs(item, seed)),
  ])

export const ideaFromLabs = (item: LabsItem, pillar: string | null = null): KeywordIdea => ({
  keyword: item.keyword,
  volume: item.keyword_info?.search_volume ?? null,
  difficulty: item.keyword_properties?.keyword_difficulty ?? null,
  intent: item.search_intent_info?.main_intent ?? null,
  core: item.keyword_properties?.core_keyword ?? null,
  pillar,
  trend:
    item.keyword_info?.search_volume_trend?.yearly == null
      ? null
      : Math.round(item.keyword_info.search_volume_trend.yearly),
  peakMonth: peakMonthOf(item.keyword_info?.monthly_searches),
})

export type ScoreContext = {
  /** Labs difficulty the blog can realistically reach (`difficultyCeiling`). */
  ceiling?: number
  /** The tenant has a product catalog, so buying comparisons can lead to its own products. */
  sells?: boolean
  /** Current month, 1–12. */
  month?: number
}

/**
 * Commercial queries ("best X", "X vs Y") are good articles and, for a shop, the ones that sell.
 * Transactional ones ("buy X") want a product page, so a blog post is a weaker answer.
 */
const intentFit = (intent: string, sells: boolean) =>
  intent === 'commercial' ? (sells ? 1.2 : 1) : intent === 'transactional' ? 0.6 : 1

/**
 * Publish ahead of a seasonal peak so the page has time to rank; a peak months away or just over waits.
 * Clearly rising or falling demand nudges the order without overriding it.
 */
const timingFit = ({ trend, peakMonth }: Pick<PlannedCluster, 'trend' | 'peakMonth'>, month?: number) => {
  const momentum = trend == null ? 1 : trend >= 50 ? 1.15 : trend <= -50 ? 0.85 : 1
  if (!peakMonth || !month) return momentum
  const until = (peakMonth - month + 12) % 12
  return momentum * (until === 0 ? 1.1 : until <= 3 ? 1.25 : 0.8)
}

/**
 * Unknown volume counts as a little demand, not none: Czech long-tail volumes are mostly missing, not zero.
 * A topic above the blog's difficulty ceiling is discounted, not dropped: Labs difficulty is an estimate.
 */
export const clusterScore = (
  cluster: Pick<PlannedCluster, 'volume' | 'difficulty' | 'intent'> &
    Partial<Pick<PlannedCluster, 'trend' | 'peakMonth'>>,
  { ceiling = 100, sells = false, month }: ScoreContext = {},
) => {
  const demand = Math.log10(cluster.volume + 10)
  const ease = 1 - Math.min(cluster.difficulty ?? 50, 100) / 150
  const reach = cluster.difficulty != null && cluster.difficulty > ceiling ? 0.25 : 1
  const timing = timingFit({ trend: cluster.trend ?? null, peakMonth: cluster.peakMonth ?? null }, month)
  return Math.round(demand * ease * intentFit(cluster.intent, sells) * reach * timing * 100) / 100
}

/**
 * The hardest topic the blog already ranks top 10 for, plus a margin. A blog with no proven ranking starts
 * low, so the plan stops offering topics only established sites can win.
 */
export const difficultyCeiling = (ranked: { difficulty: number | null; position: number | null }[]) => {
  const proven = ranked.flatMap(({ difficulty, position }) =>
    difficulty != null && position != null && position <= 10 ? [difficulty] : [],
  )
  return proven.length ? Math.min(100, Math.max(START_DIFFICULTY, Math.max(...proven) + 10)) : START_DIFFICULTY
}

const words = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]{3,}/gu) ?? []

/**
 * Groups word-order and accent variants, plus DataForSEO's `core_keyword` where it has one (rarely for Czech).
 * Navigational searches want one specific site, so they are dropped. Transactional ones are only discounted:
 * Labs tags a head term like "výběrová káva" transactional, and a guide can still serve it.
 */
export const clusterIdeas = (ideas: KeywordIdea[], context: ScoreContext = {}): PlannedCluster[] => {
  const groups = new Map<string, KeywordIdea[]>()
  for (const idea of ideas) {
    if (idea.intent === 'navigational') continue
    const key = words(idea.core || idea.keyword)
      .sort()
      .join(' ')
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), idea])
  }
  return [...groups.values()]
    .map((group) => {
      const sorted = [...group].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      const head = sorted[0]!
      const cluster = {
        keyword: head.keyword,
        keywords: sorted.slice(0, 10).map(({ keyword, volume }) => ({ keyword, volume })),
        // Synonym volumes can describe the same searches; adding them overstates demand.
        volume: head.volume ?? 0,
        difficulty: head.difficulty,
        intent: head.intent ?? 'informational',
        pillar: head.pillar ?? null,
        trend: head.trend ?? null,
        peakMonth: head.peakMonth ?? null,
      }
      return { ...cluster, score: clusterScore(cluster, context) }
    })
    .sort((a, b) => b.score - a.score)
}

/** Cheap first pass only; the topic picker still judges novelty against the article summaries. */
export const isKeywordCovered = (keyword: string, titles: string[]) => {
  const terms = words(keyword)
  if (!terms.length) return false
  return titles.some((title) => {
    const titleWords = new Set(words(title))
    return terms.every((term) => titleWords.has(term))
  })
}

type SerpCandidate = PlannedCluster & { urls: string[]; questions: string[] }

/**
 * Queries Google answers with the same pages are one article, whatever their wording: "jak připravit
 * espresso doma" and "domácí espresso návod" share no word order but share the results. Candidates come
 * in priority order; the first of each group stays the head and absorbs the others' phrasings and questions.
 */
export const groupBySerp = <T extends SerpCandidate>(candidates: T[]) => {
  const heads: T[] = []
  for (const candidate of candidates) {
    const head = heads.find((group) => candidate.urls.filter((url) => group.urls.includes(url)).length >= SERP_OVERLAP)
    if (!head) {
      heads.push({ ...candidate })
      continue
    }
    const index = heads.indexOf(head)
    heads[index] = {
      ...head,
      keywords: [
        ...new Map([...head.keywords, ...candidate.keywords].map((entry) => [entry.keyword, entry])).values(),
      ].slice(0, 10),
      questions: [...new Set([...head.questions, ...candidate.questions])].slice(0, 5),
    }
  }
  return heads
}

type PlanSite = ScopeSite & {
  keywordPlanRefreshedAt?: Date | string | null
  keywordPlanAttemptedAt?: Date | string | null
  keywordPlanProfile?: string | null
  keywordMarket?: string | null
  domain?: string | null
}

const seedSchema = z.object({
  seeds: z.array(z.string().min(2).max(80)).min(3).max(8).describe('Short search phrases, one to three words each.'),
})

/**
 * Rewords the tenant's focus as search phrases. Names and
 * trends come from the search data, never from the model's memory.
 */
const deriveSeeds = async (site: PlanSite, titles: string[]) => {
  const result = await generateText({
    model: aiModel('keywordSeeds'),
    maxOutputTokens: 600,
    providerOptions: aiReasoning('medium'),
    instructions:
      "List short search phrases for distinct subtopics inside this blog's exact focus, including specific reader problems and comparisons. Use the blog language. Avoid generic umbrella categories and do not invent trending names or search volumes.",
    prompt: `${siteProfile(site)}\nRecent titles:\n${
      titles
        .slice(0, 10)
        .map((title) => `- ${title}`)
        .join('\n') || '- none'
    }`,
    output: Output.object({ schema: seedSchema }),
  })
  await recordAiUsage(site.id, result.usage.totalTokens ?? 0, 'KEYWORD_PLAN_SEED_TOKENS', { usage: result.usage })
  return result.output.seeds
}

export const planProfile = (site: PlanSite) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        2,
        site.focus ?? '',
        site.audience ?? '',
        siteKeywords(site),
        site.language,
        site.keywordMarket ?? '',
        site.domain ?? '',
      ]),
    )
    .digest('hex')
    .slice(0, 16)

/** The retry cooldown lives in keywordPlanAttemptedAt, so profile changes can invalidate immediately. */
export const isPlanStale = (site: PlanSite, now: Date) => {
  if (!site.keywordPlanRefreshedAt) return true
  const age = now.getTime() - new Date(site.keywordPlanRefreshedAt).getTime()
  return age > REFRESH_DAYS * DAY_MS || site.keywordPlanProfile !== planProfile(site)
}

/**
 * Rebuilds the plan from DataForSEO: Labs suggestions per seed (volume, difficulty, intent), then a SERP per
 * top cluster. Suggestions, not `keyword_ideas`: for Czech the ideas endpoint returned local business names.
 */
export const refreshKeywordPlan = async (site: PlanSite, now = new Date()) => {
  const market = keywordLocation(site.language, site.keywordMarket)
  const articles = await prisma.article.findMany({
    where: { clientSiteId: site.id, status: { in: ['published', 'draft'] } },
    select: { id: true, title: true, excerpt: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const titles = articles.map((article) => article.title)

  const keywords = siteKeywords(site)
  const derived = site.focus || keywords.length < 3 ? await deriveSeeds(site, titles) : []
  const seeds = [
    ...new Set(
      [...keywords.slice(0, derived.length ? 3 : MAX_SEEDS), ...derived].map((seed) => seed.trim().toLocaleLowerCase()),
    ),
  ].slice(0, MAX_SEEDS)

  let cost = 0
  // One failing seed must not throw away the ones already paid for.
  const settled = await Promise.allSettled(
    seeds.map(async (seed) => {
      const {
        result,
        results,
        cost: spent,
      } = await dataForSeo<LabsResult>('/dataforseo_labs/google/keyword_suggestions/live', {
        keyword: seed,
        // No location is Labs' worldwide answer for a GLOBAL market.
        ...(market.labsLocationCode ? { location_code: market.labsLocationCode } : {}),
        language_code: market.languageCode,
        include_seed_keyword: true,
        limit: SUGGESTIONS_PER_SEED,
      })
      cost += spent
      return ideasFromLabs(results ?? (result ? [result] : []), seed)
    }),
  )
  const failedSeeds = settled.filter((outcome) => outcome.status === 'rejected')
  if (failedSeeds.length === seeds.length) throw (failedSeeds[0] as PromiseRejectedResult).reason
  const suggestions = settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : []))
  // The first seed that suggested a keyword owns it, so a topic belongs to one pillar.
  const unique = new Map<string, KeywordIdea>()
  for (const idea of suggestions) if (!unique.has(idea.keyword)) unique.set(idea.keyword, idea)

  const [ranked, pinned, product, themed] = await Promise.all([
    prisma.keywordCluster.findMany({
      where: { clientSiteId: site.id, status: 'USED', position: { not: null } },
      select: { difficulty: true, position: true, rankHistory: true },
    }),
    prisma.keywordCluster.findMany({
      where: { clientSiteId: site.id, status: 'PINNED' },
      select: {
        keyword: true,
        keywords: true,
        volume: true,
        difficulty: true,
        intent: true,
        pillar: true,
        trend: true,
        peakMonth: true,
      },
    }),
    prisma.knowledgeProduct.findFirst({ where: { clientSiteId: site.id }, select: { id: true } }),
    prisma.keywordCluster.findMany({
      where: { clientSiteId: site.id, theme: { not: null } },
      select: { theme: true },
      distinct: ['theme'],
      take: 50,
    }),
  ])
  const ceiling = difficultyCeiling(
    ranked.filter(
      (row) =>
        site.domain && rankHistoryFor(row.rankHistory, { ...site, domain: site.domain }).at(-1)?.position != null,
    ),
  )
  const context: ScoreContext = { ceiling, sells: Boolean(product), month: now.getUTCMonth() + 1 }
  const suggested = clusterIdeas([...unique.values()], context)
  const pinnedKeywords = new Set(pinned.map((row) => row.keyword))
  const candidates = suggested
    .filter((cluster) => !pinnedKeywords.has(cluster.keyword) && !isKeywordCovered(cluster.keyword, titles))
    .slice(0, SCOPE_CANDIDATES)
  const inside = await inScope(
    site,
    candidates.map((cluster) => cluster.keyword),
    'KEYWORD_PLAN_SCOPE_TOKENS',
  )
  // Pinned topics skip the cheap pre-filters: the editor asked for them, so only the full assessment may
  // drop them. Without it a pin from an older profile would stay visible but never be offered.
  const reassessed = pinned.map((row) => {
    const fresh = suggested.find((cluster) => cluster.keyword === row.keyword)
    if (fresh) return fresh
    const cluster = {
      keyword: row.keyword,
      keywords: row.keywords as PlannedCluster['keywords'],
      volume: row.volume,
      difficulty: row.difficulty,
      intent: row.intent,
      pillar: row.pillar,
      trend: row.trend,
      peakMonth: row.peakMonth,
    }
    return { ...cluster, score: clusterScore(cluster, context) }
  })
  const scoped = [...reassessed, ...inside.map((index) => candidates[index]!).slice(0, PLAN_SIZE)]

  const serps: (ReturnType<typeof serpSignals> | null)[] = []
  const failedSerps: string[] = []
  for (let offset = 0; offset < scoped.length; offset += 5) {
    serps.push(
      ...(await Promise.all(
        scoped.slice(offset, offset + 5).map(async (cluster) => {
          try {
            const serp = await dataForSeo<{ items: SerpItem[] | null }>('/serp/google/organic/live/advanced', {
              keyword: cluster.keyword,
              location_code: market.serpLocationCode,
              language_code: market.languageCode,
              depth: 10,
            })
            cost += serp.cost
            return serpSignals(serp.result?.items)
          } catch (error) {
            failedSerps.push((error as Error).message)
            return null
          }
        }),
      )),
    )
  }
  if (scoped.length && failedSerps.length === scoped.length)
    throw new Error(`No SERP evidence available: ${failedSerps[0]}`)

  // Pinned topics lead `scoped`, so a pin stays the head when another query shares its results.
  const grouped = groupBySerp(
    scoped.map((cluster, index) => ({
      ...cluster,
      ...(serps[index] ?? { questions: [], aiOverview: false, domains: [], organic: [], urls: [] }),
    })),
  )
  // A page of the blog already in the top 10 answers the query; a new article would compete with it.
  // An editor's pin still goes to the assessment, which judges coverage itself.
  const ownHost = site.domain?.toLocaleLowerCase().replace(/^www\./, '')
  const ranking = (cluster: { urls: string[] }) =>
    Boolean(ownHost) && cluster.urls.some((url) => url.split('/')[0] === ownHost)
  const enriched = grouped
    .filter((cluster) => pinnedKeywords.has(cluster.keyword) || !ranking(cluster))
    .map(({ urls: _urls, ...cluster }) => cluster)
  const { accepted: decisions, expansions } = await assessOpportunities(
    site,
    enriched,
    articles.map(({ title, excerpt }) => ({ title, excerpt })),
    themed.flatMap((row) => (row.theme ? [row.theme] : [])),
  )
  if (failedSerps.length && decisions.length && !decisions.some((decision) => enriched[decision.index]!.organic.length))
    throw new Error('SERP checks failed for every recommended topic')
  const profile = planProfile(site)
  const clusters = decisions
    .map((decision) => {
      const { organic, ...cluster } = enriched[decision.index]!
      return {
        ...cluster,
        intent: decision.intent,
        theme: themeKey(decision.theme),
        score:
          clusterScore({ ...cluster, intent: decision.intent }, context) *
          (decision.articleFit === 'strong' ? 1 : 0.7) *
          (decision.specificity === 'focused' ? 1 : 0.35),
        opportunity: {
          reason: decision.reason.trim(),
          angle: decision.angle.trim(),
          articleFit: decision.articleFit,
          specificity: decision.specificity,
          evidence: organic.length ? 'serp' : 'metrics',
          organic,
          profile,
          checkedAt: now.toISOString(),
        },
      }
    })
    .sort((a, b) => b.score - a.score)

  const existing = await prisma.keywordCluster.findMany({
    where: { clientSiteId: site.id },
    select: { id: true, keyword: true, status: true },
  })
  const byKeyword = new Map(existing.map((row) => [row.keyword, row]))
  await prisma.$transaction(async (tx) => {
    for (const cluster of clusters) {
      const data = { ...cluster, opportunity: cluster.opportunity as never, keywords: cluster.keywords as never }
      const row = byKeyword.get(cluster.keyword)
      // PINNED, SKIPPED and USED are editorial facts; a rebuild only refreshes the numbers behind them.
      if (row) await tx.keywordCluster.update({ where: { id: row.id }, data })
      else await tx.keywordCluster.create({ data: { ...data, clientSiteId: site.id } })
    }
    const kept = new Set(clusters.map((cluster) => cluster.keyword))
    const stale = existing.filter((row) => row.status === 'OPEN' && !kept.has(row.keyword)).map((row) => row.id)
    if (stale.length) await tx.keywordCluster.deleteMany({ where: { id: { in: stale }, status: 'OPEN' } })
    await tx.clientSite.update({
      where: { id: site.id },
      data: { keywordPlanRefreshedAt: now, keywordPlanProfile: profile },
    })
  })

  // Only a published article can be edited in place; a draft still gets its editor's attention first.
  const expanded = await suggestExpansions(
    site.id,
    expansions.flatMap((expansion) => {
      const article = articles[expansion.article]
      return article?.status === 'published'
        ? [{ articleId: article.id, keyword: enriched[expansion.index]!.keyword, ...expansion }]
        : []
    }),
    now,
  ).catch((error: Error) => {
    // The plan is already saved; a missed suggestion comes back with the next rebuild.
    console.error('[keyword-plan] Expansion suggestions failed:', site.id, error.message)
    return 0
  })

  await logAction({
    action: 'KEYWORD_PLAN_REFRESHED',
    clientSiteId: site.id,
    metadata: {
      clusters: clusters.length,
      outOfScope: candidates.length - inside.length,
      unsuitable: scoped.length - clusters.length,
      serpChecked: serps.filter(Boolean).length,
      failedSerps: failedSerps.length,
      serpErrors: [...new Set(failedSerps)].slice(0, 3),
      seeds: seeds.length,
      failedSeeds: failedSeeds.length,
      market: market.market,
      difficultyCeiling: ceiling,
      mergedBySerp: scoped.length - grouped.length,
      alreadyRanking: grouped.length - enriched.length,
      sells: context.sells,
      expansionsSuggested: expanded,
      costUsd: Math.round(cost * 10_000) / 10_000,
    },
  })
  return clusters.length
}

const candidateSelect = {
  id: true,
  keyword: true,
  keywords: true,
  volume: true,
  difficulty: true,
  intent: true,
  questions: true,
  aiOverview: true,
  pillar: true,
  trend: true,
  peakMonth: true,
  status: true,
  opportunity: true,
  score: true,
  theme: true,
} as const

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * Rebuilds a stale plan first. The claim is a one-day lease written before the paid calls: overlapping
 * runs cannot both pay, and a failure or a crash mid-rebuild retries tomorrow instead of every slot.
 */
export const keywordPlanFor = async (site: PlanSite, now = new Date()) => {
  const profile = planProfile(site)
  const current = <T extends { opportunity: unknown }>(rows: T[]) =>
    rows.flatMap((row) => {
      const opportunity = keywordOpportunity(row.opportunity)
      return opportunity?.profile === profile ? [{ ...row, opportunity }] : []
    })
  const load = async () => {
    const [pinned, open, recent] = await Promise.all([
      prisma.keywordCluster.findMany({
        where: { clientSiteId: site.id, status: 'PINNED' },
        select: candidateSelect,
        orderBy: { updatedAt: 'desc' },
        take: PLAN_SIZE,
      }),
      prisma.keywordCluster.findMany({
        where: { clientSiteId: site.id, status: 'OPEN' },
        select: candidateSelect,
        orderBy: { score: 'desc' },
        take: PLAN_SIZE,
      }),
      recentThemes(site.id),
    ])
    return { pinned: current(pinned), open: current(open), recent }
  }
  let ready = await load()
  const previous = site.keywordPlanAttemptedAt ? new Date(site.keywordPlanAttemptedAt) : null
  const canRetry = !previous || now.getTime() - previous.getTime() >= DAY_MS
  const due =
    isPlanStale(site, now) ||
    (ready.pinned.length + ready.open.length < MIN_READY && (await shortageDue(site, ready, now)))
  if (hasDataForSeo() && canRetry && due) {
    const claimed = await prisma.clientSite.updateMany({
      where: { id: site.id, keywordPlanAttemptedAt: previous },
      data: { keywordPlanAttemptedAt: now },
    })
    if (claimed.count) {
      try {
        await refreshKeywordPlan(site, now)
        ready = await load()
      } catch (error) {
        console.error('[keyword-plan] Rebuild failed:', site.id, (error as Error).message)
        await logAction({
          action: 'KEYWORD_PLAN_REFRESH_FAILED',
          clientSiteId: site.id,
          metadata: { error: (error as Error).message },
        })
      }
    }
  }
  const ordered = orderCandidates(ready.pinned, ready.open, ready.recent, now.getUTCMonth() + 1)
  return (await recheckCoverage(site, ordered, now)).slice(0, 3)
}

export const themeKey = (value: string | null | undefined) => value?.trim().toLocaleLowerCase() || null

/** Plans built before themes existed carry only the seed pillar; it stands in until the next rebuild. */
export const themeOf = (cluster: { theme?: string | null; pillar: string | null }) =>
  themeKey(cluster.theme ?? cluster.pillar)

/** Newest first. An article without its own theme inherits the plan topic it was written for. */
const recentThemes = async (clientSiteId: string) => {
  const articles = await prisma.article.findMany({
    where: { clientSiteId, status: { in: ['published', 'draft'] } },
    select: { theme: true, keywordClusters: { select: { theme: true, pillar: true }, take: 1 } },
    orderBy: { createdAt: 'desc' },
    take: THEME_WINDOW,
  })
  return articles.map((article) => {
    const cluster = article.keywordClusters?.[0]
    return themeKey(article.theme) ?? (cluster ? themeOf(cluster) : null)
  })
}

type RecheckRow = {
  id: string
  keyword: string
  status: string
  volume: number
  difficulty: number | null
  intent: string
  questions: string[]
  aiOverview: boolean
  opportunity: KeywordOpportunity
}

/**
 * An open topic was judged against the articles that existed at its last check. One written since may
 * answer it: such a topic is skipped and linked to that article, and a part the article misses becomes an
 * EXPAND suggestion. Enrichment like the rebuild: a failed check offers the topics unchanged.
 */
const recheckCoverage = async <T extends RecheckRow>(site: PlanSite, ordered: T[], now: Date) => {
  const checkedAt = (cluster: T) => Date.parse(cluster.opportunity.checkedAt)
  const due = ordered
    .filter((cluster) => cluster.status === 'OPEN' && !Number.isNaN(checkedAt(cluster)))
    .slice(0, RECHECK_CANDIDATES)
  if (!due.length) return ordered
  const articles = await prisma.article.findMany({
    where: {
      clientSiteId: site.id,
      status: { in: ['published', 'draft'] },
      createdAt: { gt: new Date(Math.min(...due.map(checkedAt))) },
    },
    select: { id: true, title: true, excerpt: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const stale = due.filter((cluster) => articles.some((article) => article.createdAt.getTime() > checkedAt(cluster)))
  if (!stale.length) return ordered

  try {
    const { covered, expansions } = await assessOpportunities(
      site,
      stale.map((cluster) => ({
        keyword: cluster.keyword,
        volume: cluster.volume,
        difficulty: cluster.difficulty,
        intent: cluster.intent,
        questions: cluster.questions,
        aiOverview: cluster.aiOverview,
        organic: cluster.opportunity.organic,
      })),
      articles.map(({ title, excerpt }) => ({ title, excerpt })),
    )
    const coveredIds = new Set<string>()
    for (const { index, article } of covered) {
      const cluster = stale[index]!
      coveredIds.add(cluster.id)
      await prisma.keywordCluster.updateMany({
        where: { id: cluster.id, status: 'OPEN' },
        data: { status: 'SKIPPED', articleId: articles[article]!.id },
      })
    }
    for (const cluster of stale.filter((cluster) => !coveredIds.has(cluster.id)))
      await prisma.keywordCluster.update({
        where: { id: cluster.id },
        data: { opportunity: { ...cluster.opportunity, checkedAt: now.toISOString() } as never },
      })
    await suggestExpansions(
      site.id,
      expansions.flatMap((expansion) => {
        const article = articles[expansion.article]
        return article?.status === 'published'
          ? [{ articleId: article.id, keyword: stale[expansion.index]!.keyword, ...expansion }]
          : []
      }),
      now,
    ).catch((error: Error) => {
      // The skips are saved; a missed suggestion comes back with the next rebuild.
      console.error('[keyword-plan] Expansion suggestions failed:', site.id, error.message)
    })
    return ordered.filter((cluster) => !coveredIds.has(cluster.id))
  } catch (error) {
    console.error('[keyword-plan] Coverage recheck failed:', site.id, (error as Error).message)
    return ordered
  }
}

/**
 * A short plan is refilled daily only when the last rebuild found enough topics and the blog used them up.
 * A niche where it found fewer would pay for the same few again, so that waits SHORTAGE_RETRY_DAYS.
 */
const shortageDue = async (site: PlanSite, ready: { pinned: unknown[]; open: unknown[] }, now: Date) => {
  if (!site.keywordPlanRefreshedAt) return true
  const refreshedAt = new Date(site.keywordPlanRefreshedAt)
  if (now.getTime() - refreshedAt.getTime() >= SHORTAGE_RETRY_DAYS * DAY_MS) return true
  const used = await prisma.keywordCluster.count({
    where: { clientSiteId: site.id, status: 'USED', usedAt: { gte: refreshedAt } },
  })
  return used + ready.pinned.length + ready.open.length >= MIN_READY
}

/** Within three months of its peak a topic has to go out now, whatever the feed wrote recently. */
const peaksSoon = (peakMonth: number | null, month?: number) =>
  !!peakMonth && !!month && (peakMonth - month + 12) % 12 <= 3

type OrderRow = { theme?: string | null; pillar: string | null; score: number; peakMonth: number | null }

/**
 * Pinned topics first, then open ones by score divided by how often their theme appears among the last
 * THEME_WINDOW articles. A theme at THEME_CAP rests unless its season is close or nothing else is left.
 */
export const orderCandidates = <T extends OrderRow>(
  pinned: T[],
  open: T[],
  recent: (string | null)[],
  month?: number,
) => {
  const window = recent.slice(0, THEME_WINDOW)
  const ranked = open
    .map((cluster) => {
      const theme = themeOf(cluster)
      const count = theme && !peaksSoon(cluster.peakMonth, month) ? window.filter((entry) => entry === theme).length : 0
      return { cluster, count, rank: cluster.score / (1 + THEME_PENALTY * count) }
    })
    .sort((a, b) => b.rank - a.rank)
  const rested = ranked.filter((entry) => entry.count < THEME_CAP)
  return [...pinned, ...(rested.length ? rested : ranked).map((entry) => entry.cluster)]
}

export const pickCandidates = <T extends OrderRow>(pinned: T[], open: T[], recent: (string | null)[], month?: number) =>
  orderCandidates(pinned, open, recent, month).slice(0, 3)

export type PlanCandidate = Awaited<ReturnType<typeof keywordPlanFor>>[number]

/** One line per candidate for the topic picker; the exact keyword is what it copies back. */
export const planSignal = (cluster: PlanCandidate) => {
  const related = (cluster.keywords as { keyword: string }[])
    .slice(1, 5)
    .map((entry) => entry.keyword)
    .join(', ')
  return [
    `keyword "${cluster.keyword}"`,
    cluster.volume ? `about ${cluster.volume} searches a month` : 'search volume unknown',
    cluster.difficulty == null ? null : `difficulty ${cluster.difficulty}/100`,
    `${cluster.intent} intent`,
    themeOf(cluster) ? `theme "${themeOf(cluster)}"` : null,
    cluster.peakMonth ? `searches peak in ${MONTHS[cluster.peakMonth - 1]}` : null,
    cluster.trend != null && Math.abs(cluster.trend) >= 50
      ? `demand ${cluster.trend > 0 ? 'up' : 'down'} ${Math.abs(cluster.trend)}% year on year`
      : null,
    cluster.aiOverview ? 'Google shows an AI overview' : null,
    cluster.status === 'PINNED' ? 'pinned by the editor' : null,
    cluster.opportunity
      ? `unanswered need: ${cluster.opportunity.angle}; why: ${cluster.opportunity.reason}; evidence: ${cluster.opportunity.evidence}`
      : null,
    related ? `related: ${related}` : null,
    cluster.questions.length ? `readers ask: ${cluster.questions.slice(0, 3).join(' | ')}` : null,
  ]
    .filter(Boolean)
    .join('; ')
}

export const sameKeyword = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

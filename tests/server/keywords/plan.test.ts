import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dataForSeo = vi.fn()
vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo, hasDataForSeo: () => true }))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

/** The seed call answers with fixed phrases; the scope call keeps the numbers listed in `keep`. */
const mockModels = (keep: (items: string[]) => number[] = (items) => items.map((_, index) => index + 1)) => {
  vi.stubGlobal('aiModel', (task: string) => task)
  vi.stubGlobal('recordAiUsage', vi.fn())
  vi.mocked(generateText).mockImplementation((async ({ model, prompt }: { model: string; prompt: string }) => {
    if (model === 'keywordSeeds') return { output: { seeds: ['domácí espresso', 'pražírna', 'mlýnek'] }, usage: {} }
    if (model === 'keywordOpportunity') {
      const candidates = JSON.parse(String(prompt).split('## CANDIDATES\n')[1]!) as unknown[]
      return {
        output: {
          decisions: candidates.map((_, index) => ({
            item: index + 1,
            write: true,
            coveredBy: 0,
            duplicateOf: 0,
            articleFit: 'strong',
            specificity: 'focused',
            intent: 'informational',
            angle: 'Jak připravit espresso doma?',
            reason: 'Otázka pro domácí baristy.',
          })),
        },
        usage: {},
      }
    }
    const items = String(prompt).split('## ITEMS\n')[1]!.split('\n')
    return { output: { keep: keep(items) }, usage: {} }
  }) as never)
}

const {
  clusterIdeas,
  clusterScore,
  difficultyCeiling,
  ideaFromLabs,
  isKeywordCovered,
  isPlanStale,
  pickCandidates,
  keywordPlanFor,
  planProfile,
  planSignal,
  refreshKeywordPlan,
  serpSignals,
} = await import('../../../server/utils/keywords/plan')

const idea = (
  keyword: string,
  volume: number | null,
  core: string | null,
  intent = 'informational',
  difficulty = 20,
) => ({ keyword, volume, core, intent, difficulty })

describe('clusterIdeas', () => {
  it('groups synonyms by core keyword and leads with the most searched one', () => {
    const [cluster] = clusterIdeas([
      idea('káva doma', 90, 'káva domácí'),
      idea('domácí káva', 400, 'káva domácí'),
      idea('jak připravit kávu doma', null, 'káva domácí'),
    ])
    expect(cluster).toMatchObject({ keyword: 'domácí káva', volume: 400, intent: 'informational' })
    expect(cluster!.keywords.map((entry) => entry.keyword)).toEqual([
      'domácí káva',
      'káva doma',
      'jak připravit kávu doma',
    ])
  })

  it('drops navigational searches and only discounts transactional ones', () => {
    const clusters = clusterIdeas([
      idea('výběrová káva praha', 9000, null, 'navigational'),
      idea('výběrová káva', 300, null, 'transactional'),
      idea('jak vybrat mlýnek', 300, null, 'informational'),
    ])
    expect(clusters.map((cluster) => cluster.keyword)).toEqual(['jak vybrat mlýnek', 'výběrová káva'])
  })

  it('merges word-order and accent variants, which Labs rarely clusters for Czech', () => {
    const clusters = clusterIdeas([idea('výběrová káva', 720, null), idea('káva výběrová', 10, 'výběrová káva')])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toMatchObject({ keyword: 'výběrová káva', volume: 720 })
  })

  it('ranks easier and bigger topics first', () => {
    const clusters = clusterIdeas([
      idea('hard', 1000, null, 'informational', 90),
      idea('easy', 1000, null, 'informational', 10),
    ])
    expect(clusters.map((cluster) => cluster.keyword)).toEqual(['easy', 'hard'])
  })
})

describe('clusterScore', () => {
  it('treats an unknown volume as some demand, not none', () => {
    expect(clusterScore({ volume: 0, difficulty: 20, intent: 'informational' })).toBeGreaterThan(0)
  })

  it('discounts a topic above the blog difficulty ceiling instead of dropping it', () => {
    const topic = { volume: 500, difficulty: 45, intent: 'informational' }
    expect(clusterScore(topic, 20)).toBeGreaterThan(0)
    expect(clusterScore(topic, 20)).toBeLessThan(clusterScore(topic, 60) / 2)
  })

  it('discounts commercial intent', () => {
    const informational = clusterScore({ volume: 500, difficulty: 30, intent: 'informational' })
    expect(clusterScore({ volume: 500, difficulty: 30, intent: 'commercial' })).toBeLessThan(informational)
  })
})

describe('difficultyCeiling', () => {
  it('starts low for a blog without proven rankings', () => {
    expect(difficultyCeiling([])).toBe(20)
    expect(difficultyCeiling([{ difficulty: 50, position: 25 }])).toBe(20)
  })

  it('rises to the hardest top-10 topic plus a margin', () => {
    expect(
      difficultyCeiling([
        { difficulty: 34, position: 4 },
        { difficulty: 60, position: 18 },
        { difficulty: null, position: 1 },
      ]),
    ).toBe(44)
  })
})

describe('pickCandidates', () => {
  const topic = (keyword: string, pillar: string | null) => ({ keyword, pillar })
  const open = [topic('a1', 'a'), topic('b1', 'b'), topic('b2', 'b'), topic('a2', 'a'), topic('c1', 'c')]

  it('continues the pillar of the last article with two topics and adds the best other one', () => {
    expect(pickCandidates([], open, ['a']).map((c) => c.keyword)).toEqual(['a1', 'a2', 'b1'])
  })

  it('rests a pillar after three topics in a row', () => {
    expect(pickCandidates([], open, ['a', 'a', 'a']).map((c) => c.keyword)).toEqual(['b1', 'b2', 'c1'])
  })

  it('keeps pinned topics first', () => {
    expect(pickCandidates([topic('p', 'c')], open, ['a']).map((c) => c.keyword)).toEqual(['p', 'a1', 'a2'])
  })

  it('ranks by score alone without history', () => {
    expect(pickCandidates([], open, []).map((c) => c.keyword)).toEqual(['a1', 'b1', 'b2'])
  })

  it('still offers topics when the blog has only one pillar', () => {
    expect(pickCandidates([], [topic('a1', 'a'), topic('a2', 'a')], ['a', 'a', 'a']).map((c) => c.keyword)).toEqual([
      'a1',
      'a2',
    ])
  })
})

describe('ideaFromLabs', () => {
  it('reads the DataForSEO Labs item shape', () => {
    expect(
      ideaFromLabs({
        keyword: 'výběrová káva',
        keyword_info: { search_volume: 1300 },
        keyword_properties: { keyword_difficulty: 24, core_keyword: 'káva výběrová' },
        search_intent_info: { main_intent: 'informational' },
      }),
    ).toEqual({
      keyword: 'výběrová káva',
      volume: 1300,
      difficulty: 24,
      intent: 'informational',
      core: 'káva výběrová',
      pillar: null,
    })
  })
})

describe('isKeywordCovered', () => {
  it('matches every keyword word against one title, ignoring case and diacritics', () => {
    expect(isKeywordCovered('výběrová káva', ['Co je VYBEROVA kava a proč je dražší'])).toBe(true)
    expect(isKeywordCovered('výběrová káva doma', ['Co je výběrová káva'])).toBe(false)
  })
})

describe('serpSignals', () => {
  it('collects reader questions, AI overview and ranking domains in rank order', () => {
    expect(
      serpSignals([
        { type: 'organic', rank_absolute: 3, domain: 'b.cz' },
        {
          type: 'people_also_ask',
          items: [{ title: 'Jak dlouho vydrží káva?' }, { title: 'Jak dlouho vydrží káva?' }],
        },
        { type: 'ai_overview' },
        { type: 'organic', rank_absolute: 1, domain: 'a.cz' },
      ]),
    ).toMatchObject({ questions: ['Jak dlouho vydrží káva?'], aiOverview: true, domains: ['a.cz', 'b.cz'] })
  })

  it('copes with a SERP without items', () => {
    expect(serpSignals(null)).toEqual({ questions: [], aiOverview: false, domains: [], organic: [] })
  })
})

describe('planSignal', () => {
  it('gives the picker the exact keyword and what makes it worth writing', () => {
    const line = planSignal({
      id: 'c1',
      keyword: 'výběrová káva',
      keywords: [{ keyword: 'výběrová káva' }, { keyword: 'specialty coffee' }],
      volume: 1300,
      difficulty: 24,
      intent: 'informational',
      questions: ['Proč je dražší?'],
      aiOverview: true,
      status: 'PINNED',
      pillar: null,
      opportunity: {
        reason: 'Dosud nepokrytý dotaz.',
        angle: 'Jak připravit kávu?',
        evidence: 'metrics',
        articleFit: 'possible',
        organic: [],
        profile: '',
        checkedAt: '',
      },
    })
    expect(line).toContain('keyword "výběrová káva"')
    expect(line).toContain('about 1300 searches a month')
    expect(line).toContain('pinned by the editor')
    expect(line).toContain('related: specialty coffee')
    expect(line).toContain('readers ask: Proč je dražší?')
    expect(line).toContain('unanswered need: Jak připravit kávu?')
  })
})

describe('isPlanStale', () => {
  const site = { id: 's1', language: 'cs' as const, focus: 'RPG hry', keywords: ['rpg'] }
  const now = new Date('2026-10-04T12:00:00Z')
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000)

  it('rebuilds monthly', () => {
    expect(
      isPlanStale({ ...site, keywordPlanProfile: planProfile(site), keywordPlanRefreshedAt: hoursAgo(24 * 29) }, now),
    ).toBe(false)
    expect(
      isPlanStale({ ...site, keywordPlanProfile: planProfile(site), keywordPlanRefreshedAt: hoursAgo(24 * 31) }, now),
    ).toBe(true)
  })

  it('invalidates changed focus, language and market immediately', () => {
    const changed = { ...site, focus: 'Akční hry', keywordPlanProfile: planProfile(site) }
    expect(isPlanStale({ ...changed, keywordPlanRefreshedAt: hoursAgo(2) }, now)).toBe(true)
    expect(isPlanStale({ ...changed, keywordPlanRefreshedAt: hoursAgo(25) }, now)).toBe(true)
    expect(planProfile({ ...site, language: 'en' })).not.toBe(planProfile(site))
    expect(planProfile({ ...site, keywordMarket: 'GLOBAL' })).not.toBe(planProfile(site))
  })
})

describe('keywordPlanFor', () => {
  const db = {
    clientSite: { updateMany: vi.fn(), update: vi.fn() },
    keywordCluster: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    article: { findMany: vi.fn() },
  }
  const site = { id: 's1', language: 'cs' as const, keywords: ['káva', 'espresso', 'mlýnek'] }
  const DAY = 86_400_000

  beforeEach(() => {
    vi.stubGlobal('prisma', { ...db, $transaction: (run: (tx: typeof db) => unknown) => run(db) })
    vi.stubGlobal('logAction', vi.fn())
    mockModels()
    db.keywordCluster.findMany.mockResolvedValue([])
    db.clientSite.updateMany.mockResolvedValue({ count: 0 })
    db.article.findMany.mockResolvedValue([])
    dataForSeo.mockResolvedValue({ result: { items: [] }, cost: 0.02 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('does not pay for a plan that is still fresh', async () => {
    await keywordPlanFor({
      ...site,
      keywordPlanProfile: planProfile(site),
      keywordPlanRefreshedAt: new Date(),
      keywordPlanAttemptedAt: new Date(),
    })
    expect(db.clientSite.updateMany).not.toHaveBeenCalled()
    expect(dataForSeo).not.toHaveBeenCalled()
  })

  it('leaves the rebuild to the run that won the claim', async () => {
    db.clientSite.updateMany.mockResolvedValue({ count: 0 })
    await keywordPlanFor({ ...site, keywordPlanRefreshedAt: null })
    expect(db.clientSite.updateMany.mock.calls[0]![0].where).toEqual({ id: 's1', keywordPlanAttemptedAt: null })
    expect(dataForSeo).not.toHaveBeenCalled()
  })

  it('claims a one-day lease, so a failed or crashed rebuild retries tomorrow, not every slot', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.clientSite.updateMany.mockResolvedValue({ count: 1 })
    dataForSeo.mockRejectedValue(new Error('DataForSEO down'))
    const now = new Date('2026-10-04T00:00:00Z')
    await keywordPlanFor({ ...site, keywordPlanRefreshedAt: new Date('2026-08-01T00:00:00Z') }, now)

    const lease = db.clientSite.updateMany.mock.calls[0]![0].data
    expect(lease).toEqual({ keywordPlanAttemptedAt: now })
    const leased = { ...site, ...lease }
    const attempts = db.clientSite.updateMany.mock.calls.length
    await keywordPlanFor(leased, new Date(now.getTime() + 12 * 3_600_000))
    expect(db.clientSite.updateMany).toHaveBeenCalledTimes(attempts)
    await keywordPlanFor(leased, new Date(now.getTime() + 25 * 3_600_000))
    expect(db.clientSite.updateMany).toHaveBeenCalledTimes(attempts + 1)
    expect(db.clientSite.update).not.toHaveBeenCalled()
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'KEYWORD_PLAN_REFRESH_FAILED' }))
  })

  it('offers pinned topics before the best open ones, three at most', async () => {
    const opportunity = {
      reason: 'Dosud nepokryté.',
      angle: 'Čtenářská otázka',
      articleFit: 'possible',
      evidence: 'metrics',
      organic: [],
      profile: planProfile(site),
      checkedAt: '',
    }
    db.keywordCluster.findMany
      .mockResolvedValueOnce([{ keyword: 'p1', opportunity }])
      .mockResolvedValueOnce(
        [{ keyword: 'o1' }, { keyword: 'o2' }, { keyword: 'o3' }].map((row) => ({ ...row, opportunity })),
      )
    const plan = await keywordPlanFor({
      ...site,
      keywordPlanRefreshedAt: new Date(),
      keywordPlanAttemptedAt: new Date(),
    })
    expect(plan.map((cluster) => cluster.keyword)).toEqual(['p1', 'o1', 'o2'])
  })

  it('refills a plan the blog used up after the cooldown, even before the monthly refresh', async () => {
    db.clientSite.updateMany.mockResolvedValue({ count: 1 })
    db.keywordCluster.count.mockResolvedValue(3)
    await keywordPlanFor({
      ...site,
      keywordPlanProfile: planProfile(site),
      keywordPlanRefreshedAt: new Date(Date.now() - 3 * DAY),
      keywordPlanAttemptedAt: new Date(Date.now() - 2 * DAY),
    })
    expect(dataForSeo).toHaveBeenCalled()
    expect(db.clientSite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ keywordPlanProfile: planProfile(site) }) }),
    )
  })

  it('does not pay daily for a niche whose last rebuild found too few topics', async () => {
    db.clientSite.updateMany.mockResolvedValue({ count: 1 })
    db.keywordCluster.count.mockResolvedValue(1)
    const narrow = {
      ...site,
      keywordPlanProfile: planProfile(site),
      keywordPlanRefreshedAt: new Date(Date.now() - 3 * DAY),
      keywordPlanAttemptedAt: new Date(Date.now() - 3 * DAY),
    }
    await keywordPlanFor(narrow)
    expect(db.clientSite.updateMany).not.toHaveBeenCalled()

    await keywordPlanFor(narrow, new Date(Date.now() + 5 * DAY))
    expect(db.clientSite.updateMany).toHaveBeenCalledTimes(1)
  })

  it('does not offer a pinned topic assessed for a different market', async () => {
    db.keywordCluster.findMany.mockResolvedValueOnce([
      {
        keyword: 'old',
        opportunity: {
          reason: 'Old',
          angle: 'Old',
          articleFit: 'possible',
          evidence: 'metrics',
          organic: [],
          profile: 'different',
          checkedAt: '',
        },
      },
    ])
    await expect(keywordPlanFor({ ...site, keywordPlanAttemptedAt: new Date() })).resolves.toEqual([])
  })
})

describe('refreshKeywordPlan', () => {
  const tx = {
    keywordCluster: { update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    clientSite: { update: vi.fn() },
  }
  const findClusters = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('prisma', {
      article: { findMany: vi.fn().mockResolvedValue([{ title: 'Jak vybrat mlýnek na kávu' }]) },
      // Rows carry their status, so each status query sees only its own rows.
      keywordCluster: {
        findMany: async (args: { where?: { status?: unknown } }) => {
          const rows: { status?: string }[] = await findClusters(args)
          const status = args?.where?.status
          return typeof status === 'string' ? rows.filter((row) => row.status === status) : rows
        },
      },
      $transaction: (run: (client: typeof tx) => unknown) => run(tx),
    })
    vi.stubGlobal('logAction', vi.fn())
    mockModels()
    findClusters.mockResolvedValue([
      { id: 'pinned', keyword: 'espresso doma', status: 'PINNED' },
      { id: 'gone', keyword: 'stará káva', status: 'OPEN' },
      { id: 'skipped', keyword: 'kávovar', status: 'SKIPPED' },
    ])
    dataForSeo.mockImplementation(async (path: string) =>
      path.includes('keyword_suggestions')
        ? {
            cost: 0.03,
            result: {
              items: [
                {
                  keyword: 'espresso doma',
                  keyword_info: { search_volume: 500 },
                  search_intent_info: { main_intent: 'informational' },
                },
                {
                  keyword: 'mlýnek na kávu',
                  keyword_info: { search_volume: 900 },
                  search_intent_info: { main_intent: 'informational' },
                },
              ],
            },
          }
        : { cost: 0.002, result: { items: [{ type: 'people_also_ask', items: [{ title: 'Jaký tlak?' }] }] } },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('keeps editorial state, drops covered and outdated open topics', async () => {
    await expect(
      refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['espresso', 'káva', 'mlýnek'] }),
    ).resolves.toBe(1)

    const seedCalls = dataForSeo.mock.calls.filter(([path]) => String(path).includes('keyword_suggestions'))
    expect(seedCalls.map(([, task]) => task.keyword)).toEqual(['espresso', 'káva', 'mlýnek'])
    expect(seedCalls[0]![1]).toMatchObject({ location_code: 2203, language_code: 'cs', include_seed_keyword: true })
    // "mlýnek na kávu" is covered by an existing title; only the pinned topic is refreshed in place.
    expect(tx.keywordCluster.create).not.toHaveBeenCalled()
    expect(tx.keywordCluster.update.mock.calls[0]![0]).toMatchObject({
      where: { id: 'pinned' },
      data: { keyword: 'espresso doma', questions: ['Jaký tlak?'] },
    })
    expect(tx.keywordCluster.update.mock.calls[0]![0].data).not.toHaveProperty('status')
    expect(tx.keywordCluster.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['gone'] }, status: 'OPEN' } })
    expect(tx.clientSite.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { keywordPlanRefreshedAt: expect.any(Date), keywordPlanProfile: expect.any(String) },
    })
    // Three tenant keywords are seeds enough: no model call stands in for search data. The only
    // uncovered suggestion is pinned, which skips the scope pre-filter for the full assessment.
    expect(vi.mocked(generateText).mock.calls.map(([call]) => (call as { model: string }).model)).toEqual([
      'keywordOpportunity',
    ])
  })

  it('reassesses a pinned topic the suggestions no longer return, so the pin stays usable', async () => {
    findClusters.mockResolvedValue([
      {
        id: 'old-pin',
        keyword: 'espresso na cesty',
        status: 'PINNED',
        keywords: [{ keyword: 'espresso na cesty', volume: 40 }],
        volume: 40,
        difficulty: 12,
        intent: 'informational',
        pillar: 'espresso',
      },
    ])
    await refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['espresso', 'káva', 'mlýnek'] })

    const serpKeywords = dataForSeo.mock.calls
      .filter(([path]) => String(path).includes('/serp/'))
      .map(([, task]) => task.keyword)
    expect(serpKeywords).toContain('espresso na cesty')
    const pin = tx.keywordCluster.update.mock.calls.find(([call]) => call.where.id === 'old-pin')![0]
    expect(pin.data).toMatchObject({ keyword: 'espresso na cesty', opportunity: { profile: expect.any(String) } })
    expect(pin.data).not.toHaveProperty('status')
    // The pin skips the scope pre-filter; only the full assessment may drop it.
    const scopePrompts = vi
      .mocked(generateText)
      .mock.calls.filter(([call]) => (call as { model: string }).model === 'topicScope')
      .map(([call]) => String((call as { prompt: string }).prompt))
    expect(scopePrompts.join(' ')).not.toContain('espresso na cesty')
  })

  it('rewords the focus as seeds only when the tenant has fewer than three keywords', async () => {
    findClusters.mockResolvedValue([])
    await refreshKeywordPlan({ id: 's1', language: 'cs', focus: 'Káva doma', keywords: ['espresso'] })
    const seeds = dataForSeo.mock.calls
      .filter(([path]) => String(path).includes('keyword_suggestions'))
      .map(([, task]) => task.keyword)
    expect(seeds).toEqual(['espresso', 'domácí espresso', 'pražírna', 'mlýnek'])
  })

  it('tags each topic with the seed that suggested it as its pillar', async () => {
    findClusters.mockResolvedValue([])
    await refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['espresso', 'káva', 'mlýnek'] })
    expect(tx.keywordCluster.create.mock.calls[0]![0].data).toMatchObject({
      keyword: 'espresso doma',
      pillar: 'espresso',
    })
  })

  it('asks Labs worldwide for a GLOBAL market but keeps a country for the SERP', async () => {
    findClusters.mockResolvedValue([])
    await refreshKeywordPlan({ id: 's1', language: 'en', keywordMarket: 'GLOBAL', keywords: ['rpg', 'jrpg', 'crpg'] })
    const labs = dataForSeo.mock.calls.find(([path]) => String(path).includes('keyword_suggestions'))![1]
    const serp = dataForSeo.mock.calls.find(([path]) => String(path).includes('/serp/'))![1]
    expect(labs).not.toHaveProperty('location_code')
    expect(labs).toMatchObject({ language_code: 'en' })
    expect(serp).toMatchObject({ location_code: 2840, language_code: 'en' })
  })

  it('drops topics the scope check rejects', async () => {
    findClusters.mockResolvedValue([])
    mockModels(() => [])
    await expect(
      refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['espresso', 'káva', 'mlýnek'] }),
    ).resolves.toBe(0)
    expect(tx.keywordCluster.create).not.toHaveBeenCalled()
    expect(dataForSeo.mock.calls.some(([path]) => String(path).includes('/serp/'))).toBe(false)
  })

  it('checks relevance before limiting the plan so broad popular queries do not crowd out a niche', async () => {
    findClusters.mockResolvedValue([])
    dataForSeo.mockImplementation(async (path: string) =>
      path.includes('keyword_suggestions')
        ? {
            cost: 0.01,
            result: {
              items: [
                ...Array.from({ length: 60 }, (_, index) => ({
                  keyword: `cizí téma ${index}`,
                  keyword_info: { search_volume: 10000 },
                })),
                { keyword: 'kyselé espresso', keyword_info: { search_volume: 90 } },
              ],
            },
          }
        : { cost: 0.002, result: { items: [] } },
    )
    mockModels((items) => items.flatMap((item, index) => (item.includes('kyselé espresso') ? [index + 1] : [])))
    await expect(
      refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['káva', 'espresso', 'mlýnek'] }),
    ).resolves.toBe(1)
    expect(tx.keywordCluster.create.mock.calls[0]![0].data.keyword).toBe('kyselé espresso')
  })

  it('keeps the previous plan when opportunity assessment fails', async () => {
    const original = vi.mocked(generateText).getMockImplementation()!
    vi.mocked(generateText).mockImplementation(((params: { model: string }) => {
      if (params.model === 'keywordOpportunity') throw new Error('assessment unavailable')
      return original(params as never)
    }) as never)
    await expect(
      refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['káva', 'espresso', 'mlýnek'] }),
    ).rejects.toThrow('assessment unavailable')
    expect(tx.keywordCluster.deleteMany).not.toHaveBeenCalled()
    expect(tx.clientSite.update).not.toHaveBeenCalled()
  })

  it('keeps the previous plan when every SERP call fails', async () => {
    const original = dataForSeo.getMockImplementation()!
    dataForSeo.mockImplementation(async (path: string, task: unknown) => {
      if (path.includes('/serp/')) throw new Error('402 Payment Required')
      return original(path, task)
    })
    await expect(
      refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['káva', 'espresso', 'mlýnek'] }),
    ).rejects.toThrow('No SERP evidence')
    expect(tx.keywordCluster.deleteMany).not.toHaveBeenCalled()
    expect(tx.clientSite.update).not.toHaveBeenCalled()
  })

  it('keeps the seeds that answered when another one fails', async () => {
    findClusters.mockResolvedValue([])
    const answer = dataForSeo.getMockImplementation()!
    dataForSeo.mockImplementation(async (path: string, task: { keyword: string }) => {
      if (task.keyword === 'káva') throw new Error('timeout')
      return answer(path, task)
    })
    await expect(
      refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['espresso', 'káva', 'mlýnek'] }),
    ).resolves.toBe(1)
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KEYWORD_PLAN_REFRESHED',
        metadata: expect.objectContaining({ failedSeeds: 1 }),
      }),
    )
  })

  it('fails when every seed fails, so nothing half-empty replaces the plan', async () => {
    dataForSeo.mockRejectedValue(new Error('DataForSEO down'))
    await expect(
      refreshKeywordPlan({ id: 's1', language: 'cs', keywords: ['espresso', 'káva', 'mlýnek'] }),
    ).rejects.toThrow('DataForSEO down')
    expect(tx.keywordCluster.deleteMany).not.toHaveBeenCalled()
  })
})

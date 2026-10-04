import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dataForSeo = vi.fn()
vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo, hasDataForSeo: () => true }))

const { blogPosition, checkDueRanks, firstRankCheck, nextRankCheck, rankHistoryFor } =
  await import('../../../server/utils/keywords/rank')

const DAY = 86_400_000
const USED = new Date('2026-09-01T00:00:00Z')
const day = (n: number) => new Date(USED.getTime() + n * DAY)

describe('rank schedule', () => {
  it('first checks a week after the article', () => {
    expect(firstRankCheck(USED)).toEqual(day(7))
  })

  it('follows 7, 30, 60 and 90 days, even when a check ran late', () => {
    expect(nextRankCheck(USED, null, day(7))).toEqual(day(30))
    expect(nextRankCheck(USED, 40, day(31))).toEqual(day(60))
    expect(nextRankCheck(USED, null, day(60))).toEqual(day(90))
  })

  it('then checks monthly only while the page ranks, and stops after a year', () => {
    expect(nextRankCheck(USED, 12, day(90))).toEqual(day(120))
    expect(nextRankCheck(USED, null, day(90))).toBeNull()
    expect(nextRankCheck(USED, 3, day(370))).toBeNull()
  })
})

describe('blogPosition', () => {
  it('takes the best organic position of any page on the blog host, with or without www', () => {
    expect(
      blogPosition(
        [
          { type: 'featured_snippet', rank_group: 1, domain: 'kava.topiqu.com', url: 'https://kava.topiqu.com/x' },
          { type: 'organic', rank_group: 9, domain: 'www.kava.topiqu.com', url: 'https://kava.topiqu.com/b' },
          { type: 'organic', rank_group: 4, domain: 'kava.topiqu.com', url: 'https://kava.topiqu.com/a' },
          { type: 'organic', rank_group: 1, domain: 'other.cz', url: 'https://other.cz' },
        ],
        'kava.topiqu.com',
      ),
    ).toEqual({ position: 4, url: 'https://kava.topiqu.com/a' })
  })

  it('reports no position when the blog is not in the checked depth', () => {
    expect(blogPosition([{ type: 'organic', rank_group: 1, domain: 'other.cz' }], 'kava.cz')).toEqual({
      position: null,
      url: null,
    })
  })
})

describe('checkDueRanks', () => {
  const update = vi.fn()
  const findMany = vi.fn()
  const claim = vi.fn()
  const site = { domain: 'kava.cz', language: 'cs' as const, keywordMarket: null }
  const cluster = (id: string, status: string | null, rankHistory: unknown = null) => ({
    id,
    clientSiteId: 's1',
    keyword: 'výběrová káva',
    usedAt: day(0),
    rankHistory,
    article: status ? { status, publishedAt: USED } : null,
    nextRankCheckAt: day(7),
    clientSite: site,
  })

  beforeEach(() => {
    vi.stubGlobal('prisma', { keywordCluster: { findMany, update, updateMany: claim } })
    claim.mockResolvedValue({ count: 1 })
    vi.stubGlobal('logAction', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('records the position, keeps history and logs the spend per tenant', async () => {
    const context = { location: 2203, language: 'cs', domain: 'kava.cz' }
    findMany.mockResolvedValue([
      cluster('c1', 'published', [{ at: day(7).toISOString(), position: null, url: null, ...context }]),
    ])
    dataForSeo.mockResolvedValue({
      cost: 0.006,
      result: { items: [{ type: 'organic', rank_group: 8, domain: 'kava.cz', url: 'https://kava.cz/a' }] },
    })

    await expect(checkDueRanks(day(30))).resolves.toEqual({ checked: 1, failed: 0, costUsd: 0.006 })
    expect(dataForSeo.mock.calls[0]![1]).toMatchObject({ keyword: 'výběrová káva', location_code: 2203, depth: 30 })
    expect(update.mock.calls[0]![0].data).toEqual({
      position: 8,
      rankHistory: [
        { at: day(7).toISOString(), position: null, url: null, ...context },
        { at: day(30).toISOString(), position: 8, url: 'https://kava.cz/a', ...context },
      ],
      nextRankCheckAt: day(60),
    })
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KEYWORD_RANKS_CHECKED',
        clientSiteId: 's1',
        metadata: { checked: 1, costUsd: 0.006 },
      }),
    )
  })

  it('postpones a draft, stops for a deleted article and retries a failed call tomorrow', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    findMany.mockResolvedValue([cluster('draft', 'draft'), cluster('gone', null), cluster('fail', 'published')])
    dataForSeo.mockRejectedValue(new Error('timeout'))

    await expect(checkDueRanks(day(7))).resolves.toMatchObject({ checked: 0, failed: 1 })
    const next = Object.fromEntries(update.mock.calls.map(([call]) => [call.where.id, call.data.nextRankCheckAt]))
    expect(next).toEqual({ draft: day(14), gone: null, fail: day(8) })
  })

  it('does not pay twice when another run already claimed the check', async () => {
    findMany.mockResolvedValue([cluster('c1', 'published')])
    claim.mockResolvedValue({ count: 0 })
    await expect(checkDueRanks(day(7))).resolves.toEqual({ checked: 0, failed: 0, costUsd: 0 })
    expect(dataForSeo).not.toHaveBeenCalled()
  })

  it('starts the schedule from publication after a draft waited for approval', async () => {
    const row = cluster('c1', 'published')
    row.article!.publishedAt = day(80)
    findMany.mockResolvedValue([row])
    await checkDueRanks(day(82))
    expect(dataForSeo).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { nextRankCheckAt: day(87) } })
  })

  it('does not mix a changed market, language or domain with the previous ranking history', () => {
    const points = [
      { at: '', position: 3, url: 'https://kava.cz/a', location: 2203, language: 'cs', domain: 'kava.cz' },
      { at: '', position: 2, url: 'https://kava.cz/a', location: 2840, language: 'en', domain: 'kava.cz' },
      { at: '', position: 1, url: 'https://old.cz/a', location: 2203, language: 'cs', domain: 'old.cz' },
    ]
    expect(rankHistoryFor(points, site)).toEqual([points[0]])
    expect(rankHistoryFor(points, { ...site, language: 'en', keywordMarket: 'US' })).toEqual([points[1]])
  })
})

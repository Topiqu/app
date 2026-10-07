// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo: vi.fn(), hasDataForSeo: () => true }))
const fetchPage = vi.fn()
vi.mock('../../../server/utils/backlinks/page', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/utils/backlinks/page')>()),
  fetchPage,
}))

const { checkDueBacklinks, checkOpportunity } = await import('../../../server/utils/backlinks/check')

const DAY = 86_400_000
const NOW = new Date('2026-10-07T06:30:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * DAY)
const later = (days: number) => new Date(NOW.getTime() + days * DAY)
const clientSite = { domain: 'alfa.topiqu.com', websiteUrl: 'https://kavovar-alfa.cz' }
const link = { href: 'https://kavovar-alfa.cz/', rel: ['nofollow'], anchor: 'Alfa' }
const page = (links: unknown[]) => ({ status: 'ok', title: null, text: '', links, contactUrl: null })

let db: Record<string, Record<string, ReturnType<typeof vi.fn>>>

beforeEach(() => {
  db = {
    backlinkOpportunity: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn(), update: vi.fn() },
    backlink: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  }
  db.backlinkOpportunity.updateMany!.mockResolvedValue({ count: 1 })
  vi.stubGlobal('prisma', db)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const request = (sentDaysAgo: number) => ({
  id: 'o1',
  clientSiteId: 's1',
  sourceUrl: 'https://blog.cz/a',
  sourceDomain: 'blog.cz',
  status: 'SENT',
  sentAt: ago(sentDaysAgo),
  nextCheckAt: ago(0),
  clientSite,
})

describe('checkOpportunity', () => {
  it('marks a request WON and records the link once the page links to any owned host', async () => {
    fetchPage.mockResolvedValue(page([link]))
    expect(await checkOpportunity(request(10), NOW)).toBe('won')
    expect(fetchPage).toHaveBeenCalledWith('https://blog.cz/a', ['alfa.topiqu.com', 'kavovar-alfa.cz'])
    expect(db.backlinkOpportunity.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'WON', decidedAt: NOW, nextCheckAt: null },
    })
    expect(db.backlink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ opportunityId: 'o1', rel: ['nofollow'] }) }),
    )
  })

  it('checks a sent request again in a week until it expires after 60 days', async () => {
    fetchPage.mockResolvedValue(page([]))
    expect(await checkOpportunity(request(10), NOW)).toBe('missing')
    expect(db.backlinkOpportunity.update).toHaveBeenLastCalledWith({
      where: { id: 'o1' },
      data: { nextCheckAt: later(7) },
    })
    expect(await checkOpportunity(request(61), NOW)).toBe('expired')
    expect(db.backlinkOpportunity.update).toHaveBeenLastCalledWith({
      where: { id: 'o1' },
      data: { status: 'EXPIRED', decidedAt: NOW, nextCheckAt: null },
    })
  })

  it('leaves an OPEN opportunity as it is when there is no link yet', async () => {
    fetchPage.mockResolvedValue(page([]))
    expect(await checkOpportunity({ ...request(0), status: 'OPEN', sentAt: null }, NOW)).toBe('missing')
    expect(db.backlinkOpportunity.update).not.toHaveBeenCalled()
  })
})

describe('checkDueBacklinks', () => {
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 'b1',
    clientSiteId: 's1',
    sourceUrl: 'https://blog.cz/a',
    sourceDomain: 'blog.cz',
    lastSeenAt: ago(7),
    missedChecks: 0,
    nextCheckAt: ago(0),
    clientSite,
    ...overrides,
  })

  it('skips a request another run claimed', async () => {
    db.backlinkOpportunity.findMany!.mockResolvedValue([request(10)])
    db.backlinkOpportunity.updateMany!.mockResolvedValue({ count: 0 })
    await checkDueBacklinks(NOW)
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('refreshes a live link', async () => {
    db.backlink.findMany!.mockResolvedValue([stored()])
    fetchPage.mockResolvedValue(page([link]))
    expect(await checkDueBacklinks(NOW)).toMatchObject({ live: 1, lost: 0 })
    expect(db.backlink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ lastSeenAt: NOW, missedChecks: 0, lostAt: null, nextCheckAt: later(7) }),
      }),
    )
  })

  it('needs two misses in a row before a link is lost', async () => {
    fetchPage.mockResolvedValue(page([]))
    db.backlink.findMany!.mockResolvedValue([stored()])
    expect(await checkDueBacklinks(NOW)).toMatchObject({ lost: 0 })
    expect(db.backlink.update).toHaveBeenLastCalledWith({ where: { id: 'b1' }, data: { missedChecks: 1 } })

    db.backlink.findMany!.mockResolvedValue([stored({ missedChecks: 1 })])
    expect(await checkDueBacklinks(NOW)).toMatchObject({ lost: 1 })
    expect(db.backlink.update).toHaveBeenLastCalledWith({
      where: { id: 'b1' },
      data: { missedChecks: 2, lostAt: NOW, nextCheckAt: null },
    })
  })

  it('counts a missing page as a miss but not a page it could not read', async () => {
    db.backlink.findMany!.mockResolvedValue([stored()])
    fetchPage.mockResolvedValue({ status: 'gone' })
    await checkDueBacklinks(NOW)
    expect(db.backlink.update).toHaveBeenLastCalledWith({ where: { id: 'b1' }, data: { missedChecks: 1 } })

    fetchPage.mockResolvedValue({ status: 'failed' })
    await checkDueBacklinks(NOW)
    expect(db.backlink.update).toHaveBeenLastCalledWith({ where: { id: 'b1' }, data: { nextCheckAt: later(7) } })
  })

  it('counts unreadable pages as misses once the link has not been seen for a month', async () => {
    db.backlink.findMany!.mockResolvedValue([stored({ lastSeenAt: ago(31), missedChecks: 1 })])
    fetchPage.mockResolvedValue({ status: 'failed' })
    expect(await checkDueBacklinks(NOW)).toMatchObject({ lost: 1 })
  })
})

import { createError } from 'h3'
import { afterEach, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/articleViewerAccess'), 'canReadArticle')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (options: { status?: string; budget?: boolean; moderatorCount?: number; reason?: string } = {}) => {
  let readerId = 'u1'
  const claimed = new Set<string>()
  const createMany = vi.fn().mockResolvedValue({ count: 1 })
  const comment = {
    id: 'c1',
    articleId: 'a1',
    deletedAt: null,
    article: {
      clientSiteId: 's1',
      slug: 'article',
      language: 'en',
      title: 'Article',
      userId: 'author',
      status: options.status ?? 'published',
      deletedAt: null,
      releaseAt: null,
      clientSite: { domain: 'example.test', language: 'en', deletedAt: null },
    },
  }
  const tx = { notification: { createMany } }
  const db = {
    comment: { findUnique: vi.fn().mockResolvedValue(comment) },
    ...tx,
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => ({ id: readerId, role: 'reader', name: 'Reader' }))
  vi.stubGlobal('readValidatedBody', async () => ({ commentId: 'c1', reason: options.reason }))
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('getIp', () => '192.0.2.1')
  vi.stubGlobal(
    'consumeRateLimit',
    vi.fn(async (key: string, limit: number) => {
      if (limit !== 1) return options.budget ?? true
      if (claimed.has(key)) return false
      claimed.add(key)
      return true
    }),
  )
  vi.stubGlobal(
    'clearRateLimit',
    vi.fn(async (key: string) => {
      claimed.delete(key)
    }),
  )
  vi.stubGlobal(
    'commentAudience',
    vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: options.moderatorCount ?? 1 }, (_, i) => ({ id: `moderator-${i}`, allowNotifs: true })),
      ),
  )
  const handler = (await import('../../server/api/notifications/index.post')).default
  return {
    run: () => handler({} as never),
    createMany,
    setReader: (id: string) => {
      readerId = id
    },
  }
}

it('suppresses duplicate reports by one reader without suppressing independent reporters', async () => {
  const { run, createMany, setReader } = await setup()
  await run()
  await run()
  expect(createMany).toHaveBeenCalledOnce()
  setReader('u2')
  await run()
  expect(createMany).toHaveBeenCalledTimes(2)
})

it('includes the supplied report reason in the moderator notification', async () => {
  const { run, createMany } = await setup({ reason: 'Spam links unrelated to the article' })
  await run()
  expect(createMany.mock.calls[0]?.[0].data[0].message).toContain('Spam links unrelated to the article')
})

it('does not notify moderators about an inaccessible article', async () => {
  const { run, createMany } = await setup({ status: 'draft' })
  await expect(run()).rejects.toMatchObject({ statusCode: 404 })
  expect(createMany).not.toHaveBeenCalled()
})

it('enforces the report abuse budget before fan-out', async () => {
  const { run, createMany } = await setup({ budget: false })
  await expect(run()).rejects.toMatchObject({ statusCode: 429 })
  expect(createMany).not.toHaveBeenCalled()
})

it('allows retry after notification storage fails without clearing the abuse budgets', async () => {
  const { run, createMany } = await setup()
  createMany.mockRejectedValueOnce(new Error('Storage unavailable'))
  await expect(run()).rejects.toThrow('Storage unavailable')
  await expect(run()).resolves.toMatchObject({ message: 'common.notifications.commentReported' })
  expect(createMany).toHaveBeenCalledTimes(2)
  expect(clearRateLimit).toHaveBeenCalledWith(expect.stringMatching(/^comment-report:target:u1:c1:\d+$/))
  expect(clearRateLimit).toHaveBeenCalledOnce()
})

it('bounds notification statement sizes for a large audience', async () => {
  const { run, createMany } = await setup({ moderatorCount: 1200 })
  await run()
  expect(createMany.mock.calls.flatMap(([args]) => args.data)).toHaveLength(1200)
  expect(createMany.mock.calls.every(([args]) => args.data.length <= 500)).toBe(true)
})

it('does not clear a newer window claim when a delayed old report fails', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
  const { run, createMany } = await setup()
  let fail!: (error: Error) => void
  createMany.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject
      }),
  )
  const old = run().catch((error: Error) => error)
  await vi.waitFor(() => expect(createMany).toHaveBeenCalledOnce())
  vi.setSystemTime(new Date('2026-10-22T12:10:01Z'))
  await run()
  fail(new Error('Old request failed'))
  expect(await old).toBeInstanceOf(Error)
  await run()
  expect(createMany).toHaveBeenCalledTimes(2)
})

beforeEach(stubImports)

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as imagePick from '../../../server/utils/articleImagePick'

type Row = Record<string, unknown> & { articleId: string; status: string; startedAt: Date }
type Where = Record<string, unknown>

let rows: Row[]
const matches = (row: Row, where: Where): boolean =>
  Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return (condition as Where[]).some((part) => matches(row, part))
    const value = row[key]
    if (condition instanceof Date) return (value as Date).getTime() === condition.getTime()
    if (condition && typeof condition === 'object') {
      const { not, gt, lte } = condition as { not?: unknown; gt?: Date; lte?: Date }
      if (not !== undefined) return value !== not
      if (gt) return (value as Date) > gt
      if (lte) return (value as Date) <= lte
    }
    return value === condition
  })
const db = {
  article: { findUnique: vi.fn() },
  articleImagePick: {
    findFirst: async ({ where }: { where: Where }) => rows.find((row) => matches(row, where)) ?? null,
    findUnique: async ({ where }: { where: Where }) => rows.find((row) => matches(row, where)) ?? null,
    updateMany: async ({ where, data }: { where: Where; data: Partial<Row> }) => {
      const hit = rows.filter((row) => matches(row, where))
      hit.forEach((row) => Object.assign(row, data))
      return { count: hit.length }
    },
    create: async ({ data }: { data: Row }) => {
      if (rows.some((row) => row.articleId === data.articleId)) throw Object.assign(new Error('dup'), { code: '23505' })
      rows.push({ ...data })
      return data
    },
  },
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}
type Picked = { content: string; imageUrl: string | null; coverMediaId: string | null; tokens: number }
let runs: ReturnType<typeof deferred<Picked>>[]
let scopes: string[]
let rateLimitLeft: boolean
const recordAiUsage = vi.fn()
const reportCaughtError = vi.fn()
const repickArticleImages = vi.fn()
const article = {
  id: 'article-1',
  clientSiteId: 'site-1',
  userId: 'editor',
  status: 'published',
  editVersion: 7,
  title: 'Kam umístit tepelné čerpadlo',
  excerpt: 'Perex',
  content: '<p>Text</p>',
  language: 'cs',
}

const event = () => {
  const work: Promise<unknown>[] = []
  return { work, waitUntil: (promise: Promise<unknown>) => work.push(promise) }
}
const post = async (e = event()) => {
  const handler = (await import('../../../server/api/articles/[id]/images.post')).default as (e: unknown) => unknown
  return handler(e)
}
const get = async () =>
  ((await import('../../../server/api/articles/[id]/images.get')).default as (e: unknown) => unknown)(event())

beforeEach(() => {
  rows = []
  runs = []
  scopes = ['ARTICLE_WRITE', 'AI_USE']
  rateLimitLeft = true
  vi.clearAllMocks()
  db.article.findUnique.mockResolvedValue(article)
  repickArticleImages.mockImplementation(() => {
    runs.push(deferred())
    return runs.at(-1)!.promise
  })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('requireTenantScope', async () => ({
    user: { id: 'editor', clientSiteId: 'site-1' },
    membership: { scopes },
  }))
  vi.stubGlobal('hasTenantScope', (membership: { scopes: string[] }, scope: string) =>
    membership.scopes.includes(scope),
  )
  vi.stubGlobal('requireAiPlan', async () => {})
  vi.stubGlobal('getRouterParam', () => 'article-1')
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('consumeRateLimit', async () => rateLimitLeft)
  vi.stubGlobal('isUniqueViolation', (error: { code?: string }) => error.code === '23505')
  vi.stubGlobal('withAiAllowance', (_site: string, _kind: string, run: () => unknown) => run())
  vi.stubGlobal('withAiSpend', (_site: string, run: () => unknown) => run())
  vi.stubGlobal('repickArticleImages', repickArticleImages)
  vi.stubGlobal('recordAiUsage', recordAiUsage)
  vi.stubGlobal('reportCaughtError', reportCaughtError)
  vi.stubGlobal('imagePickArticle', imagePick.imagePickArticle)
  vi.stubGlobal('startImagePick', imagePick.startImagePick)
  vi.stubGlobal('imagePickView', imagePick.imagePickView)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('picking the pictures of a saved article in the background', () => {
  it('answers at once and stores the proposal with the article version it was made for', async () => {
    const e = event()
    expect(await post(e)).toMatchObject({ status: 'RUNNING', articleVersion: 7, content: null })
    expect(repickArticleImages).toHaveBeenCalledWith(
      'site-1',
      expect.objectContaining({ id: 'article-1', published: true }),
    )

    runs[0]!.resolve({ content: '<p>Text</p><figure>new</figure>', imageUrl: null, coverMediaId: null, tokens: 900 })
    await Promise.all(e.work)
    expect(await get()).toEqual({
      status: 'READY',
      articleVersion: 7,
      content: '<p>Text</p><figure>new</figure>',
      imageUrl: null,
      coverMediaId: null,
      error: null,
    })
    expect(recordAiUsage).toHaveBeenCalledWith('site-1', 900, 'ARTICLE_IMAGES', { articleId: 'article-1' }, e, 'editor')
  })

  it('never starts a second paid pick while one runs', async () => {
    await post()
    rateLimitLeft = false
    expect(await post()).toMatchObject({ status: 'RUNNING' })
    expect(repickArticleImages).toHaveBeenCalledTimes(1)
  })

  it('stores why a pick failed, naming an exhausted allowance', async () => {
    const e = event()
    await post(e)
    runs[0]!.reject(Object.assign(new Error('spent'), { data: { code: 'AI_ALLOWANCE_EXHAUSTED' } }))
    await Promise.all(e.work)
    expect(await get()).toMatchObject({ status: 'FAILED', error: 'common.aiAllowance.exhausted' })
    expect(reportCaughtError).toHaveBeenCalled()

    const again = event()
    await post(again)
    runs[1]!.reject(new Error('provider down'))
    await Promise.all(again.work)
    expect(await get()).toMatchObject({ status: 'FAILED', error: 'common.messages.operationFailed' })
  })

  it('treats a pick lost with its server as failed, and a late finish of it never overwrites the next one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const lost = event()
    await post(lost)
    vi.setSystemTime(Date.now() + 11 * 60_000)
    expect(await get()).toMatchObject({ status: 'FAILED', error: 'common.messages.operationFailed' })

    await post()
    expect(repickArticleImages).toHaveBeenCalledTimes(2)
    runs[0]!.resolve({ content: 'stale', imageUrl: null, coverMediaId: null, tokens: 1 })
    await Promise.all(lost.work)
    expect(await get()).toMatchObject({ status: 'RUNNING', content: null })
  })

  it('refuses without AI use, over the rate limit, or for an article of another blog', async () => {
    scopes = ['ARTICLE_WRITE']
    await expect(post()).rejects.toMatchObject({ statusCode: 403 })
    scopes = ['ARTICLE_WRITE', 'AI_USE']
    rateLimitLeft = false
    await expect(post()).rejects.toMatchObject({ statusCode: 429 })
    db.article.findUnique.mockResolvedValue({ ...article, clientSiteId: 'site-2' })
    await expect(post()).rejects.toMatchObject({ statusCode: 404 })
    await expect(get()).rejects.toMatchObject({ statusCode: 404 })
    expect(repickArticleImages).not.toHaveBeenCalled()
  })

  it('lets only the author or an editor of others pick', async () => {
    db.article.findUnique.mockResolvedValue({ ...article, userId: 'someone-else' })
    await expect(post()).rejects.toMatchObject({ statusCode: 403 })
    scopes = ['ARTICLE_WRITE', 'AI_USE', 'ARTICLE_WRITE_OTHERS']
    await expect(post()).resolves.toMatchObject({ status: 'RUNNING' })
  })
})

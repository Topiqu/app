import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sanitizeHtml } from '../../../server/utils/sanitize'

const observed = '2026-10-20T12:34:56.000Z'
const update = vi.fn()
const current = vi.fn()
const access = vi.fn()
const scope = vi.fn()
const media = vi.fn()
const audit = vi.fn()
const transaction = vi.fn()
let payload: Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  payload = { title: 'Changed translation', expectedUpdatedAt: observed }
  update.mockResolvedValue({ count: 1 })
  current.mockResolvedValue({
    id: 'translation-a',
    language: 'en',
    slug: 'english-title',
    title: 'Changed translation',
    content: '<p>Body</p>',
    excerpt: null,
    status: 'READY',
    source: 'HUMAN',
    updatedAt: new Date('2026-10-22T10:00:00Z'),
  })
  access.mockResolvedValue({})
  scope.mockResolvedValue({})
  const tx = { articleTranslation: { updateMany: update, findUniqueOrThrow: current } }
  transaction.mockImplementation(async (run: (client: typeof tx) => unknown) => run(tx))
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'translation-a')
  vi.stubGlobal('requireDb', async () => ({
    user: { id: 'editor', clientSiteId: 'tenant-a' },
    db: {
      articleTranslation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'translation-a',
          articleId: 'article-a',
          language: 'en',
          slug: 'english-title',
          title: 'Old title',
          content: '<p>Body</p>',
          status: 'READY',
          clientSite: { publishToWeb: true },
        }),
      },
      $transaction: transaction,
    },
  }))
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (body: unknown) => unknown) => parse(payload))
  vi.stubGlobal('requireArticleAccess', access)
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('sanitizeHtml', sanitizeHtml)
  vi.stubGlobal('prisma', {})
  vi.stubGlobal('syncArticleMediaUsages', media)
  vi.stubGlobal('logAction', audit)
  vi.stubGlobal('getIp', () => '127.0.0.1')
  vi.stubGlobal('announceArticle', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('translation optimistic updates', () => {
  const run = async () => (await import('../../../server/api/translations/[id]/index.patch')).default({} as never)

  it('requires the observed timestamp before any mutation or media effect', async () => {
    delete payload.expectedUpdatedAt
    await expect(run()).rejects.toMatchObject({ statusCode: 428, data: { code: 'ARTICLE_VERSION_REQUIRED' } })
    expect(transaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(media).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('rejects a stale timestamp without fetching a result or applying media effects', async () => {
    update.mockResolvedValue({ count: 0 })
    await expect(run()).rejects.toMatchObject({ statusCode: 409, data: { code: 'ARTICLE_EDIT_CONFLICT' } })
    expect(current).not.toHaveBeenCalled()
    expect(media).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('enforces publication scope before a READY translation can become public', async () => {
    payload.status = 'PUBLISHED'
    scope.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(scope).toHaveBeenCalledWith({}, 'ARTICLE_PUBLISH')
    expect(update).not.toHaveBeenCalled()
    expect(media).not.toHaveBeenCalled()
  })

  it('uses a tenant-constrained timestamp compare and returns the new observed timestamp', async () => {
    payload.content = '<p onclick="unsafe()">Safe text</p><script>unsafe()</script>'
    const result = await run()
    expect(access).toHaveBeenCalledWith({}, 'article-a')
    expect(update).toHaveBeenCalledWith({
      where: { id: 'translation-a', clientSiteId: 'tenant-a', updatedAt: new Date(observed) },
      data: {
        title: 'Changed translation',
        content: '<p>Safe text</p>',
        source: 'HUMAN',
        slug: 'english-title',
        error: null,
        updatedAt: expect.any(Date),
      },
    })
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('expectedUpdatedAt')
    expect(update.mock.calls[0]![0].data.updatedAt.getTime()).toBeGreaterThan(new Date(observed).getTime())
    expect(result.translation.updatedAt).toEqual(new Date('2026-10-22T10:00:00Z'))
    expect(media).toHaveBeenCalledTimes(1)
  })
})

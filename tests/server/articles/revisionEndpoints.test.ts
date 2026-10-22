import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sanitizeHtml } from '../../../server/utils/sanitize'

const access = vi.fn()
const list = vi.fn()
const find = vi.fn()
let params: Record<string, string>
const snapshot = () => ({
  title: 'Původní článek',
  excerpt: 'Původní perex',
  content: '<p onclick="unsafe()">Původní text</p><script>unsafe()</script>',
  imageUrl: null,
  imageCredit: null,
  coverMediaId: null,
  answer: null,
  keyTakeaways: [],
  faq: null,
  sources: [],
  format: null,
  structureVariant: null,
  prompt: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  params = { id: 'article-a', revisionId: 'revision-a' }
  access.mockResolvedValue({ user: { id: 'editor', role: 'admin', clientSiteId: 'tenant-a' } })
  list.mockResolvedValue([
    { id: 'revision-a', version: 2, title: 'Původní článek', actorName: 'Editor', createdAt: new Date('2026-10-01') },
  ])
  find.mockResolvedValue({
    snapshot: {
      ...snapshot(),
      slug: 'old-slug',
      status: 'published',
      userId: 'other-user',
      clientSiteId: 'other-tenant',
      actorId: 'internal-actor',
    },
  })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getRouterParams', () => params)
  vi.stubGlobal('setResponseHeader', vi.fn())
  vi.stubGlobal('requireArticleAccess', access)
  vi.stubGlobal('getEnhancedPrisma', async () => ({ articleRevision: { findMany: list, findFirst: find } }))
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('sanitizeHtml', sanitizeHtml)
})
afterEach(() => vi.unstubAllGlobals())

describe('article revision endpoints', () => {
  const runList = async () =>
    (await import('../../../server/api/articles/[id]/revisions/index.get')).default({} as never)
  const runDetail = async () =>
    (await import('../../../server/api/articles/[id]/revisions/[revisionId].get')).default({} as never)

  it.each(['list', 'detail'])('requires article write/ownership access before serving %s', async (kind) => {
    access.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(kind === 'list' ? runList() : runDetail()).rejects.toMatchObject({ statusCode: 403 })
    expect(list).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  it('requests only bounded revision summaries for the authorized article', async () => {
    const result = await runList()
    expect(access).toHaveBeenCalledWith({}, 'article-a')
    expect(result[0]).toMatchObject({ version: 2, actorName: 'Editor' })
    expect(list).toHaveBeenCalledWith({
      where: { articleId: 'article-a' },
      orderBy: { version: 'desc' },
      take: 50,
      select: { id: true, version: true, title: true, actorName: true, createdAt: true },
    })
    expect(result[0]).not.toHaveProperty('snapshot')
    expect(result[0]).not.toHaveProperty('actorId')
  })

  it('binds detail lookup to both IDs and returns 404 for an unrelated revision', async () => {
    find.mockResolvedValue(null)
    await expect(runDetail()).rejects.toMatchObject({ statusCode: 404 })
    expect(find).toHaveBeenCalledWith({
      where: { id: 'revision-a', articleId: 'article-a' },
      select: { snapshot: true },
    })
  })

  it('returns only restorable fields and sanitizes stored HTML again before preview', async () => {
    const result = await runDetail()
    expect(result.title).toBe('Původní článek')
    expect(result.content).toContain('Původní text')
    expect(result.content).not.toMatch(/<script|onclick=/)
    for (const key of ['slug', 'status', 'userId', 'clientSiteId', 'actorId']) expect(result).not.toHaveProperty(key)
  })

  it('rate-limits retrieval before reading private revision content', async () => {
    vi.stubGlobal('consumeRateLimit', async () => false)
    await expect(runDetail()).rejects.toMatchObject({ statusCode: 429 })
    expect(find).not.toHaveBeenCalled()
  })

  it('rejects malformed stored snapshots instead of previewing unvalidated data', async () => {
    find.mockResolvedValue({ snapshot: { ...snapshot(), title: '', content: 42 } })
    await expect(runDetail()).rejects.toThrow()
  })
})

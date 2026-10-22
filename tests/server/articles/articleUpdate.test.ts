import { createError } from 'h3'
import { createQuerySchemaFactory, DbNull } from '@zenstackhq/orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { schema } from '../../../generated/zenstack/schema'
import { sanitizeHtml } from '../../../server/utils/sanitize'
import { changesReaderText } from '../../../server/utils/articleModified'

const updateSchema = createQuerySchemaFactory(schema).makeUpdateSchema('Article')
const faq = [{ question: 'When?', answer: 'In spring.' }]

describe('article updates', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  const setup = async (
    body: Record<string, unknown>,
    previous: Record<string, unknown> = {},
    includeVersion = true,
  ) => {
    const previousArticle = {
      id: 'article-1',
      editVersion: 4,
      userId: 'user-1',
      clientSiteId: 'site-1',
      slug: 'article',
      language: 'en',
      title: 'Article',
      excerpt: null,
      content: '<p>Content</p>',
      answer: null,
      keyTakeaways: [],
      faq: null,
      imageUrl: null,
      coverMediaId: null,
      articleSeriesId: null,
      seriesOrder: 0,
      status: 'draft',
      publishedAt: null,
      releaseAt: null,
      aiInvolvement: 'NONE',
      allowedComments: true,
      clientSite: { publishToWeb: true },
      ...previous,
    }
    const update = vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      // Use ZenStack's real query validator so nullable JSON and foreign keys are checked together.
      updateSchema.parse(args)
      return { ...previousArticle, ...args.data, editVersion: previousArticle.editVersion + 1 }
    })
    const query = vi.fn(async (parts: TemplateStringsArray) =>
      parts.join('').includes('FOR UPDATE') ? [{ editVersion: previousArticle.editVersion }] : [],
    )
    const tx = { article: { update }, $queryRaw: query }
    const transaction = vi.fn(async (run: (client: typeof tx) => unknown) => run(tx))
    const db = {
      article: {
        findUnique: vi.fn().mockResolvedValue(previousArticle),
        findFirst: vi.fn().mockResolvedValue({ seriesOrder: 4 }),
      },
      $transaction: transaction,
    }

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getRouterParam', () => previousArticle.id)
    vi.stubGlobal('requireTenantScope', async () => ({
      user: { id: 'user-1', name: 'Fixture editor', clientSiteId: 'site-1' },
      membership: {},
    }))
    vi.stubGlobal('getEnhancedPrisma', async () => db)
    vi.stubGlobal('readBody', async () => ({ ...(includeVersion ? { expectedVersion: 4 } : {}), ...body }))
    vi.stubGlobal('hasTenantScope', () => true)
    vi.stubGlobal('assertTenantMedia', async () => null)
    vi.stubGlobal('isCoverImageUrl', () => true)
    vi.stubGlobal('coverCreditFromMedia', async () => null)
    vi.stubGlobal('requireMediaRightsReview', async () => null)
    vi.stubGlobal('changesReaderText', changesReaderText)
    vi.stubGlobal('applyMediaAttributions', async (_site: string, content: string) => content)
    vi.stubGlobal('stampHeadingIds', (content: string) => content)
    vi.stubGlobal('sanitizeHtml', sanitizeHtml)
    const syncPolls = vi.fn(async (_db: unknown, _id: string, content: string) => content)
    vi.stubGlobal('syncArticlePolls', syncPolls)
    vi.stubGlobal('isUniqueViolation', () => false)
    vi.stubGlobal('prisma', { article: { findFirst: vi.fn().mockResolvedValue(null) } })
    vi.stubGlobal('syncArticleTranslationQueue', vi.fn())
    vi.stubGlobal('invalidateFeed', vi.fn())
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('enqueueArticleWebhook', vi.fn())
    vi.stubGlobal('announceArticle', vi.fn())

    const handler = (await import('../../../server/api/articles/[id]/index.patch')).default
    return { run: () => handler({} as never), update, query, tx, transaction, syncPolls }
  }

  it.each([
    { coverMediaId: null, articleSeriesId: null },
    { coverMediaId: 'media-1', articleSeriesId: 'series-1' },
  ])('clears JSON columns alongside relation IDs: %o', async (relations) => {
    const { run, update } = await setup({ faq: null, imageCredit: null, ...relations })

    await expect(run()).resolves.toEqual({ success: true, editVersion: 5 })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: expect.objectContaining({ faq: DbNull, imageCredit: DbNull, ...relations }),
    })
  })

  it.each([{ entries: [] }, { entries: faq }])(
    'preserves an explicitly supplied FAQ array: %j',
    async ({ entries }) => {
      const { run, update } = await setup({ faq: entries })

      await expect(run()).resolves.toEqual({ success: true, editVersion: 5 })
      expect(update.mock.calls[0]![0].data.faq).toEqual(entries)
    },
  )

  it('leaves FAQ untouched when it is omitted from a partial update', async () => {
    const { run, update } = await setup({ title: 'Updated article' }, { faq })

    await expect(run()).resolves.toEqual({ success: true, editVersion: 5 })
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('faq')
  })

  it.each([
    { previousFaq: null, changed: false },
    { previousFaq: faq, changed: true },
  ])('updates the publication modification date only when FAQ changes: %o', async ({ previousFaq, changed }) => {
    const { run, update } = await setup(
      { faq: null },
      { faq: previousFaq, status: 'published', publishedAt: new Date('2026-10-01T12:00:00Z') },
    )

    await expect(run()).resolves.toEqual({ success: true, editVersion: 5 })
    const data = update.mock.calls[0]![0].data
    if (changed) expect(data.contentUpdatedAt).toBeInstanceOf(Date)
    else expect(data).not.toHaveProperty('contentUpdatedAt')
  })

  it.each([
    { title: 'Changed title' },
    { content: '<p>Changed</p>' },
    { imageCredit: null },
    { faq: [] },
    { tagIds: ['471a89a8-966e-4813-b37a-e05af2e57f00'] },
  ])('requires the editor version for editable content: %o', async (body) => {
    const { run, update, transaction } = await setup(body, {}, false)
    await expect(run()).rejects.toMatchObject({ statusCode: 428, data: { code: 'ARTICLE_VERSION_REQUIRED' } })
    expect(transaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects an already stale save before polls, media attribution or persistence run', async () => {
    const { run, update, transaction, syncPolls } = await setup({ title: 'Stale', expectedVersion: 3 })
    const attribution = vi.fn()
    vi.stubGlobal('applyMediaAttributions', attribution)
    await expect(run()).rejects.toMatchObject({ statusCode: 409, data: { code: 'ARTICLE_EDIT_CONFLICT' } })
    expect(transaction).not.toHaveBeenCalled()
    expect(syncPolls).not.toHaveBeenCalled()
    expect(attribution).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a version changed after the initial read while holding the tenant-constrained lock', async () => {
    const { run, update, query, syncPolls } = await setup({ content: '<p>Pending edit</p>' })
    query.mockResolvedValueOnce([{ editVersion: 5 }])
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
    const [sql, ...values] = query.mock.calls[0] as unknown as [TemplateStringsArray, ...string[]]
    expect(sql.join('')).toContain('"clientSiteId" = ')
    expect(sql.join('')).toContain('FOR UPDATE')
    expect(values).toEqual(['article-1', 'site-1'])
    expect(syncPolls).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not write when the locked row is absent from the active tenant', async () => {
    const { run, update, query } = await setup({ title: 'No longer available' })
    query.mockResolvedValueOnce([])
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps metadata-only callers compatible when they omit expectedVersion', async () => {
    const { run, update } = await setup({ allowedComments: false }, {}, false)
    await expect(run()).resolves.toMatchObject({ success: true, editVersion: 5 })
    expect(update.mock.calls[0]![0].data).toMatchObject({ allowedComments: false })
  })

  it('strips client-selected editVersion before updating the article', async () => {
    const { run, update } = await setup({ title: 'Updated', editVersion: 9000 })
    await expect(run()).resolves.toEqual({ success: true, editVersion: 5 })
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('editVersion')
  })

  it('normalizes polls inside the transaction and persists their sanitized content in one update', async () => {
    const { run, update, tx, syncPolls } = await setup({ content: '<p>Incoming poll</p>' })
    syncPolls.mockResolvedValue('<p data-poll-id="poll-1">Normalized</p><script>unsafe()</script>')
    await expect(run()).resolves.toMatchObject({ success: true })
    expect(syncPolls).toHaveBeenCalledWith(tx, 'article-1', '<p>Incoming poll</p>')
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![0].data.content).toContain('Normalized')
    expect(update.mock.calls[0]![0].data.content).not.toContain('<script>')
    expect(syncPolls.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]!)
  })

  it('aborts the save without an article write when poll reconciliation fails', async () => {
    const { run, update, syncPolls } = await setup({ content: '<p>Poll content</p>' })
    syncPolls.mockRejectedValue(new Error('Synthetic poll write failure'))
    await expect(run()).rejects.toThrow('Synthetic poll write failure')
    expect(update).not.toHaveBeenCalled()
  })
})

import { createError } from 'h3'
import { createQuerySchemaFactory, DbNull } from '@zenstackhq/orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { schema } from '../../../generated/zenstack/schema'
import { changesReaderText } from '../../../server/utils/articleModified'

const updateSchema = createQuerySchemaFactory(schema).makeUpdateSchema('Article')
const faq = [{ question: 'When?', answer: 'In spring.' }]

describe('article updates', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  const setup = async (body: Record<string, unknown>, previous: Record<string, unknown> = {}) => {
    const previousArticle = {
      id: 'article-1',
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
      clientSite: { publishToWeb: true },
      ...previous,
    }
    const update = vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      // Use ZenStack's real query validator so nullable JSON and foreign keys are checked together.
      updateSchema.parse(args)
      return { ...previousArticle, ...args.data }
    })
    const tx = { article: { update } }
    const db = {
      article: {
        findUnique: vi.fn().mockResolvedValue(previousArticle),
        findFirst: vi.fn().mockResolvedValue({ seriesOrder: 4 }),
      },
      $transaction: (run: (client: typeof tx) => unknown) => run(tx),
    }

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getRouterParam', () => previousArticle.id)
    vi.stubGlobal('requireTenantScope', async () => ({
      user: { id: 'user-1', clientSiteId: 'site-1' },
      membership: {},
    }))
    vi.stubGlobal('getEnhancedPrisma', async () => db)
    vi.stubGlobal('readBody', async () => ({ ...body }))
    vi.stubGlobal('hasTenantScope', () => true)
    vi.stubGlobal('assertTenantMedia', async () => null)
    vi.stubGlobal('isCoverImageUrl', () => true)
    vi.stubGlobal('coverCreditFromMedia', async () => null)
    vi.stubGlobal('requireMediaRightsReview', async () => null)
    vi.stubGlobal('changesReaderText', changesReaderText)
    vi.stubGlobal('isUniqueViolation', () => false)
    vi.stubGlobal('prisma', { article: { findFirst: vi.fn().mockResolvedValue(null) } })
    vi.stubGlobal('syncArticleTranslationQueue', vi.fn())
    vi.stubGlobal('invalidateFeed', vi.fn())
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('enqueueArticleWebhook', vi.fn())
    vi.stubGlobal('announceArticle', vi.fn())

    const handler = (await import('../../../server/api/articles/[id]/index.patch')).default
    return { run: () => handler({} as never), update }
  }

  it.each([
    { coverMediaId: null, articleSeriesId: null },
    { coverMediaId: 'media-1', articleSeriesId: 'series-1' },
  ])('clears JSON columns alongside relation IDs: %o', async (relations) => {
    const { run, update } = await setup({ faq: null, imageCredit: null, ...relations })

    await expect(run()).resolves.toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: expect.objectContaining({ faq: DbNull, imageCredit: DbNull, ...relations }),
    })
  })

  it.each([{ entries: [] }, { entries: faq }])(
    'preserves an explicitly supplied FAQ array: %j',
    async ({ entries }) => {
      const { run, update } = await setup({ faq: entries })

      await expect(run()).resolves.toEqual({ success: true })
      expect(update.mock.calls[0]![0].data.faq).toEqual(entries)
    },
  )

  it('leaves FAQ untouched when it is omitted from a partial update', async () => {
    const { run, update } = await setup({ title: 'Updated article' }, { faq })

    await expect(run()).resolves.toEqual({ success: true })
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

    await expect(run()).resolves.toEqual({ success: true })
    const data = update.mock.calls[0]![0].data
    if (changed) expect(data.contentUpdatedAt).toBeInstanceOf(Date)
    else expect(data).not.toHaveProperty('contentUpdatedAt')
  })
})

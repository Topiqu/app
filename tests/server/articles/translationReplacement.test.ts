import { createError } from 'h3'
import { afterEach, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(
    import('../../../server/utils/ai/translationRow'),
    'translationSelect',
    'nextTranslationVersion',
  )
}

const observed = '2026-10-20T12:00:00.000Z'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (
  options: { existing?: boolean; published?: boolean; denyPublish?: boolean; body?: Record<string, unknown> } = {},
) => {
  let row: Record<string, unknown> | null =
    options.existing === false
      ? null
      : {
          id: 'tr1',
          articleId: 'a1',
          clientSiteId: 's1',
          language: 'fr',
          title: 'Human title',
          content: 'Human text',
          status: options.published ? 'PUBLISHED' : 'READY',
          updatedAt: new Date(observed),
        }
  const user = { id: 'u1', role: 'admin', clientSiteId: 's1' }
  const article = {
    id: 'a1',
    clientSiteId: 's1',
    editVersion: 1,
    language: 'en',
    title: 'Source',
    content: 'Source text',
    status: 'published',
  }
  const create = vi.fn(async ({ data }) => {
    if (row) throw Object.assign(new Error('Unique violation'), { dbErrorCode: '23505' })
    row = { id: 'tr1', ...data, updatedAt: new Date() }
    return row
  })
  const updateMany = vi.fn(async ({ where, data }) => {
    if (!row || new Date(row.updatedAt as Date).getTime() !== new Date(where.updatedAt).getTime()) return { count: 0 }
    row = { ...row, ...data }
    return { count: 1 }
  })
  const translation = {
    findUnique: vi.fn(async () => (row ? { ...row } : null)),
    findFirst: vi.fn(async () => (row ? { ...row } : null)),
    findUniqueOrThrow: vi.fn(async () => ({ ...row })),
    create,
    updateMany,
    upsert: vi.fn(async ({ create: initial, update }) => {
      row = row ? { ...row, ...update } : { id: 'tr1', ...initial }
      return row
    }),
  }
  const client = {
    $queryRaw: vi.fn(async () => [{ editVersion: article.editVersion }]),
    article: { findFirst: vi.fn(async () => ({ ...article })), findUnique: vi.fn(async () => ({ ...article })) },
    clientSite: { findUnique: vi.fn().mockResolvedValue({ language: 'en', plan: 'PRO' }) },
    articleTranslation: translation,
  }
  const db = { ...client, $transaction: async (run: (tx: typeof client) => unknown) => run(client) }
  const body = { language: 'fr', title: 'Manual title', content: 'Manual text', ...options.body }
  const generate = vi.fn().mockResolvedValue({
    title: 'AI title',
    excerpt: null,
    content: 'AI text',
    answer: 'Answer',
    keyTakeaways: ['Point'],
    faq: [],
    slug: 'ai-title',
    usage: { totalTokens: 10 },
  })
  const scope = vi.fn(async (_event: unknown, name: string) => {
    if (name === 'ARTICLE_PUBLISH' && options.denyPublish) throw createError({ statusCode: 403 })
  })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'a1')
  vi.stubGlobal('requireDb', async () => ({ user, db }))
  vi.stubGlobal('requireUser', async () => user)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('requireArticleAccess', vi.fn())
  vi.stubGlobal('ensureMinAccountAge', vi.fn())
  vi.stubGlobal('hasActiveFeature', async () => true)
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) => parse(body))
  vi.stubGlobal('dedupeTranslationSlug', async () => 'ai-title')
  vi.stubGlobal('sanitizeHtml', (text: string) => text)
  vi.stubGlobal('generateTranslation', generate)
  vi.stubGlobal('recordAiUsage', vi.fn())
  vi.stubGlobal('syncArticleMediaUsages', vi.fn())
  vi.stubGlobal('invalidateFeed', vi.fn())
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal('getIp', () => '192.0.2.1')
  vi.stubGlobal('aiModelId', () => 'translation-model')
  vi.stubGlobal('toDatabaseJson', (value: unknown) => value)
  vi.stubGlobal('isUniqueViolation', (error: { dbErrorCode?: string }) => error.dbErrorCode === '23505')
  vi.stubGlobal('prisma', {})
  const manual = () =>
    import('../../../server/api/articles/[id]/translations.post').then(({ default: handler }) => handler({} as never))
  const ai = () =>
    import('../../../server/api/articles/[id]/translate.post').then(({ default: handler }) => handler({} as never))
  return {
    manual,
    ai,
    generate,
    create,
    updateMany,
    scope,
    getRow: () => row,
    editDuringGeneration: () => {
      row = { ...row, content: 'New human edit', updatedAt: new Date('2026-10-22T12:00:00Z') }
    },
    changeSource: () => {
      article.editVersion++
    },
  }
}

it('makes manual POST create-only instead of overwriting an existing human translation', async () => {
  const f = await setup()
  await expect(f.manual()).rejects.toMatchObject({ statusCode: 409 })
  expect(f.getRow()?.content).toBe('Human text')
})

it.each([
  { body: {}, statusCode: 409 },
  { body: { replace: true }, statusCode: 428 },
  { body: { replace: true, expectedUpdatedAt: '2026-10-19T12:00:00Z' }, statusCode: 409 },
])('rejects unobserved AI replacement before provider cost: %j', async ({ body, statusCode }) => {
  const f = await setup({ body })
  await expect(f.ai()).rejects.toMatchObject({ statusCode })
  expect(f.generate).not.toHaveBeenCalled()
  expect(f.getRow()?.content).toBe('Human text')
})

it('requires publication scope before replacing live content', async () => {
  const f = await setup({ published: true, denyPublish: true, body: { replace: true, expectedUpdatedAt: observed } })
  await expect(f.ai()).rejects.toMatchObject({ statusCode: 403 })
  expect(f.generate).not.toHaveBeenCalled()
})

it('preserves a human edit made while the model is running', async () => {
  const f = await setup({ body: { replace: true, expectedUpdatedAt: observed } })
  const generate = f.generate.getMockImplementation()!
  f.generate.mockImplementation(async (...args) => {
    const result = await generate(...args)
    f.editDuringGeneration()
    return result
  })
  await expect(f.ai()).rejects.toMatchObject({ statusCode: 409 })
  expect(f.getRow()?.content).toBe('New human edit')
})

it('does not store a translation against a source edited during generation', async () => {
  const f = await setup({ existing: false })
  const generate = f.generate.getMockImplementation()!
  f.generate.mockImplementation(async (...args) => {
    const result = await generate(...args)
    f.changeSource()
    return result
  })
  await expect(f.ai()).rejects.toMatchObject({ statusCode: 409 })
  expect(f.create).not.toHaveBeenCalled()
})

it('creates a missing translation without replacement intent', async () => {
  const f = await setup({ existing: false })
  await expect(f.ai()).resolves.toMatchObject({
    translation: { content: 'AI text', status: 'READY', answer: 'Answer', keyTakeaways: ['Point'], faq: [] },
  })
})

it('replaces exactly the observed translation when its version is unchanged', async () => {
  const f = await setup({ body: { replace: true, expectedUpdatedAt: observed } })
  await expect(f.ai()).resolves.toMatchObject({
    translation: { content: 'AI text', status: 'READY', answer: 'Answer', keyTakeaways: ['Point'], faq: [] },
  })
  expect(f.updateMany).toHaveBeenCalledOnce()
  expect(new Date(f.getRow()?.updatedAt as Date).getTime()).toBeGreaterThan(new Date(observed).getTime())
})

beforeEach(stubImports)

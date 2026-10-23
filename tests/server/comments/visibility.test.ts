import { createError } from 'h3'
import { afterEach, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/articleViewerAccess'), 'canReadArticle')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (
  options: {
    status?: string
    deletedAt?: Date | null
    releaseAt?: Date | null
    tenantDeletedAt?: Date | null
    parentDeletedAt?: Date | null
    role?: string
    viewerTenant?: string
    notificationFailure?: boolean
  } = {},
) => {
  const article = {
    id: 'article-1',
    clientSiteId: 'site-1',
    status: options.status ?? 'published',
    deletedAt: options.deletedAt ?? null,
    releaseAt: options.releaseAt ?? null,
    allowedComments: true,
    userId: 'author-1',
    slug: 'article',
    language: 'en',
    title: 'Article',
    clientSite: {
      domain: 'example.test',
      language: 'en',
      commentsEnabled: true,
      commentGifsEnabled: true,
      deletedAt: options.tenantDeletedAt ?? null,
    },
  }
  const create = vi.fn().mockResolvedValue({ id: 'comment-1', content: 'Text', parentId: null })
  const parentId = options.parentDeletedAt ? 'parent-1' : undefined
  const parent = {
    id: 'parent-1',
    articleId: 'article-1',
    deletedAt: options.parentDeletedAt ?? null,
    content: 'Parent',
    user: { id: 'parent-user', allowEmail: false, username: 'Parent' },
  }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('requireUser', async () => ({
    id: 'reader-1',
    role: options.role ?? 'reader',
    clientSiteId: options.viewerTenant,
  }))
  vi.stubGlobal('readValidatedBody', async () => ({ articleId: article.id, content: 'Text', parentId }))
  vi.stubGlobal('sanitizeHtml', (content: string) => content)
  vi.stubGlobal(
    'commentAudience',
    vi.fn().mockImplementation(async () => {
      if (options.notificationFailure) throw new Error('Audience lookup unavailable')
      return []
    }),
  )
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
  const db = {
    article: { findUnique: vi.fn().mockResolvedValue(article) },
    userBan: { findFirst: vi.fn().mockResolvedValue(null) },
    comment: {
      create,
      findFirst: vi.fn(async ({ where }) => (where.deletedAt === null && parent.deletedAt ? null : parent)),
    },
  }
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  const handler = (await import('../../../server/api/comments/index.post')).default
  return { run: () => handler({} as never), create }
}

it.each(['draft', 'archived', 'scheduled'])('blocks reader comments on %s articles', async (status) => {
  const { run, create } = await setup({ status })
  await expect(run()).rejects.toMatchObject({ statusCode: 404 })
  expect(create).not.toHaveBeenCalled()
})

it.each([
  { deletedAt: new Date() },
  { tenantDeletedAt: new Date() },
  { releaseAt: new Date('2099-01-01') },
  { parentDeletedAt: new Date() },
])('blocks an unavailable article/parent: %j', async (options) => {
  const { run, create } = await setup(options)
  await expect(run()).rejects.toMatchObject({ statusCode: 404 })
  expect(create).not.toHaveBeenCalled()
})

it('keeps published articles commentable by readers', async () => {
  const { run, create } = await setup()
  await expect(run()).resolves.toMatchObject({ id: 'comment-1' })
  expect(create).toHaveBeenCalledOnce()
})

it('preserves same-tenant administrative preview access', async () => {
  const { run } = await setup({ status: 'draft', role: 'admin', viewerTenant: 'site-1' })
  await expect(run()).resolves.toMatchObject({ id: 'comment-1' })
})

it('treats an administrator of another tenant as a public reader', async () => {
  const { run, create } = await setup({ status: 'draft', role: 'admin', viewerTenant: 'site-2' })
  await expect(run()).rejects.toMatchObject({ statusCode: 404 })
  expect(create).not.toHaveBeenCalled()
})

it('returns the committed comment when ancillary audience lookup fails', async () => {
  const { run, create } = await setup({ notificationFailure: true })
  await expect(run()).resolves.toMatchObject({ id: 'comment-1' })
  expect(create).toHaveBeenCalledOnce()
  expect(reportCaughtError).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Error),
    expect.objectContaining({ commentId: 'comment-1' }),
  )
})

beforeEach(stubImports)

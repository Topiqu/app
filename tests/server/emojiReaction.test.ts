import { createError } from 'h3'
import { afterEach, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/articleViewerAccess'), 'canReadArticle')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (
  options: {
    articleStatus?: string
    commentDeleted?: boolean
    tenantDeleted?: boolean
    emojiTenant?: string
    emojiDeleted?: boolean
    banned?: boolean
    commentsEnabled?: boolean
    existing?: boolean
    payload?: unknown
  } = {},
) => {
  const create = vi.fn().mockResolvedValue({ userId: 'u1', commentId: 'c1', emojiId: 'e1' })
  const remove = vi.fn().mockResolvedValue({ userId: 'u1', commentId: 'c1', emojiId: 'e1' })
  const db = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    comment: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'c1',
        deletedAt: options.commentDeleted ? new Date() : null,
        article: {
          clientSiteId: 's1',
          status: options.articleStatus ?? 'published',
          deletedAt: null,
          releaseAt: null,
          allowedComments: true,
          clientSite: {
            deletedAt: options.tenantDeleted ? new Date() : null,
            commentsEnabled: options.commentsEnabled ?? true,
          },
        },
      }),
    },
    emoji: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'e1',
        clientSiteId: options.emojiTenant ?? 's1',
        deletedAt: options.emojiDeleted ? new Date() : null,
      }),
    },
    userBan: { findFirst: vi.fn().mockResolvedValue(options.banned ? { id: 'ban-1' } : null) },
    emojiReaction: {
      findUnique: vi.fn().mockResolvedValue(options.existing ? { userId: 'u1' } : null),
      create,
      delete: remove,
    },
  }
  const body = options.payload ?? { commentId: 'c1', emojiId: 'e1', userId: 'forged-user' }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => ({ id: 'u1', role: 'reader' }))
  vi.stubGlobal('readBody', async () => body)
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
  vi.stubGlobal('getEnhancedPrisma', async () => ({
    ...db,
    $transaction: async (run: (tx: typeof db) => unknown) => run(db),
  }))
  vi.stubGlobal('prisma', db)
  const handler = (await import('../../server/api/emojis/reaction.post')).default
  return { run: () => handler({} as never), create, remove, db }
}

it.each([
  { articleStatus: 'draft' },
  { commentDeleted: true },
  { tenantDeleted: true },
  { emojiTenant: 'other-tenant' },
  { emojiDeleted: true },
])('rejects an inaccessible or unrelated target: %j', async (options) => {
  const { run, create, remove } = await setup(options)
  await expect(run()).rejects.toMatchObject({ statusCode: 404 })
  expect(create).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it.each([{ banned: true }, { commentsEnabled: false }])('rejects restricted interaction: %j', async (options) => {
  const { run, create, remove } = await setup(options)
  await expect(run()).rejects.toMatchObject({ statusCode: 403 })
  expect(create).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it('creates only for the session actor on a same-publication visible target', async () => {
  const { run, create } = await setup()
  await expect(run()).resolves.toEqual({ success: true, created: true })
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ data: { userId: 'u1', commentId: 'c1', emojiId: 'e1' } }),
  )
})

it('toggles an existing reaction off', async () => {
  const { run, create, remove } = await setup({ existing: true })
  await expect(run()).resolves.toEqual({ success: true, created: false })
  expect(remove).toHaveBeenCalledOnce()
  expect(create).not.toHaveBeenCalled()
})

it('validates identifiers before loading or writing targets', async () => {
  const { run, create, db } = await setup({ payload: { commentId: { id: 'c1' }, emojiId: 'e1' } })
  await expect(run()).rejects.toThrow()
  expect(db.comment.findUnique).not.toHaveBeenCalled()
  expect(create).not.toHaveBeenCalled()
})

beforeEach(stubImports)

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

const setup = () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getSessionUser', async () => ({ id: 'u1', name: 'Reader' }))
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('prisma', {
    notification: { create: vi.fn().mockRejectedValue(new Error('Notification storage unavailable')) },
  })
}

it('returns a committed follow when its notification fails', async () => {
  setup()
  const saved = { followerId: 'u1', followedId: 'u2' }
  const create = vi.fn().mockResolvedValue(saved)
  vi.stubGlobal('readValidatedBody', async () => ({ followedId: 'u2' }))
  vi.stubGlobal('getEnhancedPrisma', async () => ({
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'u2' }) },
    follow: { findFirst: vi.fn().mockResolvedValue(null), create, count: vi.fn().mockResolvedValue(1) },
  }))
  const handler = (await import('../../server/api/follows/index.post')).default
  await expect(handler({} as never)).resolves.toEqual({ follow: saved, followerCount: 1 })
  expect(create).toHaveBeenCalledOnce()
  expect(reportCaughtError).toHaveBeenCalledOnce()
})

it('returns a committed comment reaction when its notification fails', async () => {
  setup()
  const create = vi.fn().mockResolvedValue({})
  vi.stubGlobal('readValidatedBody', async () => ({ commentId: 'c1', type: 'LIKE' }))
  vi.stubGlobal('getEnhancedPrisma', async () => ({
    comment: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'c1',
        userId: 'u2',
        deletedAt: null,
        article: {
          clientSiteId: 's1',
          status: 'published',
          deletedAt: null,
          releaseAt: null,
          allowedComments: true,
          clientSite: { deletedAt: null, commentsEnabled: true },
        },
      }),
    },
    userBan: { findFirst: vi.fn().mockResolvedValue(null) },
    commentReaction: { findUnique: vi.fn().mockResolvedValue(null), create, count: vi.fn().mockResolvedValue(1) },
  }))
  const handler = (await import('../../server/api/comments/reaction.post')).default
  await expect(handler({} as never)).resolves.toEqual({ liked: true, likes: 1 })
  expect(create).toHaveBeenCalledOnce()
  expect(reportCaughtError).toHaveBeenCalledOnce()
})

beforeEach(stubImports)

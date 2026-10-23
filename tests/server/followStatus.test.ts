import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

const setup = async (query: Record<string, unknown> = {}, authenticated = true, count = 3) => {
  const profiles = Array.from({ length: count }, (_, index) => ({
    id: `author-${index}`,
    username: `Author ${index}`,
    role: 'reader',
    avatarUrl: 'https://example.invalid/avatar.webp',
    bio: 'a'.repeat(500),
  }))
  const rows = [
    ...profiles.map((followed) => ({ followerId: 'viewer', followedId: followed.id, followed })),
    { followerId: 'other-viewer', followedId: 'foreign', followed: { ...profiles[0]!, id: 'foreign' } },
  ]
  const findMany = vi.fn(
    async ({ where, take }: { where: { followerId: string; followedId?: string }; take?: number }) =>
      rows
        .filter(
          (row) => row.followerId === where.followerId && (!where.followedId || row.followedId === where.followedId),
        )
        .slice(0, take)
        .map(({ followed }) => ({ followed })),
  )
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () =>
    authenticated ? { id: 'viewer', role: 'reader', clientSiteId: 'site-1' } : null,
  )
  vi.stubGlobal('getEnhancedPrisma', async () => ({ follow: { findMany } }))
  vi.stubGlobal('getValidatedQuery', async (_event: unknown, parse: (value: unknown) => unknown) => {
    try {
      return parse(query)
    } catch {
      throw createError({ statusCode: 400 })
    }
  })
  const handler = (await import('../../server/api/follows/followed.get')).default
  return { run: () => handler({} as never), profiles, findMany, query }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('bounded author follow status', () => {
  it('requires authentication before querying another user’s follow data', async () => {
    const state = await setup({ followedId: 'author-0' }, false)
    await expect(state.run()).rejects.toMatchObject({ statusCode: 401 })
    expect(state.findMany).not.toHaveBeenCalled()
  })

  it('preserves the default complete profile list used by FollowDialog', async () => {
    const state = await setup()
    expect(await state.run()).toEqual(state.profiles)
    expect(state.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { followerId: 'viewer' }, take: undefined }),
    )
    expect(state.findMany.mock.calls[0]?.[0]).toMatchObject({
      select: { followed: { select: { id: true, username: true, role: true, avatarUrl: true, bio: true } } },
    })
  })

  it('returns zero or one followed profile, scoped to the authenticated follower', async () => {
    const state = await setup({ followedId: 'author-1', followerId: 'other-viewer' })
    expect(await state.run()).toEqual([state.profiles[1]])
    expect(state.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { followerId: 'viewer', followedId: 'author-1' }, take: 1 }),
    )
    state.query.followedId = 'foreign'
    expect(await state.run()).toEqual([])
  })

  it.each([{ followedId: '' }, { followedId: ['author-1', 'author-2'] }, { followedId: 'a'.repeat(129) }])(
    'rejects invalid filter %j before database work',
    async (query) => {
      const state = await setup(query)
      await expect(state.run()).rejects.toMatchObject({ statusCode: 400 })
      expect(state.findMany).not.toHaveBeenCalled()
    },
  )

  it('bounds status response rows and bytes independently of the number of followed authors', async () => {
    const state = await setup({}, true, 1_000)
    const full = await state.run()
    state.query.followedId = 'author-999'
    const filtered = await state.run()
    expect(full).toHaveLength(1_000)
    expect(filtered).toHaveLength(1)
    expect(JSON.stringify(filtered).length).toBeLessThan(JSON.stringify(full).length / 100)
  })
})

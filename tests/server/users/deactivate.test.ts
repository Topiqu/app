import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('DELETE /api/users/:id', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const setup = async (options: { actor: { id: string; role: string }; targetId: string; ownedBlogs?: number }) => {
    const update = vi.fn(async () => ({}))
    const revoke = vi.fn(async () => ({ count: 2 }))
    const count = vi.fn(async () => options.ownedBlogs ?? 0)

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => options.actor)
    vi.stubGlobal('getRouterParam', () => options.targetId)
    vi.stubGlobal('getEnhancedPrisma', async () => ({
      user: { findFirst: vi.fn(async () => ({ clientSiteId: 'site-1' })), update },
      session: { deleteMany: revoke },
    }))
    vi.stubGlobal('prisma', { tenantMembership: { count } })
    vi.stubGlobal('invalidateAuthor', vi.fn())
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')

    const handler = (await import('../../../server/api/users/[id]/index.delete')).default as (
      event: never,
    ) => Promise<unknown>
    return { run: () => handler({} as never), update, revoke, count }
  }

  it('lets a user deactivate their own account and signs out every device', async () => {
    const { run, update, revoke } = await setup({ actor: { id: 'u1', role: 'reader' }, targetId: 'u1' })
    await run()
    expect(update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { deletedAt: expect.any(Date) } })
    expect(revoke).toHaveBeenCalledWith({ where: { userId: 'u1' } })
  })

  it('refuses to deactivate someone else unless superadmin', async () => {
    const { run, update } = await setup({ actor: { id: 'u1', role: 'admin' }, targetId: 'u2' })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps the owner of a live blog from leaving it ownerless', async () => {
    const { run, update, count } = await setup({ actor: { id: 'u1', role: 'admin' }, targetId: 'u1', ownedBlogs: 1 })
    await expect(run()).rejects.toMatchObject({ statusCode: 409, message: 'common.errors.ownerCannotDeactivate' })
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'u1', role: 'OWNER', deletedAt: null, clientSite: { deletedAt: null } },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('lets a superadmin deactivate any account', async () => {
    const { run, update, count } = await setup({ actor: { id: 'admin', role: 'superadmin' }, targetId: 'u1', ownedBlogs: 1 })
    await run()
    expect(count).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })
})

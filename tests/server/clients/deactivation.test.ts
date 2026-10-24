// @vitest-environment node
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (
  options: { member?: boolean; foreign?: boolean; hard?: boolean; confirmation?: string; anonymous?: boolean } = {},
) => {
  const event = { context: {} }
  const sites = [
    { id: 'own-site', deletedAt: null as Date | null },
    { id: 'other-site', deletedAt: null as Date | null },
  ]
  const sessions = [
    { id: 'owner-session', clientSiteId: 'own-site' as string | null },
    { id: 'member-session', clientSiteId: 'own-site' as string | null },
    { id: 'foreign-session', clientSiteId: 'other-site' as string | null },
  ]
  const tx = {
    clientSite: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { deletedAt: Date } }) =>
        Object.assign(
          sites.find((site) => site.id === where.id)!,
          data,
        ),
      ),
      delete: vi.fn(),
    },
    session: {
      updateMany: vi.fn(async ({ where, data }: { where: { clientSiteId: string }; data: { clientSiteId: null } }) => {
        const matching = sessions.filter((session) => session.clientSiteId === where.clientSiteId)
        for (const session of matching) Object.assign(session, data)
        return { count: matching.length }
      }),
    },
    article: { deleteMany: vi.fn() },
    user: { updateMany: vi.fn() },
    domainConnection: { deleteMany: vi.fn() },
  }
  const transaction = vi.fn(async (run: (db: typeof tx) => unknown) => run(tx))
  const lookup = vi.fn().mockResolvedValue({ domain: 'own-blog' })
  const membership = vi.fn(async () => {
    if (options.foreign) throw createError({ statusCode: 403, message: 'Tenant membership required' })
    return { membership: { role: options.member ? 'MEMBER' : 'OWNER' } }
  })
  const invalidation = vi.fn()
  const uncache = vi.fn()
  const audit = vi.fn()
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () =>
    options.anonymous ? null : { id: 'owner', role: 'admin', clientSiteId: 'own-site' },
  )
  vi.stubGlobal('getEnhancedPrisma', async () => ({ clientSite: { findUnique: lookup } }))
  vi.stubGlobal('getRouterParam', () => (options.foreign ? 'other-site' : 'own-site'))
  vi.stubGlobal('getQuery', () => (options.hard ? { hard: 'true' } : {}))
  vi.stubGlobal('requireTenantMember', membership)
  vi.stubGlobal('readBody', async () => ({ confirmation: options.confirmation ?? 'own-blog' }))
  vi.stubGlobal('prisma', { $transaction: transaction })
  vi.stubGlobal('invalidateFeed', invalidation)
  vi.stubGlobal('uncache', uncache)
  vi.stubGlobal('tenantHostKey', (domain: string) => `host:${domain}`)
  vi.stubGlobal('domainRedirectKey', (domain: string) => `redirect:${domain}`)
  vi.stubGlobal('logAction', audit)
  vi.stubGlobal('getIp', () => '192.0.2.1')
  const handler = (await import('../../../server/api/clients/[id]/index.delete')).default
  return {
    run: () => handler(event as never),
    event,
    tx,
    sites,
    sessions,
    transaction,
    lookup,
    membership,
    invalidation,
    uncache,
    audit,
  }
}

describe('owner-authorized blog deactivation', () => {
  it('rejects an anonymous request before reading or writing tenant data', async () => {
    const { run, lookup, transaction } = await setup({ anonymous: true })
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
    expect(lookup).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a regular member without changing the blog or its sessions', async () => {
    const { run, lookup, transaction } = await setup({ member: true })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(lookup).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a foreign tenant through the membership guard before accessing its data', async () => {
    const { run, event, membership, lookup, transaction } = await setup({ foreign: true })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(membership).toHaveBeenCalledWith(event, 'other-site')
    expect(lookup).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('does not let an owner escalate deactivation into permanent deletion', async () => {
    const { run, lookup, transaction } = await setup({ hard: true })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(lookup).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('requires the exact blog confirmation before writing anything', async () => {
    const { run, transaction, invalidation, audit } = await setup({ confirmation: 'wrong-blog' })
    await expect(run()).rejects.toMatchObject({ statusCode: 400 })
    expect(transaction).not.toHaveBeenCalled()
    expect(invalidation).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('deactivates only the confirmed tenant and detaches all its sessions without deleting content', async () => {
    const { run, event, tx, sites, sessions, transaction, lookup, membership, invalidation, uncache, audit } =
      await setup()
    await expect(run()).resolves.toEqual({ success: true })
    expect(membership).toHaveBeenCalledWith(event, 'own-site')
    expect(lookup).toHaveBeenCalledWith({ where: { id: 'own-site' }, select: { domain: true } })
    expect(transaction).toHaveBeenCalledOnce()
    expect(tx.clientSite.update).toHaveBeenCalledWith({
      where: { id: 'own-site' },
      data: { deletedAt: expect.any(Date) },
    })
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { clientSiteId: 'own-site' },
      data: { clientSiteId: null },
    })
    expect(sites[0]?.deletedAt).toBeInstanceOf(Date)
    expect(sites[1]?.deletedAt).toBeNull()
    expect(sessions).toEqual([
      { id: 'owner-session', clientSiteId: null },
      { id: 'member-session', clientSiteId: null },
      { id: 'foreign-session', clientSiteId: 'other-site' },
    ])
    expect(tx.clientSite.delete).not.toHaveBeenCalled()
    expect(tx.article.deleteMany).not.toHaveBeenCalled()
    expect(tx.user.updateMany).not.toHaveBeenCalled()
    expect(tx.domainConnection.deleteMany).not.toHaveBeenCalled()
    expect(invalidation).toHaveBeenCalledWith('own-site')
    expect(uncache).toHaveBeenCalledWith('host:own-blog', 'redirect:own-blog')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_DELETE',
        clientSiteId: 'own-site',
        metadata: { clientSiteId: 'own-site', hard: false },
      }),
    )
  })
})

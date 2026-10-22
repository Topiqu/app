import { createError } from 'h3'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())
let handler: typeof import('../../server/api/clients/[id]/index.patch').default
beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  handler = (await import('../../server/api/clients/[id]/index.patch')).default
})

const setup = async (body: Record<string, unknown>, role = 'admin', plan = 'PRO', missingAuthor = false) => {
  let site = {
    id: 'tenant-1',
    plan,
    name: 'Original site',
    domain: 'old-example.com',
    deletedAt: null,
    autoRelease: false,
    domainVerificationToken: 'private-dns-token',
    apiKey: 'private-api-key',
    socials: [{ platform: 'FACEBOOK', url: 'https://facebook.com/old' }],
    users: [{ id: 'ai-1', username: 'Writer', bio: 'Original bio' }],
  }
  if (missingAuthor) site.users = []
  let linkedinMode = 'PERSONAL'
  const log = vi.fn()
  const db = {
    clientSite: {
      findUnique: vi.fn(async () => structuredClone(site)),
      update: vi.fn(async ({ data }) => {
        site = { ...site, ...data }
        return structuredClone(site)
      }),
    },
    user: {
      update: vi.fn(async ({ data }) => {
        site.users = [{ ...site.users[0]!, ...data }]
        return structuredClone(site.users[0])
      }),
    },
    social: {
      updateMany: vi.fn(async ({ data }) => {
        site.socials = [{ ...site.socials[0]!, ...data }]
        return { count: 1 }
      }),
    },
    linkedinCompany: {
      findFirst: vi.fn(async () => ({ id: 'linkedin-1', mode: linkedinMode })),
      update: vi.fn(async ({ data }) => {
        linkedinMode = data.mode
        return { mode: linkedinMode }
      }),
    },
  }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => ({ id: 'owner-1', role, clientSiteId: 'tenant-1' }))
  vi.stubGlobal('getRouterParam', () => 'tenant-1')
  vi.stubGlobal('requireTenantScope', vi.fn())
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('readBody', async () => structuredClone(body))
  vi.stubGlobal('getIp', () => '203.0.113.4')
  vi.stubGlobal('RELEASE_SCHEDULE_FIELDS', [])
  vi.stubGlobal('invalidateAuthor', vi.fn())
  vi.stubGlobal(
    'ensureAiAuthor',
    vi.fn(async () => {
      const author = { id: 'default-ai', username: 'Original site Editorial Team 0123abcd', bio: '' }
      site.users.push(author)
      return author
    }),
  )
  vi.stubGlobal('isDomainTaken', async () => false)
  vi.stubGlobal('logAction', log)
  return { run: () => handler({} as never), db, log }
}

describe('tenant settings audit', () => {
  it('saves validated footer settings on a paid tenant', async () => {
    const footerSettings = {
      enabled: false,
      text: 'Publication',
      showSocials: true,
      links: [{ label: 'Contact', url: '/contact' }],
    }
    const { run, db } = await setup({ footerSettings })
    await run()
    expect(db.clientSite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ footerSettings }) }),
    )
  })

  it('refuses footer changes on Basic, including a forged plan upgrade', async () => {
    const { run, db } = await setup({ footerSettings: { enabled: false }, plan: 'PRO' }, 'admin', 'BASIC')
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(db.clientSite.update).not.toHaveBeenCalled()
  })

  it('rejects unsafe footer links before writing any settings', async () => {
    const { run, db } = await setup({ footerSettings: { links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] } })
    await expect(run()).rejects.toMatchObject({ statusCode: 400 })
    expect(db.clientSite.update).not.toHaveBeenCalled()
  })

  it('keeps a collision-safe default name when an older site first customizes its author', async () => {
    const { run, db } = await setup(
      { aiUser: { username: 'Original site Editorial Team', bio: 'Our editorial team' } },
      'admin',
      'PRO',
      true,
    )
    await run()
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'default-ai' },
      data: { username: 'Original site Editorial Team 0123abcd', bio: 'Our editorial team' },
    })
  })
  it('records changed persisted values and ignores unchanged and uneditable input', async () => {
    const { run, log } = await setup({
      name: 'New site',
      autoRelease: false,
      apiKey: 'injected-secret',
      stripeCustomerId: 'injected',
    })
    await run()
    expect(log).toHaveBeenCalledWith({
      action: 'CLIENT_SITE_UPDATE',
      userId: 'owner-1',
      clientSiteId: 'tenant-1',
      ip: '203.0.113.4',
      metadata: { updatedFields: ['name'], changes: { name: { before: 'Original site', after: 'New site' } } },
    })
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-|injected/)
  })

  it('includes relation changes without logging arbitrary AI identity request fields', async () => {
    const { run, log } = await setup({
      socials: [{ platform: 'FACEBOOK', url: 'https://facebook.com/new' }],
      linkedinMode: 'PAGE',
      aiUser: { username: 'Writer', bio: 'New bio', password: 'injected-secret' },
    })
    await run()
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_SITE_UPDATE',
        metadata: {
          updatedFields: ['socials', 'aiUser', 'linkedinMode'],
          changes: {
            socials: {
              before: [{ platform: 'FACEBOOK', url: 'https://facebook.com/old' }],
              after: [{ platform: 'FACEBOOK', url: 'https://facebook.com/new' }],
            },
            aiUser: {
              before: { username: 'Writer', bio: 'Original bio' },
              after: { username: 'Writer', bio: 'New bio' },
            },
            linkedinMode: { before: 'PERSONAL', after: 'PAGE' },
          },
        },
      }),
    )
    expect(JSON.stringify(log.mock.calls)).not.toContain('injected-secret')
  })

  it('does not create change events for an unchanged settings save', async () => {
    const { run, log } = await setup({
      name: 'Original site',
      linkedinMode: 'PERSONAL',
      aiUser: { username: 'Writer', bio: 'Original bio' },
    })
    await run()
    expect(log).not.toHaveBeenCalled()
  })

  it('does not attribute an unrelated concurrent branding change to this save', async () => {
    const { run, db, log } = await setup({ name: 'New site' })
    db.clientSite.update.mockImplementation(async () => ({
      ...(await db.clientSite.findUnique()),
      name: 'New site',
      accentColor: '#ffffff',
    }))
    await run()
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_SITE_UPDATE',
        metadata: { updatedFields: ['name'], changes: { name: { before: 'Original site', after: 'New site' } } },
      }),
    )
  })

  it('never logs the generated DNS verification secret during an administrator domain change', async () => {
    const { run, log } = await setup({ domain: 'new-example.com' }, 'superadmin')
    await run()
    const entry = log.mock.calls.find(([entry]) => entry.action === 'CLIENT_SITE_UPDATE')![0]
    expect(entry.metadata.updatedFields).toEqual(['domain'])
    expect(entry.metadata.changes).toEqual({ domain: { before: 'old-example.com', after: 'new-example.com' } })
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/domainVerificationToken|private-/)
  })
})

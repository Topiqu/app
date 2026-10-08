import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { htmlConfigSchema, widgetAllowed, widgetsInputSchema } from '../../shared/utils/widgets'

describe('PUT /api/widgets', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const setup = async (body: unknown, options: { allowed?: boolean; updated?: number } = {}) => {
    const tx = {
      siteWidget: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        updateMany: vi.fn(async () => ({ count: options.updated ?? 1 })),
        create: vi.fn(async () => ({})),
      },
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireTenantScope', async () => {
      if (options.allowed === false) throw createError({ statusCode: 403 })
      return { user: { id: 'u1' }, membership: { clientSiteId: 'site-1' } }
    })
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
    vi.stubGlobal('widgetsInputSchema', widgetsInputSchema)
    vi.stubGlobal('getEnhancedPrisma', async () => ({ $transaction: (run: (t: typeof tx) => unknown) => run(tx) }))
    vi.stubGlobal('listSiteWidgets', vi.fn(async () => []))
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')

    const handler = (await import('../../server/api/widgets/index.put')).default as (event: never) => Promise<unknown>
    return { run: () => handler({} as never), tx }
  }

  const bar = (id?: string, text = 'Hi') => ({ id, kind: 'ANNOUNCEMENT', slot: 'BAR', active: false, languages: [], config: { text } })

  it('needs the tenant settings scope', async () => {
    const { run, tx } = await setup({ widgets: [] }, { allowed: false })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(tx.siteWidget.deleteMany).not.toHaveBeenCalled()
  })

  it('replaces the set in order and pins every write to the caller’s tenant', async () => {
    const { run, tx } = await setup({ widgets: [bar('w1', 'first'), bar(undefined, 'second')] })
    await run()

    expect(tx.siteWidget.deleteMany).toHaveBeenCalledWith({ where: { clientSiteId: 'site-1', id: { notIn: ['w1'] } } })
    expect(tx.siteWidget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1', clientSiteId: 'site-1' }, data: expect.objectContaining({ position: 0 }) }),
    )
    expect(tx.siteWidget.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientSiteId: 'site-1', position: 1 }),
    })
  })

  it('turns an id from another tenant into a new widget of this one', async () => {
    const { run, tx } = await setup({ widgets: [bar('foreign')] }, { updated: 0 })
    await run()
    expect(tx.siteWidget.create).toHaveBeenCalledWith({ data: expect.objectContaining({ clientSiteId: 'site-1' }) })
  })
})

describe('PUT /api/widgets CTA image', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const run = async (assets: { id: string; url: string; deliveryUrl: string | null; defaultAltText: string | null }[]) => {
    const create = vi.fn(async () => ({}))
    const findMany = vi.fn(async () => assets)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'u1' }, membership: { clientSiteId: 'site-1' } }))
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
      parse({
        widgets: [
          {
            kind: 'CTA',
            slot: 'ARTICLE_END',
            active: true,
            languages: [],
            config: {
              title: 'Hi',
              button: { url: '/', label: 'Go' },
              image: { assetId: 'a1', url: 'https://evil.example/x.png', alt: '' },
            },
          },
        ],
      }),
    )
    vi.stubGlobal('widgetsInputSchema', widgetsInputSchema)
    vi.stubGlobal('getEnhancedPrisma', async () => ({
      mediaAsset: { findMany },
      $transaction: (fn: (tx: unknown) => unknown) =>
        fn({ siteWidget: { deleteMany: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), create } }),
    }))
    vi.stubGlobal('listSiteWidgets', vi.fn(async () => []))
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')
    const handler = (await import('../../server/api/widgets/index.put')).default as (event: never) => Promise<unknown>
    return { promise: handler({} as never), create, findMany }
  }

  it('takes the image URL from the tenant’s own asset, not from the body', async () => {
    const { promise, create, findMany } = await run([
      { id: 'a1', url: 'https://cdn.topiqu.com/a1.png', deliveryUrl: null, defaultAltText: 'Team' },
    ])
    await promise
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['a1'] }, clientSiteId: 'site-1', deletedAt: null } }),
    )
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        config: expect.objectContaining({ image: { assetId: 'a1', url: 'https://cdn.topiqu.com/a1.png', alt: 'Team' } }),
      }),
    })
  })

  it('refuses an asset of another tenant', async () => {
    const { promise, create } = await run([])
    await expect(promise).rejects.toMatchObject({ statusCode: 400 })
    expect(create).not.toHaveBeenCalled()
  })
})

describe('GET /widgets/:id frame', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const site = { id: 'site-1', plan: 'PRO', domain: 'blog.example.cz', domainVerified: true }
  const setup = async (options: { host?: string; plan?: string } = {}) => {
    const headers: Record<string, string> = {}
    const findFirst = vi.fn(async () => ({ config: { title: 'Form <x>', html: '<p>hello</p>', height: 200 } }))
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getRouterParam', () => 'w1')
    vi.stubGlobal('tenantByHost', async () => ({ ...site, plan: options.plan ?? 'PRO' }))
    vi.stubGlobal('getRequestHost', () => options.host ?? 'blog.example.cz')
    vi.stubGlobal('widgetAllowed', widgetAllowed)
    vi.stubGlobal('htmlConfigSchema', htmlConfigSchema)
    vi.stubGlobal('prisma', { siteWidget: { findFirst } })
    vi.stubGlobal('setResponseHeaders', (_event: unknown, values: Record<string, string>) => Object.assign(headers, values))
    const handler = (await import('../../server/routes/widgets/[id].get')).default as (event: never) => Promise<string>
    return { run: () => handler({} as never), headers, findFirst }
  }

  it('serves the tenant HTML as a sandboxed document', async () => {
    const { run, headers } = await setup()
    const body = await run()
    expect(headers['content-security-policy']).toMatch(/^sandbox allow-scripts/)
    expect(headers['content-security-policy']).not.toContain('allow-same-origin')
    expect(body).toContain('<p>hello</p>')
    expect(body).toContain('<title>Form &lt;x&gt;</title>')
  })

  it('refuses any host but the tenant’s verified own domain', async () => {
    await expect((await setup({ host: 'acme.topiqu.com' })).run()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses a plan without HTML widgets', async () => {
    const { run, findFirst } = await setup({ plan: 'BASIC' })
    await expect(run()).rejects.toMatchObject({ statusCode: 404 })
    expect(findFirst).not.toHaveBeenCalled()
  })
})

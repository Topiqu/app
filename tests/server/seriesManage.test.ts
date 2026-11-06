import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const stub = (series: Record<string, unknown>, tx?: Record<string, unknown>) => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'series-1')
  vi.stubGlobal('getIp', () => '127.0.0.1')
  vi.stubGlobal('createError', (input: { statusCode: number }) => Object.assign(new Error('failed'), input))
  vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'admin', clientSiteId: 'site-1' } }))
  vi.stubGlobal('invalidateFeed', vi.fn())
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (body: unknown) => unknown) =>
    parse({ name: ' Nový název ', description: null }),
  )
  vi.stubGlobal('getEnhancedPrisma', async () => ({
    articleSeries: series,
    $transaction: (run: (client: unknown) => unknown) => run(tx),
  }))
}

describe('DELETE /api/series/:id', () => {
  const remove = () => import('../../server/api/series/[id].delete').then(({ default: run }) => run({} as never))

  it('detaches the tenant’s articles and deletes the series in one transaction', async () => {
    const updateMany = vi.fn()
    const deleteSeries = vi.fn()
    const findFirst = vi.fn().mockResolvedValue({ id: 'series-1', name: 'Série' })
    stub({ findFirst }, { article: { updateMany }, articleSeries: { delete: deleteSeries } })

    await expect(remove()).resolves.toEqual({ success: true })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'series-1', clientSiteId: 'site-1' } }),
    )
    expect(updateMany).toHaveBeenCalledWith({
      where: { clientSiteId: 'site-1', articleSeriesId: 'series-1' },
      data: { articleSeriesId: null, seriesOrder: 0 },
    })
    expect(deleteSeries).toHaveBeenCalledWith({ where: { id: 'series-1' } })
  })

  it('answers 404 for a series of another tenant without touching anything', async () => {
    const updateMany = vi.fn()
    stub({ findFirst: vi.fn().mockResolvedValue(null) }, { article: { updateMany } })

    await expect(remove()).rejects.toMatchObject({ statusCode: 404 })
    expect(updateMany).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/series/:id', () => {
  const patch = () => import('../../server/api/series/[id].patch').then(({ default: run }) => run({} as never))

  it('saves a trimmed name and a cleared description', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'series-1' })
    stub({ findFirst: vi.fn().mockResolvedValueOnce({ id: 'series-1' }).mockResolvedValueOnce(null), update })

    await patch()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'series-1' }, data: { name: 'Nový název', description: null } }),
    )
  })

  it('refuses a name another series of the tenant already uses', async () => {
    const update = vi.fn()
    stub({ findFirst: vi.fn().mockResolvedValue({ id: 'other' }), update })

    await expect(patch()).rejects.toMatchObject({ statusCode: 409 })
    expect(update).not.toHaveBeenCalled()
  })
})

it('lets a superadmin manage series, as on the neighbouring article models', () => {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/models/article.zmodel'), 'utf8')
  const model = schema.slice(schema.indexOf('model ArticleSeries'))
  expect(model.slice(0, model.indexOf('\n}'))).toContain(
    "@@allow('all', (auth().role == 'admin' && clientSiteId == auth().clientSiteId) || auth().role == 'superadmin')",
  )
})

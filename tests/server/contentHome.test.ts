// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { models } from '../../shared/databaseSchemas'
import { hasExternalContentHome } from '../../shared/utils/seo'
import { TENANT_EDITABLE_CLIENT_SITE_FIELDS, fieldMask } from '../../shared/utils/clientSiteFields'

const tenant = { id: 'site1', language: 'cs', plan: 'PRO', contentHome: 'EXTERNAL' }
const findMany = vi.fn()

beforeEach(() => {
  vi.resetModules()
  findMany.mockReset().mockResolvedValue([])
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('defineSitemapEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('tenantByHost', async () => tenant)
  vi.stubGlobal('hasExternalContentHome', hasExternalContentHome)
  vi.stubGlobal('prisma', { article: { findMany } })
})
afterEach(() => vi.unstubAllGlobals())

describe('one indexable home per article', () => {
  it('keeps an external-home blog out of the sitemap without reading its articles', async () => {
    const { default: urls } = await import('../../server/api/__sitemap__/urls.get')
    expect(await (urls as (event: unknown) => Promise<unknown[]>)({})).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it.each([
    ['RSS', '../../server/routes/rss.xml.get'],
    ['llms.txt', '../../server/routes/llms.txt.get'],
    ['markdown', '../../server/routes/md/[...path].get'],
  ])('answers the %s feed with 404', async (_name, path) => {
    const { default: route } = await import(path)
    await expect((route as (event: unknown) => Promise<unknown>)({})).rejects.toMatchObject({ statusCode: 404 })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('treats only an explicit EXTERNAL home as external', () => {
    expect(hasExternalContentHome({ contentHome: 'EXTERNAL' })).toBe(true)
    expect(hasExternalContentHome({ contentHome: 'TOPIQU' })).toBe(false)
    expect(hasExternalContentHome(null)).toBe(false)
  })

  it('lets the tenant choose the home and rejects other values', () => {
    const schema = models.ClientSiteScalarSchema.pick(fieldMask(TENANT_EDITABLE_CLIENT_SITE_FIELDS)).partial()
    expect(schema.parse({ contentHome: 'EXTERNAL' })).toEqual({ contentHome: 'EXTERNAL' })
    expect(schema.safeParse({ contentHome: 'ELSEWHERE' }).success).toBe(false)
  })
})

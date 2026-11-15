// @vitest-environment node
import { createEvent, getRequestURL } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasExternalContentHome, hasSeoPlan } from '../../shared/utils/seo'
import { articlePath, authorPath, homePath, tagPath } from '../../shared/utils/routes'

const tenant = {
  id: 'site1',
  name: 'Dubina',
  domain: 'dubina-ukazka.topiqu.com',
  description: null,
  language: 'cs',
  plan: 'PRO',
  contentHome: 'TOPIQU',
}
const findMany = vi.fn()

type Init = (context: {
  siteConfig: { push: (input: Record<string, unknown>) => void }
  event: unknown
}) => Promise<void>

const request = () =>
  createEvent(
    {
      url: '/sitemap.xml',
      method: 'GET',
      headers: { host: 'internal:3000', 'x-forwarded-host': tenant.domain },
    } as never,
    {} as never,
  )

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
  vi.stubGlobal('defineSitemapEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRequestURL', getRequestURL)
  vi.stubGlobal('cachedTenantByHost', async () => tenant)
  vi.stubGlobal('tenantByHost', async () => tenant)
  vi.stubGlobal('hasExternalContentHome', hasExternalContentHome)
  vi.stubGlobal('hasSeoPlan', hasSeoPlan)
  vi.stubGlobal('publicArticleWhere', () => ({}))
  vi.stubGlobal('articleModifiedAt', () => new Date('2026-11-14T00:00:00Z'))
  Object.entries({ articlePath, authorPath, homePath, tagPath }).forEach(([name, fn]) => vi.stubGlobal(name, fn))
  vi.stubGlobal('prisma', { article: { findMany } })
  findMany.mockReset().mockResolvedValue([
    {
      slug: 'eudr-a-nabytek',
      language: 'cs',
      user: { username: 'Dubina Studio' },
      tags: [{ tag: { name: 'Dřevo a výroba' } }],
      translations: [],
    },
  ])
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('tenant site URL', () => {
  const pushed = async () => {
    const plugin = (await import('../../server/plugins/siteConfig')).default as unknown as (app: unknown) => void
    let init: Init | undefined
    plugin({ hooks: { hook: (_name: string, callback: Init) => (init = callback) } })
    const push = vi.fn()
    await init!({ siteConfig: { push }, event: request() })
    return push.mock.calls[0]?.[0] as Record<string, unknown> | undefined
  }

  it("resolves a blog's canonical URLs against its own domain in production", async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(await pushed()).toMatchObject({ url: 'https://dubina-ukazka.topiqu.com', name: 'Dubina' })
  })

  it('uses the request origin outside production', async () => {
    expect((await pushed())?.url).toBe('http://dubina-ukazka.topiqu.com')
  })

  it('leaves the platform hosts on the platform URL', async () => {
    vi.stubGlobal('cachedTenantByHost', async () => null)
    expect(await pushed()).toBeUndefined()
  })

  it('hands the sitemap paths it encoded itself, so author and tag names are encoded once', async () => {
    const { default: urls } = await import('../../server/api/__sitemap__/urls.get')
    const entries = await (urls as (event: unknown) => Promise<{ loc: string; _encoded?: boolean }[]>)({})
    expect(entries.every((entry) => entry._encoded)).toBe(true)
    expect(entries.map((entry) => entry.loc)).toEqual(
      expect.arrayContaining(['/cs/autor/Dubina%20Studio', tagPath('cs', 'Dřevo a výroba')]),
    )
    expect(tagPath('cs', 'Dřevo a výroba')).toMatch(/\/D%C5%99evo%20a%20v%C3%BDroba$/)
  })
})

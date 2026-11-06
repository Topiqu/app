// @vitest-environment node
import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasAiPlan } from '../../shared/utils/plans'
import {
  emptyWebsiteValues,
  normalizeWebsiteUrl,
  WEBSITE_IMPORT_CONSENT_VERSION,
} from '../../shared/utils/websiteImport'

const mocks = vi.hoisted(() => ({
  scope: vi.fn(),
  aiPlan: vi.fn(),
  rateLimit: vi.fn(),
  site: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  log: vi.fn(),
  kick: vi.fn(),
  lock: vi.fn(),
}))
const tx = {
  $queryRaw: mocks.lock,
  clientSite: { findFirst: mocks.site },
  websiteImport: { count: mocks.count, create: mocks.create },
}
const transaction = vi.fn(async (run: (client: typeof tx) => unknown) => run(tx))
const user = { id: 'user-1', clientSiteId: 'site-1' }
const site = {
  plan: 'PREMIUM',
  accentColor: '#112233',
  logoUrl: null,
  faviconUrl: null,
  keywords: ['káva'],
  focus: 'Current focus',
  audience: null,
  aiToneOfVoice: null,
  language: 'cs',
  socials: [],
}
let handler: typeof import('../../server/api/website-import/index.post').default
const start = (body: Record<string, unknown> = { url: 'firma.cz', consentVersion: WEBSITE_IMPORT_CONSENT_VERSION }) =>
  handler({ body } as never) as Promise<{ id: string }>
// The handler counts active, then last-day, then last-month imports.
const counts = (active: number, today: number, month: number) =>
  mocks.count.mockResolvedValueOnce(active).mockResolvedValueOnce(today).mockResolvedValueOnce(month)

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('readValidatedBody', async (event: { body: unknown }, parse: (body: unknown) => unknown) =>
    parse(event.body),
  )
  vi.stubGlobal('requireTenantScope', mocks.scope)
  vi.stubGlobal('requireAiPlan', mocks.aiPlan)
  vi.stubGlobal('consumeRateLimit', mocks.rateLimit)
  vi.stubGlobal('normalizeWebsiteUrl', normalizeWebsiteUrl)
  vi.stubGlobal('WEBSITE_IMPORT_CONSENT_VERSION', WEBSITE_IMPORT_CONSENT_VERSION)
  vi.stubGlobal('emptyWebsiteValues', emptyWebsiteValues)
  vi.stubGlobal('hasAiPlan', hasAiPlan)
  vi.stubGlobal('WEBSITE_SITE_SELECT', { focus: true })
  vi.stubGlobal('prisma', { $transaction: transaction })
  vi.stubGlobal('logAction', mocks.log)
  vi.stubGlobal('kickWebsiteImport', mocks.kick)
  vi.stubGlobal('isUniqueViolation', (error: unknown) => (error as { code?: string })?.code === '23505')
  const policy = await import('../../server/utils/websiteImport/policy')
  vi.stubGlobal('WEBSITE_IMPORT_LIMITS', policy.WEBSITE_IMPORT_LIMITS)
  vi.stubGlobal('websiteSnapshot', policy.websiteSnapshot)
  handler = (await import('../../server/api/website-import/index.post')).default
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.clearAllMocks()
  mocks.count.mockReset()
  mocks.scope.mockResolvedValue({ user })
  mocks.aiPlan.mockResolvedValue(undefined)
  mocks.rateLimit.mockResolvedValue(true)
  mocks.site.mockResolvedValue(site)
  mocks.create.mockResolvedValue({ id: 'import-2' })
})

describe('POST /api/website-import', () => {
  it('queues an import for the session tenant with the current settings as baseline', async () => {
    counts(0, 1, 1)
    await expect(start({ url: ' firma.cz ', consentVersion: 1, clientSiteId: 'other-site' })).resolves.toEqual({
      id: 'import-2',
    })
    expect(mocks.scope).toHaveBeenCalledWith(expect.anything(), 'TENANT_SETTINGS')
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        clientSiteId: 'site-1',
        sourceUrl: 'https://firma.cz/',
        createdById: 'user-1',
        consentVersion: 1,
        baseline: expect.objectContaining({ focus: 'Current focus', keywords: ['káva'], accentColor: '#112233' }),
      },
      select: { id: true },
    })
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WEBSITE_IMPORT_QUEUED', metadata: expect.objectContaining({ manual: true }) }),
    )
    expect(mocks.kick).toHaveBeenCalledWith('import-2')
  })

  it('stops at the tenant guards before touching the database', async () => {
    mocks.scope.mockRejectedValueOnce(createError({ statusCode: 403 }))
    await expect(start()).rejects.toMatchObject({ statusCode: 403 })
    mocks.aiPlan.mockRejectedValueOnce(createError({ statusCode: 403 }))
    await expect(start()).rejects.toMatchObject({ statusCode: 403 })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('requires the current processing confirmation', async () => {
    await expect(start({ url: 'firma.cz' })).rejects.toThrow()
    await expect(start({ url: 'firma.cz', consentVersion: WEBSITE_IMPORT_CONSENT_VERSION + 1 })).rejects.toThrow()
    expect(transaction).not.toHaveBeenCalled()
  })

  it.each(['https://127.0.0.1', 'javascript:alert(1)', 'https://user:pass@firma.cz', 'firma.local'])(
    'rejects %s as a source',
    async (url) => {
      await expect(start({ url, consentVersion: 1 })).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'WEBSITE_URL' },
      })
      expect(transaction).not.toHaveBeenCalled()
    },
  )

  it('refuses while another import is queued, running or waiting for review', async () => {
    counts(1, 0, 0)
    await expect(start()).rejects.toMatchObject({ statusCode: 409, data: { code: 'WEBSITE_IMPORT_ACTIVE' } })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('maps a lost race on the active-import index to a conflict', async () => {
    counts(0, 0, 0)
    mocks.create.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }))
    await expect(start()).rejects.toMatchObject({ statusCode: 409, data: { code: 'WEBSITE_IMPORT_ACTIVE' } })
    expect(mocks.kick).not.toHaveBeenCalled()
  })

  it.each([
    ['day', 2, 2],
    ['month', 1, 4],
  ])('caps paid imports per %s', async (_window, today, month) => {
    counts(0, today, month)
    await expect(start()).rejects.toMatchObject({ statusCode: 429, data: { code: 'WEBSITE_IMPORT_LIMIT' } })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('rate-limits repeated attempts per user', async () => {
    mocks.rateLimit.mockResolvedValueOnce(false)
    await expect(start()).rejects.toMatchObject({ statusCode: 429 })
    expect(mocks.rateLimit).toHaveBeenCalledWith('website-import-start:user-1', 10, 3600)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rechecks the plan under the tenant lock', async () => {
    mocks.site.mockResolvedValueOnce({ ...site, plan: 'BASIC' })
    await expect(start()).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.lock).toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
})

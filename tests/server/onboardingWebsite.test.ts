// @vitest-environment node
import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verified: vi.fn(), createSite: vi.fn(), createImport: vi.fn(), kick: vi.fn() }))
vi.mock('../../server/utils/websiteImport', () => ({ kickWebsiteImport: mocks.kick }))
vi.mock('../../server/utils/onboardingTokens', () => ({
  verifyVerifiedToken: mocks.verified,
  landingClientIp: () => '203.0.113.4',
}))
vi.mock('../../server/utils/userLog', () => ({ saveUserWithLogging: async () => ({ id: 'user-1' }) }))
vi.mock('../../server/utils/log', () => ({ logAction: vi.fn() }))
vi.mock('argon2', () => ({ default: { hash: async () => 'hashed-password' } }))

let handler: typeof import('../../server/api/onboarding/checkout.post').default
const transaction = vi.fn(async (run) =>
  run({
    clientSite: { create: mocks.createSite },
    tenantMembership: { create: vi.fn() },
    websiteImport: { create: mocks.createImport },
  }),
)
const signup = (websiteUrl?: string, websiteImportConsentVersion?: number) =>
  handler({
    body: {
      siteName: 'Firma',
      domain: 'firma',
      language: 'cs',
      username: 'Owner',
      email: 'owner@firma.cz',
      password: 'strong-test-password',
      verifiedToken: 'verified',
      websiteUrl,
      websiteImportConsentVersion,
    },
  } as never)

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  vi.stubGlobal('readValidatedBody', async (event: { body: unknown }, parse: (body: unknown) => unknown) =>
    parse(event.body),
  )
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('isDisposableEmail', () => false)
  vi.stubGlobal('isDomainTaken', async () => false)
  vi.stubGlobal('prisma', { user: { findFirst: async () => null }, $transaction: transaction })
  vi.stubGlobal('getIp', () => '203.0.113.4')
  vi.stubGlobal('pepperIp', (ip: string) => ip)
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('inboxOwnsSite', async () => false)
  vi.stubGlobal('creditArticleCredits', vi.fn())
  vi.stubGlobal('syncPlanFeatures', vi.fn())
  vi.stubGlobal('ensureAiAuthor', vi.fn().mockResolvedValue({ id: 'default-ai' }))
  vi.stubGlobal('TENANT_SCOPES', ['TENANT_SETTINGS'])
  vi.stubGlobal('getRequestURL', () => new URL('https://app.topiqu.com/api/onboarding/checkout'))
  handler = (await import('../../server/api/onboarding/checkout.post')).default
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.clearAllMocks()
  mocks.verified.mockReturnValue(true)
  mocks.createSite.mockImplementation(async ({ data }) => ({ id: 'site-1', ...data }))
  mocks.createImport.mockResolvedValue({ id: 'import-1' })
})

describe('company website at signup', () => {
  it.each([
    ['firma.cz/o-nas', 'https://firma.cz/o-nas'],
    [' https://FIRMA.cz ', 'https://firma.cz/'],
    ['http://firma.cz', 'http://firma.cz/'],
    ['', null],
    [undefined, null],
    ['not a website', null],
    ['ftp://firma.cz', null],
    ['javascript:alert(1)', null],
  ])('stores %s as %s without blocking signup', async (raw, expected) => {
    const result = await signup(raw)
    expect(mocks.createSite).toHaveBeenCalledWith({ data: expect.objectContaining({ websiteUrl: expected }) })
    expect(ensureAiAuthor).toHaveBeenCalledWith('site-1', expect.any(Object))
    expect(result.url).toContain('created=true&token=')
  })

  it('keeps verification in front of account and website creation', async () => {
    mocks.verified.mockReturnValue(false)
    await expect(signup('firma.cz')).rejects.toMatchObject({ statusCode: 400 })
    expect(transaction).not.toHaveBeenCalled()
    expect(mocks.createSite).not.toHaveBeenCalled()
  })

  it('queues background preparation only with the current website-processing confirmation', async () => {
    await signup('firma.cz', 1)
    expect(mocks.createImport).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientSiteId: 'site-1',
        sourceUrl: 'https://firma.cz/',
        consentVersion: 1,
        createdById: 'user-1',
      }),
    })
    expect(mocks.kick).toHaveBeenCalledWith('import-1')
  })

  it('keeps older signup clients and unsafe website inputs from triggering analysis', async () => {
    await signup('firma.cz')
    await signup('https://127.0.0.1', 1)
    expect(mocks.createImport).not.toHaveBeenCalled()
    expect(mocks.kick).not.toHaveBeenCalled()
  })
})

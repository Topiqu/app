// @vitest-environment node
import { createError } from 'h3'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LanguageSchema, ThemeSchema } from '../../shared/siteSchemas'
import { normalizeAccentColor, parseBrandGradient } from '../../shared/utils/publicationBranding'

mockNuxtImport('useRuntimeConfig', () => () => ({ public: { baseDomain: 'topiqu.com' } }))

const createSite = vi.fn()
const createMembership = vi.fn()
const updateSession = vi.fn()
const transaction = {
  clientSite: { create: createSite },
  tenantMembership: { create: createMembership },
  session: { update: updateSession },
  user: { update: vi.fn() },
}
const body = {
  name: 'My blog',
  domain: 'my-blog',
  domainType: 'SUBDOMAIN',
  language: 'cs',
  theme: 'indigo',
  accentColor: '#ab1234',
  brandGradient: { colors: ['#ab1234', '#112233'], angle: 120 },
  typographyPreset: 'EDITORIAL',
  tagline: 'A personal publication',
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  vi.stubGlobal('readValidatedBody', async (e: { body: unknown }, parse: (body: unknown) => unknown) => parse(e.body))
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('requireUser', async () => ({ id: 'new-user', role: 'reader', sessionId: 'new-session' }))
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { baseDomain: 'topiqu.com' } }))
  vi.stubGlobal('normalizeDomain', (value: string) => value.toLowerCase())
  vi.stubGlobal('validateSubdomain', () => null)
  vi.stubGlobal('isDomainTaken', async () => false)
  vi.stubGlobal('domainVerificationDefaults', () => ({}))
  vi.stubGlobal('ensureAiAuthor', vi.fn())
  vi.stubGlobal('TENANT_SCOPES', ['TENANT_SETTINGS'])
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal('getIp', () => '203.0.113.8')
  vi.stubGlobal('LanguageSchema', LanguageSchema)
  vi.stubGlobal('ThemeSchema', ThemeSchema)
  vi.stubGlobal('normalizeAccentColor', normalizeAccentColor)
  vi.stubGlobal('parseBrandGradient', parseBrandGradient)
  vi.stubGlobal('prisma', {
    session: { findFirst: vi.fn().mockResolvedValue({ id: 'new-session' }) },
    clientSite: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: async (run: (tx: typeof transaction) => unknown) => run(transaction),
  })
  createSite.mockResolvedValue({ id: 'new-blog', name: body.name, domain: 'my-blog.topiqu.com', language: 'cs' })
})
afterEach(() => vi.unstubAllGlobals())

describe('self-service blog creation', () => {
  it('saves the same appearance fields as landing onboarding, on a free blog owned by the current account', async () => {
    const handler = (await import('../../server/api/tenant/index.post')).default
    await handler({ body } as never)
    expect(createSite).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: 'BASIC',
          theme: 'indigo',
          accentColor: '#AB1234',
          brandGradient: { colors: ['#AB1234', '#112233'], angle: 120 },
          typographyPreset: 'EDITORIAL',
          tagline: 'A personal publication',
        }),
      }),
    )
    expect(createMembership).toHaveBeenCalledWith({
      data: {
        clientSiteId: 'new-blog',
        userId: 'new-user',
        role: 'OWNER',
        scopes: ['TENANT_SETTINGS'],
      },
    })
    expect(updateSession).toHaveBeenCalledWith({ where: { id: 'new-session' }, data: { clientSiteId: 'new-blog' } })
  })

  it.each([
    { accentColor: 'javascript:bad' },
    { brandGradient: { colors: ['#112233'], angle: 120 } },
    { typographyPreset: 'CUSTOM' },
    { tagline: 'x'.repeat(81) },
  ])('rejects invalid appearance before any blog is created: %j', async (invalid) => {
    const handler = (await import('../../server/api/tenant/index.post')).default
    await expect(handler({ body: { ...body, ...invalid } } as never)).rejects.toThrow()
    expect(createSite).not.toHaveBeenCalled()
  })
})

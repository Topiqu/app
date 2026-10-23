// @vitest-environment node

import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { publish, reconcile } = vi.hoisted(() => ({ publish: vi.fn(), reconcile: vi.fn() }))
vi.mock('../../../server/utils/linkedin/publisher', () => ({
  publishDecisionAndExecute: publish,
  reconcilePublishedDraft: reconcile,
}))
const findFirst = vi.fn()
const scope = vi.fn()
let body: unknown = {}
const user = { id: 'actor', role: 'admin', clientSiteId: 'tenant' }
const draft = { id: 'draft', task: { company: { clientSite: { publishToLinkedIn: true } } } }
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  body = {}
  publish.mockResolvedValue({ status: 'needs_review' })
  reconcile.mockResolvedValue({ status: 'published', urn: 'urn:li:share:123' })
  findFirst.mockResolvedValue(draft)
  scope.mockResolvedValue({ user, membership: { clientSiteId: 'tenant' } })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'draft')
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('getEnhancedPrisma', async () => ({ draftPost: { findFirst } }))
  vi.stubGlobal('consumeRateLimit', vi.fn().mockResolvedValue(true))
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
})
afterEach(() => vi.unstubAllGlobals())

const routes = {
  publish: async () => (await import('../../../server/api/publish/[id].post')).default({} as never),
  reconcile: async () => (await import('../../../server/api/publish/[id]/reconcile.post')).default({} as never),
}

describe('LinkedIn publication authorization and reconciliation', () => {
  it.each(['publish', 'reconcile'] as const)('requires active integration access for %s', async (name) => {
    scope.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(routes[name]()).rejects.toMatchObject({ statusCode: 403 })
    expect(findFirst).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
    expect(reconcile).not.toHaveBeenCalled()
  })

  it.each(['publish', 'reconcile'] as const)('does not look up another tenant for %s', async (name) => {
    findFirst.mockResolvedValue(null)
    await expect(routes[name]()).rejects.toMatchObject({ statusCode: 404 })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          task: { deletedAt: null, company: { deletedAt: null, clientSiteId: 'tenant' } },
        }),
      }),
    )
    expect(publish).not.toHaveBeenCalled()
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('returns the uncertain state instead of claiming publication success', async () => {
    await expect(routes.publish()).resolves.toMatchObject({ status: 'needs_review' })
  })

  it('permits local reconciliation while the remote publication channel is disabled', async () => {
    findFirst.mockResolvedValue({ ...draft, task: { company: { clientSite: { publishToLinkedIn: false } } } })
    await expect(routes.publish()).rejects.toMatchObject({ statusCode: 403 })
    await expect(routes.reconcile()).resolves.toMatchObject({ status: 'published' })
    expect(reconcile).toHaveBeenCalledWith('draft', { urn: undefined, clientSiteId: 'tenant', reviewerId: 'actor' })
    expect(publish).not.toHaveBeenCalled()
  })

  it.each([
    { linkedinPostId: 'urn:li:share:123' },
    { confirmedPublished: true },
    { linkedinPostId: 'https://elsewhere.invalid/post', confirmedPublished: true },
    { linkedinPostId: 'urn:li:share:123', confirmedPublished: true, retry: true },
  ])('rejects unconfirmed or unsupported reconciliation input %j', async (invalid) => {
    body = invalid
    await expect(routes.reconcile()).rejects.toThrow()
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('passes only an explicitly confirmed ID and authenticated reviewer to reconciliation', async () => {
    body = { linkedinPostId: 'urn:li:ugcPost:123', confirmedPublished: true }
    await expect(routes.reconcile()).resolves.toMatchObject({ status: 'published' })
    expect(reconcile).toHaveBeenCalledWith('draft', {
      urn: 'urn:li:ugcPost:123',
      clientSiteId: 'tenant',
      reviewerId: 'actor',
    })
  })

  it('maps a failed local finalization to a retryable local error without publishing', async () => {
    reconcile.mockResolvedValue({ status: 'needs_review' })
    await expect(routes.reconcile()).rejects.toMatchObject({ statusCode: 503 })
    expect(publish).not.toHaveBeenCalled()
  })
})

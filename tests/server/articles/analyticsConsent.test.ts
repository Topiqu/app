import type { H3Event } from 'h3'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { articleAnalyticsAllowed } from '../../../server/utils/articleAnalyticsConsent'
import { clearAnalyticsSession, issueAnalyticsSession } from '../../../server/utils/analyticsSession'
import { CONSENT_COOKIE, consentCapabilities, createConsentDecision } from '../../../shared/utils/consent'

const site = { id: 'site-1', plan: 'PRO' }
const eventFor = (decision?: unknown) => {
  const headers = new Map<string, unknown>()
  const cookie = decision === undefined ? '' : `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(decision))}`
  const event = {
    node: {
      req: { headers: { cookie } },
      res: {
        getHeader: (key: string) => headers.get(key),
        setHeader: (key: string, value: unknown) => headers.set(key, value),
        removeHeader: (key: string) => headers.delete(key),
        appendHeader: (key: string, value: unknown) =>
          headers.set(key, [...((headers.get(key) as unknown[]) ?? []), value]),
      },
    },
  } as unknown as H3Event
  return { event, headers }
}
const accepted = () => createConsentDecision(consentCapabilities(site), { analytics: true, marketing: false })

describe('server analytics consent', () => {
  it('rejects missing, malformed, denied and outdated choices without writing cookies', () => {
    for (const decision of [
      undefined,
      'broken',
      { version: 2, analytics: true },
      createConsentDecision(consentCapabilities(site), { analytics: false, marketing: false }),
    ]) {
      const { event, headers } = eventFor(decision)
      expect(articleAnalyticsAllowed(event, site)).toBe(false)
      expect(headers.size).toBe(0)
    }
  })
  it('decodes the cookie written by Nuxt and requires consent to the current services', () => {
    const { event } = eventFor(accepted())
    expect(articleAnalyticsAllowed(event, site)).toBe(true)
    expect(articleAnalyticsAllowed(event, { ...site, allowGtag: true, gtagId: 'G-NEW123' })).toBe(false)
    expect(articleAnalyticsAllowed(event, { ...site, id: 'another-site' })).toBe(false)
  })
  it('issues and clears a separate HttpOnly analytics cookie', () => {
    const { event, headers } = eventFor(accepted())
    expect(issueAnalyticsSession(event)).toMatch(/^[a-f0-9-]{36}$/)
    expect(String(headers.get('set-cookie'))).toContain('analytics_session=')
    expect(String(headers.get('set-cookie'))).toContain('HttpOnly')
    expect(String(headers.get('set-cookie'))).not.toContain('anon_session=')
    clearAnalyticsSession(event)
    expect(String(headers.get('set-cookie'))).toContain('Max-Age=0')
  })
})

describe('article statistics endpoints', () => {
  const article = { id: 'a1', clientSiteId: site.id, shared: 2, clientSite: site }
  const findFirst = vi.fn(),
    findUnique = vi.fn(),
    insertView = vi.fn(),
    update = vi.fn()
  const createShare = vi.fn(),
    session = vi.fn(),
    identity = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    findFirst.mockResolvedValue(article)
    findUnique.mockResolvedValue(article)
    insertView.mockResolvedValue(1)
    update.mockResolvedValue({ shared: 3 })
    createShare.mockResolvedValue({})
    session.mockResolvedValue(null)
    identity.mockReturnValue('server-issued-id')
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', () => 'a1')
    vi.stubGlobal('readBody', async () => ({}))
    vi.stubGlobal('readValidatedBody', async () => ({ platform: 'OTHER', visitorId: 'forged-id' }))
    vi.stubGlobal('useServerI18n', async () => ({ translate: () => 'Error' }))
    vi.stubGlobal('getSessionUser', session)
    vi.stubGlobal('articleAnalyticsAllowed', articleAnalyticsAllowed)
    vi.stubGlobal('issueAnalyticsSession', identity)
    vi.stubGlobal('prisma', {
      article: { findFirst, findUnique, update },
      articleShare: { findFirst: vi.fn().mockResolvedValue(null), create: createShare },
      $executeRaw: insertView,
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    })
  })

  it('does not persist views or create an identity without consent', async () => {
    const handler = (await import('../../../server/api/articles/[id]/view.post')).default
    expect(await handler(eventFor().event)).toEqual({ success: true, counted: false })
    expect(findFirst).not.toHaveBeenCalled()
    expect(insertView).not.toHaveBeenCalled()
    expect(identity).not.toHaveBeenCalled()
  })
  it('does not persist a view if GA4 was added after the stored choice', async () => {
    findFirst.mockResolvedValue({ ...article, clientSite: { ...site, allowGtag: true, gtagId: 'G-NEW123' } })
    const handler = (await import('../../../server/api/articles/[id]/view.post')).default
    expect(await handler(eventFor(accepted()).event)).toEqual({ success: true, counted: false })
    expect(insertView).not.toHaveBeenCalled()
    expect(identity).not.toHaveBeenCalled()
  })
  it('persists an opted-in view with an identity issued by the server', async () => {
    const handler = (await import('../../../server/api/articles/[id]/view.post')).default
    expect(await handler(eventFor(accepted()).event)).toEqual({ success: true, counted: true })
    expect(insertView).toHaveBeenCalledOnce()
    expect(identity).toHaveBeenCalledOnce()
  })
  it('ignores unconsented shares and never trusts a visitor ID from the request', async () => {
    const handler = (await import('../../../server/api/articles/[id]/share.post')).default
    expect(await handler(eventFor().event)).toEqual({ success: true, counted: false })
    expect(findUnique).not.toHaveBeenCalled()
    expect(await handler(eventFor(accepted()).event)).toEqual({ success: true, shared: 3, counted: true })
    expect(createShare).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sessionId: 'server-issued-id' }) }),
    )
  })
})

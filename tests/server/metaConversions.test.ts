// @vitest-environment node
import { createHash } from 'node:crypto'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  metaRegistrationId,
  metaSignals,
  reportMetaSignUp,
  reportMetaSubscribe,
  reportPlatformSignUp,
  sendMetaEvent,
} from '../../server/utils/metaConversions'

const fbp = 'fb.1.1700000000000.123456789'
const fbc = 'fb.1.1700000000000.IwAR-click_id'
const user = { id: 'user-1', email: ' Owner@Example.test ' }
const sha = (value: string) => createHash('sha256').update(value).digest('hex')

const fetch = vi.hoisted(() => vi.fn())
mockNuxtImport('$fetch', () => fetch)
const warn = vi.fn()
const db = {
  user: { update: vi.fn() },
  tenantMembership: { findFirst: vi.fn() },
  billingAccountMember: { findFirst: vi.fn() },
}
let headers: Record<string, string> = {}
let cookies: Record<string, string> = {}

beforeEach(() => {
  vi.stubEnv('META_CAPI_TOKEN', 'capi-token')
  vi.stubEnv('META_PIXEL_ID', 'pixel-1')
  vi.stubEnv('META_TEST_EVENT_CODE', '')
  vi.stubEnv('APP_URL', 'https://app.topiqu.com')
  vi.stubGlobal('$fetch', fetch)
  vi.stubGlobal('logger', { warn })
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('getCookie', (_event: unknown, name: string) => cookies[name])
  vi.stubGlobal('getHeader', (_event: unknown, name: string) => headers[name])
  vi.stubGlobal('getIp', () => '203.0.113.9')
  vi.stubGlobal('landingClientIp', () => '203.0.113.4')
  vi.stubGlobal('getRequestURL', (event: { url: string }) => new URL(event.url))
  vi.stubGlobal('isRootHost', (host: string) => host === 'app.topiqu.com')
  fetch.mockResolvedValue({ events_received: 1 })
  headers = {}
  cookies = {}
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const sent = () => fetch.mock.calls.map(([, options]) => options.body.data[0])
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Meta signals', () => {
  it('exist only with a valid Meta cookie, which the pixel sets after consent', () => {
    expect(metaSignals({ ip: '203.0.113.9', userAgent: 'Browser' })).toBeNull()
    expect(metaSignals({ fbp: 'fb.1.<script>', fbc: 'x' })).toBeNull()
    expect(metaSignals({ fbp, ip: 'not-an-ip', userAgent: 'B'.repeat(900) })).toMatchObject({
      fbp,
      fbc: undefined,
      ip: undefined,
      userAgent: 'B'.repeat(512),
    })
  })

  it('are never collected while the Conversions API is not configured', () => {
    vi.stubEnv('META_CAPI_TOKEN', '')
    expect(metaSignals({ fbp, fbc })).toBeNull()
  })

  it('shares the sign-up event id with the landing pixel', () => {
    expect(metaRegistrationId(user.email)).toBe(`registration-${sha('owner@example.test').slice(0, 40)}`)
  })
})

describe('sendMetaEvent', () => {
  const signals = { at: new Date().toISOString(), fbp, fbc, ip: '203.0.113.9', userAgent: 'Browser' }

  it('sends hashed identity, the event id and the value, with the token in the body', async () => {
    vi.stubEnv('META_TEST_EVENT_CODE', 'TEST123')
    const ok = await sendMetaEvent({
      name: 'Subscribe',
      id: 'subscribe-blog-1',
      user,
      signals,
      url: 'https://app.topiqu.com',
      value: { amount: 49, currency: 'usd' },
    })
    expect(ok).toBe(true)
    const [url, options] = fetch.mock.calls[0]!
    expect(url).toBe('https://graph.facebook.com/v24.0/pixel-1/events')
    expect(url).not.toContain('capi-token')
    expect(options).toMatchObject({ method: 'POST', retry: 0, timeout: 5000 })
    expect(options.body).toMatchObject({ access_token: 'capi-token', test_event_code: 'TEST123' })
    expect(sent()[0]).toMatchObject({
      event_name: 'Subscribe',
      event_id: 'subscribe-blog-1',
      action_source: 'website',
      event_source_url: 'https://app.topiqu.com',
      user_data: {
        em: [sha('owner@example.test')],
        external_id: [sha('user-1')],
        client_ip_address: '203.0.113.9',
        client_user_agent: 'Browser',
        fbp,
        fbc,
      },
      custom_data: { value: 49, currency: 'USD' },
    })
  })

  it('reports an event without a user agent as system generated', async () => {
    await sendMetaEvent({ name: 'Subscribe', id: 'x', user, signals: { at: signals.at, fbp }, url: 'https://x' })
    expect(sent()[0]).toMatchObject({ action_source: 'system_generated' })
    expect(sent()[0]).not.toHaveProperty('custom_data')
  })

  it('swallows a Meta failure and logs it without the token', async () => {
    fetch.mockRejectedValueOnce({ data: { error: { message: 'Invalid parameter' } } })
    expect(await sendMetaEvent({ name: 'StartTrial', id: 'x', user, signals, url: 'https://x' })).toBe(false)
    expect(warn).toHaveBeenCalledWith('meta:event failed', expect.objectContaining({ error: 'Invalid parameter' }))
    expect(JSON.stringify(warn.mock.calls)).not.toContain('capi-token')
  })
})

describe('sign-up', () => {
  it('stores the signals for the first payment and reports registration and trial', async () => {
    const signals = metaSignals({ fbp, userAgent: 'Browser' })
    await reportMetaSignUp(user, signals, { url: 'https://topiqu.com/', trial: true })
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { metaSignals: signals } })
    expect(sent().map(({ event_name, event_id }) => [event_name, event_id])).toEqual([
      ['CompleteRegistration', metaRegistrationId(user.email)],
      ['StartTrial', 'trial-user-1'],
    ])
  })

  it('stores and sends nothing without consent signals', async () => {
    await reportMetaSignUp(user, null, { url: 'https://topiqu.com/', trial: true })
    expect(db.user.update).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('counts a platform registration, never a reader signing up on a tenant blog', async () => {
    cookies._fbp = fbp
    headers['user-agent'] = 'Browser'
    reportPlatformSignUp({ url: 'https://blog.example.com/api/auth/register' } as never, user)
    await flush()
    expect(fetch).not.toHaveBeenCalled()

    reportPlatformSignUp({ url: 'https://app.topiqu.com/api/auth/register' } as never, user)
    await flush()
    expect(sent()).toEqual([
      expect.objectContaining({
        event_name: 'CompleteRegistration',
        event_source_url: 'https://app.topiqu.com/auth',
        user_data: expect.objectContaining({ fbp, client_ip_address: '203.0.113.9', client_user_agent: 'Browser' }),
      }),
    ])
  })
})

describe('first payment', () => {
  const owner = (at: Date) => ({ user: { ...user, metaSignals: { at: at.toISOString(), fbp, userAgent: 'Browser' } } })

  it("reports a blog's first payment for its owner, once per blog", async () => {
    db.tenantMembership.findFirst.mockResolvedValue(owner(new Date()))
    await reportMetaSubscribe({ clientSiteId: 'site-1' }, { amount: 99, currency: 'usd' })
    expect(db.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientSiteId: 'site-1', role: 'OWNER', deletedAt: null } }),
    )
    expect(sent()[0]).toMatchObject({ event_name: 'Subscribe', event_id: 'subscribe-blog-site-1' })
  })

  it("reports an agency's first payment for its first owner", async () => {
    db.billingAccountMember.findFirst.mockResolvedValue(owner(new Date()))
    await reportMetaSubscribe({ accountId: 'agency-1' })
    expect(db.billingAccountMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: 'agency-1', role: 'OWNER', deletedAt: null } }),
    )
    expect(sent()[0]).toMatchObject({ event_id: 'subscribe-agency-agency-1' })
  })

  it('skips an owner without signals or with a sign-up older than 60 days', async () => {
    db.tenantMembership.findFirst.mockResolvedValueOnce({ user: { ...user, metaSignals: null } })
    await reportMetaSubscribe({ clientSiteId: 'site-1' })
    db.tenantMembership.findFirst.mockResolvedValueOnce(owner(new Date(Date.now() - 61 * 86400000)))
    await reportMetaSubscribe({ clientSiteId: 'site-1' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads nothing while the Conversions API is not configured', async () => {
    vi.stubEnv('META_CAPI_TOKEN', '')
    await reportMetaSubscribe({ clientSiteId: 'site-1' })
    expect(db.tenantMembership.findFirst).not.toHaveBeenCalled()
  })
})

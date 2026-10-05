// @vitest-environment node
import { createHmac } from 'node:crypto'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { canonicalEmail } from '../../server/utils/trialInbox'
import { landingClientIp } from '../../server/utils/onboardingTokens'

describe('canonicalEmail', () => {
  it.each([
    ['Jan.Novak+blog@Gmail.com', 'jannovak@gmail.com'],
    ['j.a.n@googlemail.com', 'jan@gmail.com'],
    ['jan+1+2@firma.cz', 'jan@firma.cz'],
    // Dots are significant outside Gmail.
    ['jan.novak@firma.cz', 'jan.novak@firma.cz'],
    ['  JAN@Firma.CZ ', 'jan@firma.cz'],
  ])('%s → %s', (email, expected) => {
    expect(canonicalEmail(email)).toBe(expected)
  })
})

const { secret } = vi.hoisted(() => ({ secret: 'test-secret' }))
mockNuxtImport('useRuntimeConfig', () => () => ({ auth: { secret } }))

describe('landingClientIp', () => {
  const sign = (timestamp: string, ip: string) =>
    createHmac('sha256', secret).update(`${timestamp}.${ip}`).digest('hex')
  const event = (headers: Record<string, string>) => ({ headers }) as any

  beforeAll(() => {
    vi.stubGlobal('getHeader', (e: { headers: Record<string, string> }, name: string) => e.headers[name])
  })
  afterAll(() => vi.unstubAllGlobals())

  const now = () => String(Date.now())

  it('trusts a fresh signature over the forwarded IP', () => {
    const timestamp = now()
    const headers = {
      'x-landing-client-ip': '203.0.113.4',
      'x-landing-timestamp': timestamp,
      'x-landing-sig': sign(timestamp, '203.0.113.4'),
    }
    expect(landingClientIp(event(headers))).toBe('203.0.113.4')
  })

  it.each([
    ['a swapped IP', (t: string) => ({ ip: '198.51.100.9', sig: sign(t, '203.0.113.4') })],
    ['a non-hex signature', () => ({ ip: '203.0.113.4', sig: 'z'.repeat(64) })],
    ['a short signature', () => ({ ip: '203.0.113.4', sig: 'abc' })],
    ['a non-IP value', (t: string) => ({ ip: 'localhost', sig: sign(t, 'localhost') })],
  ])('rejects %s', (_, build) => {
    const timestamp = now()
    const { ip, sig } = build(timestamp)
    const headers = { 'x-landing-client-ip': ip, 'x-landing-timestamp': timestamp, 'x-landing-sig': sig }
    expect(landingClientIp(event(headers))).toBeNull()
  })

  it('rejects a stale or missing timestamp', () => {
    const stale = String(Date.now() - 10 * 60 * 1000)
    const ip = '203.0.113.4'
    expect(
      landingClientIp(
        event({ 'x-landing-client-ip': ip, 'x-landing-timestamp': stale, 'x-landing-sig': sign(stale, ip) }),
      ),
    ).toBeNull()
    expect(landingClientIp(event({ 'x-landing-client-ip': ip, 'x-landing-sig': sign('', ip) }))).toBeNull()
  })
})

describe('repeat inbox notice', () => {
  it('reads the same action onboarding writes', async () => {
    const { readFileSync } = await import('node:fs')
    const checkout = readFileSync('server/api/onboarding/checkout.post.ts', 'utf8')
    const status = readFileSync('server/api/clients/status.get.ts', 'utf8')
    expect(checkout).toContain("action: 'TRIAL_REPEAT_INBOX'")
    expect(status).toContain("action: 'TRIAL_REPEAT_INBOX'")
    expect(readFileSync('app/components/Admin/UpgradeBanner.vue', 'utf8')).toContain('status?.trial.repeatInbox')
  })
})

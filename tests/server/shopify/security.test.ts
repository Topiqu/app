// @vitest-environment node
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeShopifyShop, shopifyOrigin } from '../../../server/utils/shopify/config'
import {
  decryptShopifyToken,
  encryptShopifyToken,
  signShopifyLink,
  verifyShopifyIdToken,
  verifyShopifyLink,
  verifyShopifyWebhookHmac,
} from '../../../server/utils/shopify/security'

const idToken = (claims: Record<string, unknown>, secret = 'test-secret', alg = 'HS256') => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const body = `${encode({ alg, typ: 'JWT' })}.${encode(claims)}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

describe('Shopify sessions, domains, and encrypted credentials', () => {
  beforeEach(() => {
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'test-client')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('SHOPIFY_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
  })
  afterEach(() => vi.unstubAllEnvs())

  it('pins requests to a single valid myshopify.com host', () => {
    expect(normalizeShopifyShop(' Store-42.myshopify.com ')).toBe('store-42.myshopify.com')
    for (const shop of [
      'https://store.myshopify.com',
      'store.myshopify.com/anything',
      'store.myshopify.com.evil.test',
      'store.myshopify.com@evil.test',
      'localhost',
      'store.myshopify.com:443',
      '*.myshopify.com',
      ['store.myshopify.com'],
    ])
      expect(normalizeShopifyShop(shop)).toBeNull()
  })

  it('accepts only a current App Bridge ID token issued to this app for the store it names', () => {
    const now = Math.floor(Date.now() / 1000)
    const claims = {
      iss: 'https://store.myshopify.com/admin',
      dest: 'https://store.myshopify.com',
      aud: 'test-client',
      sub: '42',
      exp: now + 60,
      nbf: now - 1,
    }
    expect(verifyShopifyIdToken(idToken(claims))).toEqual({ shop: 'store.myshopify.com' })
    for (const forged of [
      idToken(claims, 'other-secret'),
      idToken(claims, 'test-secret', 'none'),
      idToken({ ...claims, aud: 'other-app' }),
      idToken({ ...claims, exp: now - 60 }),
      idToken({ ...claims, nbf: now + 60 }),
      idToken({ ...claims, iss: 'https://attacker.myshopify.com/admin' }),
      idToken({ ...claims, iss: 'https://evil.test/admin', dest: 'https://evil.test' }),
      'not-a-token',
      undefined,
    ])
      expect(verifyShopifyIdToken(forged)).toBeNull()
  })

  it('signs installation links that cannot be altered or reused after expiry', () => {
    const id = '0d4c1b0e-6f0a-4a8e-9c1d-2b3a4c5d6e7f'
    const link = signShopifyLink(id)
    expect(verifyShopifyLink(link)).toBe(id)
    const [, expires, signature] = link.split('.')
    expect(verifyShopifyLink(`1d4c1b0e-6f0a-4a8e-9c1d-2b3a4c5d6e7f.${expires}.${signature}`)).toBeNull()
    expect(verifyShopifyLink(`${id}.${Number(expires) + 60}.${signature}`)).toBeNull()
    expect(verifyShopifyLink(`${link}.extra`)).toBeNull()
    vi.useFakeTimers({ now: Date.now() + 16 * 60_000 })
    expect(verifyShopifyLink(link)).toBeNull()
    vi.useRealTimers()
  })

  it('signs the exact raw webhook body, including whitespace', () => {
    const raw = '{ "shop_domain": "store.myshopify.com" }'
    const hmac = createHmac('sha256', 'test-secret').update(raw).digest('base64')
    expect(verifyShopifyWebhookHmac(raw, hmac)).toBe(true)
    expect(verifyShopifyWebhookHmac(JSON.stringify(JSON.parse(raw)), hmac)).toBe(false)
    expect(verifyShopifyWebhookHmac(raw, undefined)).toBe(false)
  })

  it('uses randomized authenticated encryption and detects tampering', () => {
    const a = encryptShopifyToken('private-token')
    const b = encryptShopifyToken('private-token')
    expect(a).not.toBe(b)
    expect(a).not.toContain('private-token')
    expect(decryptShopifyToken(a)).toBe('private-token')
    const parts = a.split('.')
    parts[2] = Buffer.from('tampered').toString('base64url')
    expect(() => decryptShopifyToken(parts.join('.'))).toThrow()
    vi.stubEnv('SHOPIFY_ENCRYPTION_KEY', 'too-short')
    expect(() => encryptShopifyToken('secret')).toThrow(/32 bytes/)
  })

  it('requires HTTPS outside loopback development', () => {
    vi.stubEnv('APP_URL', 'https://app.topiqu.com/some/path')
    expect(shopifyOrigin()).toBe('https://app.topiqu.com')
    vi.stubEnv('APP_URL', 'http://localhost:3000')
    expect(shopifyOrigin()).toBe('http://localhost:3000')
    vi.stubEnv('APP_URL', 'http://app.topiqu.com')
    expect(() => shopifyOrigin()).toThrow(/HTTPS/)
  })
})

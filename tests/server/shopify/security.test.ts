// @vitest-environment node
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeShopifyShop, shopifyOrigin } from '../../../server/utils/shopify/config'
import {
  decryptShopifyToken,
  encryptShopifyToken,
  verifyShopifyOAuthHmac,
  verifyShopifyWebhookHmac,
} from '../../../server/utils/shopify/security'

describe('Shopify OAuth, domains, and encrypted credentials', () => {
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

  it('verifies the OAuth signature over sorted decoded query values', () => {
    const query = { shop: 'store.myshopify.com', timestamp: '123', state: 'state', code: 'code' }
    const message = 'code=code&shop=store.myshopify.com&state=state&timestamp=123'
    const hmac = createHmac('sha256', 'test-secret').update(message).digest('hex')
    expect(verifyShopifyOAuthHmac({ ...query, hmac })).toBe(true)
    expect(verifyShopifyOAuthHmac({ ...query, shop: 'other.myshopify.com', hmac })).toBe(false)
    expect(verifyShopifyOAuthHmac({ ...query, state: ['state', 'forged'], hmac })).toBe(false)
    expect(verifyShopifyOAuthHmac({ ...query, hmac: 'short' })).toBe(false)
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

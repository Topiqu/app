import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto'

import { normalizeShopifyShop, shopifyCredentials } from './config'

const equal = (provided: string, expected: string) => {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const verifyShopifyWebhookHmac = (body: string, signature: string | undefined) =>
  Boolean(
    signature &&
    equal(signature, createHmac('sha256', shopifyCredentials().clientSecret).update(body).digest('base64')),
  )

const CLOCK_SKEW_SECONDS = 5

const decodeJwtPart = (part: string) => {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

const hostname = (value: unknown) => {
  try {
    return typeof value === 'string' ? new URL(value).hostname : null
  } catch {
    return null
  }
}

/** The App Bridge ID token: HS256 signed with the client secret. Returns the shop it was issued for. */
export const verifyShopifyIdToken = (token: string | undefined) => {
  const parts = token?.split('.')
  if (parts?.length !== 3) return null
  const [header, payload, signature] = parts as [string, string, string]
  const { clientId, clientSecret } = shopifyCredentials()
  const expected = createHmac('sha256', clientSecret).update(`${header}.${payload}`).digest('base64url')
  if (!equal(signature, expected) || decodeJwtPart(header)?.alg !== 'HS256') return null
  const claims = decodeJwtPart(payload)
  const now = Date.now() / 1000
  if (!claims || !(Number(claims.exp) > now - CLOCK_SKEW_SECONDS) || !(Number(claims.nbf) <= now + CLOCK_SKEW_SECONDS))
    return null
  const dest = hostname(claims.dest)
  if (claims.aud !== clientId || !dest || hostname(claims.iss) !== dest) return null
  const shop = normalizeShopifyShop(dest)
  return shop ? { shop } : null
}

const LINK_TTL_SECONDS = 15 * 60

const linkSignature = (installationId: string, expires: number) =>
  createHmac('sha256', shopifyCredentials().clientSecret)
    .update(`topiqu-shopify-link:${installationId}:${expires}`)
    .digest('base64url')

// Stateless, so App Home can hand out a fresh link on every load; the claim deletes the installation.
export const signShopifyLink = (installationId: string) => {
  const expires = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS
  return `${installationId}.${expires}.${linkSignature(installationId, expires)}`
}

export const verifyShopifyLink = (value: unknown) => {
  if (typeof value !== 'string') return null
  const [installationId, expires, signature, ...rest] = value.split('.')
  if (rest.length || !installationId || !/^[0-9a-f-]{36}$/.test(installationId) || !/^\d{1,12}$/.test(expires || ''))
    return null
  if (Number(expires) < Date.now() / 1000) return null
  return equal(signature || '', linkSignature(installationId, Number(expires))) ? installationId : null
}

const encryptionKey = () => {
  const key = Buffer.from(process.env.SHOPIFY_ENCRYPTION_KEY || '', 'base64')
  if (key.length !== 32) throw new Error('SHOPIFY_ENCRYPTION_KEY must be 32 bytes encoded as base64')
  return key
}

export const encryptShopifyToken = (plain: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [Buffer.from(iv), cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

export const decryptShopifyToken = (value: string) => {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted Shopify token')
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv!)
  decipher.setAuthTag(tag!)
  return Buffer.concat([decipher.update(encrypted!), decipher.final()]).toString('utf8')
}

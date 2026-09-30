import { createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { shopifyCredentials } from './config'

export const hashShopifyState = (state: string) => createHash('sha256').update(state).digest('hex')

const equal = (provided: string, expected: string) => {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const verifyShopifyOAuthHmac = (query: Record<string, unknown>) => {
  if (typeof query.hmac !== 'string' || !/^[a-f0-9]{64}$/.test(query.hmac)) return false
  if (Object.values(query).some((value) => typeof value !== 'string')) return false
  const message = Object.keys(query)
    .filter((key) => key !== 'hmac')
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&')
  return equal(query.hmac, createHmac('sha256', shopifyCredentials().clientSecret).update(message).digest('hex'))
}

export const verifyShopifyWebhookHmac = (body: string, signature: string | undefined) =>
  Boolean(
    signature &&
    equal(signature, createHmac('sha256', shopifyCredentials().clientSecret).update(body).digest('base64')),
  )

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

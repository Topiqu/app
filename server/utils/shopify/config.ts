// Must equal the scopes released in the Dev Dashboard. `read_products` is granted up front so a
// product sync later needs no second merchant consent.
export const SHOPIFY_SCOPES = 'read_products,read_content,write_content'
export const SHOPIFY_API_VERSION = '2026-07'

export const normalizeShopifyShop = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const shop = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) && shop.length <= 253 ? shop : null
}

export const shopifyOrigin = () => {
  const url = new URL(process.env.APP_URL || 'https://app.topiqu.com')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    throw new Error('APP_URL must use HTTPS')
  return url.origin
}

export const shopifyConfigured = () =>
  Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET && process.env.SHOPIFY_ENCRYPTION_KEY)

export const shopifyCredentials = () => {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Shopify OAuth is not configured')
  return { clientId, clientSecret }
}

export const shopifyEligible = (plan: string) => ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan)

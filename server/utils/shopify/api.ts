import { SHOPIFY_API_VERSION, normalizeShopifyShop, shopifyCredentials } from './config'

export class ShopifyApiError extends Error {
  constructor(
    public code: 'REAUTH_REQUIRED' | 'RETRY' | 'REJECTED' | 'UNCERTAIN',
    message: string,
  ) {
    super(message)
  }
}

export interface ShopifyTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_in: number
  scope: string
}

export const shopifyTokenRequest = async (shop: string, params: Record<string, string>): Promise<ShopifyTokens> => {
  if (!normalizeShopifyShop(shop)) throw new Error('Invalid Shopify shop')
  const { clientId, clientSecret } = shopifyCredentials()
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  })
  if (!response.ok) throw new ShopifyApiError('REAUTH_REQUIRED', 'Shopify authorization must be renewed')
  const tokens = (await response.json()) as ShopifyTokens
  if (
    !tokens.access_token ||
    !tokens.refresh_token ||
    !(tokens.expires_in > 0) ||
    !(tokens.refresh_token_expires_in > 0)
  )
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Shopify did not return expiring offline tokens')
  return tokens
}

export const shopifyGraphql = async <T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
  mutation = false,
): Promise<T> => {
  if (!normalizeShopifyShop(shop)) throw new Error('Invalid Shopify shop')
  let response: Response
  try {
    response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new ShopifyApiError(mutation ? 'UNCERTAIN' : 'RETRY', 'Shopify request could not be completed')
  }
  if (response.status === 401 || response.status === 403)
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Shopify access must be renewed')
  if (response.status === 429) throw new ShopifyApiError('RETRY', 'Shopify rate limit reached')
  if (!response.ok)
    throw new ShopifyApiError(
      mutation && (response.status >= 500 || response.status === 408)
        ? 'UNCERTAIN'
        : response.status < 500
          ? 'REJECTED'
          : 'RETRY',
      'Shopify is temporarily unavailable',
    )
  let result: { data?: T; errors?: { extensions?: { code?: string } }[] }
  try {
    result = await response.json()
  } catch {
    throw new ShopifyApiError(mutation ? 'UNCERTAIN' : 'RETRY', 'Shopify returned an unreadable response')
  }
  if (result.errors?.length) {
    const throttled = result.errors.every((error) => error.extensions?.code === 'THROTTLED')
    const validation = result.errors.every((error) => error.extensions?.code === 'GRAPHQL_VALIDATION_FAILED')
    throw new ShopifyApiError(
      throttled ? 'RETRY' : mutation && !validation ? 'UNCERTAIN' : 'REJECTED',
      'Shopify rejected the API request',
    )
  }
  if (!result.data) throw new ShopifyApiError(mutation ? 'UNCERTAIN' : 'RETRY', 'Shopify returned no result')
  return result.data
}

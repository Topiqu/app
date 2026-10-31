import type { H3Event } from 'h3'

import { decryptShopifyToken } from './security'

const SHOP_QUERY = 'query TopiquShop { shop { id name primaryDomain { url } } }'

/** Exchanges an App Bridge ID token for expiring offline tokens plus the store identity. */
export const exchangeShopifySession = async (shop: string, idToken: string) => {
  const tokens = await shopifyTokenExchange(shop, idToken)
  const grantedScopes = (tokens.scope || '').split(',').map((scope) => scope.trim())
  if (!shopifyGrantsContent(grantedScopes))
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Shopify content access was not granted')
  const { shop: info } = await shopifyGraphql<{ shop: { id: string; name: string; primaryDomain: { url: string } } }>(
    shop,
    tokens.access_token,
    SHOP_QUERY,
  )
  return {
    ...shopifyTokenFields(tokens),
    grantedScopes,
    shopGid: info.id,
    shopName: info.name,
    storefrontUrl: info.primaryDomain.url,
  }
}

/** A pending installation whose tokens can still seed a connection, with a usable Admin API token. */
export const pendingShopifyInstallation = async (shop: string, idToken: string) => {
  const existing = await prisma.shopifyInstallation.findUnique({
    where: { shop },
    select: {
      id: true,
      shopGid: true,
      encryptedAccessToken: true,
      accessTokenExpiresAt: true,
      refreshTokenExpiresAt: true,
      grantedScopes: true,
    },
  })
  // Installation tokens are never refreshed; the open App Home re-exchanges instead.
  if (
    existing &&
    existing.accessTokenExpiresAt.getTime() > Date.now() + 60_000 &&
    existing.refreshTokenExpiresAt.getTime() > Date.now() + 3_600_000 &&
    shopifyGrantsContent(existing.grantedScopes)
  )
    return {
      id: existing.id,
      shopGid: existing.shopGid,
      accessToken: decryptShopifyToken(existing.encryptedAccessToken),
    }
  const fields = await exchangeShopifySession(shop, idToken)
  const saved = await prisma.shopifyInstallation.upsert({
    where: { shop },
    create: { shop, ...fields },
    update: fields,
    select: { id: true },
  })
  return { id: saved.id, shopGid: fields.shopGid, accessToken: decryptShopifyToken(fields.encryptedAccessToken) }
}

/** The installation the browser was sent to link, from the signed httpOnly cookie. */
export const linkedShopifyInstallation = async (event: H3Event) => {
  const installationId = verifyShopifyLink(getCookie(event, SHOPIFY_LINK_COOKIE))
  if (!installationId) return null
  return prisma.shopifyInstallation.findUnique({
    where: { id: installationId },
    select: { id: true, shop: true, shopName: true },
  })
}

export const clearShopifyLink = (event: H3Event) => {
  const secure = shopifyOrigin().startsWith('https:')
  deleteCookie(event, SHOPIFY_LINK_COOKIE, { path: '/api/shopify', secure, sameSite: 'lax' })
  deleteCookie(event, SHOPIFY_INSTALL_COOKIE, { path: '/', secure, sameSite: 'lax' })
}

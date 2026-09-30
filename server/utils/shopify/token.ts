import { randomUUID } from 'node:crypto'

import { decryptShopifyToken, encryptShopifyToken } from './security'
import { ShopifyApiError, shopifyTokenRequest, type ShopifyTokens } from './api'

export const shopifyTokenFields = (tokens: ShopifyTokens) => ({
  encryptedAccessToken: encryptShopifyToken(tokens.access_token),
  encryptedRefreshToken: encryptShopifyToken(tokens.refresh_token),
  accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  refreshTokenExpiresAt: new Date(Date.now() + tokens.refresh_token_expires_in * 1000),
})

export const shopifyAccessToken = async (connectionId: string) => {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { id: connectionId },
    select: {
      shop: true,
      status: true,
      encryptedAccessToken: true,
      encryptedRefreshToken: true,
      accessTokenExpiresAt: true,
      refreshTokenExpiresAt: true,
      refreshLease: true,
      refreshLeaseUntil: true,
    },
  })
  if (!connection || connection.status !== 'CONNECTED' || !connection.encryptedAccessToken)
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Reconnect the Shopify store')
  if (connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000)
    return decryptShopifyToken(connection.encryptedAccessToken)
  if (connection.refreshLease && connection.refreshLeaseUntil && connection.refreshLeaseUntil <= new Date()) {
    await prisma.shopifyConnection.updateMany({
      where: { id: connectionId, refreshLease: connection.refreshLease, status: 'CONNECTED' },
      data: { status: 'REAUTH_REQUIRED', refreshLease: null, refreshLeaseUntil: null },
    })
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Reconnect Shopify after an interrupted token refresh')
  }
  if (
    !connection.encryptedRefreshToken ||
    !connection.refreshTokenExpiresAt ||
    connection.refreshTokenExpiresAt <= new Date()
  ) {
    await prisma.shopifyConnection.updateMany({
      where: { id: connectionId, status: 'CONNECTED' },
      data: { status: 'REAUTH_REQUIRED' },
    })
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Reconnect the Shopify store')
  }
  const lease = randomUUID()
  const acquired = await prisma.shopifyConnection.updateMany({
    where: {
      id: connectionId,
      status: 'CONNECTED',
      encryptedRefreshToken: connection.encryptedRefreshToken,
      OR: [{ refreshLeaseUntil: null }, { refreshLeaseUntil: { lt: new Date() } }],
    },
    data: { refreshLease: lease, refreshLeaseUntil: new Date(Date.now() + 60_000) },
  })
  if (!acquired.count) throw new ShopifyApiError('RETRY', 'Shopify authorization is being refreshed')
  try {
    const tokens = await shopifyTokenRequest(connection.shop, {
      grant_type: 'refresh_token',
      refresh_token: decryptShopifyToken(connection.encryptedRefreshToken),
    })
    const saved = await prisma.shopifyConnection.updateMany({
      where: { id: connectionId, status: 'CONNECTED', refreshLease: lease },
      data: { ...shopifyTokenFields(tokens), refreshLease: null, refreshLeaseUntil: null },
    })
    if (!saved.count) throw new ShopifyApiError('REAUTH_REQUIRED', 'Shopify connection changed during refresh')
    return tokens.access_token
  } catch {
    // A timed-out refresh may have rotated the token. Reusing it would risk revoking the new pair.
    await prisma.shopifyConnection.updateMany({
      where: { id: connectionId, status: 'CONNECTED', refreshLease: lease },
      data: { status: 'REAUTH_REQUIRED', refreshLease: null, refreshLeaseUntil: null },
    })
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Reconnect the Shopify store')
  }
}

import { isLanguage } from '~~/shared/utils/language'
import { SHOPIFY_INSTALL_COOKIE } from '~~/shared/utils/shopify'

import { shopifyTokenFields } from '../../utils/shopify/token'
import { shopifyGraphql, shopifyTokenRequest } from '../../utils/shopify/api'
import { hashShopifyState, verifyShopifyOAuthHmac } from '../../utils/shopify/security'
import { normalizeShopifyShop, shopifyEligible, shopifyOrigin } from '../../utils/shopify/config'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const query = getQuery(event)
  const state = query.state
  const cookie = getCookie(event, 'shopify_oauth_state')
  const shop = normalizeShopifyShop(query.shop)
  if (
    typeof state !== 'string' ||
    !/^[a-f0-9]{64}$/.test(state) ||
    state !== cookie ||
    !shop ||
    !verifyShopifyOAuthHmac(query)
  )
    throw createError({ statusCode: 403, message: 'Invalid Shopify callback' })
  const attempt = await prisma.shopifyOAuthAttempt.findUnique({ where: { tokenHash: hashShopifyState(state) } })
  if (!attempt || attempt.shop !== shop || attempt.expiresAt <= new Date())
    throw createError({ statusCode: 403, message: 'Shopify authorization expired' })
  const user = await prisma.user.findUnique({
    where: { id: attempt.userId },
    select: { id: true, role: true, deletedAt: true },
  })
  const membership = await prisma.tenantMembership.findUnique({
    where: { clientSiteId_userId: { clientSiteId: attempt.clientSiteId, userId: attempt.userId } },
    select: { role: true, scopes: true, deletedAt: true },
  })
  const site = await prisma.clientSite.findUnique({
    where: { id: attempt.clientSiteId },
    select: { domain: true, plan: true, deletedAt: true },
  })
  if (
    !user ||
    user.deletedAt ||
    !['admin', 'superadmin'].includes(user.role) ||
    !site ||
    site.deletedAt ||
    !shopifyEligible(site.plan)
  )
    throw createError({ statusCode: 403, message: 'Shopify connection is no longer allowed' })
  if (
    user.role !== 'superadmin' &&
    (!membership || membership.deletedAt || !hasTenantScope(membership, 'INTEGRATION_CONTROL'))
  )
    throw createError({ statusCode: 403, message: 'Shopify connection is no longer allowed' })
  const claimed = await prisma.shopifyOAuthAttempt.deleteMany({
    where: { id: attempt.id, expiresAt: { gt: new Date() } },
  })
  if (!claimed.count) throw createError({ statusCode: 403, message: 'Shopify authorization already completed' })
  const secure = shopifyOrigin().startsWith('https:')
  deleteCookie(event, 'shopify_oauth_state', { path: '/api/shopify', secure, sameSite: 'lax' })
  deleteCookie(event, SHOPIFY_INSTALL_COOKIE, { path: '/', secure, sameSite: 'lax' })
  const platformOrigin = shopifyOrigin()
  const tenantOrigin =
    ['localhost', '127.0.0.1'].includes(site.domain) && new URL(platformOrigin).protocol === 'http:'
      ? platformOrigin
      : `https://${site.domain}`
  const settingsUrl = `${tenantOrigin}/${isLanguage(attempt.locale) ? attempt.locale : 'en'}/settings?tab=integrations`
  if (query.error || typeof query.code !== 'string') return sendRedirect(event, `${settingsUrl}&shopify=cancelled`)
  try {
    const tokens = await shopifyTokenRequest(shop, { code: query.code, expiring: '1' })
    const scopes = (tokens.scope || '').split(',').map((scope) => scope.trim())
    if (!scopes.includes('write_content')) throw new Error('Shopify content access was not granted')
    const info = await shopifyGraphql<{ shop: { name: string; primaryDomain: { url: string } } }>(
      shop,
      tokens.access_token,
      'query TopiquShop { shop { name primaryDomain { url } } }',
    )
    // The store is globally unique: a reconnect must never move it between projects.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.shopifyConnection.findUnique({
        where: { clientSiteId: attempt.clientSiteId },
        select: { id: true, shop: true },
      })
      if (existing && existing.shop !== shop) throw new Error('Project already has another Shopify store')
      const data = {
        shop,
        shopName: info.shop.name,
        storefrontUrl: info.shop.primaryDomain.url,
        ...shopifyTokenFields(tokens),
        grantedScopes: scopes,
        status: 'CONNECTED' as const,
        refreshLease: null,
        refreshLeaseUntil: null,
      }
      if (existing) await tx.shopifyConnection.update({ where: { id: existing.id }, data })
      else await tx.shopifyConnection.create({ data: { clientSiteId: attempt.clientSiteId, ...data } })
    })
    return sendRedirect(event, `${settingsUrl}&shopify=connected`)
  } catch {
    return sendRedirect(event, `${settingsUrl}&shopify=error`)
  }
})

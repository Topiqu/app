import { randomBytes } from 'node:crypto'
import { isLanguage } from '~~/shared/utils/language'

import { hashShopifyState } from '../../utils/shopify/security'
import { requireShopifyAccess } from '../../utils/shopify/access'
import { normalizeShopifyShop, shopifyConfigured, shopifyOrigin } from '../../utils/shopify/config'

export default defineEventHandler(async (event) => {
  const { user, db, site } = await requireShopifyAccess(event)
  if (!shopifyConfigured()) throw createError({ statusCode: 503, message: 'Shopify is not configured' })
  const body = await readBody(event)
  const shop = normalizeShopifyShop(body?.shop)
  if (!shop) throw createError({ statusCode: 400, message: 'Enter a valid myshopify.com domain' })
  const existing = await db.shopifyConnection.findUnique({ where: { clientSiteId: site.id }, select: { shop: true } })
  if (existing && existing.shop !== shop)
    throw createError({ statusCode: 409, message: 'This project is already linked to another Shopify store' })
  const state = randomBytes(32).toString('hex')
  const locale = getCookie(event, 'i18n_lang')
  // System-only attempts bind the return to the initiating account, including on custom domains.
  await prisma.shopifyOAuthAttempt.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { userId: user.id }] },
  })
  await prisma.shopifyOAuthAttempt.create({
    data: {
      tokenHash: hashShopifyState(state),
      userId: user.id,
      clientSiteId: site.id,
      shop,
      locale: isLanguage(locale) ? locale : 'en',
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  })
  return { url: `${shopifyOrigin()}/api/shopify/authorize?state=${state}` }
})

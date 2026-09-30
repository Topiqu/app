import { isLanguage } from '~~/shared/utils/language'
import { SHOPIFY_INSTALL_COOKIE } from '~~/shared/utils/shopify'

import { verifyShopifyOAuthHmac } from '../../utils/shopify/security'
import { normalizeShopifyShop, shopifyConfigured, shopifyOrigin } from '../../utils/shopify/config'

const MAX_AGE_SECONDS = 3600

// The app URL Shopify opens after an install or a launch from the store admin. The signed shop is
// remembered across sign-in; the connection itself still runs through the tenant-bound OAuth flow.
export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const query = getQuery(event)
  const shop = normalizeShopifyShop(query.shop)
  const age = Math.abs(Date.now() / 1000 - Number(query.timestamp))
  if (!shopifyConfigured() || !shop || !(age <= MAX_AGE_SECONDS) || !verifyShopifyOAuthHmac(query))
    throw createError({ statusCode: 403, message: 'Invalid Shopify install request' })
  const origin = shopifyOrigin()
  setCookie(event, SHOPIFY_INSTALL_COOKIE, shop, {
    secure: origin.startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
  const locale = getCookie(event, 'i18n_lang')
  const language = isLanguage(locale) ? locale : 'en'
  return sendRedirect(event, `${origin}/${language}/settings?tab=integrations&shopify=install`)
})

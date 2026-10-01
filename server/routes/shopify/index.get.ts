import { randomBytes } from 'node:crypto'
import { isLanguage } from '~~/shared/utils/language'

import { renderShopifyAppHome } from '../../utils/shopify/appHome'
import { normalizeShopifyShop, shopifyConfigured, shopifyCredentials, shopifyOrigin } from '../../utils/shopify/config'

// The App Home URL. Outside the Shopify admin there is nothing to show, so it leads to Topiqu.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const shop = normalizeShopifyShop(query.shop)
  if (!shop || !shopifyConfigured()) return sendRedirect(event, shopifyOrigin())
  const locale = typeof query.locale === 'string' ? query.locale.slice(0, 2).toLowerCase() : ''
  const lang = isLanguage(locale) ? locale : 'en'
  const nonce = randomBytes(16).toString('base64')
  const { translate } = await useServerI18n(event, { locale: lang })
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(
    event,
    'Content-Security-Policy',
    `frame-ancestors https://${shop} https://admin.shopify.com; script-src 'nonce-${nonce}' https://cdn.shopify.com; object-src 'none'; base-uri 'none'`,
  )
  return renderShopifyAppHome({
    lang,
    clientId: shopifyCredentials().clientId,
    nonce,
    openUrl: `${shopifyOrigin()}/${lang}/start`,
    t: (key) => translate(key) || key,
  })
})
